import { priceQuote } from "./risk-engine.mjs";

export function featuresFromHistory(history, context = {}) {
  const total = history.successCount + history.violationCount + history.expiryCount;
  const coverageSize = context.coverageSizeBaseUnits === undefined
    ? context.coverageSize ?? 100_000
    : Number(context.coverageSizeBaseUnits) / 1_000_000;
  return {
    failure_rate: total === 0 ? 0.5 : (history.violationCount + history.expiryCount) / total,
    mean_slippage_bps: history.meanSlippageBps,
    mean_lateness_bps: history.meanLatenessBps,
    amount_vs_p95_bps: history.amountVsP95Bps,
    deadline_tightness_bps: history.deadlineTightnessBps,
    volatility_bps: history.volatilityBps,
    agent_id: context.agentId ?? "agent-00",
    mandate_category: context.mandateCategory ?? "swap",
    coverage_size: coverageSize,
    live_outcome_count: context.liveOutcomeCount ?? 0,
    attested_event_valid: context.attestedEventValid ?? false,
  };
}

function fallback(history, context = {}) {
  const score = priceQuote(history, { coverageAmount: 100_000_000n, strategy: "balanced" });
  const values = featuresFromHistory(history, context);
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
    features: Object.entries(shapValues).map(([name, shapValue]) => ({ name, value: values[name], shapValue })),
    confidence: 0.7,
    abstain: false,
    trainingData: "deterministic fallback",
    liveFeatures: context.attestedEventValid && context.liveOutcomeCount > 0 ? "attested on-chain outcomes" : "no attested outcomes available",
    calibrationMethod: "not-applied-service-unavailable",
    probabilityBoundsBps: { min: 100, max: 9_500 },
    dataLineage: { datasetVersion: "fallback-v1", datasetHash: `sha256:${score.modelHash.slice(2)}`, liveOutcomeCount: context.attestedEventValid ? context.liveOutcomeCount ?? 0 : 0 },
    diagnostics: { confidence: 0.7, featureDrift: null, outOfDistribution: false, abstentionReasons: [], warnings: ["risk-service-unavailable"] },
    source: "deterministic-fallback",
  };
}


function validServiceResult(value) {
  return value && Number.isInteger(value.failureProbabilityBps)
    && value.failureProbabilityBps >= 100 && value.failureProbabilityBps <= 9_500
    && typeof value.modelHash === "string"
    && Array.isArray(value.features)
    && typeof value.abstain === "boolean"
    && typeof value.trainingData === "string"
    && typeof value.liveFeatures === "string"
    && typeof value.calibrationMethod === "string"
    && value.dataLineage && Number.isInteger(value.dataLineage.liveOutcomeCount)
    && value.diagnostics && Number.isFinite(value.diagnostics.confidence)
    && Number.isFinite(value.diagnostics.featureDrift)
    && typeof value.diagnostics.outOfDistribution === "boolean"
    && Array.isArray(value.diagnostics.abstentionReasons)
    && Array.isArray(value.diagnostics.warnings);
}

export function createRiskClient({ baseUrl = process.env.RISK_SERVICE_URL ?? "http://127.0.0.1:8000", fetchImpl = fetch } = {}) {
  return {
    async score(history, context = {}) {
      try {
        const response = await fetchImpl(`${baseUrl}/v1/risk`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(featuresFromHistory(history, context)),
        });
        if (!response.ok) throw new Error(`risk service ${response.status}`);
        const result = await response.json();
        if (!validServiceResult(result)) throw new Error("invalid risk service response");
        return { ...result, source: "shap-service" };
      } catch {
        return fallback(history, context);
      }
    },
  };
}
