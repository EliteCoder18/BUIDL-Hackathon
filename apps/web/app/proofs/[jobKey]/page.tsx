"use client";

import { useEffect, useState } from "react";
import { ProofRail, type ProofStage } from "../../../components/dashboard/ProofRail";
import { StatusChip } from "../../../components/ui/StatusChip";
import { TechnicalPanel } from "../../../components/ui/TechnicalPanel";
import type { ProofResource } from "../../../lib/api";
import { useTrustFuturesApi } from "../../../lib/orchestration";
import type { Bytes32 } from "../../../lib/trustfutures/types";

export default function ProofExplorerPage({ params }: { params: { jobKey: string } }) {
  const jobKey = params.jobKey as Bytes32;
  const api = useTrustFuturesApi();
  const [proof, setProof] = useState<ProofResource>();
  const [error, setError] = useState("");
  useEffect(() => { api.getProof(jobKey).then(setProof).catch((cause) => setError(cause instanceof Error ? cause.message : "Proof not found")); }, [api, jobKey]);
  const stages: ProofStage[] = [
    { id: "source", label: "Source transaction inclusion", detail: "Sepolia execution receipt exists and succeeded", status: proof ? "verified" : "waiting", reference: proof?.sourceTxHash },
    { id: "decode", label: "Approved event decoding", detail: "Job key and objective outcome match the configured source manager", status: proof ? "verified" : "waiting", reference: proof ? `OUTCOME / ${proof.outcome.toUpperCase()}` : undefined },
    { id: "attest", label: "Attestcoin-equivalent proof", detail: "Local deterministic transport used for this non-deployed demo", status: proof?.state === "confirmed" ? "verified" : proof ? "running" : "waiting", reference: proof?.proofSource },
    { id: "cc3", label: "Creditcoin adapter commit", detail: "Outcome registered for replay-safe policy settlement", status: proof?.state === "confirmed" ? "verified" : "waiting", reference: proof?.creditcoinTxHash },
  ];
  return <div className="route-stack"><header className="route-heading"><div><p className="kicker">PROOF EXPLORER / JOB KEY</p><h1>Deterministic outcome verification</h1><p>Inspect the source receipt, decoded mandate outcome, and Creditcoin submission independently.</p></div><StatusChip label={proof?.state.toUpperCase() ?? "AWAITING PROOF"} tone={proof?.state === "confirmed" ? "success" : "warning"} pulse={!proof} /></header>
  <div className="job-key-strip"><span>JOB KEY</span><code>{jobKey}</code></div>{error && <div className="error-banner" role="alert">{error}</div>}
  <TechnicalPanel eyebrow="VERIFICATION PIPELINE" title="Source → proof → destination" explanation="Attestcoin verifies that the Sepolia event came from the approved contract and matches this job before Creditcoin accepts the outcome."><ProofRail stages={stages} /></TechnicalPanel>
  {proof && <div className="proof-detail-grid"><TechnicalPanel eyebrow="SOURCE CHAIN" title="Ethereum Sepolia" explanation="This receipt is the objective source event: where the agent's execution outcome was recorded."><dl className="technical-dl"><div><dt>TRANSACTION</dt><dd><code>{proof.sourceTxHash}</code></dd></div><div><dt>BLOCK</dt><dd>{proof.sourceBlockNumber}</dd></div><div><dt>OUTCOME</dt><dd>{proof.outcome.toUpperCase()}</dd></div></dl></TechnicalPanel><TechnicalPanel eyebrow="DESTINATION CHAIN" title="Creditcoin CC3" explanation="This commit makes the verified outcome available to the policy contract for replay-safe settlement."><dl className="technical-dl"><div><dt>TRANSACTION</dt><dd><code>{proof.creditcoinTxHash}</code></dd></div><div><dt>BLOCK</dt><dd>{proof.creditcoinBlockNumber}</dd></div><div><dt>TRANSPORT</dt><dd>{proof.proofSource}</dd></div></dl></TechnicalPanel></div>}
  <div className="simulation-disclosure"><strong>LOCAL PROOF DISCLOSURE</strong><p>This flow validates the same job key, receipt, event, outcome, adapter, and settlement boundaries as the deployment path. It is explicitly not a live Attestcoin proof.</p></div></div>;
}
