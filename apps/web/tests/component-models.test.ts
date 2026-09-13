import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildSagaSteps } from "../components/dashboard/saga-model";
import { buildSagaJourney } from "../components/dashboard/saga-journey-model";
import { WalletTransactionStepper } from "../components/wallet/WalletTransactionStepper";
import { calculateWaterfall } from "../components/policy/loss-waterfall-model";
import { normaliseRiskFeatures, riskChartModel } from "../components/risk/risk-model";

test("saga rail marks completed, active, and future phases deterministically", () => {
  const steps = buildSagaSteps("QUOTE_SIGNED");

  assert.deepEqual(steps.map((step) => step.status), [
    "complete",
    "complete",
    "complete",
    "active",
    "pending",
  ]);
});

test("a locked policy completes capital bonding and activates outcome delivery", () => {
  const steps = buildSagaSteps("CREDITCOIN_POLICY_LOCKED");

  assert.deepEqual(steps.map((step) => step.status), ["complete", "complete", "complete", "complete", "active"]);
});

test("job journey identifies the current action and bounded progress", () => {
  const journey = buildSagaJourney("SEPOLIA_MANDATE_MINED");

  assert.equal(journey.current.id, "finality");
  assert.equal(journey.current.description, "Sepolia receipt becomes canonical");
  assert.equal(journey.completedCount, 1);
  assert.equal(journey.progress, 20);
  assert.equal(buildSagaJourney("SETTLED_SUCCESS").progress, 100);
});

test("wallet confirmation uses a distinct pending state", () => {
  const html = renderToStaticMarkup(createElement(WalletTransactionStepper, {
    steps: [{ label: "Create funded mandate", chain: "Sepolia", status: "active" }],
    busy: true,
    onAdvance: () => {},
  }));

  assert.match(html, /technical-button--pending/);
  assert.match(html, /AWAITING METAMASK CONFIRMATION/);
});

test("wallet policy setup exposes a cancel action before capital is locked", () => {
  const html = renderToStaticMarkup(createElement(WalletTransactionStepper, {
    steps: [{ label: "Mint premium mUSDC", chain: "Creditcoin CC3", status: "active" }],
    busy: false,
    onAdvance: () => {},
    cancel: { label: "Cancel policy setup", onClick: () => {} },
  }));

  assert.match(html, />Cancel policy setup</);
});

test("confirmed wallet policy remains selected when the quote route remounts", () => {
  const source = readFileSync(new URL("../app/quotes/[jobKey]/page.tsx", import.meta.url), "utf8");

  assert.match(source, /selectedQuoteId=\{confirmedQuoteId\}/);
  assert.match(source, /context\.creditcoinTxHash/);
  assert.match(source, /context\.quoteId/);
});

test("wallet policy flow replaces the quote auction after a quote is chosen", () => {
  const source = readFileSync(new URL("../app/quotes/[jobKey]/page.tsx", import.meta.url), "utf8");

  assert.match(source, /showWalletPolicyFlow/);
  assert.match(source, /showWalletPolicyFlow\s*\?\s*<WalletPolicyFlow/);
  assert.match(source, /:\s*<QuoteAuctionGrid/);
});

test("quote cards keep the policy action visible beside a long nonce", () => {
  const styles = readFileSync(new URL("../app/styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.quote-card__footer\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\) auto/);
  assert.match(styles, /\.quote-card__footer\s*>\s*div\s*\{[^}]*min-width:\s*0/);
  assert.match(styles, /\.quote-card__footer code\s*\{[^}]*text-overflow:\s*ellipsis/);
});

test("compact quote analytics use a scannable signal ledger", () => {
  const source = readFileSync(new URL("../components/risk/RiskAnalyticsPanel.tsx", import.meta.url), "utf8");

  assert.match(source, /risk-analytics__signals/);
  assert.match(source, /chart\.rows\.slice\(0, 4\)/);
});

test("public vault renders the fast capital snapshot independently of policy history", () => {
  const source = readFileSync(new URL("../app/vault/page.tsx", import.meta.url), "utf8");

  assert.match(source, /api\.getLiveVault\(\)/);
  assert.match(source, /Promise\.allSettled/);
});

test("operations explains the post-lock operator handoff and refreshes public state", () => {
  const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /CLIENT STAGE COMPLETE/);
  assert.match(source, /Agent execution/);
  assert.match(source, /Attestcoin proof/);
  assert.match(source, /Keeper settlement/);
  assert.match(source, /window\.setInterval\(load, 12_000\)/);
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
