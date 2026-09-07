import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
import { Wallet, getAddress, ZeroAddress } from 'ethers';
export function validateConfig(env) {
  for (const key of ['DEPLOYER_PRIVATE_KEY','SEPOLIA_RPC_URL','CREDITCOIN_RPC_URL','CREDITCOIN_CHAIN_ID','USC_SEPOLIA_CHAIN_KEY','ERC8004_IDENTITY_REGISTRY_ADDRESS','PROOF_BUILDER_URL']) {
    if (!env[key]?.trim()) throw new Error(`Missing ${key}`);
  }
  if (env.CREDITCOIN_CHAIN_ID !== '102031') throw new Error('Only CC3 Testnet chain ID 102031 is allowed');
  for (const key of ['SEPOLIA_RPC_URL','CREDITCOIN_RPC_URL','PROOF_BUILDER_URL']) {
    let url; try { url = new URL(env[key]); } catch { throw new Error(`Invalid ${key}`); }
    if (url.protocol !== 'https:') throw new Error(`${key} must use HTTPS`);
  }
  let wallet; try { wallet = new Wallet(env.DEPLOYER_PRIVATE_KEY); } catch { throw new Error('Invalid DEPLOYER_PRIVATE_KEY'); }
  let identity; try { identity = getAddress(env.ERC8004_IDENTITY_REGISTRY_ADDRESS); } catch { throw new Error('Invalid ERC8004_IDENTITY_REGISTRY_ADDRESS'); }
  if (identity === ZeroAddress) throw new Error('ERC8004 identity registry cannot be zero');
  const chainKey = Number(env.USC_SEPOLIA_CHAIN_KEY);
  if (!Number.isSafeInteger(chainKey) || chainKey < 0) throw new Error('Invalid USC chain key');
  const seen = new Set([wallet.address]);
  for (const key of ['UNDERWRITER_CONSERVATIVE_PRIVATE_KEY','UNDERWRITER_BALANCED_PRIVATE_KEY','UNDERWRITER_AGGRESSIVE_PRIVATE_KEY']) {
    if (!env[key]) continue;
    let address; try { address = new Wallet(env[key]).address; } catch { throw new Error(`Invalid ${key}`); }
    if (seen.has(address)) throw new Error('Use separate deployer and underwriting wallets');
    seen.add(address);
  }
  return { wallet, identity, chainKey };
}
export function compileContracts() {
  const root = path.resolve('contracts/src');
  const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory()?walk(path.join(dir,e.name)):e.name.endsWith('.sol')?[path.join(dir,e.name)]:[]);
  const sources = Object.fromEntries(walk(root).map(f=>[path.relative(root,f),{content:fs.readFileSync(f,'utf8')}]));
  const decoder = '@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol';
  sources[decoder] = {content:fs.readFileSync(`node_modules/${decoder}`,'utf8')};
  const input = {language:'Solidity',sources,settings:{evmVersion:'shanghai',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode','evm.deployedBytecode']}}}};
  const result = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (result.errors??[]).filter(e=>e.severity==='error');
  if(errors.length) throw new Error(errors.map(e=>e.formattedMessage).join('\n'));
  return result.contracts;
}
export function linkedBytecode(artifact, libraries={}) {
  let code=artifact.evm.bytecode.object;
  for(const [file,refs] of Object.entries(artifact.evm.bytecode.linkReferences??{})) for(const [name,positions] of Object.entries(refs)) {
    const address=libraries[`${file}:${name}`];
    if(!address) throw new Error(`Missing linked library ${file}:${name}`);
    for(const {start,length} of positions) code=code.slice(0,start*2)+getAddress(address).slice(2).padStart(length*2,'0')+code.slice((start+length)*2);
  }
  if(!/^[a-f0-9]+$/i.test(code)) throw new Error('Invalid or unlinked creation bytecode');
  return `0x${code}`;
}
export const json = value => JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2);
export function saveJson(file, value) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(`${file}.tmp`,`${json(value)}\n`);
  fs.renameSync(`${file}.tmp`,file);
}
