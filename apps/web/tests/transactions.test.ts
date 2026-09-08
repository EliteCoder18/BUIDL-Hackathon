import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApprovePlan,
  buildCreateJobPlan,
  buildMintPlan,
  buildUnderwriterDepositPlan,
  buildVaultDepositPlan,
  deriveJobKey,
} from "../lib/contracts/transactions";

const token = `0x${"11".repeat(20)}` as const;
const manager = `0x${"22".repeat(20)}` as const;
const output = `0x${"33".repeat(20)}` as const;
const executor = `0x${"44".repeat(20)}` as const;
const account = `0x${"55".repeat(20)}` as const;

test("mint and approval plans are explicit wallet writes", () => {
  assert.deepEqual(buildMintPlan(11155111, token, account, 100_000_000n).args, [account, 100_000_000n]);
  const approve = buildApprovePlan(102031, token, manager, 200_000_000n);
  assert.equal(approve.functionName, "approve");
  assert.deepEqual(approve.args, [manager, 200_000_000n]);
});

test("Sepolia job plan binds deployed tokens, executor, terms, and deadline", () => {
  const plan = buildCreateJobPlan({
    manager, inputToken: token, outputToken: output, executor,
    agentId: 10130n, amountIn: 100_000_000n, minOut: 99_000_000n,
    deadline: 2_000_000_000n,
  });
  assert.equal(plan.chainId, 11155111);
  assert.equal(plan.functionName, "createJob");
  assert.deepEqual(plan.args, [10130n, token, output, executor, 100_000_000n, 99_000_000n, 2_000_000_000n]);
});

test("CC3 capital plans target the correct deposit entry point", () => {
  assert.equal(buildVaultDepositPlan(manager, 800_000_000n).chainId, 102031);
  assert.deepEqual(buildVaultDepositPlan(manager, 800_000_000n).args, [800_000_000n]);
  assert.deepEqual(buildUnderwriterDepositPlan(manager, 200_000_000n).args, [200_000_000n]);
});

test("canonical job key is deterministic and validates positive values", () => {
  const deployedManager = "0x85F34Ddd31de129257c5E43c2FadAc279715baF9";
  assert.equal(deriveJobKey(deployedManager, 0n), "0x9093743b04696653e8cc6fecbaab6a2a4a8ab3b2bdedb1eaf7ea064dcc2ba031");
  assert.throws(() => buildMintPlan(11155111, token, account, 0n), /positive/i);
  assert.throws(() => buildCreateJobPlan({ manager, inputToken: token, outputToken: output, executor, agentId: 1n, amountIn: 1n, minOut: 2n, deadline: 0n }), /deadline/i);
});
