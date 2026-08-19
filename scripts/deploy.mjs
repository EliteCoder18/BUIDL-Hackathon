import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const root = path.resolve("contracts/src");
const sources = Object.fromEntries(walk(root).map((file) => [path.relative(root, file), { content: fs.readFileSync(file, "utf8") }]));
sources["@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol"] = { content: fs.readFileSync("node_modules/@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol", "utf8") };
const compiled = JSON.parse(solc.compile(JSON.stringify({ language: "Solidity", sources, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } })));
const errors = (compiled.errors ?? []).filter((entry) => entry.severity === "error");
if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : target.endsWith(".sol") ? [target] : [];
  });
}
function artifact(file, contract) { return compiled.contracts[file][contract]; }
function linkedBytecode(value, libraries = {}) {
  let bytecode = value.evm.bytecode.object;
  for (const [file, references] of Object.entries(value.evm.bytecode.linkReferences)) {
    for (const [name, positions] of Object.entries(references)) {
      const address = libraries[`${file}:${name}`];
      if (!address) throw new Error(`Missing linked library ${file}:${name}`);
      for (const { start, length } of positions) bytecode = `${bytecode.slice(0, start * 2)}${address.slice(2).padStart(length * 2, "0")}${bytecode.slice((start + length) * 2)}`;
    }
  }
  return `0x${bytecode}`;
}
async function deploy(wallet, file, name, args = [], libraries = {}) {
  const value = artifact(file, name);
  const factory = new ContractFactory(value.abi, linkedBytecode(value, libraries), wallet);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

const required = ["DEPLOYER_PRIVATE_KEY", "SEPOLIA_RPC_URL", "CREDITCOIN_RPC_URL", "USC_SEPOLIA_CHAIN_KEY"];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`);
const deployer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY);
const sepoliaWallet = deployer.connect(new JsonRpcProvider(process.env.SEPOLIA_RPC_URL));
const ccWallet = deployer.connect(new JsonRpcProvider(process.env.CREDITCOIN_RPC_URL));

const usdc = await deploy(sepoliaWallet, "MockERC20.sol", "MockERC20", ["Mock USDC", "mUSDC"]);
const weth = await deploy(sepoliaWallet, "MockERC20.sol", "MockERC20", ["Mock WETH", "mWETH"]);
const dex = await deploy(sepoliaWallet, "MockDEX.sol", "MockDEX", [await usdc.getAddress(), await weth.getAddress()]);
const jobs = await deploy(sepoliaWallet, "TreasuryJobManager.sol", "TreasuryJobManager");
await (await usdc.mint(sepoliaWallet.address, 10_000_000_000n)).wait();
await (await weth.mint(await dex.getAddress(), 10_000_000_000n)).wait();

const ccUsdc = await deploy(ccWallet, "MockERC20.sol", "MockERC20", ["Creditcoin Mock USDC", "ccmUSDC"]);
await (await ccUsdc.mint(ccWallet.address, 10_000_000_000n)).wait();
const vault = await deploy(ccWallet, "CoverageVault.sol", "CoverageVault", [await ccUsdc.getAddress()]);
const registry = await deploy(ccWallet, "UnderwriterRegistry.sol", "UnderwriterRegistry", [await ccUsdc.getAddress()]);
const decoder = await deploy(ccWallet, "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol", "EvmV1Decoder");
const libraries = { "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol:EvmV1Decoder": await decoder.getAddress() };
const adapter = await deploy(ccWallet, "AttestcoinOutcomeAdapter.sol", "AttestcoinOutcomeAdapter", [await jobs.getAddress(), 11155111, Number(process.env.USC_SEPOLIA_CHAIN_KEY)], libraries);
const policy = await deploy(ccWallet, "PolicyManager.sol", "PolicyManager", [await ccUsdc.getAddress(), await registry.getAddress(), await vault.getAddress(), await adapter.getAddress(), 1_000_000_000n]);
await (await vault.setManager(await policy.getAddress())).wait();
await (await registry.setManager(await policy.getAddress())).wait();

const manifest = { generatedAt: new Date().toISOString(), sepolia: { mockUsdc: await usdc.getAddress(), mockWeth: await weth.getAddress(), mockDex: await dex.getAddress(), treasuryJobManager: await jobs.getAddress() }, creditcoin: { mockUsdc: await ccUsdc.getAddress(), evmV1Decoder: await decoder.getAddress(), coverageVault: await vault.getAddress(), underwriterRegistry: await registry.getAddress(), attestcoinOutcomeAdapter: await adapter.getAddress(), policyManager: await policy.getAddress() } };
fs.mkdirSync("deployments", { recursive: true });
fs.writeFileSync("deployments/testnet.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
