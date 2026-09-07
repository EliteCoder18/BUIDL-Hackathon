import assert from "node:assert/strict";
import test from "node:test";
import { MandateEventLedger } from "../services/demo/mandate-event-ledger.mjs";

const event = { eventId: "proof-1", agentId: "0", outcome: "violation", sourceTxHash: "0xsource", settlementTxHash: "0xsettled", attestedAt: 1_700_000_000 };

test("ledger accepts a settled attested outcome once and derives history", () => {
  const ledger = new MandateEventLedger({ now: () => 1_700_000_100 });
  ledger.append(event);
  assert.equal(ledger.historyFor("0").violationCount, 1);
  assert.equal(ledger.events[0].dataSource, "attested-on-chain");
  assert.throws(() => ledger.append(event), /duplicate/);
});

test("ledger rejects stale and incomplete attested outcomes", () => {
  const ledger = new MandateEventLedger({ now: () => 1_700_000_100, maxAgeSeconds: 10 });
  assert.throws(() => ledger.append({ ...event, eventId: "stale", attestedAt: 1_699_999_000 }), /stale/);
  assert.throws(() => ledger.append({ ...event, eventId: "incomplete", settlementTxHash: "" }), /transaction/);
});
