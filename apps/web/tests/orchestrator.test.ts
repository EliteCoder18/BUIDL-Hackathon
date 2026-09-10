import assert from "node:assert/strict";
import test from "node:test";
import { createActor } from "xstate";
import {
  crossChainOrchestrator,
  eventFromMockWebSocket,
  eventFromWagmiReceipt,
} from "../lib/trustfutures/orchestrator";

const JOB_KEY = "0x0000000000000000000000000000000000000000000000000000000000000449" as const;

test("the cross-chain saga reaches success only through the ordered lifecycle", () => {
  const actor = createActor(crossChainOrchestrator).start();
  actor.send({ type: "START_MANDATE", jobKey: JOB_KEY });
  actor.send({ type: "SEPOLIA_RECEIPT", txHash: "0x01" });
  actor.send({ type: "OPEN_AUCTION" });
  actor.send({ type: "QUOTE_SIGNED", quoteId: "quote-1", signature: "0xsig" });
  actor.send({ type: "POLICY_LOCKED", txHash: "0x02" });
  actor.send({ type: "START_PROOF", requestId: "proof-request-1" });
  actor.send({ type: "PROOF_SETTLED", proofId: "proof-1", outcome: "success" });

  assert.equal(actor.getSnapshot().value, "SETTLED_SUCCESS");
  assert.equal(actor.getSnapshot().context.proofId, "proof-1");
  actor.stop();
});

test("a slashed proof settles through the failure branch", () => {
  const actor = createActor(crossChainOrchestrator).start();
  actor.send({ type: "START_MANDATE", jobKey: JOB_KEY });
  actor.send({ type: "SEPOLIA_RECEIPT", txHash: "0x01" });
  actor.send({ type: "OPEN_AUCTION" });
  actor.send({ type: "QUOTE_SIGNED", quoteId: "quote-1", signature: "0xsig" });
  actor.send({ type: "POLICY_LOCKED", txHash: "0x02" });
  actor.send({ type: "START_PROOF", requestId: "proof-request-1" });
  actor.send({ type: "PROOF_SETTLED", proofId: "proof-2", outcome: "slashed" });

  assert.equal(actor.getSnapshot().value, "SETTLED_SLASHED");
  actor.stop();
});

test("invalid out-of-order events cannot skip lifecycle states", () => {
  const actor = createActor(crossChainOrchestrator).start();
  actor.send({ type: "POLICY_LOCKED", txHash: "0x02" });
  actor.send({ type: "PROOF_SETTLED", proofId: "proof-2", outcome: "slashed" });

  assert.equal(actor.getSnapshot().value, "IDLE");
  actor.stop();
});

test("receipt adapters distinguish Sepolia mandate and Creditcoin policy receipts", () => {
  assert.deepEqual(
    eventFromWagmiReceipt("sepoliaMandate", { transactionHash: "0x01", status: "success" }),
    { type: "SEPOLIA_RECEIPT", txHash: "0x01" },
  );
  assert.deepEqual(
    eventFromWagmiReceipt("creditcoinPolicy", { transactionHash: "0x02", status: "success" }),
    { type: "POLICY_LOCKED", txHash: "0x02" },
  );
  assert.equal(eventFromWagmiReceipt("sepoliaMandate", { transactionHash: "0x03", status: "reverted" }), null);
});

test("mock WebSocket adapter rejects malformed external payloads", () => {
  assert.deepEqual(eventFromMockWebSocket({ topic: "proof.settled", proofId: "proof-9", outcome: "slashed" }), {
    type: "PROOF_SETTLED",
    proofId: "proof-9",
    outcome: "slashed",
  });
  assert.equal(eventFromMockWebSocket({ topic: "proof.settled", proofId: "proof-9" }), null);
  assert.equal(eventFromMockWebSocket(null), null);
  assert.equal(eventFromMockWebSocket({ topic: "proof.settled", proofId: "proof-9", outcome: "corrupt" }), null);
});

test("reset removes previous saga identifiers", () => {
  const actor = createActor(crossChainOrchestrator).start();
  actor.send({ type: "START_MANDATE", jobKey: JOB_KEY });
  actor.send({ type: "SEPOLIA_RECEIPT", txHash: "0x01" });
  actor.send({ type: "OPEN_AUCTION" });
  actor.send({ type: "QUOTE_SIGNED", quoteId: "quote-1", signature: "0xsig" });
  actor.send({ type: "POLICY_LOCKED", txHash: "0x02" });
  actor.send({ type: "START_PROOF", requestId: "proof-request-1" });
  actor.send({ type: "PROOF_SETTLED", proofId: "proof-1", outcome: "success" });
  actor.send({ type: "RESET" });

  assert.equal(actor.getSnapshot().context.jobKey, undefined);
  assert.equal(actor.getSnapshot().context.sepoliaTxHash, undefined);
  assert.equal(actor.getSnapshot().context.creditcoinTxHash, undefined);
  assert.equal(actor.getSnapshot().context.quoteId, undefined);
  assert.equal(actor.getSnapshot().context.proofId, undefined);
  actor.stop();
});

test("authoritative route state can hydrate the saga after a browser refresh", () => {
  const actor = createActor(crossChainOrchestrator).start();
  actor.send({
    type: "HYDRATE",
    state: "CREDITCOIN_POLICY_LOCKED",
    context: { jobKey: JOB_KEY, creditcoinTxHash: "0xcc3" },
  });
  assert.equal(actor.getSnapshot().value, "CREDITCOIN_POLICY_LOCKED");
  assert.equal(actor.getSnapshot().context.jobKey, JOB_KEY);
  actor.send({ type: "RESET" });
  assert.equal(actor.getSnapshot().value, "IDLE");
  actor.stop();
});

test("confirmed wallet receipts advance the shared topology without intermediate server events", () => {
  const actor = createActor(crossChainOrchestrator).start();
  actor.send({ type: "WALLET_TX_CONFIRMED", operation: "createJob", jobKey: JOB_KEY, txHash: "0xwallet-sepolia" });
  assert.equal(actor.getSnapshot().value, "AUCTION_ACTIVE");
  assert.equal(actor.getSnapshot().context.sepoliaTxHash, "0xwallet-sepolia");
  actor.send({ type: "WALLET_TX_CONFIRMED", operation: "acceptQuote", txHash: "0xwallet-cc3", quoteId: "balanced-0", signature: "0xsigned" });
  assert.equal(actor.getSnapshot().value, "CREDITCOIN_POLICY_LOCKED");
  assert.equal(actor.getSnapshot().context.creditcoinTxHash, "0xwallet-cc3");
});
