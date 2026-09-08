import { isAddress, isHash, verifyTypedData } from "viem";
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


function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid quote envelope");
  return value as Record<string, unknown>;
}
function integer(value: unknown, bits = 256): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error("Quote amounts must be unsigned decimal strings");
  const parsed = BigInt(value);
  if (parsed >= 2n ** BigInt(bits)) throw new Error("Quote integer exceeds contract bounds");
  return parsed;
}
export async function validateQuoteEnvelope(value: unknown, manager: Address, now: bigint) {
  const envelope = record(value);
  const raw = record(envelope.quote);
  if (typeof raw.jobKey !== "string" || !isHash(raw.jobKey) || typeof raw.modelHash !== "string" || !isHash(raw.modelHash) || typeof raw.underwriter !== "string" || !isAddress(raw.underwriter)) throw new Error("Invalid quote identifiers");
  const quote: Quote = {
    jobKey: raw.jobKey, modelHash: raw.modelHash, underwriter: raw.underwriter,
    coverageAmount: integer(raw.coverageAmount), premiumAmount: integer(raw.premiumAmount),
    juniorAmount: integer(raw.juniorAmount), validUntil: integer(raw.validUntil, 64), nonce: integer(raw.nonce),
  };
  if (quote.coverageAmount === 0n || quote.coverageAmount > 1_000_000_000n) throw new Error("Coverage exceeds testnet limits");
  if (quote.juniorAmount * 5n !== quote.coverageAmount) throw new Error("Junior tranche must be 20%");
  if (quote.validUntil < now) throw new Error("Quote expired");
  if (typeof envelope.signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(envelope.signature)) throw new Error("Invalid quote signature");
  const signature = envelope.signature as `0x${string}`;
  if (!await verifyTypedData({ ...quoteTypedData({ chainId: 102031, verifyingContract: manager }, quote), address: quote.underwriter, signature })) throw new Error("Quote signature does not match the deployed CC3 domain");
  return { quote, signature };
}
