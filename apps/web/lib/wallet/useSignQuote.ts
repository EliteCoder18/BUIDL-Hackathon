"use client";

import { useSignTypedData } from "wagmi";
import { useCrossChainOrchestrator } from "../orchestration";
import type { Address, Quote } from "../trustfutures/types";

export const QUOTE_EIP712_TYPES = {
  Quote: [
    { name: "jobKey", type: "bytes32" },
    { name: "underwriter", type: "address" },
    { name: "coverageAmount", type: "uint256" },
    { name: "premiumAmount", type: "uint256" },
    { name: "juniorAmount", type: "uint256" },
    { name: "validUntil", type: "uint64" },
    { name: "modelHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export function quoteTypedData(domain: { chainId: number; verifyingContract: Address }, quote: Quote) {
  return {
    domain: { name: "TrustFutures", version: "1", ...domain },
    types: QUOTE_EIP712_TYPES,
    primaryType: "Quote" as const,
    message: quote,
  };
}

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
