import assert from "node:assert/strict";
import test from "node:test";

import { parseAgentRisk } from "../lib/api/schema";

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
