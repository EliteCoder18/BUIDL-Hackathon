import type { RiskFeature } from "../../lib/trustfutures/types";

export type RiskDirection = "risk" | "protective" | "neutral";

export interface NormalisedRiskFeature extends RiskFeature {
  direction: RiskDirection;
  magnitude: number;
}

export interface RiskChartRow extends NormalisedRiskFeature {
  label: string;
  valueLabel: string;
  impactLabel: string;
}

function featureLabel(name: string) {
  return name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: number | undefined) {
  if (value === undefined) return "Unavailable";
  return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export function normaliseRiskFeatures(features: readonly RiskFeature[]): NormalisedRiskFeature[] {
  const maximum = Math.max(0, ...features.map(({ shapValue }) => Math.abs(shapValue)));
  return features.map((feature) => ({
    ...feature,
    direction: feature.shapValue > 0 ? "risk" : feature.shapValue < 0 ? "protective" : "neutral",
    magnitude: maximum === 0 ? 0 : (Math.abs(feature.shapValue) / maximum) * 100,
  }));
}

export function riskChartModel(features: readonly RiskFeature[]): { rows: RiskChartRow[]; domain: [number, number] } {
  const rows = normaliseRiskFeatures(features).map((feature) => ({
    ...feature,
    label: feature.label ?? featureLabel(feature.name),
    valueLabel: formatValue(feature.value),
    impactLabel: feature.shapValue.toFixed(3),
  }));
  const bound = Math.max(0.05, ...rows.map(({ shapValue }) => Math.abs(shapValue)));
  return { rows, domain: [-bound, bound] };
}
