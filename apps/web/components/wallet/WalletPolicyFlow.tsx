"use client";

import type { LiveQuote, LiveQuotesResource } from "../../lib/api/schema";
import { useWalletPolicy } from "../../lib/wallet/useWalletPolicy";
import { WalletTransactionStepper } from "./WalletTransactionStepper";

function musdc(value: string) {
  return (Number(BigInt(value)) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function WalletPolicyConfirmation({ txHash, quote }: { txHash: string; quote?: LiveQuote }) {
  return <section className="policy-lock-receipt">
    <header>
      <div className="policy-lock-receipt__mark" aria-hidden="true">✓</div>
      <div><span>CREDITCOIN / CAPITAL FINALITY</span><h2>Performance bond locked</h2><p>The selected underwriter is confirmed and the auction is closed.</p></div>
      <b><i /> ON-CHAIN CONFIRMED</b>
    </header>
    {quote && <div className="policy-lock-receipt__economics">
      <span><small>UNDERWRITER</small><strong>{quote.strategy.toUpperCase()}</strong></span>
      <span><small>PREMIUM</small><strong>{musdc(quote.premiumAmount)} mUSDC</strong></span>
      <span><small>COVERAGE</small><strong>{musdc(quote.coverageAmount)} mUSDC</strong></span>
      <span><small>CAPITAL STACK</small><strong>20% JUNIOR · 80% SENIOR</strong></span>
    </div>}
    <footer><div><small>NEXT NETWORK ACTION</small><strong>Agent execution → Attestcoin proof</strong></div><a href={`https://creditcoin-testnet.blockscout.com/tx/${txHash}`} target="_blank" rel="noreferrer">VIEW POLICY TRANSACTION ↗</a></footer>
  </section>;
}

export function WalletPolicyFlow({ live, quote }: { live: LiveQuotesResource; quote: LiveQuote }) {
  const flow = useWalletPolicy(live, quote);
  if (flow.complete) return <WalletPolicyConfirmation txHash={flow.steps[2].hash ?? ""} quote={quote} />;
  return <WalletTransactionStepper {...flow} onAdvance={flow.advance} />;
}
