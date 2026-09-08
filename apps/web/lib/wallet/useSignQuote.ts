"use client";

import { useSignTypedData } from "wagmi";
import { useCrossChainOrchestrator } from "../orchestration";
import type { Address, Quote } from "../trustfutures/types";

import { quoteTypedData } from "../contracts/quote-envelope";
export { quoteTypedData, QUOTE_EIP712_TYPES } from "../contracts/quote-envelope";

/** External-wallet underwriter signing path; embedded mode uses deterministic server signers. */
export function useSignQuote() {
  const { signTypedDataAsync, ...state } = useSignTypedData();
  const { send } = useCrossChainOrchestrator();
  return {
    ...state,
    async signQuote(domain: { chainId: number; verifyingContract: Address }, quote: Quote, quoteId = `${quote.underwriter}:${quote.nonce}`) {
      const signature = await signTypedDataAsync(quoteTypedData(domain, quote));
      send({ type: "QUOTE_SIGNED", quoteId, signature });
      return signature;
    },
  };
}
