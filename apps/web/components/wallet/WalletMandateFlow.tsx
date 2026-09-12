"use client";

import type { WalletMandateInput } from "../../lib/wallet/useWalletMandate";
import { useWalletMandate } from "../../lib/wallet/useWalletMandate";
import { WalletTransactionStepper } from "./WalletTransactionStepper";

export function WalletMandateFlow({ input }: { input: WalletMandateInput }) {
  const flow = useWalletMandate(input);
  return <WalletTransactionStepper {...flow} onAdvance={flow.advance} retry={flow.retryQuotes ? { label: "RETRY QUOTE GENERATION · NO WALLET TRANSACTION", onClick: flow.retryQuotes } : undefined} />;
}
