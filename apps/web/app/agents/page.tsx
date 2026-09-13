"use client";

import { useEffect, useState } from "react";
import { AgentProfileCard } from "../../components/agents/AgentProfileCard";
import { StatusChip } from "../../components/ui/StatusChip";
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
    {!error && agents.length === 0 && <div className="agent-registry-loading" role="status"><i /><strong>READING ERC-8004 REGISTRY</strong><span>Loading agent identities and calibrated risk evidence…</span></div>}
    <div className="agent-matrix">{agents.map(({ agent, risk }) => <AgentProfileCard key={agent.agentId} agent={agent} risk={risk} />)}</div>
  </div>;
}
