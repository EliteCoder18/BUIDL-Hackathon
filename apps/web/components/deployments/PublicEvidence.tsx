"use client";

import { useEffect, useState } from "react";
import { loadDeploymentManifest, type TestnetDeploymentManifest } from "../../lib/contracts/deployments";
import { StatusChip } from "../ui/StatusChip";
import { TechnicalPanel } from "../ui/TechnicalPanel";

const compact = (value: string) => `${value.slice(0, 10)}…${value.slice(-8)}`;

export function PublicEvidence() {
  const [deployment, setDeployment] = useState<TestnetDeploymentManifest>();
  const [error, setError] = useState("");
  useEffect(() => { loadDeploymentManifest().then(setDeployment).catch((cause) => setError(cause instanceof Error ? cause.message : "Evidence unavailable")); }, []);
  if (error) return <div className="error-banner" role="alert">{error}</div>;
  if (!deployment) return <div className="evidence-loading">LOADING VERIFIED DEPLOYMENT MANIFEST…</div>;
  const loop = deployment.publicLoop;
  const txs = loop ? [
    { index: "01", label: "SEPOLIA JOB OUTCOME", hash: loop.sourceTransaction, url: `${deployment.sepolia.explorer}/tx/${loop.sourceTransaction}` },
    { index: "02", label: "ATTESTCOIN PROOF", hash: loop.proofTransaction, url: `${deployment.creditcoin.explorer}/tx/${loop.proofTransaction}` },
    { index: "03", label: "CC3 BOND PAYOUT", hash: loop.settlementTransaction, url: `${deployment.creditcoin.explorer}/tx/${loop.settlementTransaction}` },
  ] : [];
  return <div className="public-evidence-grid">
    <TechnicalPanel eyebrow="DEPLOYMENT EVIDENCE" title="Live testnet contracts" action={<StatusChip label="BYTECODE VERIFIED" tone="success" pulse />}><div className="contract-matrix"><a href={`${deployment.sepolia.explorer}/address/${deployment.sepolia.treasuryJobManager}`} target="_blank" rel="noreferrer"><small>SEPOLIA / JOB MANAGER</small><code>{compact(deployment.sepolia.treasuryJobManager)}</code><b>↗</b></a><a href={`${deployment.creditcoin.explorer}/address/${deployment.creditcoin.policyManager}`} target="_blank" rel="noreferrer"><small>CC3 / POLICY MANAGER</small><code>{compact(deployment.creditcoin.policyManager)}</code><b>↗</b></a><a href={`${deployment.creditcoin.explorer}/address/${deployment.creditcoin.attestcoinOutcomeAdapter}`} target="_blank" rel="noreferrer"><small>CC3 / PROOF ADAPTER</small><code>{compact(deployment.creditcoin.attestcoinOutcomeAdapter)}</code><b>↗</b></a><a href={`${deployment.creditcoin.explorer}/address/${deployment.creditcoin.coverageVault}`} target="_blank" rel="noreferrer"><small>CC3 / COVERAGE VAULT</small><code>{compact(deployment.creditcoin.coverageVault)}</code><b>↗</b></a></div></TechnicalPanel>
    <TechnicalPanel eyebrow="PUBLIC FAILURE LOOP" title="Source → proof → payout"><div className="evidence-transaction-rail">{txs.map((tx) => <a key={tx.index} href={tx.url} target="_blank" rel="noreferrer"><span>{tx.index}</span><div><strong>{tx.label}</strong><code>{compact(tx.hash)}</code></div><b>VERIFIED ↗</b></a>)}</div>{loop && <div className="evidence-result"><span>POLICY</span><code>{compact(loop.policyId)}</code><strong>{loop.payout ? `${Number(loop.payout) / 1e6} mUSDC PAID` : "SETTLED"}</strong></div>}</TechnicalPanel>
  </div>;
}
