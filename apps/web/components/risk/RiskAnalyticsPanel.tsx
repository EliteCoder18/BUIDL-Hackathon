import type { RiskFeature } from "../../lib/trustfutures/types";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { riskChartModel } from "./risk-model";

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
  provenance?: { trainingData?: string; calibrationMethod?: string; modelHash?: string; abstentionReasons?: string[]; liveOutcomeCount?: number; confidence?: number; featureDrift?: number | null; outOfDistribution?: boolean };
}

export function RiskAnalyticsPanel({
  features,
  explanation,
  probability,
  modelVersion,
  compact = false,
  provenance,
}: RiskAnalyticsPanelProps) {
  const chart = riskChartModel(features);
  const protectiveTerms = typeof explanation.protectiveTerms === "string" ? [explanation.protectiveTerms] : explanation.protectiveTerms;

  return (
    <div className={`risk-analytics${compact ? " risk-analytics--compact" : ""}`}>
      <div className="risk-analytics__heading">
        <div><span>CALIBRATED FAILURE RISK</span><strong>{probability == null ? "—" : `${(probability * 100).toFixed(1)}%`}</strong></div>
        {modelVersion && <code>{modelVersion}</code>}
      </div>
      <div className="risk-analytics__chart" role="img" aria-label="SHAP feature attribution chart">
        <ResponsiveContainer width="100%" height={Math.max(compact ? 190 : 220, chart.rows.length * (compact ? 42 : 50))}>
          <BarChart data={chart.rows} layout="vertical" margin={{ top: 8, right: 18, bottom: 20, left: compact ? 8 : 24 }}>
            <CartesianGrid stroke="#152837" horizontal={false} />
            <XAxis type="number" domain={chart.domain} tick={{ fill: "#a69dac", fontSize: 12 }} axisLine={{ stroke: "#4b405b" }} tickLine={false} tickFormatter={(value) => Number(value).toFixed(2)} />
            <YAxis type="category" dataKey="label" width={compact ? 128 : 168} tick={{ fill: "#c0b8ce", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "rgba(169,150,255,.06)" }} contentStyle={{ background: "#0f0a18", border: "1px solid #4b405b", borderRadius: 12, fontFamily: "ui-monospace", fontSize: 12 }} formatter={(value, _name, item) => [`${Number(value).toFixed(3)} · observed ${item.payload.valueLabel}`, "SHAP impact"]} />
            <ReferenceLine x={0} stroke="#7890a2" />
            <Bar dataKey="shapValue" radius={[4, 4, 4, 4]} minPointSize={4} animationDuration={400}>
              {chart.rows.map((feature) => <Cell key={feature.name} fill={feature.direction === "risk" ? "#ff5e66" : feature.direction === "protective" ? "#c8ff5a" : "#9289a3"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <ul className="sr-only">
          {chart.rows.map((feature) => <li key={feature.name}>{feature.label}: observed value {feature.valueLabel}; SHAP impact {feature.impactLabel}; {feature.direction}.</li>)}
        </ul>
      </div>
      <p className="risk-analytics__summary">{explanation.summary}</p>
      <details className="model-evidence">
        <summary>Model evidence</summary>
        {provenance && <p className="risk-analytics__summary"><code>{provenance.trainingData ?? "provenance unavailable"} · {provenance.calibrationMethod ?? "calibration unavailable"} · live outcomes {provenance.liveOutcomeCount ?? 0} · confidence {provenance.confidence == null ? "—" : `${(provenance.confidence * 100).toFixed(0)}%`} · drift {provenance.featureDrift ?? "—"} · OOD {String(provenance.outOfDistribution ?? false)} · {provenance.modelHash ?? ""}</code>{provenance.abstentionReasons?.length ? <span role="alert"> Quote withheld: {provenance.abstentionReasons.join(", ")}</span> : null}</p>}
        <pre className="risk-analytics__json"><code>{JSON.stringify({
          topRisks: explanation.topRisks,
          protectiveTerms,
        }, null, 2)}</code></pre>
      </details>
    </div>
  );
}
