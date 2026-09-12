import assert from "node:assert/strict";
import test from "node:test";
import { walletTransactionPlan } from "../lib/wallet/transaction-plan";
import { reduceWalletTransaction } from "../lib/wallet/transaction-state";
import { nextMandateAction, parsePendingMandate, parseRecoveryTransactionHash, verifiedMandateKey } from "../lib/wallet/mandate-recovery";

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

test("a confirmed mandate retries quote hydration instead of sending createJob again", () => {
  assert.equal(nextMandateAction(2, undefined), "create-job");
  assert.equal(nextMandateAction(2, {
    jobKey: `0x${"a".repeat(64)}`,
    txHash: `0x${"b".repeat(64)}`,
  }), "request-quotes");
});

test("a confirmed mandate can be restored after a page refresh", () => {
  const pending = {
    jobKey: `0x${"a".repeat(64)}` as `0x${string}`,
    txHash: `0x${"b".repeat(64)}` as `0x${string}`,
    input: {
      agentId: "10130",
      amountIn: "100000000",
      minOut: "99000000",
      coverageAmount: "100000000",
      deadlineSeconds: 3600,
      deadline: "2000000000",
    },
  };
  assert.deepEqual(parsePendingMandate(JSON.stringify(pending)), pending);
  assert.equal(parsePendingMandate("not-json"), undefined);
});

test("receipt-verified server job key is canonical during recovery", () => {
  assert.equal(verifiedMandateKey(
    `0x${"a".repeat(64)}`,
    `0x${"c".repeat(64)}`,
  ), `0x${"c".repeat(64)}`);
});

test("manual mandate recovery accepts only a transaction hash", () => {
  const hash = `0x${"d".repeat(64)}`;
  assert.equal(parseRecoveryTransactionHash(hash), hash);
  assert.throws(() => parseRecoveryTransactionHash("0x1234"), /transaction hash/i);
});
