"use client";

import { explorerTransactionUrl } from "../../lib/wallet/chains";
import type { TransactionPhase } from "../../lib/wallet/useTransactionAction";

const labels: Record<TransactionPhase, string> = {
  idle: "READY FOR WALLET",
  switching: "SWITCHING NETWORK…",
  signing: "CONFIRM IN METAMASK…",
  mining: "WAITING FOR FINALITY…",
  success: "CONFIRMED ON-CHAIN",
  error: "TRANSACTION INTERRUPTED",
};

export function TransactionStatus({ phase, chainId, hash, error }: { phase: TransactionPhase; chainId: number; hash?: string; error?: string }) {
  const explorer = hash ? explorerTransactionUrl(chainId, hash) : undefined;
  return (
    <div className={`transaction-status transaction-status--${phase}`} aria-live="polite">
      <span><i />{labels[phase]}</span>
      {error && <p>{error}</p>}
      {explorer && <a href={explorer} target="_blank" rel="noreferrer">VERIFY TRANSACTION ↗</a>}
    </div>
  );
}
