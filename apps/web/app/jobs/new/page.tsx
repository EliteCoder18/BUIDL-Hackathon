"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SagaRail } from "../../../components/dashboard/SagaRail";
import { StatusChip } from "../../../components/ui/StatusChip";
import { TechnicalPanel } from "../../../components/ui/TechnicalPanel";
import { useCrossChainOrchestrator } from "../../../lib/orchestration";
import { useExecutionMode } from "../../execution-mode-provider";
import { WalletMandateFlow } from "../../../components/wallet/WalletMandateFlow";
import type { WalletMandateInput } from "../../../lib/wallet/useWalletMandate";

export default function CreateJobPage() {
  const router = useRouter();
  const { api, state } = useCrossChainOrchestrator();
  const { mode } = useExecutionMode();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scenario, setScenario] = useState<"success" | "violation">("success");
  const [walletInput, setWalletInput] = useState<WalletMandateInput>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    if (mode === "wallet") {
      setWalletInput({ agentId: String(data.get("agentId")), amountIn: String(data.get("amountIn")) as `${bigint}`, minOut: String(data.get("minOut")) as `${bigint}`, coverageAmount: String(data.get("coverageAmount")) as `${bigint}`, deadlineSeconds: Number(data.get("deadlineSeconds")), deadline: BigInt(Math.floor(Date.now() / 1000) + Number(data.get("deadlineSeconds"))) });
      setBusy(false);
      return;
    }
    try {
      const created = await api.createJob({ agentId: String(data.get("agentId")), amountIn: String(data.get("amountIn")) as `${bigint}`, minOut: String(data.get("minOut")) as `${bigint}`, coverageAmount: String(data.get("coverageAmount")) as `${bigint}`, deadlineSeconds: Number(data.get("deadlineSeconds")) });
      await api.openAuction(created.data.jobKey);
      sessionStorage.setItem(`trustfutures:scenario:${created.data.jobKey}`, scenario);
      router.push(`/quotes/${created.data.jobKey}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mandate transaction failed"); setBusy(false); }
  }
  return <div className="route-stack">
    <header className="route-heading"><div><p className="kicker">SEPOLIA / MANDATE BUILDER</p><h1>Fund an objective agent job</h1><p>{mode === "wallet" ? "Your wallet signs each client-owned action on public Sepolia. Agent and proof roles remain separate." : "The demo client deposits mUSDC and constrains DEX output, slippage, and execution deadline on-chain."}</p></div><StatusChip label={mode === "wallet" ? "PUBLIC TESTNET · METAMASK" : "EMBEDDED CONTRACT TX"} tone="success" pulse /></header>
    <div className="form-layout"><TechnicalPanel eyebrow="JOB PARAMETERS" title="Treasury rebalance mandate"><form className="technical-form" onSubmit={submit}>
      <label><span>ERC-8004 AGENT</span><select name="agentId" defaultValue={mode === "wallet" ? "10130" : "0"}>{mode === "wallet" ? <option value="10130">#10130 — Public testnet agent</option> : <><option value="0">#0000 — Treasury Delta</option><option value="1">#0001 — Liquidity Sigma</option></>}</select></label>
      <div className="form-pair"><label><span>INPUT (BASE UNITS)</span><input name="amountIn" inputMode="numeric" pattern="[0-9]+" defaultValue="100000000" required /></label><label><span>MINIMUM OUTPUT</span><input name="minOut" inputMode="numeric" pattern="[0-9]+" defaultValue="99000000" required /></label></div>
      <div className="form-pair"><label><span>COVERAGE (MAX 1,000 mUSDC)</span><input name="coverageAmount" inputMode="numeric" pattern="[0-9]+" defaultValue="100000000" required /></label><label><span>DEADLINE (SECONDS)</span><input name="deadlineSeconds" type="number" min="60" max="86400" defaultValue="3600" required /></label></div>
      <fieldset><legend>DEMO OUTCOME SCENARIO</legend><button type="button" className={scenario === "success" ? "scenario-active" : ""} onClick={() => setScenario("success")}>SUCCESS / CAPITAL RELEASE</button><button type="button" className={scenario === "violation" ? "scenario-active danger" : ""} onClick={() => setScenario("violation")}>VIOLATION / SLASH</button></fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}<button className="technical-button technical-button--primary technical-button--wide" disabled={busy}>{busy ? "MINING MANDATE + OPENING AUCTION…" : mode === "wallet" ? "PREPARE METAMASK TRANSACTIONS" : "CREATE MANDATE + REQUEST QUOTES"}</button>
      {mode === "wallet" && walletInput && <WalletMandateFlow input={walletInput} />}
    </form></TechnicalPanel><TechnicalPanel eyebrow="EXPECTED EVENT STREAM" title="Deterministic transition preview"><SagaRail state={state} /><div className="spec-ledger"><span><b>01</b> CLIENT FUNDS JOB MANAGER</span><span><b>02</b> RECEIPT FINALIZES ON SEPOLIA</span><span><b>03</b> THREE UNDERWRITERS SIGN EIP-712</span><span><b>04</b> 20/80 CAPITAL LOCKS ON CC3</span></div></TechnicalPanel></div>
  </div>;
}
