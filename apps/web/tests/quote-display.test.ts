import assert from "node:assert/strict";
import test from "node:test";

import type { LiveQuote } from "../lib/api/schema";
import { quoteToDisplay } from "../lib/risk/quote-display";

const modelHash = `0x${"55".repeat(32)}` as const;
const richLiveQuote = {
  jobKey: `0x${"22".repeat(32)}`,
  underwriter: `0x${"44".repeat(20)}`,
  coverageAmount: "900000000",
  premiumAmount: "111060000",
  juniorAmount: "180000000",
  seniorAmount: "720000000",
  validUntil: "2000000000",
  modelHash,
  nonce: "0",
  signature: `0x${"66".repeat(65)}`,
  strategy: "balanced",
  failureProbabilityBps: 1234,
  premiumBps: 1234,
  factors: [{ name: "failure_rate", value: 0.1, shapValue: 0.6, label: "Failure rate" }],
  riskProfile: {
    failureProbabilityBps: 1234,
    modelHash,
    modelVersion: "trustfutures-gbm-v1",
    confidence: 0.91,
    abstain: false,
    source: "python-risk-service",
    features: [{ name: "failure_rate", value: 0.1, shapValue: 0.6, label: "Failure rate" }],
    trainingData: "fixed-seed synthetic",
    liveFeatures: "attested on-chain outcomes",
    calibrationMethod: "isotonic",
    dataLineage: { datasetVersion: "synthetic-mandates-v1", datasetHash: "sha256:fixture", liveOutcomeCount: 2 },
    diagnostics: { confidence: 0.91, featureDrift: 0.02, outOfDistribution: false, abstentionReasons: [], warnings: [] },
  },
  llmExplanation: { summary: "Model prices the verified mandate.", topRisks: ["failure_rate"], protectiveTerms: ["20% first-loss"] },
} satisfies LiveQuote;

test("wallet quote display retains analytics accompanying the signed quote", () => {
  const display = quoteToDisplay(richLiveQuote, 0);
  assert.equal(display.coverageAmount, 900);
  assert.equal(display.premiumAmount, 111.06);
  assert.equal(display.juniorAmount, 180);
  assert.equal(display.probability, 0.1234);
  assert.deepEqual(display.features, richLiveQuote.riskProfile.features);
  assert.equal(display.provenance?.confidence, 0.91);
  assert.equal(display.provenance?.featureDrift, 0.02);
  assert.equal(display.provenance?.liveOutcomeCount, 2);
  assert.equal(display.explanation, richLiveQuote.llmExplanation);
});
