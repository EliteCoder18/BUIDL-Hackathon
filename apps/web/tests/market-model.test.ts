import assert from "node:assert/strict";
import test from "node:test";

import { resolveMarketMetrics } from "../components/dashboard/market-model";

test("wallet dashboard metrics come from Creditcoin instead of embedded demo state", () => {
  const demo = {
    agents: [], jobs: [],
    policies: [{ policyId: `0x${"11".repeat(32)}`, state: "CREDITCOIN_POLICY_LOCKED" }],
    proofs: [],
  } as never;
  const live = {
    chainId: 102031,
    activePolicyCount: 3,
    confirmedProofCount: 2,
    vault: { totalAssets: "900000000", reserved: "240000000", freeAssets: "660000000", totalShares: "800000000" },
    policies: [{ policyId: `0x${"aa".repeat(32)}` }],
  } as never;

  const result = resolveMarketMetrics("wallet", demo, { totalAssets: "1", reserved: "0", freeAssets: "1", totalShares: "1" }, live);

  assert.equal(result.latestPolicyId, `0x${"aa".repeat(32)}`);
  assert.equal(result.activePolicyCount, 3);
  assert.equal(result.confirmedProofCount, 2);
  assert.equal(result.vault?.reserved, "240000000");
  assert.equal(result.orchestratorState, "CREDITCOIN_POLICY_LOCKED");
});

test("a settled public policy restores the final saga outcome after reload", () => {
  const live = { chainId: 102031, activePolicyCount: 0, confirmedProofCount: 1, vault: undefined, policies: [{ state: "SETTLED_FAILURE" }] } as never;

  assert.equal(resolveMarketMetrics("wallet", undefined, undefined, live).orchestratorState, "SETTLED_SLASHED");
});
