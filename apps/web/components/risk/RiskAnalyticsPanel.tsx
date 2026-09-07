import type { RiskFeature } from "../../lib/trustfutures/types";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { normaliseRiskFeatures } from "./risk-model";

export interface RiskExplanation {
  summary: string;
  topRisks: readonly string[];
  protectiveTerms: readonly string[] | string;
}

export interface RiskAnalyticsPanelProps {
  features: readonly RiskFeature[];
  explanation: RiskExplanation;
  probability?: number;
  modelVersion?: string;
  compact?: boolean;
  provenance?: { trainingData?: string; calibrationMethod?: string; modelHash?: string; abstentionReasons?: string[]; liveOutcomeCount?: number; confidence?: number; featureDrift?: number; outOfDistribution?: boolean };
}

export function RiskAnalyticsPanel({
  features,
  explanation,
  probability,
  modelVersion,
  compact = false,
  provenance,
}: RiskAnalyticsPanelProps) {
  const normalised = normaliseRiskFeatures(features);
  const protectiveTerms = typeof explanation.protectiveTerms === "string" ? [explanation.protectiveTerms] : explanation.protectiveTerms;

  return (
    <div className={`risk-analytics${compact ? " risk-analytics--compact" : ""}`}>
      <div className="risk-analytics__heading">
        <div><span>CALIBRATED FAILURE RISK</span><strong>{probability == null ? "—" : `${(probability * 100).toFixed(1)}%`}</strong></div>
        {modelVersion && <code>{modelVersion}</code>}
      </div>
      <div className="risk-analytics__chart" role="img" aria-label="SHAP feature attribution chart">
        <ResponsiveContainer width="100%" height={compact ? 176 : 228}>
          <BarChart data={normalised} layout="vertical" margin={{ top: 4, right: 10, bottom: 4, left: compact ? 2 : 24 }}>
            <CartesianGrid stroke="#152837" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#718a9b", fontSize: 8 }} axisLine={{ stroke: "#24445a" }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={compact ? 82 : 118} tick={{ fill: "#9bb0be", fontSize: 8 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "#10202b" }} contentStyle={{ background: "#050a0f", border: "1px solid #24445a", fontFamily: "ui-monospace", fontSize: 10 }} formatter={(value) => [Number(value).toFixed(3), "SHAP"]} />
            <ReferenceLine x={0} stroke="#7890a2" />
            <Bar dataKey="shapValue" radius={[2, 2, 2, 2]} animationDuration={550}>
              {normalised.map((feature) => <Cell key={feature.name} fill={feature.direction === "risk" ? "#ff5a6f" : feature.direction === "protective" ? "#66f7a1" : "#718493"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="risk-analytics__summary">{explanation.summary}</p>
      {provenance && <p className="risk-analytics__summary"><code>{provenance.trainingData ?? "provenance unavailable"} · {provenance.calibrationMethod ?? "calibration unavailable"} · live outcomes {provenance.liveOutcomeCount ?? 0} · confidence {provenance.confidence == null ? "—" : `${(provenance.confidence * 100).toFixed(0)}%`} · drift {provenance.featureDrift ?? "—"} · OOD {String(provenance.outOfDistribution ?? false)} · {provenance.modelHash ?? ""}</code>{provenance.abstentionReasons?.length ? <span role="alert"> Quote withheld: {provenance.abstentionReasons.join(", ")}</span> : null}</p>}
      <pre className="risk-analytics__json"><code>{JSON.stringify({
        topRisks: explanation.topRisks,
        protectiveTerms,
      }, null, 2)}</code></pre>
    </div>
  );
}
