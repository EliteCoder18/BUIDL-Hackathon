import assert from "node:assert/strict";
import test from "node:test";

import { parseAgentRisk, parseLiveQuotes } from "../lib/api/schema";

test("agent risk parser accepts unavailable feature drift from the deterministic fallback", () => {
  const risk = parseAgentRisk({
    agentId: "0",
    attestedFeatures: {
      successCount: 9,
      violationCount: 0,
      expiryCount: 1,
      meanSlippageBps: 24,
      meanLatenessBps: 42,
      amountVsP95Bps: 9400,
      deadlineTightnessBps: 280,
      volatilityBps: 300,
    },
    failureProbabilityBps: 1000,
    modelHash: `0x${"11".repeat(32)}`,
    modelVersion: "trustfutures-risk-v1-fixed-seed",
    confidence: 0.7,
    abstain: false,
    source: "deterministic-fallback",
    features: [{ name: "failure_rate", value: 0.1, shapValue: 0.6 }],
    trainingData: "deterministic fallback",
    liveFeatures: "no attested outcomes available",
    calibrationMethod: "not-applied-service-unavailable",
    dataLineage: {
      datasetVersion: "fallback-v1",
      datasetHash: "sha256:fixture",
      liveOutcomeCount: 0,
    },
    diagnostics: {
      confidence: 0.7,
      featureDrift: null,
      outOfDistribution: false,
      abstentionReasons: [],
      warnings: ["risk-service-unavailable"],
    },
  });

  assert.equal(risk.diagnostics?.featureDrift, null);
});

test("live quote parser preserves the verified job and Creditcoin signing domain", () => {
  const body = parseLiveQuotes({
    job: { sourceTxHash: `0x${"11".repeat(32)}`, jobKey: `0x${"22".repeat(32)}`, jobId: "7", agentId: "10130", amountIn: "100", minOut: "99", deadline: "2000000000" },
    domain: { chainId: 102031, verifyingContract: `0x${"33".repeat(20)}` },
    signing: "EIP-712 signed",
    quotes: [{ jobKey: `0x${"22".repeat(32)}`, underwriter: `0x${"44".repeat(20)}`, coverageAmount: "100", premiumAmount: "10", juniorAmount: "20", validUntil: "2000000000", modelHash: `0x${"55".repeat(32)}`, nonce: "0", signature: `0x${"66".repeat(65)}`, strategy: "balanced" }],
  });
  assert.equal(body.domain.chainId, 102031);
  assert.equal(body.job.agentId, "10130");
  assert.equal(body.quotes[0].premiumAmount, "10");
});
