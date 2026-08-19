"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CrossChainTopology } from "../components/cross-chain/CrossChainTopology";
import { NetworkTelemetry } from "../components/dashboard/NetworkTelemetry";
import { SagaRail } from "../components/dashboard/SagaRail";
import { MetricReadout } from "../components/ui/MetricReadout";
import { StatusChip } from "../components/ui/StatusChip";
import { TechnicalPanel } from "../components/ui/TechnicalPanel";
import type { DemoStateResource, VaultResource } from "../lib/api";
import { useCrossChainOrchestrator } from "../lib/orchestration";

function units(value?: string) {
  return value ? (Number(value) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
}

export default function OperationsPage() {
  const { api, state } = useCrossChainOrchestrator();
  const [snapshot, setSnapshot] = useState<DemoStateResource>();
  const [vault, setVault] = useState<VaultResource>();
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api.getDemoState(), api.getVault()])
      .then(([nextSnapshot, nextVault]) => { setSnapshot(nextSnapshot); setVault(nextVault); setError(""); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "API unavailable"));
  }, [api]);
  const latestPolicy = snapshot?.policies.at(-1);
  return (
    <div className="route-stack">
      <header className="route-heading">
        <div><p className="kicker">CONTROL PLANE / OVERVIEW</p><h1>Cross-chain reliability operations</h1><p>Price AI-agent failure, lock first-loss capital, and settle objective execution proofs.</p></div>
        <div className="route-actions"><StatusChip label={error ? "DATA LINK OFFLINE" : "SYSTEM NOMINAL"} tone={error ? "danger" : "success"} pulse={!error} /><Link className="technical-button technical-button--primary" href="/jobs/new">NEW MANDATE</Link></div>
      </header>
      {error && <div className="error-banner" role="alert"><strong>LOCAL API UNREACHABLE</strong><span>{error}</span><code>Run: npm run demo</code></div>}
      <NetworkTelemetry reservedCapital={units(vault?.reserved)} proofLatency="LOCAL / <1s" />
      <div className="dashboard-grid dashboard-grid--topology">
        <TechnicalPanel eyebrow="LIVE NETWORK DAG" title="Execution and capital topology" action={<StatusChip label={state.replaceAll("_", " ")} tone="cyan" pulse />}>
          <CrossChainTopology state={state} />
        </TechnicalPanel>
        <TechnicalPanel eyebrow="DETERMINISTIC ORCHESTRATOR" title="Saga state vector">
          <SagaRail state={state} />
          <div className="state-terminal"><span>CURRENT STATE</span><strong>{state}</strong><code>{latestPolicy?.policyId ?? "NO_ACTIVE_POLICY"}</code></div>
        </TechnicalPanel>
      </div>
      <div className="dashboard-grid dashboard-grid--metrics">
        <MetricReadout label="REGISTERED AGENTS" value={snapshot?.agents.length ?? "—"} detail="ERC-8004 IDENTITIES" tone="green" />
        <MetricReadout label="SENIOR LIQUIDITY" value={units(vault?.totalAssets)} detail="mUSDC / CC3" tone="cyan" />
        <MetricReadout label="ACTIVE POLICIES" value={snapshot?.policies.filter((policy) => policy.state === "CREDITCOIN_POLICY_LOCKED").length ?? "—"} detail="CAPITAL RESERVED" tone="amber" />
        <MetricReadout label="CONFIRMED PROOFS" value={snapshot?.proofs.filter((proof) => proof.state === "confirmed").length ?? "—"} detail="LOCAL ATTESTCOIN SIM" />
      </div>
      <TechnicalPanel eyebrow="OPERATOR SHORTCUTS" title="Launch a complete bonded mandate">
        <div className="operator-cards">
          <Link href="/agents"><span>01</span><strong>Inspect agents</strong><small>Attested histories + SHAP risk</small></Link>
          <Link href="/jobs/new"><span>02</span><strong>Fund mandate</strong><small>Sepolia job transaction</small></Link>
          <Link href="/vault"><span>03</span><strong>Audit capital</strong><small>20/80 CC3 liquidity</small></Link>
        </div>
      </TechnicalPanel>
    </div>
  );
}
