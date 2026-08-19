import { createHash } from "node:crypto";

const STRATEGY_MULTIPLIER = Object.freeze({
  conservative: 1.35,
  balanced: 1,
  aggressive: 0.72,
});

const MODEL_VERSION = "trustfutures-risk-v1-fixed-seed";

export function priceQuote(history, { coverageAmount, strategy }) {
  if (!Object.hasOwn(STRATEGY_MULTIPLIER, strategy)) throw new Error("unknown strategy");
  if (coverageAmount <= 0n) throw new Error("coverage must be positive");
  const total = history.successCount + history.violationCount + history.expiryCount;
  const failureRate = total === 0 ? 0.5 : (history.violationCount + history.expiryCount) / total;
  const normalized =
    failureRate * 6_000 +
    Math.min(history.meanSlippageBps, 1_000) * 1.2 +
    Math.min(history.meanLatenessBps, 1_000) * 0.7 +
    Math.max(history.amountVsP95Bps - 10_000, 0) * 0.15 +
    history.deadlineTightnessBps * 0.08 +
    history.volatilityBps * 0.25;
  const failureProbabilityBps = Math.max(100, Math.min(9_500, Math.round(normalized * STRATEGY_MULTIPLIER[strategy])));
  const premiumBps = Math.max(75, Math.min(3_000, Math.round(failureProbabilityBps * 1.35 + 50)));
  const premiumAmount = coverageAmount * BigInt(premiumBps) / 10_000n;
  const factors = rankFactors(history, failureRate);
  return {
    strategy,
    failureProbabilityBps,
    premiumBps,
    premiumAmount,
    juniorAmount: coverageAmount / 5n,
    seniorAmount: coverageAmount - coverageAmount / 5n,
    modelHash: `0x${createHash("sha256").update(`${MODEL_VERSION}:${strategy}`).digest("hex")}`,
    factors,
  };
}

export function explainFallback(quote) {
  return {
    summary: `Model prices ${quote.failureProbabilityBps / 100}% execution-failure risk for ${quote.strategy} underwriting.`,
    topRisks: quote.factors.slice(0, 3).map((factor) => factor.label),
    protectiveTerms: "20% junior first-loss stake; 80% senior LP capital.",
  };
}

function rankFactors(history, failureRate) {
  const candidates = [
    { label: `Historical failure rate ${(failureRate * 100).toFixed(1)}%`, score: failureRate * 10_000 },
    { label: `Mean slippage ${history.meanSlippageBps} bps`, score: history.meanSlippageBps * 1.2 },
    { label: `Deadline tightness ${history.deadlineTightnessBps} bps`, score: history.deadlineTightnessBps * 0.08 },
    { label: `Market volatility ${history.volatilityBps} bps`, score: history.volatilityBps * 0.25 },
    { label: `Task size ${history.amountVsP95Bps} bps of historical P95`, score: Math.max(history.amountVsP95Bps - 10_000, 0) * 0.15 },
  ];
  return candidates.sort((a, b) => b.score - a.score);
}
