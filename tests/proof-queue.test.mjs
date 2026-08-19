import test from "node:test";
import assert from "node:assert/strict";
import { ProofQueue } from "../services/prover/proof-queue.mjs";

test("proof queue is idempotent by job key and retains state transitions", () => {
  const queue = new ProofQueue();
  const first = queue.enqueue("0xabc", { sourceBlock: 44 });
  const second = queue.enqueue("0xabc", { sourceBlock: 44 });
  assert.equal(first.id, second.id);
  queue.transition("0xabc", "building");
  queue.transition("0xabc", "submitted", { txHash: "0xtx" });
  assert.deepEqual(queue.get("0xabc"), {
    id: first.id,
    jobKey: "0xabc",
    state: "submitted",
    sourceBlock: 44,
    txHash: "0xtx",
  });
});

test("proof queue rejects invalid transitions", () => {
  const queue = new ProofQueue();
  queue.enqueue("0xabc", {});
  assert.throws(() => queue.transition("0xabc", "confirmed"), /transition/);
});
