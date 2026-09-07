import fs from 'node:fs';
import {loadEnvFile} from 'node:process';
import {Contract,JsonRpcProvider,Wallet,keccak256,parseEther} from 'ethers';
import {proofProvider} from '@gluwa/usc-sdk';
import {validateConfig,compileContracts,saveJson,json} from './deployment-support.mjs';
import {createQuoteSigner} from '../services/underwriter/quote-signer.mjs';
import {priceQuote} from '../services/underwriter/risk-engine.mjs';
loadEnvFile('.env');
const config=validateConfig(process.env);
const manifest=JSON.parse(fs.readFileSync('deployments/testnet.json','utf8'));
const source=new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const target=new JsonRpcProvider(process.env.CREDITCOIN_RPC_URL);
const client=config.wallet.connect(source), payer=config.wallet.connect(target);
const file=process.env.TESTNET_LOOP_FILE ?? 'deployments/testnet-loop.json';
const outcomeArg=process.argv[process.argv.indexOf('--outcome')+1] ?? 'violation';
if(!['success','violation'].includes(outcomeArg)) throw new Error('--outcome must be success or violation');
const state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{deployer:client.address,jobManager:manifest.sepolia.treasuryJobManager,steps:{}};
if(state.deployer!==client.address || state.jobManager!==manifest.sepolia.treasuryJobManager) throw new Error('Loop checkpoint belongs to another deployment');
const checkpoint=()=>saveJson(file,state);
const compiled=compileContracts();
const contract=(name,address,wallet)=>new Contract(address,compiled[`${name}.sol`][name].abi,wallet);
const jobs=contract('TreasuryJobManager',manifest.sepolia.treasuryJobManager,client);
const usdc=contract('MockERC20',manifest.sepolia.mockUsdc,client);
const asset=contract('MockERC20',manifest.creditcoin.mockUsdc,payer);
const vault=contract('CoverageVault',manifest.creditcoin.coverageVault,payer);
const registry=contract('UnderwriterRegistry',manifest.creditcoin.underwriterRegistry,payer);
const policy=contract('PolicyManager',manifest.creditcoin.policyManager,payer);
const adapter=contract('AttestcoinOutcomeAdapter',manifest.creditcoin.attestcoinOutcomeAdapter,payer);
async function send(name,wallet,build) {
 let entry=state.steps[name];
 if(!entry) {
  const request=await build();
  const gasLimit=(await wallet.estimateGas(request))*130n/100n;
  const gasPrice=(await wallet.provider.getFeeData()).gasPrice*2n;
  const network=await wallet.provider.getNetwork();
  if(network.chainId!==11155111n && network.chainId!==102031n) throw new Error('Wrong testnet');
  const raw=await wallet.signTransaction({...request,chainId:network.chainId,nonce:await wallet.provider.getTransactionCount(wallet.address,'pending'),gasLimit,gasPrice,type:0});
  entry={hash:keccak256(raw),chainId:Number(network.chainId)}; state.steps[name]=entry;checkpoint();
  await wallet.provider.broadcastTransaction(raw);console.log(`${name}: ${entry.hash}`);
 }
 const receipt=await wallet.provider.waitForTransaction(entry.hash,1,120000);
 if(!receipt || receipt.status!==1) throw new Error(`Unconfirmed or failed step ${name}; inspect checkpoint before retrying`);
 entry.receipt=receipt.toJSON();checkpoint();return receipt;
}
try {
 if((await source.getNetwork()).chainId!==11155111n || (await target.getNetwork()).chainId!==102031n) throw new Error('Wrong testnet RPC');
 const identity=new Contract(manifest.sepolia.erc8004IdentityRegistry,['function register(string) returns(uint256)','event Registered(uint256 indexed agentId,string agentURI,address indexed owner)','function ownerOf(uint256) view returns(address)'],client);
 if(!state.agentId) {
  const uri='data:application/json,'+encodeURIComponent(JSON.stringify({type:'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',name:'TrustFutures Testnet Treasury Agent',description:'Dedicated testnet-only treasury mandate agent for the TrustFutures public proof loop',active:true,services:[]}));
  const receipt=await send('register-agent',client,()=>identity.register.populateTransaction(uri));
  const event=receipt.logs.map(l=>{try{return identity.interface.parseLog(l)}catch{return null}}).find(e=>e?.name==='Registered');
  if(!event) throw new Error('Missing registry registration event');
  state.agentId=event.args.agentId.toString();checkpoint();
 }
 if((await identity.ownerOf(state.agentId)).toLowerCase()!==client.address.toLowerCase()) throw new Error('Agent owner mismatch');
 const strategies=['conservative','balanced','aggressive'];
 const privateKeys=Object.fromEntries(strategies.map(s=>[s,process.env[`UNDERWRITER_${s.toUpperCase()}_PRIVATE_KEY`]]));
 for(const strategy of strategies) {
  const wallet=new Wallet(privateKeys[strategy],target);
  await send(`fund-${strategy}`,payer,()=>({to:wallet.address,value:parseEther('2')}));
  await send(`mint-${strategy}`,payer,()=>asset.mint.populateTransaction(wallet.address,200_000_000n));
  await send(`approve-${strategy}`,wallet,()=>asset.connect(wallet).approve.populateTransaction(registry.target,200_000_000n));
  await send(`stake-${strategy}`,wallet,()=>registry.connect(wallet).deposit.populateTransaction(200_000_000n));
 }
 await send('approve-vault',payer,()=>asset.approve.populateTransaction(vault.target,800_000_000n));
 await send('deposit-vault',payer,()=>vault.deposit.populateTransaction(800_000_000n));
 await send('approve-job',client,()=>usdc.approve.populateTransaction(jobs.target,100_000_000n));
 if(state.jobId===undefined) {
  const deadline=(await source.getBlock('latest')).timestamp+86400;
  const minOut=outcomeArg==='success'?99_000_000n:200_000_000n;
  const receipt=await send('create-job',client,()=>jobs.createJob.populateTransaction(state.agentId,manifest.sepolia.mockUsdc,manifest.sepolia.mockWeth,manifest.sepolia.mockDex,100_000_000n,minOut,deadline));
  const event=receipt.logs.map(l=>{try{return jobs.interface.parseLog(l)}catch{return null}}).find(e=>e?.name==='JobCreated');
  if(!event) throw new Error('Missing JobCreated');state.jobId=event.args.jobId.toString();state.jobKey=await jobs.jobKey(state.jobId);checkpoint();
 }
 const history={successCount:10,violationCount:0,expiryCount:0,meanSlippageBps:10,meanLatenessBps:0,amountVsP95Bps:10000,deadlineTightnessBps:100,volatilityBps:100};
 state.pricingHistorySource='Synthetic demo baseline; violation increment verified by the public proof below';
 state.baselineHistory=history;checkpoint();
 if(!state.quotes) {
  const sign=createQuoteSigner({chainId:102031,verifyingContract:policy.target,privateKeys});
  state.quotes=[];
  for(const strategy of strategies) state.quotes.push(await sign({...priceQuote(history,{coverageAmount:500_000_000n,strategy}),jobKey:state.jobKey,coverageAmount:500_000_000n,validUntil:(await target.getBlock('latest')).timestamp+86400,nonce:Date.now()}));
  state.quotes=JSON.parse(json(state.quotes));checkpoint();
 }
 const quote=state.quotes.find(q=>q.strategy==='balanced');
 state.policyId=await policy.policyId(quote);checkpoint();
 await send('approve-premium',payer,()=>asset.approve.populateTransaction(policy.target,quote.premiumAmount));
 await send('accept-quote',payer,()=>policy.acceptQuote.populateTransaction(quote,quote.signature));
 const outcomeReceipt=await send('execute-job',client,()=>jobs.execute.populateTransaction(state.jobId));
 if((await jobs.jobs(state.jobId)).outcome!==(outcomeArg==='success'?1n:2n)) throw new Error(`Expected source-chain ${outcomeArg}`);
 if(!state.proof) {
  const builder=new proofProvider.service.ProofBuilder(config.chainKey,process.env.PROOF_BUILDER_URL);
  console.log(`Waiting for Attestcoin to attest Sepolia block ${outcomeReceipt.blockNumber}`);
  await builder.waitUntilHeightAttested(config.chainKey,outcomeReceipt.blockNumber,15000,1200000);
  const result=await builder.getProof(outcomeReceipt.hash);
  if(!result.success || !result.data) throw new Error('Proof builder did not return proof');
  state.proof=result.data;checkpoint();
 }
 const p=state.proof;
 await send('submit-proof',payer,()=>adapter.execute.populateTransaction(0,p.chainKey,p.headerNumber,p.txBytes,p.merkleProof.root,p.merkleProof.siblings,p.continuityProof.lowerEndpointDigest,p.continuityProof.roots));
 if(await adapter.provenOutcome(state.jobKey)!==(outcomeArg==='success'?1n:2n)) throw new Error('Proof did not establish requested outcome');
 if(!state.balanceBeforeSettlement) {state.balanceBeforeSettlement=(await asset.balanceOf(payer.address)).toString();checkpoint();}
 await send('settle-policy',payer,()=>policy.settle.populateTransaction(state.policyId));
 if((await policy.policies(state.policyId)).state!==(outcomeArg==='success'?2n:3n)) throw new Error('Policy did not settle as requested outcome');
 const received=await asset.balanceOf(payer.address)-BigInt(state.balanceBeforeSettlement);
 if(outcomeArg==='violation' && received!==500_000_000n) throw new Error('Coverage payout mismatch');
 state.payout=received.toString();
 state.nextPremium=priceQuote({...history,violationCount:1},{coverageAmount:500_000_000n,strategy:'balanced'}).premiumAmount.toString();
 if(BigInt(state.nextPremium)<=BigInt(quote.premiumAmount)) throw new Error('Expected premium increase after proven failure');
 state.status='complete';state.completedAt=new Date().toISOString();state.attestedEvent={eventId:`testnet-${state.jobKey}`,agentId:state.agentId,mandateCategory:'swap',coverageSize:500000000,deadline:86400,expectedOutput:100000000,actualOutput:outcomeArg==='success'?100000000:90000000,slippageBps:outcomeArg==='success'?0:1000,completionLatencySeconds:0,outcome:outcomeArg,sourceTxHash:state.steps['execute-job'].hash,settlementTxHash:state.steps['settle-policy'].hash,sourceChainId:11155111,settlementChainId:102031,attestedAt:Math.floor(Date.now()/1000),dataSource:'attested-on-chain'};checkpoint();
 manifest.underwriters=Object.fromEntries(state.quotes.map(q=>[q.strategy,q.underwriter]));
 manifest.publicLoop={agentId:state.agentId,jobId:state.jobId,jobKey:state.jobKey,policyId:state.policyId,sourceTransaction:state.steps['execute-job'].hash,proofTransaction:state.steps['submit-proof'].hash,settlementTransaction:state.steps['settle-policy'].hash,payout:state.payout,premiumBefore:quote.premiumAmount,premiumAfter:state.nextPremium,evidence:'deployments/testnet-loop.json'};
 saveJson('deployments/testnet.json',manifest);
 console.log('Public proof and payout loop complete. Evidence: deployments/testnet-loop.json');
} finally {source.destroy();target.destroy();}
