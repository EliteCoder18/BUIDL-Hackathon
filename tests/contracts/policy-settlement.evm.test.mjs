import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import ganache from "ganache";
import { BrowserProvider, ContractFactory, keccak256, toUtf8Bytes, Wallet } from "ethers";

const root = path.resolve("contracts/src");
const sources = Object.fromEntries(fs.readdirSync(root).filter((name) => name.endsWith(".sol")).map((file) => [file, { content: fs.readFileSync(path.join(root, file), "utf8") }]));
sources["@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol"] = { content: fs.readFileSync("node_modules/@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol", "utf8") };
const compiled = JSON.parse(solc.compile(JSON.stringify({ language: "Solidity", sources, settings: { evmVersion: "shanghai", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } })));
const errors = (compiled.errors ?? []).filter((entry) => entry.severity === "error");
if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));

async function deploy(signer, file, name, args = []) {
  const artifact = compiled.contracts[file][name];
  const contract = await new ContractFactory(artifact.abi, `0x${artifact.evm.bytecode.object}`, signer).deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

test("PolicyManager verifies EIP-712 quote and pays failure junior-first", async () => {
  const ganacheProvider = ganache.provider({ logging: { quiet: true } });
  const provider = new BrowserProvider(ganacheProvider);
  const client = await provider.getSigner(0);
  const underwriter = await provider.getSigner(1);
  const lp = await provider.getSigner(2);
  const asset = await deploy(client, "MockERC20.sol", "MockERC20", ["Mock USDC", "mUSDC"]);
  const registry = await deploy(client, "UnderwriterRegistry.sol", "UnderwriterRegistry", [await asset.getAddress()]);
  const vault = await deploy(client, "CoverageVault.sol", "CoverageVault", [await asset.getAddress()]);
  const adapter = await deploy(client, "MockOutcomeAdapter.sol", "MockOutcomeAdapter");
  const policy = await deploy(client, "PolicyManager.sol", "PolicyManager", [await asset.getAddress(), await registry.getAddress(), await vault.getAddress(), await adapter.getAddress(), 1_000_000n]);
  await (await registry.setManager(await policy.getAddress())).wait();
  await (await vault.setManager(await policy.getAddress())).wait();
  await (await asset.mint(await underwriter.getAddress(), 20_000n)).wait();
  await (await asset.mint(await lp.getAddress(), 80_000n)).wait();
  await (await asset.mint(await client.getAddress(), 10_000n)).wait();
  await (await asset.connect(underwriter).approve(await registry.getAddress(), 20_000n)).wait();
  await (await registry.connect(underwriter).deposit(20_000n)).wait();
  await (await asset.connect(lp).approve(await vault.getAddress(), 80_000n)).wait();
  await (await vault.connect(lp).deposit(80_000n)).wait();
  await (await asset.connect(client).approve(await policy.getAddress(), 10_000n)).wait();

  const jobKey = keccak256(toUtf8Bytes("attested-job-449"));
  const validUntil = BigInt((await provider.getBlock("latest")).timestamp + 3600);
  const quote = { jobKey, underwriter: await underwriter.getAddress(), coverageAmount: 100_000n, premiumAmount: 10_000n, juniorAmount: 20_000n, validUntil, modelHash: keccak256(toUtf8Bytes("risk-v1")), nonce: 7n };
  const domain = { name: "TrustFutures", version: "1", chainId: Number((await provider.getNetwork()).chainId), verifyingContract: await policy.getAddress() };
  const types = { Quote: [{ name: "jobKey", type: "bytes32" }, { name: "underwriter", type: "address" }, { name: "coverageAmount", type: "uint256" }, { name: "premiumAmount", type: "uint256" }, { name: "juniorAmount", type: "uint256" }, { name: "validUntil", type: "uint64" }, { name: "modelHash", type: "bytes32" }, { name: "nonce", type: "uint256" }] };
  const accounts = Object.values(ganacheProvider.getInitialAccounts());
  const underwriterWallet = new Wallet(accounts[1].secretKey, provider);
  const signature = await underwriterWallet.signTypedData(domain, types, quote);
  await (await policy.connect(client).acceptQuote(quote, signature)).wait();
  const id = await policy.policyId(quote);
  await (await adapter.setOutcome(jobKey, 2)).wait();
  await (await policy.settle(id)).wait();
  assert.equal((await policy.policies(id)).state, 3n);
  assert.equal(await asset.balanceOf(await client.getAddress()), 100_000n);
  assert.equal(await asset.balanceOf(await registry.getAddress()), 0n);
  assert.equal(await asset.balanceOf(await vault.getAddress()), 0n);
});
