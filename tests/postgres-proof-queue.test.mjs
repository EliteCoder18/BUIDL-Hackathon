import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { PostgresProofQueue } from "../services/prover/postgres-proof-queue.mjs";

class RecordingPool extends EventEmitter {
  queries = [];
  rows = [];
  closed = false;

  async query(text, values = []) {
    this.queries.push({ text: text.replace(/\s+/g, " ").trim(), values });
    return { rows: this.rows.shift() ?? [] };
  }

  async end() { this.closed = true; }
}

test("idle PostgreSQL client errors are observed without crashing the API process", () => {
  const pool = new RecordingPool();
  const observed = [];
  new PostgresProofQueue("postgresql://unused", { pool, onPoolError: (error) => observed.push(error.message) });

  assert.doesNotThrow(() => pool.emit("error", new Error("transient socket failure")));
  assert.deepEqual(observed, ["transient socket failure"]);
});

test("claimNext atomically locks one eligible Supabase job and maps retry metadata", async () => {
  const pool = new RecordingPool();
  pool.rows.push([{
    id: "job-id",
    jobKey: "0xabc",
    sourceTxHash: "0xsource",
    state: "building",
    creditcoinTxHash: null,
    error: null,
    attemptCount: 2,
    lockedAt: "2026-09-09T00:00:00.000Z",
    nextAttemptAt: null,
  }]);
  const queue = new PostgresProofQueue("postgresql://unused", { pool });

  const job = await queue.claimNext({ maxAttempts: 5 });

  assert.equal(job.jobKey, "0xabc");
  assert.equal(job.attemptCount, 2);
  assert.match(pool.queries[0].text, /FOR UPDATE SKIP LOCKED/);
  assert.match(pool.queries[0].text, /attempt_count < \$1/);
  assert.deepEqual(pool.queries[0].values, [5]);
});

test("claimNext returns null when no proof job is eligible", async () => {
  const pool = new RecordingPool();
  const queue = new PostgresProofQueue("postgresql://unused", { pool });
  assert.equal(await queue.claimNext({ maxAttempts: 3 }), null);
});

test("queue transitions persist a retry time without interpolating job input into SQL", async () => {
  const pool = new RecordingPool();
  pool.rows.push([{
    id: "job-id",
    jobKey: "job'; DROP TABLE proof_jobs; --",
    sourceTxHash: "0xsource",
    state: "failed",
    creditcoinTxHash: null,
    error: "temporary failure",
    attemptCount: 1,
    lockedAt: null,
    nextAttemptAt: "2026-09-09T00:01:00.000Z",
  }]);
  const queue = new PostgresProofQueue("postgresql://unused", { pool });
  const retryAt = new Date("2026-09-09T00:01:00.000Z");

  const job = await queue.transition("job'; DROP TABLE proof_jobs; --", "failed", {
    error: "temporary failure",
    nextAttemptAt: retryAt,
  });

  assert.equal(job.state, "failed");
  assert.ok(!pool.queries[0].text.includes("DROP TABLE"));
  assert.equal(pool.queries[0].values[0], "job'; DROP TABLE proof_jobs; --");
  assert.equal(pool.queries[0].values[4], retryAt);
  await queue.close();
  assert.equal(pool.closed, true);
});
