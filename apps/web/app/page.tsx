"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useExecutionMode } from "./execution-mode-provider";
import { CrossChainTopology } from "../components/cross-chain/CrossChainTopology";
import { resolveMarketMetrics } from "../components/dashboard/market-model";
import { NetworkTelemetry } from "../components/dashboard/NetworkTelemetry";
import { SagaRail } from "../components/dashboard/SagaRail";
import { PolicyHistory } from "../components/policy/PolicyHistory";
import { MetricReadout } from "../components/ui/MetricReadout";
import { StatusChip } from "../components/ui/StatusChip";
import { TechnicalPanel } from "../components/ui/TechnicalPanel";
import type { DemoStateResource, LiveMarketResource, VaultResource } from "../lib/api";
import { useCrossChainOrchestrator } from "../lib/orchestration";

function units(value?: string) {
  return value ? (Number(value) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
}

export default function OperationsPage() {
  const { api, state, context } = useCrossChainOrchestrator();
  const { mode } = useExecutionMode();
  const { address } = useAccount();
  const [snapshot, setSnapshot] = useState<DemoStateResource>();
  const [vault, setVault] = useState<VaultResource>();
  const [liveMarket, setLiveMarket] = useState<LiveMarketResource>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    async function load() {
      try {
        const nextSnapshot = await api.getDemoState();
        if (!active) return;
        setSnapshot(nextSnapshot);
        if (mode === "wallet") {
          setVault(undefined);
          setLiveMarket(address ? await api.getLiveMarket(address) : undefined);
        } else {
          setLiveMarket(undefined);
          setVault(await api.getVault());
        }
        if (active) setError("");
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "API unavailable");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [address, api, mode]);

  const metrics = resolveMarketMetrics(mode, snapshot, vault, liveMarket);
  const displayState = metrics.orchestratorState ?? state;
  const statePolicyLabel = mode === "wallet" && !address
    ? "CONNECT WALLET"
    : loading ? "READING CHAIN STATE" : metrics.latestPolicyId ?? "NO POLICY FOUND";
  const historyStatus = !address ? "WALLET DISCONNECTED" : loading ? "READING CHAIN" : error ? "READ FAILED" : `${liveMarket?.policies.length ?? 0} POLICIES`;

  return (
    <div className="route-stack observatory-route">
      <header className="route-heading observatory-heading">
        <div>
          <p className="kicker"><span>00</span> OBSERVATORY / LIVE MARKET</p>
          <h1>Cross-chain<br /><em>reliability</em> operations</h1>
          <p>Hire any AI agent. The market prices failure. A deterministic bond pays when trust breaks.</p>
        </div>
        <div className="route-actions">
          <StatusChip label={error ? "DATA LINK OFFLINE" : "SYSTEM NOMINAL"} tone={error ? "danger" : "success"} pulse={!error} />
          <Link className="technical-button technical-button--primary launch-control" href="/jobs/new" aria-label="NEW MANDATE">
            <span>Launch bonded mandate</span><i aria-hidden="true">↗</i><small>NEW MANDATE</small>
          </Link>
        </div>
      </header>

      {error && <div className="error-banner" role="alert"><strong>{mode === "wallet" ? "PUBLIC CHAIN READ FAILED" : "LOCAL API UNREACHABLE"}</strong><span>{error}</span><code>{mode === "wallet" ? "Creditcoin CC3 / 102031" : "Run: ./start"}</code></div>}

      <section className="observatory-stage" aria-label="Live network observatory">
        <div className="observatory-stage__coordinate observatory-stage__coordinate--left">CHAIN VECTOR 41.072°</div>
        <div className="observatory-stage__coordinate observatory-stage__coordinate--right">EPOCH 20·08·2026</div>
        <CrossChainTopology
          state={displayState}
          evidence={{
            sepoliaTxHash: context.sepoliaTxHash,
            creditcoinTxHash: context.creditcoinTxHash ?? liveMarket?.policies[0]?.lockTxHash,
            proofId: context.proofId ?? context.proofRequestId,
          }}
        />

        <div className="state-lens">
          <span>CURRENT SAGA VECTOR</span>
          <strong>{displayState.replaceAll("_", " ")}</strong>
          <code>{statePolicyLabel}</code>
        </div>

        <div className="telemetry-satellite telemetry-satellite--agents">
          <MetricReadout label="REGISTERED AGENTS" value={snapshot?.agents.length ?? "—"} detail="ERC-8004 IDENTITIES" tone="green" />
        </div>
        <div className="telemetry-satellite telemetry-satellite--liquidity">
          <MetricReadout label="SENIOR LIQUIDITY" value={units(metrics.vault?.totalAssets)} detail="mUSDC / CC3" tone="cyan" />
        </div>
        <div className="telemetry-satellite telemetry-satellite--policies">
          <MetricReadout label="ACTIVE POLICIES" value={metrics.activePolicyCount ?? "—"} detail="CAPITAL RESERVED" tone="amber" />
        </div>
        <div className="telemetry-satellite telemetry-satellite--proofs">
          <MetricReadout label="CONFIRMED PROOFS" value={metrics.confirmedProofCount ?? "—"} detail="ATTESTCOIN EVIDENCE" />
        </div>
      </section>

      <div className="evidence-ribbon">
        <NetworkTelemetry reservedCapital={units(metrics.vault?.reserved)} proofLatency={mode === "wallet" ? "PUBLIC / FINALIZED" : "LOCAL / <1s"} />
      </div>

      <div className="observatory-lower-grid">
        <TechnicalPanel eyebrow="DETERMINISTIC ORCHESTRATOR" title="Capital-bound saga vector" action={<StatusChip label={displayState.replaceAll("_", " ")} tone="cyan" pulse />}>
          <SagaRail state={displayState} compact />
        </TechnicalPanel>

        <TechnicalPanel eyebrow="OPERATOR APERTURES" title="Enter the market">
          <div className="operator-cards">
            <Link href="/agents"><span>01 / IDENTITY</span><strong>Inspect agents</strong><small>Attested histories + ML attribution</small><i>↗</i></Link>
            <Link href="/jobs/new"><span>02 / MANDATE</span><strong>Fund a job</strong><small>Constrain objective execution</small><i>↗</i></Link>
            <Link href="/vault"><span>03 / CAPITAL</span><strong>Audit the vault</strong><small>20/80 loss waterfall</small><i>↗</i></Link>
          </div>
        </TechnicalPanel>
      </div>

      {mode === "wallet" && <TechnicalPanel eyebrow="CREDITCOIN / WALLET LEDGER" title="Policy transaction history" action={<StatusChip label={historyStatus} tone={!address || error ? "danger" : "cyan"} />}>
        {!address
          ? <div className="policy-history-empty"><strong>CONNECT METAMASK</strong><span>Connect a wallet to load its public Creditcoin policy history.</span></div>
          : loading
            ? <div className="policy-history-empty" role="status" aria-atomic="true"><strong>READING CREDITCOIN</strong><span>Loading confirmed policy events and contract state…</span></div>
            : error
              ? <div className="policy-history-empty" role="alert"><strong>HISTORY UNAVAILABLE</strong><span>Check the Creditcoin RPC connection, then reload this page.</span></div>
              : <PolicyHistory policies={liveMarket?.policies ?? []} />}
      </TechnicalPanel>}
    </div>
  );
}
