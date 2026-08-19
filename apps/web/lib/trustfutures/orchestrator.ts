import { assign, setup } from "xstate";
import type { Bytes32 } from "./types";

export type OrchestratorState =
  | "IDLE"
  | "SEPOLIA_MANDATE_PENDING"
  | "SEPOLIA_MANDATE_MINED"
  | "AUCTION_ACTIVE"
  | "QUOTE_SIGNED"
  | "CREDITCOIN_POLICY_LOCKED"
  | "ATTESTCOIN_PROVING"
  | "SETTLED_SUCCESS"
  | "SETTLED_SLASHED";

export type CrossChainEvent =
  | { type: "START_MANDATE"; jobKey: Bytes32; txHash?: string }
  | { type: "SEPOLIA_RECEIPT"; txHash: string }
  | { type: "OPEN_AUCTION" }
  | { type: "QUOTE_SIGNED"; quoteId: string; signature: string }
  | { type: "POLICY_LOCKED"; txHash: string }
  | { type: "START_PROOF"; requestId: string }
  | { type: "PROOF_SETTLED"; outcome: "success" | "slashed"; proofId: string }
  | { type: "HYDRATE"; state: OrchestratorState; context?: OrchestratorContext }
  | { type: "RESET" };

export interface OrchestratorContext {
  jobKey?: Bytes32;
  sepoliaTxHash?: string;
  creditcoinTxHash?: string;
  quoteId?: string;
  signature?: string;
  proofId?: string;
  proofRequestId?: string;
}

export interface MockWebSocketPayload {
  topic: "sepolia.receipt" | "auction.opened" | "policy.locked" | "proof.started" | "proof.settled";
  txHash?: string;
  requestId?: string;
  proofId?: string;
  outcome?: "success" | "slashed";
}

/** Converts external delivery formats into events. Unknown payloads are discarded. */
export function eventFromMockWebSocket(payload: unknown): CrossChainEvent | null {
  if (!payload || typeof payload !== "object" || !("topic" in payload)) return null;
  const message = payload as Partial<MockWebSocketPayload>;
  switch (message.topic) {
    case "sepolia.receipt":
      return typeof message.txHash === "string" ? { type: "SEPOLIA_RECEIPT", txHash: message.txHash } : null;
    case "auction.opened":
      return { type: "OPEN_AUCTION" };
    case "policy.locked":
      return typeof message.txHash === "string" ? { type: "POLICY_LOCKED", txHash: message.txHash } : null;
    case "proof.started":
      return typeof message.requestId === "string" ? { type: "START_PROOF", requestId: message.requestId } : null;
    case "proof.settled":
      return typeof message.proofId === "string" && (message.outcome === "success" || message.outcome === "slashed")
        ? { type: "PROOF_SETTLED", proofId: message.proofId, outcome: message.outcome }
        : null;
    default:
      return null;
  }
}

/** Adapter for a wagmi receipt once its status has been confirmed successful. */
export function eventFromWagmiReceipt(
  operation: "sepoliaMandate" | "creditcoinPolicy",
  receipt: { transactionHash: string; status: "success" | "reverted" },
): CrossChainEvent | null {
  if (receipt.status !== "success") return null;
  return operation === "sepoliaMandate"
    ? { type: "SEPOLIA_RECEIPT", txHash: receipt.transactionHash }
    : { type: "POLICY_LOCKED", txHash: receipt.transactionHash };
}

