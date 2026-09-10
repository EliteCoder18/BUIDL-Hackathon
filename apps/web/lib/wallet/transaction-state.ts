export type WalletTransactionState =
  | { stage: "idle" | "needs-wallet" | "needs-network" | "needs-funds" | "awaiting-signature" }
  | { stage: "confirming"; hash: `0x${string}` }
  | { stage: "confirmed"; hash: `0x${string}`; blockNumber: bigint }
  | { stage: "failed"; code: string; message: string };

export type WalletTransactionEvent =
  | { type: "REQUEST_SIGNATURE" }
  | { type: "SUBMITTED"; hash: `0x${string}` }
  | { type: "CONFIRMED"; blockNumber: bigint }
  | { type: "REJECTED" }
  | { type: "FAILED"; code: string; message: string };

export function reduceWalletTransaction(state: WalletTransactionState, event: WalletTransactionEvent): WalletTransactionState {
  if (event.type === "REQUEST_SIGNATURE") return { stage: "awaiting-signature" };
  if (event.type === "SUBMITTED") return { stage: "confirming", hash: event.hash };
  if (event.type === "REJECTED") return { stage: "failed", code: "USER_REJECTED", message: "Signature request rejected. Nothing was submitted." };
  if (event.type === "FAILED") return { stage: "failed", code: event.code, message: event.message };
  if (event.type === "CONFIRMED" && state.stage === "confirming") return { stage: "confirmed", hash: state.hash, blockNumber: event.blockNumber };
  return state;
}
