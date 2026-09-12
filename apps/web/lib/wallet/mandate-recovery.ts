import type { Hash } from "viem";
import type { Bytes32 } from "../trustfutures/types";

export interface ConfirmedMandate {
  jobKey: Bytes32;
  txHash: Hash;
}

export interface PendingMandate extends ConfirmedMandate {
  input: {
    agentId: string;
    amountIn: `${bigint}`;
    minOut: `${bigint}`;
    coverageAmount: `${bigint}`;
    deadlineSeconds: number;
    deadline: `${bigint}`;
  };
}

export const PENDING_MANDATE_KEY = "trustfutures:pending-live-mandate";

const hashPattern = /^0x[0-9a-fA-F]{64}$/;
const integerPattern = /^\d+$/;

export function parsePendingMandate(raw: string | null): PendingMandate | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as PendingMandate;
    const input = value?.input;
    if (!hashPattern.test(value?.jobKey ?? "") || !hashPattern.test(value?.txHash ?? "") || !input) return undefined;
    if (![input.agentId, input.amountIn, input.minOut, input.coverageAmount, input.deadline].every((entry) => integerPattern.test(entry))) return undefined;
    if (!Number.isInteger(input.deadlineSeconds) || input.deadlineSeconds < 60 || input.deadlineSeconds > 86_400) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export function nextMandateAction(_index: number, _confirmed?: ConfirmedMandate): "create-job" | "request-quotes" {
  return _confirmed ? "request-quotes" : "create-job";
}

export function verifiedMandateKey(_localKey: Bytes32, receiptVerifiedKey: Bytes32): Bytes32 {
  return receiptVerifiedKey;
}

export function parseRecoveryTransactionHash(value: string): Hash {
  const candidate = value.trim();
  if (!hashPattern.test(candidate)) throw new TypeError("Enter a complete Sepolia transaction hash.");
  return candidate as Hash;
}
