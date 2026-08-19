import { priceQuote } from "./risk-engine.mjs";

export function featuresFromHistory(history) {
  const total = history.successCount + history.violationCount + history.expiryCount;
  return {
    failure_rate: total === 0 ? 0.5 : (history.violationCount + history.expiryCount) / total,
    mean_slippage_bps: history.meanSlippageBps,
    mean_lateness_bps: history.meanLatenessBps,
    amount_vs_p95_bps: history.amountVsP95Bps,
    deadline_tightness_bps: history.deadlineTightnessBps,
    volatility_bps: history.volatilityBps,
  };
}

function fallback(history) {
  const score = priceQuote(history, { coverageAmount: 100_000_000n, strategy: "balanced" });
  const values = featuresFromHistory(history);
  const shapValues = {
    failure_rate: values.failure_rate * 6,
    mean_slippage_bps: values.mean_slippage_bps * 0.0012,
    mean_lateness_bps: values.mean_lateness_bps * 0.0007,
    amount_vs_p95_bps: Math.max(values.amount_vs_p95_bps - 10_000, 0) * 0.00015,
    deadline_tightness_bps: values.deadline_tightness_bps * 0.00008,
    volatility_bps: values.volatility_bps * 0.00025,
  };
  return {
    failureProbabilityBps: score.failureProbabilityBps,
    modelVersion: "trustfutures-risk-v1-fixed-seed",
    modelHash: score.modelHash,
    features: Object.entries(values).map(([name, value]) => ({ name, value, shapValue: shapValues[name] })),
    confidence: 0.7,
    abstain: false,
    source: "deterministic-fallback",
  };
}

function validServiceResult(value) {
  return value && Number.isInteger(value.failureProbabilityBps)
    && value.failureProbabilityBps >= 100 && value.failureProbabilityBps <= 9_500
    && typeof value.modelHash === "string"
    && Array.isArray(value.features)
    && typeof value.abstain === "boolean";
}

export function createRiskClient({ baseUrl = "http://127.0.0.1:8000", fetchImpl = fetch } = {}) {
  return {
    async score(history) {
      try {
        const response = await fetchImpl(`${baseUrl}/v1/risk`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(featuresFromHistory(history)),
        });
        if (!response.ok) throw new Error(`risk service ${response.status}`);
        const result = await response.json();
        if (!validServiceResult(result)) throw new Error("invalid risk service response");
        return { ...result, source: "shap-service" };
      } catch {
        return fallback(history);
      }
    },
  };
}
