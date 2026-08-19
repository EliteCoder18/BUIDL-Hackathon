import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import ganache from "ganache";
import { BrowserProvider, ContractFactory } from "ethers";

const root = path.resolve("contracts/src");
const files = fs.readdirSync(root).filter((name) => name.endsWith(".sol"));
const sources = Object.fromEntries(files.map((file) => [file, { content: fs.readFileSync(path.join(root, file), "utf8") }]));
sources["@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol"] = { content: fs.readFileSync("node_modules/@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol", "utf8") };
const compiled = JSON.parse(solc.compile(JSON.stringify({ language: "Solidity", sources, settings: { evmVersion: "shanghai", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } })));
const errors = (compiled.errors ?? []).filter((entry) => entry.severity === "error");
if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));

async function deploy(signer, file, name, args = []) {
  const artifact = compiled.contracts[file][name];
  const instance = await new ContractFactory(artifact.abi, `0x${artifact.evm.bytecode.object}`, signer).deploy(...args);
  await instance.waitForDeployment();
  return instance;
}

test("TreasuryJobManager executes ERC-8004 mandates through success, violation, and expiry", async () => {
  const provider = new BrowserProvider(ganache.provider({ logging: { quiet: true } }));
  const client = await provider.getSigner(0);
  const agent = await provider.getSigner(1);
  const registry = await deploy(client, "MockERC8004IdentityRegistry.sol", "MockERC8004IdentityRegistry");
  const usdc = await deploy(client, "MockERC20.sol", "MockERC20", ["Mock USDC", "mUSDC"]);
  const weth = await deploy(client, "MockERC20.sol", "MockERC20", ["Mock WETH", "mWETH"]);
  const dex = await deploy(client, "MockDEX.sol", "MockDEX", [await usdc.getAddress(), await weth.getAddress()]);
  const manager = await deploy(client, "TreasuryJobManager.sol", "TreasuryJobManager", [await registry.getAddress()]);
  await (await registry.mint(await agent.getAddress())).wait();
  await (await usdc.mint(await client.getAddress(), 1_000_000n)).wait();
  await (await weth.mint(await dex.getAddress(), 1_000_000n)).wait();
  await (await usdc.approve(await manager.getAddress(), 1_000_000n)).wait();
  const now = BigInt((await provider.getBlock("latest")).timestamp);

  await (await manager.createJob(0, await usdc.getAddress(), await weth.getAddress(), await dex.getAddress(), 100_000n, 99_000n, now + 3600n)).wait();
  await (await manager.connect(agent).execute(0)).wait();
  assert.equal((await manager.jobs(0)).outcome, 1n);
  assert.equal(await weth.balanceOf(await client.getAddress()), 100_000n);

  await (await manager.createJob(0, await usdc.getAddress(), await weth.getAddress(), await dex.getAddress(), 100_000n, 101_000n, now + 3600n)).wait();
  await (await manager.connect(agent).execute(1)).wait();
  assert.equal((await manager.jobs(1)).outcome, 2n);

  // Ganache advances the timestamp when mining the create transaction, so leave a real margin.
  const expiryDeadline = BigInt((await provider.getBlock("latest")).timestamp) + 30n;
  await (await manager.createJob(0, await usdc.getAddress(), await weth.getAddress(), await dex.getAddress(), 100_000n, 99_000n, expiryDeadline)).wait();
  await provider.send("evm_increaseTime", [60]);
  await provider.send("evm_mine", []);
  await (await manager.finalizeExpired(2)).wait();
  assert.equal((await manager.jobs(2)).outcome, 3n);
});
