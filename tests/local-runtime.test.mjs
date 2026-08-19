import assert from "node:assert/strict";
import test from "node:test";

import { createLocalChainRuntime } from "../services/local-chain/runtime.mjs";

test("local runtime deploys both chains and seeds underwriting capital", async (t) => {
  const runtime = await createLocalChainRuntime({ sepoliaPort: 0, creditcoinPort: 0 });
  t.after(() => runtime.close());

  assert.equal((await runtime.sepolia.provider.getNetwork()).chainId, 11155111n);
  assert.equal((await runtime.creditcoin.provider.getNetwork()).chainId, 102031n);
  assert.equal(await runtime.contracts.identity.ownerOf(0), runtime.accounts.agent.address);
  assert.equal(await runtime.contracts.vault.totalAssets(), 800_000_000n);

  for (const underwriter of runtime.accounts.underwriters) {
    assert.equal(await runtime.contracts.registry.deposited(underwriter.address), 200_000_000n);
  }
});

test("local runtime seeds funded client, executable DEX, and configured policy managers", async (t) => {
  const runtime = await createLocalChainRuntime({ sepoliaPort: 0, creditcoinPort: 0 });
  t.after(() => runtime.close());

  assert.equal(await runtime.contracts.sepoliaUsdc.balanceOf(runtime.accounts.client.address), 10_000_000_000n);
  assert.equal(await runtime.contracts.sepoliaWeth.balanceOf(await runtime.contracts.dex.getAddress()), 10_000_000_000n);
  assert.equal(await runtime.contracts.vault.manager(), await runtime.contracts.policy.getAddress());
  assert.equal(await runtime.contracts.registry.manager(), await runtime.contracts.policy.getAddress());
});
