import assert from "node:assert/strict";
import test from "node:test";

import { createProofWorkerRunner } from "../services/prover/worker-runner.mjs";

class MemoryWorkerQueue {
  constructor(job = null) {
    this.job = job;
    this.closed = false;
  }

  async claimNext() {
    if (!this.job || this.job.claimed) return null;
    this.job = { ...this.job, state: "building", claimed: true };
    return { ...this.job };
  }

  async transition(jobKey, state, patch = {}) {
    assert.equal(jobKey, this.job.jobKey);
    this.job = { ...this.job, ...patch, state };
    return { ...this.job };
  }

  async close() { this.closed = true; }
}

const config = { pollIntervalMs: 1000, maxAttempts: 3 };
const quietLogger = { info() {}, error() {} };

test("runOnce leaves an idle queue untouched", async () => {
  const queue = new MemoryWorkerQueue();
  const runner = createProofWorkerRunner({
    queue,
    proveAndSubmit: async () => { throw new Error("must not run"); },
    config,
    logger: quietLogger,
  });
  assert.equal(await runner.runOnce(), null);
});

test("runOnce confirms a claimed proof after the Creditcoin transaction is mined", async () => {
  const queue = new MemoryWorkerQueue({
    jobKey: "0xjob",
    sourceTxHash: "0xsource",
    attemptCount: 1,
    state: "queued",
  });
  const runner = createProofWorkerRunner({
    queue,
    proveAndSubmit: async (sourceTxHash) => {
      assert.equal(sourceTxHash, "0xsource");
      return "0xcreditcoin";
    },
    config,
    logger: quietLogger,
  });

  const result = await runner.runOnce();

  assert.equal(result.state, "confirmed");
  assert.equal(result.creditcoinTxHash, "0xcreditcoin");
  assert.equal(queue.job.state, "confirmed");
});

test("runOnce stores a sanitized error and schedules a bounded retry", async () => {
  const queue = new MemoryWorkerQueue({
    jobKey: "0xjob",
    sourceTxHash: "0xsource",
    attemptCount: 2,
    state: "queued",
  });
  const runner = createProofWorkerRunner({
    queue,
    proveAndSubmit: async () => {
      throw new Error("RPC https://user:password@rpc.example.test failed");
    },
    config,
    logger: quietLogger,
    now: () => new Date("2026-09-09T00:00:00.000Z"),
  });

  const result = await runner.runOnce();

  assert.equal(result.state, "failed");
  assert.doesNotMatch(result.error, /password/);
  assert.equal(result.nextAttemptAt.toISOString(), "2026-09-09T00:02:00.000Z");
});

test("stop closes the queue and prevents new work", async () => {
  const queue = new MemoryWorkerQueue();
  const runner = createProofWorkerRunner({ queue, proveAndSubmit: async () => "0xtx", config, logger: quietLogger });
  await runner.stop();
  assert.equal(queue.closed, true);
  assert.equal(await runner.runOnce(), null);
});
