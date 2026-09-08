"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CrossChainTopology } from "../components/cross-chain/CrossChainTopology";
import { PublicEvidence } from "../components/deployments/PublicEvidence";
import { NetworkTelemetry } from "../components/dashboard/NetworkTelemetry";
import { SagaRail } from "../components/dashboard/SagaRail";
import { MetricReadout } from "../components/ui/MetricReadout";
import { StatusChip } from "../components/ui/StatusChip";
import { TechnicalPanel } from "../components/ui/TechnicalPanel";
import type { DemoStateResource, VaultResource } from "../lib/api";
import { useCrossChainOrchestrator } from "../lib/orchestration";
import { resolveWalletMode } from "../lib/wallet/mode";

function units(value?: string) {
  return value ? (Number(value) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
}

export default function OperationsPage() {
  const mode = resolveWalletMode(process.env.NEXT_PUBLIC_EMBEDDED_DEMO);
  return mode.kind === "public" ? <PublicOperationsPage /> : <EmbeddedOperationsPage />;
}

function PublicOperationsPage() {
  const { state } = useCrossChainOrchestrator();
  return <div className="route-stack observatory-route">
    <header className="route-heading observatory-heading"><div><p className="kicker"><span>00</span> PUBLIC TESTNET / LIVE MARKET</p><h1>Trust becomes<br /><em>priced capital.</em></h1><p>Connect MetaMask to create Sepolia mandates, stake CC3 liquidity, sign failure-risk quotes, and verify the real Attestcoin payout loop.</p></div><div className="route-actions"><StatusChip label="PUBLIC TESTNET LIVE" tone="success" pulse /><Link className="technical-button technical-button--primary launch-control" href="/jobs/new"><span>Create public mandate</span><i>↗</i><small>START ON SEPOLIA</small></Link></div></header>
    <section className="observatory-stage observatory-stage--public" aria-label="Public cross-chain topology"><div className="observatory-stage__coordinate observatory-stage__coordinate--left">SEPOLIA → ATTESTCOIN → CC3</div><div className="observatory-stage__coordinate observatory-stage__coordinate--right">CHAIN IDS 11155111 / 102031</div><CrossChainTopology state={state} /><div className="state-lens"><span>WALLET ORCHESTRATOR</span><strong>{state.replaceAll("_", " ")}</strong><code>RECEIPT-DRIVEN / NON-CUSTODIAL</code></div><div className="public-stage-actions"><Link href="/jobs/new"><small>CLIENT</small><strong>CREATE MANDATE</strong><span>↗</span></Link><Link href="/vault"><small>LIQUIDITY PROVIDER</small><strong>DEPOSIT SENIOR</strong><span>↗</span></Link><Link href="/underwrite"><small>UNDERWRITER</small><strong>STAKE + QUOTE</strong><span>↗</span></Link></div></section>
    <div className="simulation-disclosure"><strong>SAFE PUBLIC LAB</strong><p>Only testnet contracts and freely mintable mock assets are enabled. Wallet signatures are user initiated; this prototype is a performance bond, not production insurance.</p></div>
    <PublicEvidence />
  </div>;
}

function EmbeddedOperationsPage() {
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
  const confirmedProofs = snapshot?.proofs.filter((proof) => proof.state === "confirmed").length;

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

      {error && <div className="error-banner" role="alert"><strong>LOCAL API UNREACHABLE</strong><span>{error}</span><code>Run: npm run demo</code></div>}

      <section className="observatory-stage" aria-label="Live network observatory">
        <div className="observatory-stage__coordinate observatory-stage__coordinate--left">CHAIN VECTOR 41.072°</div>
        <div className="observatory-stage__coordinate observatory-stage__coordinate--right">EPOCH 20·08·2026</div>
        <CrossChainTopology state={state} />

        <div className="state-lens">
          <span>CURRENT SAGA VECTOR</span>
          <strong>{state.replaceAll("_", " ")}</strong>
          <code>{latestPolicy?.policyId ?? "NO ACTIVE POLICY"}</code>
        </div>

        <div className="telemetry-satellite telemetry-satellite--agents">
          <MetricReadout label="REGISTERED AGENTS" value={snapshot?.agents.length ?? "—"} detail="ERC-8004 IDENTITIES" tone="green" />
        </div>
        <div className="telemetry-satellite telemetry-satellite--liquidity">
          <MetricReadout label="SENIOR LIQUIDITY" value={units(vault?.totalAssets)} detail="mUSDC / CC3" tone="cyan" />
        </div>
        <div className="telemetry-satellite telemetry-satellite--policies">
          <MetricReadout label="ACTIVE POLICIES" value={snapshot?.policies.filter((policy) => policy.state === "CREDITCOIN_POLICY_LOCKED").length ?? "—"} detail="CAPITAL RESERVED" tone="amber" />
        </div>
        <div className="telemetry-satellite telemetry-satellite--proofs">
          <MetricReadout label="CONFIRMED PROOFS" value={confirmedProofs ?? "—"} detail="ATTESTCOIN EVIDENCE" />
        </div>
      </section>

      <div className="evidence-ribbon">
        <NetworkTelemetry reservedCapital={units(vault?.reserved)} proofLatency="LOCAL / <1s" />
      </div>

      <div className="observatory-lower-grid">
        <TechnicalPanel eyebrow="DETERMINISTIC ORCHESTRATOR" title="Capital-bound saga vector" action={<StatusChip label={state.replaceAll("_", " ")} tone="cyan" pulse />}>
          <SagaRail state={state} compact />
        </TechnicalPanel>

        <TechnicalPanel eyebrow="OPERATOR APERTURES" title="Enter the market">
          <div className="operator-cards">
            <Link href="/agents"><span>01 / IDENTITY</span><strong>Inspect agents</strong><small>Attested histories + ML attribution</small><i>↗</i></Link>
            <Link href="/jobs/new"><span>02 / MANDATE</span><strong>Fund a job</strong><small>Constrain objective execution</small><i>↗</i></Link>
            <Link href="/vault"><span>03 / CAPITAL</span><strong>Audit the vault</strong><small>20/80 loss waterfall</small><i>↗</i></Link>
          </div>
        </TechnicalPanel>
      </div>
    </div>
  );
}