export const crossChainOrchestrator = setup({
  types: {
    context: {} as OrchestratorContext,
    events: {} as CrossChainEvent,
  },
  actions: {
    setMandate: assign(({ event }) => event.type === "START_MANDATE" ? { jobKey: event.jobKey, sepoliaTxHash: event.txHash } : {}),
    setSepoliaReceipt: assign(({ event }) => event.type === "SEPOLIA_RECEIPT" ? { sepoliaTxHash: event.txHash } : {}),
    setQuote: assign(({ event }) => event.type === "QUOTE_SIGNED" ? { quoteId: event.quoteId, signature: event.signature } : {}),
    setPolicy: assign(({ event }) => event.type === "POLICY_LOCKED" ? { creditcoinTxHash: event.txHash } : {}),
    setProofRequest: assign(({ event }) => event.type === "START_PROOF" ? { proofRequestId: event.requestId } : {}),
    setProof: assign(({ event }) => event.type === "PROOF_SETTLED" ? { proofId: event.proofId } : {}),
    hydrate: assign(({ event }) => event.type === "HYDRATE" ? event.context ?? {} : {}),
    clear: assign(() => ({
      jobKey: undefined,
      sepoliaTxHash: undefined,
      creditcoinTxHash: undefined,
      quoteId: undefined,
      signature: undefined,
      proofId: undefined,
      proofRequestId: undefined,
    })),
  },
}).createMachine({
  id: "crossChainOrchestrator",
  initial: "IDLE",
  context: {},
  on: {
    RESET: { target: ".IDLE", actions: "clear" },
    HYDRATE: [
      { guard: ({ event }) => event.state === "IDLE", target: ".IDLE", actions: ["clear", "hydrate"] },
      { guard: ({ event }) => event.state === "SEPOLIA_MANDATE_PENDING", target: ".SEPOLIA_MANDATE_PENDING", actions: ["clear", "hydrate"] },
      { guard: ({ event }) => event.state === "SEPOLIA_MANDATE_MINED", target: ".SEPOLIA_MANDATE_MINED", actions: ["clear", "hydrate"] },
      { guard: ({ event }) => event.state === "AUCTION_ACTIVE", target: ".AUCTION_ACTIVE", actions: ["clear", "hydrate"] },
      { guard: ({ event }) => event.state === "QUOTE_SIGNED", target: ".QUOTE_SIGNED", actions: ["clear", "hydrate"] },
      { guard: ({ event }) => event.state === "CREDITCOIN_POLICY_LOCKED", target: ".CREDITCOIN_POLICY_LOCKED", actions: ["clear", "hydrate"] },
      { guard: ({ event }) => event.state === "ATTESTCOIN_PROVING", target: ".ATTESTCOIN_PROVING", actions: ["clear", "hydrate"] },
      { guard: ({ event }) => event.state === "SETTLED_SUCCESS", target: ".SETTLED_SUCCESS", actions: ["clear", "hydrate"] },
      { target: ".SETTLED_SLASHED", actions: ["clear", "hydrate"] },
    ],
  },
  states: {
    IDLE: { on: { START_MANDATE: { target: "SEPOLIA_MANDATE_PENDING", actions: "setMandate" } } },
    SEPOLIA_MANDATE_PENDING: { on: { SEPOLIA_RECEIPT: { target: "SEPOLIA_MANDATE_MINED", actions: "setSepoliaReceipt" } } },
    SEPOLIA_MANDATE_MINED: { on: { OPEN_AUCTION: "AUCTION_ACTIVE" } },
    AUCTION_ACTIVE: { on: { QUOTE_SIGNED: { target: "QUOTE_SIGNED", actions: "setQuote" } } },
    QUOTE_SIGNED: { on: { POLICY_LOCKED: { target: "CREDITCOIN_POLICY_LOCKED", actions: "setPolicy" } } },
    CREDITCOIN_POLICY_LOCKED: { on: { START_PROOF: { target: "ATTESTCOIN_PROVING", actions: "setProofRequest" } } },
    ATTESTCOIN_PROVING: {
      on: {
        PROOF_SETTLED: [
          { guard: ({ event }) => event.outcome === "success", target: "SETTLED_SUCCESS", actions: "setProof" },
          { target: "SETTLED_SLASHED", actions: "setProof" },
        ],
      },
    },
    SETTLED_SUCCESS: {},
    SETTLED_SLASHED: {},
  },
});
