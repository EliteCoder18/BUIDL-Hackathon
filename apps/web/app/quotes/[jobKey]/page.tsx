"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { QuoteAuctionGrid } from "../../../components/risk/QuoteAuctionGrid";
import type { DisplayQuote } from "../../../components/risk/QuoteCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { TechnicalPanel } from "../../../components/ui/TechnicalPanel";
import type { AuctionResource, LiveQuote, LiveQuotesResource } from "../../../lib/api";
import { useCrossChainOrchestrator } from "../../../lib/orchestration";
import { quoteToDisplay } from "../../../lib/risk/quote-display";
import type { Bytes32 } from "../../../lib/trustfutures/types";
import { useExecutionMode } from "../../execution-mode-provider";
import { WalletPolicyConfirmation, WalletPolicyFlow } from "../../../components/wallet/WalletPolicyFlow";

export default function QuoteAuctionPage({ params }: { params: { jobKey: string } }) {
  const jobKey = params.jobKey as Bytes32;
  const router = useRouter();
  const { api, context, send } = useCrossChainOrchestrator();
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
  const displayQuotes = useMemo(() => mode === "wallet" ? live?.quotes.map(quoteToDisplay) ?? [] : auction?.quotes.map(quoteToDisplay) ?? [], [auction, live, mode]);
  const confirmedQuoteId = useMemo(() => {
    if (mode !== "wallet" || context.jobKey !== jobKey || !context.creditcoinTxHash || !context.quoteId) return undefined;
    const quoteIndex = live?.quotes.findIndex((quote) => `${quote.strategy}-${quote.nonce}` === context.quoteId) ?? -1;
    return quoteIndex >= 0 ? displayQuotes[quoteIndex]?.id : undefined;
  }, [context.creditcoinTxHash, context.jobKey, context.quoteId, displayQuotes, jobKey, live, mode]);
  const confirmedQuote = confirmedQuoteId ? live?.quotes[Number(confirmedQuoteId.split(":")[0])] : undefined;
  const showWalletPolicyFlow = Boolean(mode === "wallet" && live && liveQuote && !confirmedQuoteId);
  const quoteStats = useMemo(() => {
    const premiums = displayQuotes.map((quote) => Number(quote.premiumAmount)).filter(Number.isFinite);
    const risks = displayQuotes.map((quote) => quote.probability ?? 0);
    return {
      bestPremium: premiums.length ? Math.min(...premiums).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—",
      coverage: displayQuotes[0] ? Number(displayQuotes[0].coverageAmount).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—",
      averageRisk: risks.length ? `${(risks.reduce((sum, risk) => sum + risk, 0) / risks.length * 100).toFixed(1)}%` : "—",
    };
  }, [displayQuotes]);
  async function accept(selected: DisplayQuote) {
    const quoteIndex = Number(selected.id.split(":")[0]); setBusy(selected.id); setError("");
    if (mode === "wallet") { setLiveQuote(live?.quotes[quoteIndex]); setBusy(""); return; }
    try { const result = await api.acceptPolicy(jobKey, quoteIndex); router.push(`/policies/${result.data.policyId}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Policy lock failed"); setBusy(""); }
  }
  const pageTitle = confirmedQuoteId ? "Performance bond active" : showWalletPolicyFlow ? "Confirm capital lock" : "Signed failure-risk auction";
  const pageStatus = confirmedQuoteId ? "POLICY LOCKED" : showWalletPolicyFlow ? "AWAITING WALLET" : `${displayQuotes.length || "—"} EIP-712 QUOTES`;
  return <div className="route-stack quote-route">
    <header className="route-heading"><div><p className="kicker">CREDITCOIN / COMPETITIVE UNDERWRITING</p><h1>{pageTitle}</h1><p>{showWalletPolicyFlow ? "Authorize the selected underwriting offer through three explicit Creditcoin transactions." : confirmedQuoteId ? "Capital is reserved and the mandate is ready for execution and objective proof." : "Compare signed risk prices, inspect their strongest model signals, and lock one enforceable performance bond."}</p></div><StatusChip label={pageStatus} tone={confirmedQuoteId ? "success" : "cyan"} pulse={!confirmedQuoteId} /></header>
    <div className="job-key-strip"><span>JOB KEY</span><code>{jobKey}</code></div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {!showWalletPolicyFlow && !confirmedQuoteId && <div className="quote-market-summary" aria-label="Auction summary">
      <span><small>SIGNED OFFERS</small><strong>{displayQuotes.length || "—"}</strong></span>
      <span><small>BEST PREMIUM</small><strong>{quoteStats.bestPremium} <i>mUSDC</i></strong></span>
      <span><small>PROTECTED VALUE</small><strong>{quoteStats.coverage} <i>mUSDC</i></strong></span>
      <span><small>MEAN FAILURE RISK</small><strong>{quoteStats.averageRisk}</strong></span>
    </div>}
    {context.creditcoinTxHash && confirmedQuoteId
      ? <WalletPolicyConfirmation txHash={context.creditcoinTxHash} quote={confirmedQuote} />
      : showWalletPolicyFlow
        ? <WalletPolicyFlow live={live!} quote={liveQuote!} />
        : <QuoteAuctionGrid quotes={displayQuotes} selectedQuoteId={confirmedQuoteId} busyQuoteId={busy} disabled={Boolean(busy)} onSelect={accept} />}
    {!showWalletPolicyFlow && !confirmedQuoteId && <TechnicalPanel eyebrow="SIGNING DOMAIN" title="Canonical quote integrity" explanation="EIP-712 signatures bind every quote to this job, underwriter, price, expiry, and Creditcoin policy contract."><div className="integrity-grid"><span><small>DOMAIN</small><strong>TrustFutures v1</strong></span><span><small>VERIFYING CHAIN</small><strong>Creditcoin CC3 / 102031</strong></span><span><small>CAPITAL WATERFALL</small><strong>20% JUNIOR → 80% SENIOR</strong></span><span><small>ECONOMIC AUTHORITY</small><strong>MODEL OUTPUT ONLY</strong></span></div></TechnicalPanel>}
  </div>;
}
