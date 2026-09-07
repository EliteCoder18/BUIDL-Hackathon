import fs from 'node:fs';
import {saveJson} from './deployment-support.mjs';
const manifest=JSON.parse(fs.readFileSync('deployments/testnet.json','utf8'));
if(manifest.sepolia?.chainId!==11155111 || manifest.creditcoin?.chainId!==102031 || !manifest.verification?.roles) throw new Error('Expected a verified testnet manifest');
// This public copy contains only addresses and execution evidence, never wallet keys.
saveJson('apps/web/public/testnet.json',manifest);
if(fs.existsSync('.env')) {
 const key='POLICY_MANAGER_ADDRESS';
 let content=fs.readFileSync('.env','utf8');
 const line=content.split('\n').find(l=>l.startsWith(key+'='));
 content=line===undefined?content+`\n${key}=${manifest.creditcoin.policyManager}\n`:content.replace(line,`${key}=${manifest.creditcoin.policyManager}`);
 fs.writeFileSync('.env',content,{mode:0o600});fs.chmodSync('.env',0o600);
}
console.log('Public manifest copied to /testnet.json; backend policy address configured.');
