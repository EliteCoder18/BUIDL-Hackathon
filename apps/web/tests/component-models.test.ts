import assert from "node:assert/strict";
import test from "node:test";
import { buildSagaSteps } from "../components/dashboard/saga-model";
import { calculateWaterfall } from "../components/policy/loss-waterfall-model";
import { normaliseRiskFeatures } from "../components/risk/risk-model";

test("saga rail marks completed, active, and future phases deterministically", () => {
  const steps = buildSagaSteps("CREDITCOIN_POLICY_LOCKED");

  assert.deepEqual(steps.map((step) => step.status), [
    "complete",
    "complete",
    "complete",
    "active",
    "pending",
  ]);
});

test("slashed waterfall consumes the 20% junior tranche before senior capital", () => {
  assert.deepEqual(calculateWaterfall(1_000, 150), {
    coverage: 1_000,
    loss: 150,
    juniorInitial: 200,
    juniorRemaining: 50,
    seniorInitial: 800,
    seniorRemaining: 800,
    payout: 150,
  });

  assert.deepEqual(calculateWaterfall(1_000, 350), {
    coverage: 1_000,
    loss: 350,
    juniorInitial: 200,
    juniorRemaining: 0,
    seniorInitial: 800,
    seniorRemaining: 650,
    payout: 350,
  });
});

test("waterfall bounds invalid loss amounts to available coverage", () => {
  assert.equal(calculateWaterfall(1_000, -20).payout, 0);
  assert.equal(calculateWaterfall(1_000, 1_500).payout, 1_000);
});

test("risk features preserve sign and normalise bar magnitude against the strongest signal", () => {
  assert.deepEqual(normaliseRiskFeatures([
    { name: "Mean slippage", shapValue: 3.2 },
    { name: "Lateness", shapValue: -1.1 },
    { name: "History", shapValue: 0 },
  ]), [
    { name: "Mean slippage", shapValue: 3.2, direction: "risk", magnitude: 100 },
    { name: "Lateness", shapValue: -1.1, direction: "protective", magnitude: 34.375 },
    { name: "History", shapValue: 0, direction: "neutral", magnitude: 0 },
  ]);
});
