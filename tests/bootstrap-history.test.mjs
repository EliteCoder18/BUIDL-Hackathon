import assert from "node:assert/strict";
import test from "node:test";
import { validateAttestedEvent } from "../scripts/bootstrap-attested-history.mjs";

const event = { eventId: "event-1", agentId: "0", outcome: "success", sourceTxHash: "0xsource", settlementTxHash: "0xsettled", attestedAt: 100 };

test("testnet ingestion rejects stale, duplicate, and incomplete outcomes", () => {
  assert.deepEqual(validateAttestedEvent(event, { now: 110, maxAgeSeconds: 20 }), { ...event, dataSource: "attested-on-chain" });
  assert.throws(() => validateAttestedEvent(event, { now: 110, ids: new Set([event.eventId]) }), /duplicate/);
  assert.throws(() => validateAttestedEvent({ ...event, attestedAt: 1 }, { now: 110, maxAgeSeconds: 20 }), /stale/);
  assert.throws(() => validateAttestedEvent({ ...event, settlementTxHash: "" }, { now: 110 }), /transaction/);
});
