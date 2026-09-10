import assert from "node:assert/strict";
import test from "node:test";
import { walletTransactionPlan } from "../lib/wallet/transaction-plan";
import { reduceWalletTransaction } from "../lib/wallet/transaction-state";

const address = (byte: string) => `0x${byte.repeat(40)}` as `0x${string}`;

test("wallet plan assigns client actions to Sepolia and Creditcoin in order", () => {
  const steps = walletTransactionPlan({
    sepolia: { chainId: 11155111, mockUsdc: address("1"), mockWeth: address("2"), mockDexExecutor: address("3"), treasuryJobManager: address("4") },
    creditcoin: { chainId: 102031, mockUsdc: address("5"), policyManager: address("6") },
  }, { agentId: 10130n, amountIn: 100_000_000n, minOut: 99_000_000n, coverageAmount: 100_000_000n, deadline: 2_000_000_000n });
  assert.deepEqual(steps.map(({ chainId, action }) => [chainId, action]), [
    [11155111, "mint"], [11155111, "approve"], [11155111, "create-job"],
    [102031, "mint"], [102031, "approve"], [102031, "accept-policy"],
  ]);
  assert.equal(steps[2].args[0], 10130n);
  assert.equal(steps[4].args[1], 100_000_000n);
});

test("invalid live manifest chain IDs are rejected", () => {
  assert.throws(() => walletTransactionPlan({
    sepolia: { chainId: 1, mockUsdc: address("1"), mockWeth: address("2"), mockDexExecutor: address("3"), treasuryJobManager: address("4") },
    creditcoin: { chainId: 102031, mockUsdc: address("5"), policyManager: address("6") },
  }, { agentId: 1n, amountIn: 1n, minOut: 1n, coverageAmount: 1n, deadline: 2n }), /Sepolia/);
});

test("a rejected signature fails without claiming submission", () => {
  assert.deepEqual(reduceWalletTransaction({ stage: "awaiting-signature" }, { type: "REJECTED" }), {
    stage: "failed", code: "USER_REJECTED", message: "Signature request rejected. Nothing was submitted.",
  });
});

test("a confirmed receipt records public transaction evidence", () => {
  assert.deepEqual(reduceWalletTransaction({ stage: "confirming", hash: `0x${"a".repeat(64)}` }, { type: "CONFIRMED", blockNumber: 42n }), {
    stage: "confirmed", hash: `0x${"a".repeat(64)}`, blockNumber: 42n,
  });
});
