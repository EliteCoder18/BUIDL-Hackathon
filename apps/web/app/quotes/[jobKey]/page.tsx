"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { QuoteAuctionGrid } from "../../../components/risk/QuoteAuctionGrid";
import type { DisplayQuote } from "../../../components/risk/QuoteCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { TechnicalPanel } from "../../../components/ui/TechnicalPanel";
import type { ApiQuote, AuctionResource, LiveQuote, LiveQuotesResource } from "../../../lib/api";
import { useCrossChainOrchestrator } from "../../../lib/orchestration";
import type { Bytes32 } from "../../../lib/trustfutures/types";
import { useExecutionMode } from "../../execution-mode-provider";
import { WalletPolicyFlow } from "../../../components/wallet/WalletPolicyFlow";

function toDisplay(quote: ApiQuote, index: number): DisplayQuote {
  return { id: `${index}:${quote.strategy}`, underwriter: quote.underwriter, coverageAmount: Number(quote.coverageAmount) / 1e6, premiumAmount: Number(quote.premiumAmount) / 1e6, juniorAmount: Number(quote.juniorAmount) / 1e6, validUntil: quote.validUntil, modelHash: quote.modelHash, nonce: quote.nonce, probability: quote.failureProbabilityBps / 10_000, features: quote.riskProfile.features, explanation: quote.llmExplanation, strategy: quote.strategy };
}

export default function QuoteAuctionPage({ params }: { params: { jobKey: string } }) {
  const jobKey = params.jobKey as Bytes32;
  const router = useRouter();
  const { api, send } = useCrossChainOrchestrator();
  const { mode } = useExecutionMode();
  const [auction, setAuction] = useState<AuctionResource>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [live, setLive] = useState<LiveQuotesResource>();
  const [liveQuote, setLiveQuote] = useState<LiveQuote>();
  useEffect(() => {
    if (mode === "wallet") {
      const stored = sessionStorage.getItem(`trustfutures:live:${jobKey}`);
      if (!stored) { setError("This public testnet quote session is unavailable. Create a new MetaMask mandate first."); return; }
      try { setLive(JSON.parse(stored) as LiveQuotesResource); } catch { setError("Stored public quote session is invalid."); }
      return;
    }
    api.getQuotes(jobKey).then((value) => { setAuction(value); send({ type: "HYDRATE", state: "AUCTION_ACTIVE", context: { jobKey } }); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Quote auction unavailable"));
  }, [api, jobKey, mode, send]);
  const displayQuotes = useMemo(() => mode === "wallet" ? live?.quotes.map((quote, index) => ({ id: `${index}:${quote.strategy}`, underwriter: quote.underwriter, coverageAmount: Number(quote.coverageAmount) / 1e6, premiumAmount: Number(quote.premiumAmount) / 1e6, juniorAmount: Number(quote.juniorAmount) / 1e6, validUntil: quote.validUntil, modelHash: quote.modelHash, nonce: quote.nonce, features: [], explanation: { summary: "Receipt-verified mandate priced by a server-side underwriter.", topRisks: [], protectiveTerms: ["20% first-loss", "Verified Sepolia receipt"] }, strategy: quote.strategy })) ?? [] : auction?.quotes.map(toDisplay) ?? [], [auction, live, mode]);
  async function accept(selected: DisplayQuote) {
    const quoteIndex = Number(selected.id.split(":")[0]); setBusy(selected.id); setError("");
    if (mode === "wallet") { setLiveQuote(live?.quotes[quoteIndex]); setBusy(""); return; }
    try { const result = await api.acceptPolicy(jobKey, quoteIndex); router.push(`/policies/${result.data.policyId}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Policy lock failed"); setBusy(""); }
  }
  return <div className="route-stack">
    <header className="route-heading"><div><p className="kicker">CREDITCOIN / COMPETITIVE UNDERWRITING</p><h1>Signed failure-risk auction</h1><p>Three independent pricing strategies commit 20% junior capital against 80% senior vault liquidity.</p></div><StatusChip label={`${displayQuotes.length || "—"} EIP-712 QUOTES`} tone="cyan" pulse /></header>
    <div className="job-key-strip"><span>JOB KEY</span><code>{jobKey}</code></div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <QuoteAuctionGrid quotes={displayQuotes} busyQuoteId={busy} disabled={Boolean(busy)} onSelect={accept} />
    {mode === "wallet" && live && liveQuote && <WalletPolicyFlow live={live} quote={liveQuote} />}
    <TechnicalPanel eyebrow="SIGNING DOMAIN" title="Canonical quote integrity"><div className="integrity-grid"><span><small>DOMAIN</small><strong>TrustFutures v1</strong></span><span><small>VERIFYING CHAIN</small><strong>Creditcoin CC3 / 102031</strong></span><span><small>CAPITAL WATERFALL</small><strong>20% JUNIOR → 80% SENIOR</strong></span><span><small>ECONOMIC AUTHORITY</small><strong>MODEL OUTPUT ONLY</strong></span></div></TechnicalPanel>
  </div>;
}
