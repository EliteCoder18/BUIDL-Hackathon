import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSagaSteps } from "../components/dashboard/saga-model";
import { calculateWaterfall } from "../components/policy/loss-waterfall-model";
import { normaliseRiskFeatures, riskChartModel } from "../components/risk/risk-model";

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

test("risk chart uses a symmetric domain and retains visible zero-impact rows", () => {
  const model = riskChartModel([
    { name: "failure_rate", value: 0.2, shapValue: 0.4 },
    { name: "volatility_bps", value: 300, shapValue: 0 },
    { name: "mean_slippage_bps", value: 50, shapValue: -0.2 },
  ]);
  assert.deepEqual(model.domain, [-0.4, 0.4]);
  assert.equal(model.rows.length, 3);
  assert.equal(model.rows[1].impactLabel, "0.000");
  assert.equal(model.rows[1].valueLabel, "300");
  assert.equal(model.rows[2].direction, "protective");
});

test("an all-zero risk chart retains a stable non-zero axis", () => {
  const model = riskChartModel([{ name: "failure_rate", value: 0, shapValue: 0 }]);
  assert.deepEqual(model.domain, [-0.05, 0.05]);
});

test("application shell uses the Eclipse orbital dock instead of the old sidebar", () => {
  const source = readFileSync(new URL("../components/ui/TechnicalShell.tsx", import.meta.url), "utf8");
  assert.match(source, /orbital-dock/);
  assert.match(source, /edge-coordinate/);
  assert.match(source, /chain-constellation/);
  assert.doesNotMatch(source, /technical-shell__sidebar/);
});

test("cross-chain topology renders an eclipse, orbit rings, and distinct chain instruments", () => {
  const source = readFileSync(new URL("../components/cross-chain/CrossChainTopology.tsx", import.meta.url), "utf8");
  assert.match(source, /EclipseBody/);
  assert.match(source, /OrbitRings/);
  assert.match(source, /SepoliaCrystal/);
  assert.match(source, /VerifierAperture/);
  assert.match(source, /CapitalGyroscope/);
  assert.match(source, /Semi-implicit Euler/);
});

test("Eclipse typography keeps technical labels at accessible sizes", () => {
  const source = readFileSync(new URL("../app/styles.css", import.meta.url), "utf8");
  assert.match(source, /--micro-copy:\s*12px/);
  assert.match(source, /--label-copy:\s*13px/);
  assert.match(source, /--nav-copy:\s*14px/);
  assert.match(source, /\.metric-readout__label[^}]+var\(--label-copy\)/s);
  assert.match(source, /\.proof-rail__content code[^}]+var\(--micro-copy\)/s);
});
