import test from "node:test";
import assert from "node:assert/strict";

import { priceQuote, explainFallback } from "../services/underwriter/risk-engine.mjs";

const strongHistory = {
  successCount: 18,
  violationCount: 0,
  expiryCount: 0,
  meanSlippageBps: 15,
  meanLatenessBps: 50,
  amountVsP95Bps: 9_000,
  deadlineTightnessBps: 2_000,
  volatilityBps: 300,
};

test("risk engine charges materially more after violations", () => {
  const good = priceQuote(strongHistory, { coverageAmount: 1_000_000n, strategy: "balanced" });
  const bad = priceQuote({ ...strongHistory, successCount: 3, violationCount: 7, expiryCount: 2 }, { coverageAmount: 1_000_000n, strategy: "balanced" });
  assert.ok(bad.failureProbabilityBps > good.failureProbabilityBps);
  assert.ok(bad.premiumAmount > good.premiumAmount);
});

test("each strategy returns a bounded quote with mandatory junior stake", () => {
  for (const strategy of ["conservative", "balanced", "aggressive"]) {
    const quote = priceQuote(strongHistory, { coverageAmount: 1_000_000n, strategy });
    assert.equal(quote.juniorAmount, 200_000n);
    assert.ok(quote.failureProbabilityBps >= 100 && quote.failureProbabilityBps <= 9_500);
    assert.ok(quote.premiumAmount > 0n);
    assert.ok(quote.modelHash.startsWith("0x"));
  }
});

test("fallback explanation exposes decision factors without changing quote", () => {
  const quote = priceQuote(strongHistory, { coverageAmount: 1_000_000n, strategy: "balanced" });
  const explanation = explainFallback(quote);
  assert.equal(explanation.protectiveTerms, "20% junior first-loss stake; 80% senior LP capital.");
  assert.ok(explanation.topRisks.length > 0);
});
