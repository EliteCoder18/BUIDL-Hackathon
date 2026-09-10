"use client";

import type { LiveQuote, LiveQuotesResource } from "../../lib/api/schema";
import { useWalletPolicy } from "../../lib/wallet/useWalletPolicy";
import { WalletTransactionStepper } from "./WalletTransactionStepper";

export function WalletPolicyFlow({ live, quote }: { live: LiveQuotesResource; quote: LiveQuote }) {
  const flow = useWalletPolicy(live, quote);
  if (flow.complete) return <div className="settlement-report"><strong>CLIENT SIGNATURES CONFIRMED</strong><span>Agent execution, Attestcoin proof submission, and keeper settlement continue under their assigned roles.</span><a href={`https://creditcoin-testnet.blockscout.com/tx/${flow.steps[2].hash}`} target="_blank" rel="noreferrer">VIEW POLICY TRANSACTION ↗</a></div>;
  return <WalletTransactionStepper {...flow} onAdvance={flow.advance} />;
}
