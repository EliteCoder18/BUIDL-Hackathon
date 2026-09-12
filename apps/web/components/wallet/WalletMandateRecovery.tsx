"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCrossChainOrchestrator } from "../../lib/orchestration";
import { parseRecoveryTransactionHash } from "../../lib/wallet/mandate-recovery";
import { parseMusdc } from "../../lib/units/musdc";

export function WalletMandateRecovery() {
  const router = useRouter();
  const { api } = useCrossChainOrchestrator();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const txHash = parseRecoveryTransactionHash(String(data.get("sourceTxHash") ?? ""));
      const coverageAmount = parseMusdc(String(data.get("recoveryCoverage") ?? ""));
      const live = await api.getLiveQuotes(txHash, coverageAmount);
      sessionStorage.setItem(`trustfutures:live:${live.job.jobKey}`, JSON.stringify(live));
      router.push(`/quotes/${live.job.jobKey}?mode=wallet`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to recover the confirmed mandate.");
      setBusy(false);
    }
  }

  return <form className="technical-form wallet-recovery" onSubmit={recover}>
    <div><p className="kicker">ALREADY MINED?</p><strong>Resume from a Sepolia receipt</strong></div>
    <label><span>CONFIRMED TRANSACTION HASH</span><input name="sourceTxHash" placeholder="0x…" autoComplete="off" spellCheck={false} required /></label>
    <label><span>COVERAGE (mUSDC · MAX 1,000)</span><input name="recoveryCoverage" inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,6})?" defaultValue="100" aria-describedby="recovery-coverage-help" required /><small id="recovery-coverage-help">Use the coverage selected for this mandate.</small></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="submit" className="technical-button technical-button--wide" disabled={busy}>{busy ? "VERIFYING RECEIPT + PRICING…" : "VERIFY RECEIPT + RESUME AUCTION"}</button>
  </form>;
}
