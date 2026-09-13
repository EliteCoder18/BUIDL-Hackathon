"use client";

import type { LiveQuote, LiveQuotesResource } from "../../lib/api/schema";
import { useWalletPolicy } from "../../lib/wallet/useWalletPolicy";
import { WalletTransactionStepper } from "./WalletTransactionStepper";

export function WalletPolicyConfirmation({ txHash }: { txHash: string }) {
  return <div className="settlement-report"><strong>POLICY LOCKED ON CREDITCOIN</strong><span>The selected underwriter is confirmed and the auction is closed. Agent execution, Attestcoin proof submission, and keeper settlement continue under their assigned roles.</span><a href={`https://creditcoin-testnet.blockscout.com/tx/${txHash}`} target="_blank" rel="noreferrer">VIEW POLICY TRANSACTION ↗</a></div>;
}

export function WalletPolicyFlow({ live, quote }: { live: LiveQuotesResource; quote: LiveQuote }) {
  const flow = useWalletPolicy(live, quote);
  if (flow.complete) return <WalletPolicyConfirmation txHash={flow.steps[2].hash ?? ""} />;
  return <WalletTransactionStepper {...flow} onAdvance={flow.advance} />;
}
