import assert from "node:assert/strict";
import test from "node:test";
import { Interface } from "ethers";
import { LIVE_JOB_ABI, verifyLiveJob } from "../services/api/live-job-verifier.mjs";

const manager = `0x${"11".repeat(20)}`;
const client = `0x${"22".repeat(20)}`;
const agent = `0x${"33".repeat(20)}`;
const token = `0x${"44".repeat(20)}`;
const output = `0x${"55".repeat(20)}`;
const executor = `0x${"66".repeat(20)}`;
const hash = `0x${"77".repeat(32)}`;
const iface = new Interface(LIVE_JOB_ABI);
const data = iface.encodeFunctionData("createJob", [10130n, token, output, executor, 100n, 99n, 2_000_000_000n]);
const event = iface.encodeEventLog(iface.getEvent("JobCreated"), [7n, client, agent, 100n, 99n, 2_000_000_000n]);

function provider(to = manager) {
  return {
    getTransactionReceipt: async () => ({ status: 1, to, logs: [{ address: to, topics: event.topics, data: event.data }] }),
    getTransaction: async () => ({ to, from: client, data }),
  };
}

test("verified live jobs derive trusted calldata and canonical job key", async () => {
  const result = await verifyLiveJob({ sourceTxHash: hash, expectedManager: manager, provider: provider() });
  assert.equal(result.jobId, "7");
  assert.equal(result.agentId, "10130");
  assert.equal(result.amountIn, "100");
  assert.match(result.jobKey, /^0x[0-9a-f]{64}$/);
});

test("live job verification rejects a receipt from another manager", async () => {
  await assert.rejects(() => verifyLiveJob({ sourceTxHash: hash, expectedManager: manager, provider: provider(`0x${"99".repeat(20)}`) }), /configured TreasuryJobManager/);
});
