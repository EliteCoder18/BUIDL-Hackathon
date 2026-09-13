"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProofRail, type ProofStage } from "../../../components/dashboard/ProofRail";
import { SagaRail } from "../../../components/dashboard/SagaRail";
import { LossWaterfall } from "../../../components/policy/LossWaterfall";
import { StatusChip } from "../../../components/ui/StatusChip";
import { TechnicalPanel } from "../../../components/ui/TechnicalPanel";
import type { JobResource, PolicyResource, ProofResource } from "../../../lib/api";
import { useCrossChainOrchestrator } from "../../../lib/orchestration";
import type { OrchestratorState } from "../../../lib/trustfutures/orchestrator";
import type { Bytes32 } from "../../../lib/trustfutures/types";

const money = (value?: string) => value == null ? "—" : `${(Number(value) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 3 })} mUSDC`;
const short = (value?: string) => value ? `${value.slice(0, 10)}…${value.slice(-8)}` : "—";

export default function PolicyPage({ params }: { params: { policyId: string } }) {
  const policyId = params.policyId as Bytes32;
  const { api, state, send } = useCrossChainOrchestrator();
  const [policy, setPolicy] = useState<PolicyResource>();
  const [job, setJob] = useState<JobResource>();
  const [proof, setProof] = useState<ProofResource>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [scenario, setScenario] = useState<"success" | "violation">("success");
  async function reload() {
    const nextPolicy = await api.getPolicy(policyId);
    const nextJob = await api.getJob(nextPolicy.jobKey);
    const nextProof = await api.getProof(nextPolicy.jobKey).catch(() => undefined);
    setPolicy(nextPolicy); setJob(nextJob); setProof(nextProof);
    const hydrated: OrchestratorState = nextPolicy.state === "SETTLED_SUCCESS" ? "SETTLED_SUCCESS" : nextPolicy.state === "SETTLED_SLASHED" ? "SETTLED_SLASHED" : nextProof ? "ATTESTCOIN_PROVING" : "CREDITCOIN_POLICY_LOCKED";
    send({ type: "HYDRATE", state: hydrated, context: { jobKey: nextPolicy.jobKey, creditcoinTxHash: nextPolicy.lockTxHash, proofId: nextProof?.id } });
    const stored = sessionStorage.getItem(`trustfutures:scenario:${nextPolicy.jobKey}`);
    if (stored === "success" || stored === "violation") setScenario(stored);
  }
  useEffect(() => { reload().catch((cause) => setError(cause instanceof Error ? cause.message : "Policy unavailable")); }, [policyId]);
  async function command(label: string, action: () => Promise<unknown>) { setBusy(label); setError(""); try { await action(); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Command failed"); } finally { setBusy(""); } }
  const executed = Boolean(job?.outcome);
  const settled = policy?.state.startsWith("SETTLED");
  const stages: ProofStage[] = [
    { id: "receipt", label: "Sepolia receipt", detail: "Validate configured manager and JobSettled log", status: executed ? "verified" : "waiting", reference: job?.executionTxHash },
    { id: "build", label: "Attestcoin proof", detail: "Deterministic local equivalent; no live Attestcoin finality claimed", status: proof ? "verified" : executed ? "running" : "waiting", reference: proof?.id },
    { id: "submit", label: "CC3 outcome adapter", detail: "Commit decoded job outcome for replay-safe settlement", status: proof?.state === "confirmed" ? "verified" : proof ? "running" : "waiting", reference: proof?.creditcoinTxHash },
    { id: "settle", label: "Policy settlement", detail: "Release premium or slash junior before senior", status: settled ? "verified" : proof ? "running" : "waiting", reference: policy?.settlementTxHash },
  ];
  return <div className="route-stack">
    <header className="route-heading"><div><p className="kicker">POLICY CONTROL / {short(policyId)}</p><h1>{policy?.state.replaceAll("_", " ") ?? "Loading capital bond…"}</h1><p>Execute the mandate, produce the local cross-chain proof, and settle real local contract balances.</p></div><StatusChip label={state.replaceAll("_", " ")} tone={state === "SETTLED_SLASHED" ? "danger" : state === "SETTLED_SUCCESS" ? "success" : "warning"} pulse={!settled} /></header>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <SagaRail state={state} compact />
    <div className="dashboard-grid dashboard-grid--policy"><TechnicalPanel eyebrow="CAPITAL BOND" title={`${money(policy?.coverageAmount)} coverage`} explanation="This certificate shows the client's protection, paid premium, and the junior/senior capital reserved for a verified failure."><LossWaterfall coverage={Number(policy?.coverageAmount ?? 0) / 1e6} loss={Number(policy?.clientPayout ?? 0) / 1e6} state={state} /><div className="integrity-grid"><span><small>UNDERWRITER</small><code>{short(policy?.underwriter)}</code></span><span><small>PREMIUM</small><strong>{money(policy?.premiumAmount)}</strong></span><span><small>JUNIOR FIRST LOSS</small><strong>{money(policy?.juniorAmount)}</strong></span><span><small>SENIOR LOCK</small><strong>{money(policy?.seniorAmount)}</strong></span></div></TechnicalPanel>
    <TechnicalPanel eyebrow="COMMAND SEQUENCER" title="Advance objective lifecycle" explanation="The demo exposes each role separately: agent execution, proof creation, then Creditcoin settlement."><div className="command-stack"><button className="technical-button" disabled={!policy || executed || Boolean(busy)} onClick={() => command("execute", () => api.executeJob(policy!.jobKey, scenario))}>{busy === "execute" ? "MINING EXECUTION…" : `01 / EXECUTE ${scenario.toUpperCase()}`}</button><button className="technical-button" disabled={!executed || Boolean(proof) || Boolean(busy)} onClick={() => command("prove", () => api.proveOutcome(policy!.jobKey))}>{busy === "prove" ? "BUILDING PROOF…" : "02 / BUILD + SUBMIT PROOF"}</button><button className="technical-button technical-button--primary" disabled={!proof || settled || Boolean(busy)} onClick={() => command("settle", () => api.settlePolicy(policyId))}>{busy === "settle" ? "SETTLING CC3 POLICY…" : "03 / SETTLE PERFORMANCE BOND"}</button></div><div className="scenario-toggle"><span>DEMO OUTCOME</span><button className={scenario === "success" ? "active" : ""} disabled={executed} onClick={() => setScenario("success")}>SUCCESS</button><button className={scenario === "violation" ? "active danger" : ""} disabled={executed} onClick={() => setScenario("violation")}>VIOLATION</button></div>{proof && <Link className="text-link" href={`/proofs/${policy!.jobKey}`}>OPEN FULL PROOF EXPLORER →</Link>}</TechnicalPanel></div>
    <TechnicalPanel eyebrow="CROSS-CHAIN VERIFICATION" title="Proof and settlement rail" explanation="The policy can settle only after source execution is decoded, verified, and committed to the Creditcoin outcome adapter."><ProofRail stages={stages} /></TechnicalPanel>
    {settled && <div className={`settlement-report ${policy?.state === "SETTLED_SLASHED" ? "settlement-report--danger" : ""}`} aria-live="polite"><strong>{policy?.state === "SETTLED_SUCCESS" ? "CAPITAL UNLOCKED" : "CLIENT PAID / CAPITAL SLASHED"}</strong><span>Client payout: {money(policy?.clientPayout)} · Underwriter premium: {money(policy?.underwriterPremium)} · LP premium: {money(policy?.lpPremium)}</span><Link href="/jobs/new">RUN ANOTHER SCENARIO</Link></div>}
  </div>;
}
