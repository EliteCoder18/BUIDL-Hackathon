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

test("TreasuryJobManager executes only through approved balance-verified adapters", async () => {
  const provider = new BrowserProvider(ganache.provider({ logging: { quiet: true } }));
  const admin = await provider.getSigner(0);
  const agent = await provider.getSigner(1);
  const registry = await deploy(admin, "MockERC8004IdentityRegistry.sol", "MockERC8004IdentityRegistry");
  const usdc = await deploy(admin, "MockERC20.sol", "MockERC20", ["Mock USDC", "mUSDC"]);
  const weth = await deploy(admin, "MockERC20.sol", "MockERC20", ["Mock WETH", "mWETH"]);
  const dex = await deploy(admin, "MockDEX.sol", "MockDEX", [await usdc.getAddress(), await weth.getAddress()]);
  const executor = await deploy(admin, "MockDexExecutor.sol", "MockDexExecutor", [await dex.getAddress()]);
  const manager = await deploy(admin, "TreasuryJobManager.sol", "TreasuryJobManager", [await registry.getAddress()]);

  await (await registry.mint(await agent.getAddress())).wait();
  await (await usdc.mint(await admin.getAddress(), 500_000n)).wait();
  await (await weth.mint(await dex.getAddress(), 500_000n)).wait();
  await (await usdc.approve(await manager.getAddress(), 500_000n)).wait();
  const now = BigInt((await provider.getBlock("latest")).timestamp);

  await assert.rejects(
    manager.createJob(0, await usdc.getAddress(), await weth.getAddress(), await dex.getAddress(), 100_000n, 99_000n, now + 3_600n),
  );

  await (await manager.setExecutorApproval(await executor.getAddress(), true)).wait();
  assert.equal(await manager.approvedExecutors(await executor.getAddress()), true);
  await (await manager.createJob(0, await usdc.getAddress(), await weth.getAddress(), await executor.getAddress(), 100_000n, 99_000n, now + 3_600n)).wait();
  await (await manager.connect(agent).execute(0)).wait();
  assert.equal((await manager.jobs(0)).outcome, 1n);
  assert.equal(await weth.balanceOf(await admin.getAddress()), 100_000n);

  await (await dex.setOutputBps(9_000)).wait();
  const balanceBeforeViolation = await usdc.balanceOf(await admin.getAddress());
  await (await manager.createJob(0, await usdc.getAddress(), await weth.getAddress(), await executor.getAddress(), 100_000n, 99_000n, now + 3_600n)).wait();
  await (await manager.connect(agent).execute(1)).wait();
  assert.equal((await manager.jobs(1)).outcome, 2n);
  assert.equal(await usdc.balanceOf(await admin.getAddress()), balanceBeforeViolation);

  await (await manager.setExecutorApproval(await executor.getAddress(), false)).wait();
  await assert.rejects(
    manager.createJob(0, await usdc.getAddress(), await weth.getAddress(), await executor.getAddress(), 100_000n, 98_000n, now + 3_600n),
  );
});
