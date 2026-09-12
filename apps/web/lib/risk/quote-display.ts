import type { DisplayQuote } from "../../components/risk/QuoteCard";
import type { ApiQuote, LiveQuote } from "../api/schema";

function displayMusdc(value: `${bigint}`): number {
  return Number(BigInt(value)) / 1_000_000;
}

export function quoteToDisplay(quote: ApiQuote | LiveQuote, index: number): DisplayQuote {
  const profile = quote.riskProfile;
  return {
    id: `${index}:${quote.strategy}`,
    underwriter: quote.underwriter,
    coverageAmount: displayMusdc(quote.coverageAmount),
    premiumAmount: displayMusdc(quote.premiumAmount),
    juniorAmount: displayMusdc(quote.juniorAmount),
    validUntil: quote.validUntil,
    modelHash: quote.modelHash,
    nonce: quote.nonce,
    probability: quote.failureProbabilityBps / 10_000,
    features: profile.features,
    explanation: quote.llmExplanation,
    provenance: {
      source: profile.source,
      modelVersion: profile.modelVersion,
      trainingData: profile.trainingData,
      liveFeatures: profile.liveFeatures,
      calibrationMethod: profile.calibrationMethod,
      modelHash: profile.modelHash,
      datasetVersion: profile.dataLineage?.datasetVersion,
      datasetHash: profile.dataLineage?.datasetHash,
      liveOutcomeCount: profile.dataLineage?.liveOutcomeCount,
      confidence: profile.confidence,
      featureDrift: profile.diagnostics?.featureDrift,
      outOfDistribution: profile.diagnostics?.outOfDistribution,
      abstentionReasons: profile.diagnostics?.abstentionReasons,
      warnings: profile.diagnostics?.warnings,
    },
    strategy: quote.strategy,
  };
}
