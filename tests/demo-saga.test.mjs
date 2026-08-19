import assert from "node:assert/strict";
import test from "node:test";

import { createDemoSaga } from "../services/demo/demo-saga.mjs";
import { createLocalChainRuntime } from "../services/local-chain/runtime.mjs";

const mandate = {
  agentId: "0",
  amountIn: "100000000",
  minOut: "99000000",
  deadlineSeconds: 3600,
  coverageAmount: "100000000",
};

async function createPolicy(saga) {
  const job = await saga.createJob(mandate);
  const auction = await saga.openAuction(job.data.jobKey);
  assert.equal(auction.data.quotes.length, 3);
  const policy = await saga.acceptPolicy({ jobKey: job.data.jobKey, quoteIndex: 1 });
  return { job, auction, policy };
}

test("success saga confirms a local proof, releases capital, and splits premium", async (t) => {
  const runtime = await createLocalChainRuntime({ sepoliaPort: 0, creditcoinPort: 0 });
  t.after(() => runtime.close());
  const saga = createDemoSaga(runtime);
  const { job, policy } = await createPolicy(saga);

  const executed = await saga.executeJob(job.data.jobKey, "success");
  const proof = await saga.proveOutcome(job.data.jobKey);
  const settled = await saga.settlePolicy(policy.data.policyId);

  assert.equal(executed.data.outcome, "success");
  assert.equal(proof.data.state, "confirmed");
  assert.equal(proof.data.proofSource, "local-attestcoin-simulation");
  assert.equal(settled.data.state, "SETTLED_SUCCESS");
  assert.equal(settled.data.clientPayout, 0n);
  assert.equal(settled.data.underwriterPremium + settled.data.lpPremium, settled.data.premiumAmount);
  assert.equal(await runtime.contracts.vault.reserved(), 0n);
});

test("violation saga pays full coverage junior-first and raises the next premium", async (t) => {
  const runtime = await createLocalChainRuntime({ sepoliaPort: 0, creditcoinPort: 0 });
  t.after(() => runtime.close());
  const saga = createDemoSaga(runtime);
  const before = await saga.quoteForAgent("0", mandate);
  const { job, policy } = await createPolicy(saga);

  await saga.executeJob(job.data.jobKey, "violation");
  await saga.proveOutcome(job.data.jobKey);
  const settled = await saga.settlePolicy(policy.data.policyId);
  const after = await saga.quoteForAgent("0", mandate);

  assert.equal(settled.data.state, "SETTLED_SLASHED");
  assert.equal(settled.data.clientPayout, settled.data.coverageAmount);
  assert.equal(settled.data.juniorLoss, settled.data.coverageAmount / 5n);
  assert.equal(settled.data.seniorLoss, settled.data.coverageAmount * 4n / 5n);
  assert.ok(after.balanced.premiumAmount > before.balanced.premiumAmount);
});

test("proof generation is idempotent for one job key", async (t) => {
  const runtime = await createLocalChainRuntime({ sepoliaPort: 0, creditcoinPort: 0 });
  t.after(() => runtime.close());
  const saga = createDemoSaga(runtime);
  const { job } = await createPolicy(saga);
  await saga.executeJob(job.data.jobKey, "success");

  const first = await saga.proveOutcome(job.data.jobKey);
  const second = await saga.proveOutcome(job.data.jobKey);

  assert.equal(second.data.id, first.data.id);
  assert.equal(second.data.creditcoinTxHash, first.data.creditcoinTxHash);
});

test("auction returns no signed quotes when the risk model abstains", async (t) => {
  const runtime = await createLocalChainRuntime({ sepoliaPort: 0, creditcoinPort: 0 });
  t.after(() => runtime.close());
  const riskClient = {
    async score() {
      return {
        failureProbabilityBps: 5_000,
        modelVersion: "uncertain-model",
        modelHash: `0x${"22".repeat(32)}`,
        features: [],
        confidence: 0.2,
        abstain: true,
        source: "shap-service",
      };
    },
  };
  const saga = createDemoSaga(runtime, { riskClient });
  const job = await saga.createJob(mandate);

  const auction = await saga.openAuction(job.data.jobKey);

  assert.deepEqual(auction.data.quotes, []);
});
