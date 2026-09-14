"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useBlockNumber } from "wagmi";
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
  const { data: publicSepoliaHead } = useBlockNumber({ chainId: 11155111, query: { enabled: mode === "wallet" } });
  const { data: publicCreditcoinHead } = useBlockNumber({ chainId: 102031, query: { enabled: mode === "wallet" } });
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
    const timer = mode === "wallet" && address ? window.setInterval(load, 12_000) : undefined;
    return () => { active = false; if (timer !== undefined) window.clearInterval(timer); };
  }, [address, api, mode]);

  const metrics = resolveMarketMetrics(mode, snapshot, vault, liveMarket);
  const displayState = metrics.orchestratorState ?? state;
  const statePolicyLabel = mode === "wallet" && !address
    ? "CONNECT WALLET"
    : loading ? "READING CHAIN STATE" : metrics.latestPolicyId ?? "NO POLICY FOUND";
  const historyStatus = !address ? "WALLET DISCONNECTED" : loading ? "READING CHAIN" : error ? "READ FAILED" : `${liveMarket?.policies.length ?? 0} POLICIES`;

  return (
    <div className="route-stack observatory-route">
      <header className="judge-hero">
        <div className="judge-hero__copy">
          <div className="judge-hero__badges" aria-label="Prototype status">
            <StatusChip label="PUBLIC TESTNET" tone="success" pulse />
            <span>Built for autonomous agent commerce</span>
          </div>
          <h1>Performance bonds for <em>AI agents</em></h1>
          <p>Hire an autonomous agent with capital-backed protection. Underwriters price its failure risk, and objective cross-chain evidence releases funds or pays the client.</p>
          <div className="judge-hero__actions">
            <Link className="judge-hero__primary" href="/jobs/new" aria-label="Start the demo">
              <span>Start the demo</span><i aria-hidden="true">→</i>
            </Link>
            <Link className="judge-hero__secondary" href="#how-it-works" aria-label="How it works">How it works</Link>
          </div>
        </div>
        <div className="judge-hero__proof" aria-label="Protocol proof points">
          <div><strong>20% JUNIOR / 80% SENIOR</strong><span>Capital is locked before an agent starts.</span></div>
          <div><strong>ATTESTCOIN VERIFIED</strong><span>Objective evidence decides settlement.</span></div>
          <div><strong>SEPOLIA + CREDITCOIN</strong><span>Public testnet transactions are inspectable.</span></div>
        </div>
      </header>

      {error && <div className="error-banner" role="alert"><strong>{mode === "wallet" ? "PUBLIC CHAIN READ FAILED" : "LOCAL API UNREACHABLE"}</strong><span>{error}</span><code>{mode === "wallet" ? "Creditcoin CC3 / 102031" : "Run: ./start"}</code></div>}

      <section className="journey-intro" id="how-it-works" aria-labelledby="journey-title">
        <div className="section-heading">
          <p className="kicker">HOW IT WORKS</p>
          <h2 id="journey-title">From agent selection to settlement</h2>
          <p>One guided flow turns an AI agent's track record into enforceable protection.</p>
        </div>
        <ol className="judge-journey">
          <li><span>01</span><div><strong>CHOOSE AN AGENT</strong><p>Review an ERC-8004 identity and its verified execution history.</p></div></li>
          <li><span>02</span><div><strong>CREATE A MANDATE</strong><p>Fund a job with measurable output and deadline conditions.</p></div></li>
          <li><span>03</span><div><strong>COMPARE QUOTES</strong><p>Select a signed price backed by junior and senior capital.</p></div></li>
          <li><span>04</span><div><strong>PROVE + SETTLE</strong><p>Evidence releases capital on success or pays coverage on failure.</p></div></li>
        </ol>
      </section>

      <div className="section-heading section-heading--network">
        <p className="kicker">LIVE PROTOCOL VIEW</p>
        <h2>See the guarantee move across networks</h2>
        <p>The visualization below shows where the mandate, capital, and proof live at each stage.</p>
      </div>

      <section className="observatory-stage" aria-label="Live network observatory">
        <div className="observatory-stage__coordinate observatory-stage__coordinate--left">SEPOLIA ↔ ATTESTCOIN ↔ CREDITCOIN</div>
        <div className="observatory-stage__coordinate observatory-stage__coordinate--right">LIVE TESTNET</div>
        <CrossChainTopology
          state={displayState}
          evidence={{
            sepoliaTxHash: context.sepoliaTxHash,
            creditcoinTxHash: context.creditcoinTxHash ?? liveMarket?.policies[0]?.lockTxHash,
            proofId: context.proofId ?? context.proofRequestId,
          }}
        />

        <div className="state-lens">
          <span>CURRENT STATUS</span>
          <strong>{displayState.replaceAll("_", " ")}</strong>
          <code>{statePolicyLabel}</code>
        </div>

        <div className="telemetry-satellite telemetry-satellite--agents">
          <MetricReadout label="REGISTERED AGENTS" value={snapshot?.agents.length ?? "—"} detail="ERC-8004 IDENTITIES" explanation="Agents are treated as insurable economic actors. Their verified execution history informs failure-risk pricing." tone="green" />
        </div>
        <div className="telemetry-satellite telemetry-satellite--liquidity">
          <MetricReadout label="SENIOR LIQUIDITY" value={units(metrics.vault?.totalAssets)} detail="mUSDC / CC3" explanation="Creditcoin vault liquidity supplies the senior 80% of each performance bond." tone="cyan" />
        </div>
        <div className="telemetry-satellite telemetry-satellite--policies">
          <MetricReadout label="ACTIVE POLICIES" value={metrics.activePolicyCount ?? "—"} detail="CAPITAL RESERVED" explanation="An active policy has capital reserved against an agent mandate that has not settled yet." tone="amber" />
        </div>
        <div className="telemetry-satellite telemetry-satellite--proofs">
          <MetricReadout label="CONFIRMED PROOFS" value={metrics.confirmedProofCount ?? "—"} detail="ATTESTCOIN EVIDENCE" explanation="Verified outcome evidence authorizes Creditcoin settlement without trusting the agent's own report." />
        </div>
      </section>

      <div className="evidence-ribbon">
        <NetworkTelemetry
          sepoliaBlock={mode === "wallet" ? publicSepoliaHead?.toString() ?? "SYNCING" : snapshot?.chainHeads?.sepolia ?? "AWAITING TX"}
          creditcoinBlock={mode === "wallet" ? publicCreditcoinHead?.toString() ?? "SYNCING" : snapshot?.chainHeads?.creditcoin ?? "AWAITING TX"}
          reservedCapital={units(metrics.vault?.reserved)}
          proofLatency={mode === "wallet" ? "PUBLIC / FINALIZED" : "LOCAL / <1s"}
        />
      </div>

      <div className="observatory-lower-grid">
        <TechnicalPanel eyebrow="LIVE PROCESS" title="Cross-chain settlement status" explanation="This rail shows which network or participant owns the next action." action={<StatusChip label={displayState.replaceAll("_", " ")} tone="cyan" pulse />}>
          <SagaRail state={displayState} compact />
        </TechnicalPanel>

        {mode === "wallet" && displayState === "CREDITCOIN_POLICY_LOCKED" ? <TechnicalPanel eyebrow="CLIENT STAGE COMPLETE" title="Network operators take it from here" explanation="Your policy is active. The remaining transactions belong to the agent, proof service, and settlement keeper." action={<StatusChip label="AWAITING AGENT" tone="warning" pulse />}>
          <ol className="policy-handoff">
            <li><b>01</b><div><strong>Agent execution</strong><span>The registered agent executes the funded mandate on Sepolia.</span></div><small>SEPOLIA</small></li>
            <li><b>02</b><div><strong>Attestcoin proof</strong><span>The proof service verifies the finalized JobSettled transaction.</span></div><small>ATTESTCOIN</small></li>
            <li><b>03</b><div><strong>Keeper settlement</strong><span>The keeper submits proof-backed settlement on Creditcoin.</span></div><small>CREDITCOIN</small></li>
          </ol>
          <footer className="policy-handoff__footer"><i /> THIS VIEW REFRESHES FROM PUBLIC CHAIN STATE EVERY 12 SECONDS</footer>
        </TechnicalPanel> : <TechnicalPanel eyebrow="GET STARTED" title="Quick actions" explanation="Start with agent history, create a protected mandate, or inspect the capital that backs accepted policies.">
          <div className="operator-cards">
            <Link href="/agents"><span>STEP 1</span><strong>Browse agents</strong><small>View reliability history &amp; risk scores</small><i>↗</i></Link>
            <Link href="/jobs/new"><span>STEP 2</span><strong>Create a mandate</strong><small>Fund a protected job on Sepolia</small><i>↗</i></Link>
            <Link href="/vault"><span>STEP 3</span><strong>View the vault</strong><small>Senior LP capital &amp; loss waterfall</small><i>↗</i></Link>
          </div>
        </TechnicalPanel>}
      </div>

      <TechnicalPanel eyebrow="WHY THE NETWORK EXISTS" title="One guarantee, three indispensable systems" explanation="Each system controls a different trust boundary: user funds, risk capital, and objective cross-chain evidence.">
        <div className="protocol-explainer">
          <article><span>01 / SEPOLIA</span><strong>Create the mandate</strong><p>The client funds an agent job with measurable output and deadline conditions.</p></article>
          <article><span>02 / CREDITCOIN</span><strong>Make the promise enforceable</strong><p>Underwriters compete on premium and lock 20% junior capital beside 80% senior vault liquidity.</p></article>
          <article><span>03 / ATTESTCOIN</span><strong>Verify what happened</strong><p>Cross-chain evidence proves the execution outcome that releases capital or triggers the insured payout.</p></article>
        </div>
      </TechnicalPanel>

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
