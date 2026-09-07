"use client";

import { useEffect, useState } from "react";
import { RiskAnalyticsPanel } from "../../components/risk/RiskAnalyticsPanel";
import { StatusChip } from "../../components/ui/StatusChip";
import { TechnicalPanel } from "../../components/ui/TechnicalPanel";
import type { AgentResource, AgentRiskResource } from "../../lib/api";
import { useTrustFuturesApi } from "../../lib/orchestration";

export default function AgentsPage() {
  const api = useTrustFuturesApi();
  const [agents, setAgents] = useState<Array<{ agent: AgentResource; risk: AgentRiskResource }>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api.getAgents().then(async (items) => Promise.all(items.map(async (agent) => ({ agent, risk: await api.getAgentRisk(agent.agentId) }))))
      .then(setAgents).catch((cause) => setError(cause instanceof Error ? cause.message : "Agent telemetry unavailable"));
  }, [api]);
  return <div className="route-stack">
    <header className="route-heading"><div><p className="kicker">ERC-8004 / IDENTITY REGISTRY</p><h1>Agent reliability matrix</h1><p>Attested execution history drives calibrated failure probability and signed bond economics.</p></div><StatusChip label={`${agents.length || "—"} VERIFIED AGENTS`} tone="success" /></header>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="agent-matrix">{agents.map(({ agent, risk }) => {
      const total = agent.history.successCount + agent.history.violationCount + agent.history.expiryCount;
      const reliability = total ? (agent.history.successCount / total) * 100 : 0;
      return <TechnicalPanel key={agent.agentId} eyebrow={`ERC-8004 / AGENT ${agent.agentId.padStart(4, "0")}`} title={agent.name} action={<StatusChip label={risk.source.toUpperCase()} tone={risk.source.includes("fallback") ? "warning" : "cyan"} />}>
        <div className="agent-identity"><div className="agent-orb" aria-hidden="true"><span>{agent.name.slice(0, 1)}</span></div><div className="agent-readouts"><span><small>RELIABILITY</small><strong>{reliability.toFixed(1)}%</strong></span><span><small>SUCCESS / VIOLATION / EXPIRY</small><strong>{agent.history.successCount} / {agent.history.violationCount} / {agent.history.expiryCount}</strong></span><span><small>MODEL CONFIDENCE</small><strong>{(risk.confidence * 100).toFixed(0)}%</strong></span></div></div>
        <RiskAnalyticsPanel features={risk.features} probability={risk.failureProbabilityBps / 10_000} modelVersion={risk.modelVersion} provenance={{ trainingData: risk.trainingData, calibrationMethod: risk.calibrationMethod, modelHash: risk.modelHash, abstentionReasons: risk.diagnostics?.abstentionReasons, liveOutcomeCount: risk.dataLineage?.liveOutcomeCount, confidence: risk.confidence, featureDrift: risk.diagnostics?.featureDrift, outOfDistribution: risk.diagnostics?.outOfDistribution }} explanation={{ summary: `${risk.calibrationMethod === "isotonic" ? "Calibrated" : "Bounded"} model prices ${agent.name}; data provenance is shown below.`, topRisks: risk.features.filter((feature) => feature.shapValue > 0).slice(0, 3).map((feature) => feature.name), protectiveTerms: ["20% underwriter first-loss", "Objective on-chain outcome", "Deterministic expiry finalization"] }} />
      </TechnicalPanel>;
    })}</div>
  </div>;
}
