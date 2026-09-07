import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Wallet } from 'ethers';
const modulePath = '../scripts/deployment-support.mjs';
test('deployment refuses mainnet and missing registry before RPC access', async () => {
  assert.ok(fs.existsSync(new URL(modulePath, import.meta.url)), 'deployment validation module must exist');
  const { validateConfig } = await import(modulePath);
  const env = { DEPLOYER_PRIVATE_KEY: Wallet.createRandom().privateKey, SEPOLIA_RPC_URL: 'https://example.org', CREDITCOIN_RPC_URL: 'https://example.org', CREDITCOIN_CHAIN_ID: '102030', USC_SEPOLIA_CHAIN_KEY: '1', PROOF_BUILDER_URL: 'https://example.org', ERC8004_IDENTITY_REGISTRY_ADDRESS: Wallet.createRandom().address };
  assert.throws(() => validateConfig(env), /102031/);
  env.CREDITCOIN_CHAIN_ID = '102031';
  delete env.ERC8004_IDENTITY_REGISTRY_ADDRESS;
  assert.throws(() => validateConfig(env), /ERC8004/);
});
test('deployment rejects deployer reuse as underwriter and unsafe chain key', async () => {
  assert.ok(fs.existsSync(new URL(modulePath, import.meta.url)), 'deployment validation module must exist');
  const { validateConfig } = await import(modulePath);
  const env = { DEPLOYER_PRIVATE_KEY: Wallet.createRandom().privateKey, SEPOLIA_RPC_URL: 'https://example.org', CREDITCOIN_RPC_URL: 'https://example.org', CREDITCOIN_CHAIN_ID: '102031', USC_SEPOLIA_CHAIN_KEY: '1', PROOF_BUILDER_URL: 'https://example.org', ERC8004_IDENTITY_REGISTRY_ADDRESS: Wallet.createRandom().address };
  env.UNDERWRITER_BALANCED_PRIVATE_KEY = env.DEPLOYER_PRIVATE_KEY;
  assert.throws(() => validateConfig(env), /separate/);
  delete env.UNDERWRITER_BALANCED_PRIVATE_KEY;
  env.USC_SEPOLIA_CHAIN_KEY = '1.5';
  assert.throws(() => validateConfig(env), /chain key/);
});
test('compiler returns fully linked adapter creation bytecode', async () => {
  assert.ok(fs.existsSync(new URL(modulePath, import.meta.url)), 'deployment compiler module must exist');
  const { compileContracts, linkedBytecode } = await import(modulePath);
  const contracts = compileContracts();
  const adapter = contracts['AttestcoinOutcomeAdapter.sol'].AttestcoinOutcomeAdapter;
  assert.throws(() => linkedBytecode(adapter), /Missing linked library/);
  const bytecode = linkedBytecode(adapter, { '@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol:EvmV1Decoder': Wallet.createRandom().address });
  assert.match(bytecode, /^0x[0-9a-f]+$/i);
  assert.ok(bytecode.length > 100);
});
