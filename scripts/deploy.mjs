import fs from "node:fs";
import { loadEnvFile } from "node:process";
import { Contract, ContractFactory, JsonRpcProvider, keccak256, toUtf8Bytes, formatEther } from "ethers";
import { chainInfo } from "@gluwa/usc-sdk";
import { validateConfig, compileContracts, linkedBytecode, saveJson, json } from "./deployment-support.mjs";

if(fs.existsSync('.env')) loadEnvFile('.env');
const config = validateConfig(process.env);
const deployer = config.wallet;
const compiled = compileContracts();
const sepoliaWallet = deployer.connect(new JsonRpcProvider(process.env.SEPOLIA_RPC_URL));
const ccWallet = deployer.connect(new JsonRpcProvider(process.env.CREDITCOIN_RPC_URL));
const journalFile = 'deployments/testnet-progress.json';
const fingerprint = keccak256(toUtf8Bytes(json({compiled,identity:config.identity,chainKey:config.chainKey,deployer:deployer.address})));
const journal = fs.existsSync(journalFile) ? JSON.parse(fs.readFileSync(journalFile,'utf8')) : {fingerprint,steps:{}};
if(journal.fingerprint !== fingerprint) throw new Error('Deployment inputs changed; use the original inputs to resume this journal');
const networkFor = wallet => wallet===sepoliaWallet ? {id:11155111, name:'sepolia',explorer:'https://sepolia.etherscan.io'} : {id:102031,name:'creditcoin',explorer:'https://creditcoin-testnet.blockscout.com'};
async function transact(wallet,name,build,metadata={}) {
  const network=networkFor(wallet), key=`${network.name}:${name}`;
  let entry=journal.steps[key];
  const resuming=Boolean(entry);
  if(!entry) {
    if(Number((await wallet.provider.getNetwork()).chainId)!==network.id) throw new Error('RPC chain changed');
    const request=await build();
    const estimate=await wallet.estimateGas(request);
    const gasLimit=estimate*130n/100n;
    const fee=await wallet.provider.getFeeData();
    const gasPrice=fee.gasPrice ? fee.gasPrice*2n : null;
    if(!gasPrice) throw new Error('RPC did not provide gas price');
    const cost=gasLimit*gasPrice;
    if(await wallet.provider.getBalance(wallet.address)<cost) throw new Error(`Insufficient ${network.name} balance for ${name}`);
    console.log(`${key}: estimated gas ${estimate}, limit ${gasLimit}, maximum cost ${formatEther(cost)}`);
    const nonce=await wallet.provider.getTransactionCount(wallet.address,'pending');
    const raw=await wallet.signTransaction({...request,chainId:network.id,nonce,gasLimit,gasPrice,type:0});
    entry={...metadata,hash:keccak256(raw),nonce,gasEstimate:estimate.toString(),gasLimit:gasLimit.toString(),gasPrice:gasPrice.toString(),explorer:`${network.explorer}/tx/${keccak256(raw)}`,status:'prepared'};
    journal.steps[key]=entry;
    saveJson(journalFile,journal);
    await wallet.provider.broadcastTransaction(raw);
    entry.status='broadcast'; saveJson(journalFile,journal);
  }
  if(resuming && process.argv.includes('--replace-pending') && !await wallet.provider.getTransactionReceipt(entry.hash)) {
    const latestNonce=await wallet.provider.getTransactionCount(wallet.address,'latest');
    if(latestNonce>entry.nonce) throw new Error(`Nonce already consumed for ${key}; inspect before replacing`);
    const request=await build();
    const current=(await wallet.provider.getFeeData()).gasPrice;
    const gasPrice=current*2n>BigInt(entry.gasPrice)*2n?current*2n:BigInt(entry.gasPrice)*2n;
    const gasLimit=BigInt(entry.gasLimit);
    if(await wallet.provider.getBalance(wallet.address)<gasPrice*gasLimit) throw new Error('Insufficient replacement gas');
    const raw=await wallet.signTransaction({...request,chainId:network.id,nonce:entry.nonce,gasLimit,gasPrice,type:0});
    entry.previousHashes=[...(entry.previousHashes??[]),entry.hash];
    entry.hash=keccak256(raw);entry.gasPrice=gasPrice.toString();entry.explorer=`${network.explorer}/tx/${entry.hash}`;
    entry.status='prepared';saveJson(journalFile,journal);
    await wallet.provider.broadcastTransaction(raw);entry.status='broadcast';saveJson(journalFile,journal);
    console.log(`${key}: replaced at the same nonce ${entry.nonce}`);
  }
  const receipt=await wallet.provider.waitForTransaction(entry.hash,1,120000);
  if(!receipt) throw new Error(`Unconfirmed ${key}; inspect ${entry.explorer} before resuming. Do not delete the journal.`);
  if(receipt.status!==1) throw new Error(`Reverted ${key}: ${entry.explorer}`);
  entry.receipt=receipt.toJSON(); entry.status='confirmed'; saveJson(journalFile,journal);
  return receipt;
}
async function deploy(wallet,file,name,args=[],libraries={}) {
  const artifact=compiled[file][name];
  const bytecode=linkedBytecode(artifact,libraries);
  // MockERC20 occurs twice on Sepolia: include its constructor name in the journal key.
  const label=name==='MockERC20'?`${name}-${args[0]}`:name;
  const receipt=await transact(wallet,label,()=>new ContractFactory(artifact.abi,bytecode,wallet).getDeployTransaction(...args),{contract:name,file,constructorArguments:JSON.parse(json(args)),libraries,creationBytecodeHash:keccak256(bytecode)});
  if(!receipt.contractAddress) throw new Error(`Missing deployed address: ${label}`);
  const code=await wallet.provider.getCode(receipt.contractAddress);
  if(code==='0x') throw new Error(`No deployed code: ${label}`);
  const entry=journal.steps[`${networkFor(wallet).name}:${label}`];
  if(entry.runtimeCodeHash && entry.runtimeCodeHash!==keccak256(code)) throw new Error(`Deployed code changed: ${label}`);
  entry.address=receipt.contractAddress; entry.runtimeCodeHash=keccak256(code); saveJson(journalFile,journal);
  return new Contract(receipt.contractAddress,artifact.abi,wallet);
}
try {
for(const wallet of [sepoliaWallet,ccWallet]) {
  const expected=networkFor(wallet);
  if(Number((await wallet.provider.getNetwork()).chainId)!==expected.id) throw new Error(`Wrong ${expected.name} chain ID; expected ${expected.id}`);
  const balance=await wallet.provider.getBalance(wallet.address);
  if(balance===0n) throw new Error(`Unfunded ${expected.name} deployer`);
  console.log(`${expected.name}: chain ${expected.id}; deployer ${wallet.address}; balance ${formatEther(balance)}`);
}
if(await sepoliaWallet.provider.getCode(config.identity)==='0x') throw new Error('Official ERC8004 registry has no code on Sepolia');
const supported=await new chainInfo.PrecompileChainInfoProvider(ccWallet.provider).getSupportedChains();
if(!supported.some(c=>Number(c.chainId)===11155111 && Number(c.chainKey)===config.chainKey)) throw new Error('USC chain key does not identify Sepolia');
const proofHealth=await fetch(new URL(`/api/v1/attested-height/${config.chainKey}`,process.env.PROOF_BUILDER_URL),{signal:AbortSignal.timeout(15000)});
if(!proofHealth.ok) throw new Error(`Proof builder unavailable: HTTP ${proofHealth.status}`);
console.log('Configuration, networks, registry bytecode and proof service preflight passed.');
if(process.argv.includes('--preflight')) process.exit(0);
const usdc = await deploy(sepoliaWallet, "MockERC20.sol", "MockERC20", ["Mock USDC", "mUSDC"]);
const weth = await deploy(sepoliaWallet, "MockERC20.sol", "MockERC20", ["Mock WETH", "mWETH"]);
const dex = await deploy(sepoliaWallet, "MockDEX.sol", "MockDEX", [await usdc.getAddress(), await weth.getAddress()]);
const mockDexExecutor = await deploy(sepoliaWallet, "MockDexExecutor.sol", "MockDexExecutor", [await dex.getAddress()]);
const identityRegistry = process.env.ERC8004_IDENTITY_REGISTRY_ADDRESS;
if (!identityRegistry) throw new Error("Missing ERC8004_IDENTITY_REGISTRY_ADDRESS (official Sepolia registry)");
const jobs = await deploy(sepoliaWallet, "TreasuryJobManager.sol", "TreasuryJobManager", [identityRegistry]);
await transact(sepoliaWallet, "approve-mock-executor", () => jobs.setExecutorApproval.populateTransaction(mockDexExecutor.target, true));
await transact(sepoliaWallet, "seed-usdc", () => usdc.mint.populateTransaction(sepoliaWallet.address, 10_000_000_000n));
await transact(sepoliaWallet, "seed-dex", () => weth.mint.populateTransaction(dex.target, 10_000_000_000n));

const ccUsdc = await deploy(ccWallet, "MockERC20.sol", "MockERC20", ["Creditcoin Mock USDC", "ccmUSDC"]);
await transact(ccWallet, "seed-usdc", () => ccUsdc.mint.populateTransaction(ccWallet.address, 10_000_000_000n));
const vault = await deploy(ccWallet, "CoverageVault.sol", "CoverageVault", [await ccUsdc.getAddress()]);
const registry = await deploy(ccWallet, "UnderwriterRegistry.sol", "UnderwriterRegistry", [await ccUsdc.getAddress()]);
const decoder = await deploy(ccWallet, "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol", "EvmV1Decoder");
const libraries = { "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol:EvmV1Decoder": await decoder.getAddress() };
const adapter = await deploy(ccWallet, "AttestcoinOutcomeAdapter.sol", "AttestcoinOutcomeAdapter", [await jobs.getAddress(), 11155111, Number(process.env.USC_SEPOLIA_CHAIN_KEY)], libraries);
const policy = await deploy(ccWallet, "PolicyManager.sol", "PolicyManager", [await ccUsdc.getAddress(), await registry.getAddress(), await vault.getAddress(), await adapter.getAddress(), 1_000_000_000n]);
await transact(ccWallet, "vault-manager", () => vault.setManager.populateTransaction(policy.target));
await transact(ccWallet, "registry-manager", () => registry.setManager.populateTransaction(policy.target));


const same = (a,b) => a.toLowerCase() === b.toLowerCase();
for (const [label,actual,expected] of [
  ['vault manager', await vault.manager(), policy.target],
  ['registry manager', await registry.manager(), policy.target],
  ['vault owner', await vault.owner(), deployer.address],
  ['registry owner', await registry.owner(), deployer.address],
  ['identity registry', await jobs.identityRegistry(), config.identity],
  ['adapter source', await adapter.sourceJobManager(), jobs.target],
  ['policy vault', await policy.vault(), vault.target],
  ['policy registry', await policy.registry(), registry.target],
  ['policy adapter', await policy.outcomeAdapter(), adapter.target],
  ['policy asset', await policy.asset(), ccUsdc.target],
]) if (!same(actual,expected)) throw new Error(`Post-deployment mismatch: ${label}`);
if (!await jobs.approvedExecutors(mockDexExecutor.target)) throw new Error('Post-deployment mismatch: mock executor approval');
if (await adapter.sourceChainId() !== 11155111n || await adapter.sourceChainKey() !== BigInt(config.chainKey)) throw new Error('Adapter chain mismatch');
const manifest = {
  generatedAt: new Date().toISOString(), deployer: deployer.address,
  sepolia: { chainId:11155111, explorer:'https://sepolia.etherscan.io', erc8004IdentityRegistry:config.identity, mockUsdc:usdc.target, mockWeth:weth.target, mockDex:dex.target, mockDexExecutor:mockDexExecutor.target, treasuryJobManager:jobs.target },
  creditcoin: { chainId:102031, explorer:'https://creditcoin-testnet.blockscout.com', mockUsdc:ccUsdc.target, evmV1Decoder:decoder.target, coverageVault:vault.target, underwriterRegistry:registry.target, attestcoinOutcomeAdapter:adapter.target, policyManager:policy.target },
  transactions: journal.steps, verification: {roles:true, bytecode:true, sourceChainKey:config.chainKey, checkedAt:new Date().toISOString()},
};
for (const network of [manifest.sepolia,manifest.creditcoin]) network.contractLinks = Object.fromEntries(Object.entries(network).filter(([,v])=>typeof v==='string' && /^0x[0-9a-f]{40}$/i.test(v)).map(([k,v])=>[k,`${network.explorer}/address/${v}`]));
saveJson('deployments/testnet.json',manifest);
console.log('Deployment and role checks passed. Manifest: deployments/testnet.json');
} finally { sepoliaWallet.provider.destroy(); ccWallet.provider.destroy(); }
