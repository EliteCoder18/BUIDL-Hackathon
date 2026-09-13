import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../services/api/app.mjs";
import { createQuoteSigner } from "../services/underwriter/quote-signer.mjs";
import { createRiskClient } from "../services/underwriter/risk-client.mjs";

const history = { successCount: 8, violationCount: 1, expiryCount: 1, meanSlippageBps: 20, meanLatenessBps: 5, amountVsP95Bps: 10_200, deadlineTightnessBps: 350, volatilityBps: 280 };
const offlineRiskClient = () => createRiskClient({ fetchImpl: async () => { throw new Error("offline test service"); } });

test("quote endpoint returns three bounded underwriting choices", async () => {
  const api = createApi({ riskClient: offlineRiskClient() });
  const response = await api.handle(new Request("http://local/v1/quotes", { method: "POST", body: JSON.stringify({ jobKey: "0xjob", coverageAmount: "100000000", history, agentId: "agent-00", mandateCategory: "swap", liveOutcomeCount: 0, attestedEventValid: false }) }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.quotes.length, 3);
  assert.equal(body.quotes[0].juniorAmount, "20000000");
});

test("quote endpoint preserves a supplied risk result above the deterministic floor", async () => {
  const api = createApi({ riskClient: { score: async () => ({ failureProbabilityBps: 2200, modelHash: `0x${"ab".repeat(32)}`, abstain: false }) } });
  const response = await api.handle(new Request("http://local/v1/quotes", { method: "POST", body: JSON.stringify({ jobKey: "0xjob", coverageAmount: "100000000", history, agentId: "agent-00", mandateCategory: "swap", liveOutcomeCount: 0, attestedEventValid: false }) }));
  const body = await response.json();
  assert.equal(body.quotes[1].failureProbabilityBps, 2200);
  assert.equal(body.quotes[1].modelHash, `0x${"ab".repeat(32)}`);
});

test("health endpoint supports deployment readiness checks", async () => {
  const response = await createApi().handle(new Request("http://local/healthz"));
  assert.deepEqual(await response.json(), { ok: true, service: "trustfutures-api" });
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
  const api = createApi({ quoteSigner: signer, riskClient: offlineRiskClient() });
  const response = await api.handle(new Request("http://local/v1/quotes", { method: "POST", body: JSON.stringify({ jobKey: `0x${"44".repeat(32)}`, coverageAmount: "100000000", history, agentId: "agent-00", mandateCategory: "swap", liveOutcomeCount: 0, attestedEventValid: false }) }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(body.quotes[0].signature, /^0x[0-9a-f]{130}$/);
  assert.match(body.quotes[0].underwriter, /^0x[0-9a-f]{40}$/i);
});

test("live quote endpoint prices only a backend-verified Sepolia job", async () => {
  const signer = createQuoteSigner({
    chainId: 102031,
    verifyingContract: "0x0000000000000000000000000000000000001234",
    privateKeys: { conservative: `0x${"11".repeat(32)}`, balanced: `0x${"22".repeat(32)}`, aggressive: `0x${"33".repeat(32)}` },
  });
  const verifiedJob = { sourceTxHash: `0x${"55".repeat(32)}`, jobKey: `0x${"44".repeat(32)}`, jobId: "7", agentId: "10130", amountIn: "100000000", minOut: "99000000", deadline: "2000000000" };
  const api = createApi({
    quoteSigner: signer,
    riskClient: offlineRiskClient(),
    liveJobVerifier: async () => verifiedJob,
    liveAgentHistory: () => history,
    liveSigningDomain: { chainId: 102031, verifyingContract: "0x0000000000000000000000000000000000001234" },
  });
  const response = await api.handle(new Request("http://local/v1/live/quotes", { method: "POST", body: JSON.stringify({ sourceTxHash: verifiedJob.sourceTxHash, coverageAmount: "100000000" }) }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.job.jobKey, verifiedJob.jobKey);
  assert.deepEqual(body.domain, { chainId: 102031, verifyingContract: "0x0000000000000000000000000000000000001234" });
  assert.match(body.quotes[0].signature, /^0x[0-9a-f]{130}$/);
  assert.match(body.quotes[0].validUntil, /^\d+$/);
  assert.equal(typeof body.quotes[0].validUntil, "string");
  assert.ok(body.quotes[0].riskProfile.features.length > 0);
  assert.equal(typeof body.quotes[0].llmExplanation.summary, "string");
  assert.ok(body.quotes[0].llmExplanation.summary.length > 0);
});

test("live quote nonces are stable for one job and unique across jobs", async () => {
  const signer = createQuoteSigner({
    chainId: 102031,
    verifyingContract: "0x0000000000000000000000000000000000001234",
    privateKeys: { conservative: `0x${"11".repeat(32)}`, balanced: `0x${"22".repeat(32)}`, aggressive: `0x${"33".repeat(32)}` },
  });
  const jobs = {
    [`0x${"aa".repeat(32)}`]: { sourceTxHash: `0x${"aa".repeat(32)}`, jobKey: `0x${"44".repeat(32)}`, jobId: "7", agentId: "10130", amountIn: "100000000", minOut: "99000000", deadline: "2000000000" },
    [`0x${"bb".repeat(32)}`]: { sourceTxHash: `0x${"bb".repeat(32)}`, jobKey: `0x${"55".repeat(32)}`, jobId: "8", agentId: "10130", amountIn: "100000000", minOut: "99000000", deadline: "2000000000" },
  };
  const api = createApi({
    quoteSigner: signer,
    riskClient: offlineRiskClient(),
    liveJobVerifier: async (sourceTxHash) => jobs[sourceTxHash],
    liveAgentHistory: () => history,
    liveSigningDomain: { chainId: 102031, verifyingContract: "0x0000000000000000000000000000000000001234" },
  });
  const request = async (sourceTxHash) => {
    const response = await api.handle(new Request("http://local/v1/live/quotes", { method: "POST", body: JSON.stringify({ sourceTxHash, coverageAmount: "100000000" }) }));
    assert.equal(response.status, 200);
    return response.json();
  };

  const first = await request(`0x${"aa".repeat(32)}`);
  const second = await request(`0x${"bb".repeat(32)}`);
  const retry = await request(`0x${"aa".repeat(32)}`);

  assert.notEqual(first.quotes[2].nonce, second.quotes[2].nonce);
  assert.equal(first.quotes[2].nonce, retry.quotes[2].nonce);
});

test("live quote endpoint fails closed without receipt verification and signers", async () => {
  const response = await createApi().handle(new Request("http://local/v1/live/quotes", { method: "POST", body: JSON.stringify({ sourceTxHash: `0x${"55".repeat(32)}`, coverageAmount: "100000000" }) }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "LIVE_WALLET_UNAVAILABLE");
});

test("live market endpoint validates the wallet and returns public policy history", async () => {
  const wallet = "0xdBF524a895026A67e48AD058277C8C287afF8e16";
  let requestedWallet;
  const payload = { chainId: 102031, activePolicyCount: 1, confirmedProofCount: 0, vault: { totalAssets: "800000000", reserved: "80000000", freeAssets: "720000000", totalShares: "800000000" }, policies: [] };
  const api = createApi({ liveMarketReader: async (value) => { requestedWallet = value; return payload; } });

  const response = await api.handle(new Request(`http://local/v1/live/market?client=${wallet.toLowerCase()}`));

  assert.equal(response.status, 200);
  assert.equal(requestedWallet, wallet);
  assert.deepEqual(await response.json(), payload);
  const invalid = await api.handle(new Request("http://local/v1/live/market?client=not-an-address"));
  assert.equal(invalid.status, 400);
});

test("live market endpoint fails clearly when public-chain reads are unavailable", async () => {
  const response = await createApi().handle(new Request("http://local/v1/live/market?client=0xdBF524a895026A67e48AD058277C8C287afF8e16"));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "LIVE_MARKET_UNAVAILABLE");
});

test("live vault endpoint returns capital without waiting for market history", async () => {
  const payload = { totalAssets: "800000000", reserved: "80000000", freeAssets: "720000000", totalShares: "800000000" };
  const api = createApi({
    liveVaultReader: async () => payload,
    liveMarketReader: async () => new Promise(() => {}),
  });

  const response = await api.handle(new Request("http://local/v1/live/vault"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), payload);
});
