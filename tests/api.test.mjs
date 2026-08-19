import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../services/api/app.mjs";
import { createQuoteSigner } from "../services/underwriter/quote-signer.mjs";

const history = { successCount: 8, violationCount: 1, expiryCount: 1, meanSlippageBps: 20, meanLatenessBps: 5, amountVsP95Bps: 10_200, deadlineTightnessBps: 350, volatilityBps: 280 };

test("quote endpoint returns three bounded underwriting choices", async () => {
  const api = createApi();
  const response = await api.handle(new Request("http://local/v1/quotes", { method: "POST", body: JSON.stringify({ jobKey: "0xjob", coverageAmount: "100000000", history }) }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.quotes.length, 3);
  assert.equal(body.quotes[0].juniorAmount, "20000000");
});

test("proof endpoint is idempotent and risk endpoint exposes attested feature basis", async () => {
  const api = createApi({ agentRisk: new Map([["1842", history]]) });
  const first = await api.handle(new Request("http://local/v1/proofs", { method: "POST", body: JSON.stringify({ jobKey: "0xjob", sourceTxHash: "0xtx" }) }));
  const second = await api.handle(new Request("http://local/v1/proofs", { method: "POST", body: JSON.stringify({ jobKey: "0xjob", sourceTxHash: "0xtx" }) }));
  assert.equal((await first.json()).id, (await second.json()).id);
  const risk = await api.handle(new Request("http://local/v1/agents/1842/risk"));
  assert.equal(risk.status, 200);
  assert.equal((await risk.json()).modelVersion, "trustfutures-risk-v1-fixed-seed");
});

test("configured bots return EIP-712 signed quotes without changing model values", async () => {
  const signer = createQuoteSigner({
    chainId: 102031,
    verifyingContract: "0x0000000000000000000000000000000000001234",
    privateKeys: { conservative: `0x${"11".repeat(32)}`, balanced: `0x${"22".repeat(32)}`, aggressive: `0x${"33".repeat(32)}` },
  });
  const api = createApi({ quoteSigner: signer });
  const response = await api.handle(new Request("http://local/v1/quotes", { method: "POST", body: JSON.stringify({ jobKey: `0x${"44".repeat(32)}`, coverageAmount: "100000000", history }) }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(body.quotes[0].signature, /^0x[0-9a-f]{130}$/);
  assert.match(body.quotes[0].underwriter, /^0x[0-9a-f]{40}$/i);
});
