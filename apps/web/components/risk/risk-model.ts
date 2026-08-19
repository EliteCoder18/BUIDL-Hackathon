import type { RiskFeature } from "../../lib/trustfutures/types";

export type RiskDirection = "risk" | "protective" | "neutral";

export interface NormalisedRiskFeature extends RiskFeature {
  direction: RiskDirection;
  magnitude: number;
}

export function normaliseRiskFeatures(features: readonly RiskFeature[]): NormalisedRiskFeature[] {
  const maximum = Math.max(0, ...features.map(({ shapValue }) => Math.abs(shapValue)));
  return features.map((feature) => ({
    ...feature,
    direction: feature.shapValue > 0 ? "risk" : feature.shapValue < 0 ? "protective" : "neutral",
    magnitude: maximum === 0 ? 0 : (Math.abs(feature.shapValue) / maximum) * 100,
  }));
}
