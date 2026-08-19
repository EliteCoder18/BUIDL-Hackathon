import assert from "node:assert/strict";
import test from "node:test";

import { createRiskClient } from "../services/underwriter/risk-client.mjs";

const history = {
  successCount: 9,
  violationCount: 0,
  expiryCount: 1,
  meanSlippageBps: 24,
  meanLatenessBps: 42,
  amountVsP95Bps: 9_400,
  deadlineTightnessBps: 280,
  volatilityBps: 300,
};

test("risk client preserves calibrated SHAP service output", async () => {
  const serviceResult = {
    failureProbabilityBps: 730,
    modelVersion: "risk-shap-v2",
    modelHash: `0x${"11".repeat(32)}`,
    features: [{ name: "failure_rate", value: 0.1, shapValue: -0.42 }],
    confidence: 0.91,
    abstain: false,
  };
  const client = createRiskClient({
    baseUrl: "http://risk",
    fetchImpl: async () => Response.json(serviceResult),
  });

  const result = await client.score(history);

  assert.deepEqual(result, { ...serviceResult, source: "shap-service" });
});

test("risk client returns labeled deterministic feature attribution during an outage", async () => {
  const client = createRiskClient({
    baseUrl: "http://risk",
    fetchImpl: async () => new Response("offline", { status: 503 }),
  });

  const result = await client.score(history);

  assert.equal(result.source, "deterministic-fallback");
  assert.equal(result.features.length, 6);
  assert.ok(result.features.every((feature) => Number.isFinite(feature.shapValue)));
  assert.ok(result.failureProbabilityBps >= 100 && result.failureProbabilityBps <= 9_500);
  assert.equal(result.abstain, false);
});
