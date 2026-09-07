/** Append-only records whose outcome was proved and settled on-chain. */
export class MandateEventLedger {
  constructor({ now = () => Math.floor(Date.now() / 1000), maxAgeSeconds = 86_400 } = {}) {
    this.now = now;
    this.maxAgeSeconds = maxAgeSeconds;
    this.events = [];
    this.ids = new Set();
  }

  append(event) {
    if (!event?.eventId || this.ids.has(event.eventId)) throw new Error("duplicate attested event");
    if (!event.sourceTxHash || !event.settlementTxHash) throw new Error("attested event requires transaction references");
    if (!Number.isInteger(event.attestedAt) || event.attestedAt <= 0 || this.now() - event.attestedAt > this.maxAgeSeconds) throw new Error("stale attested event");
    if (!["success", "violation", "expired"].includes(event.outcome)) throw new Error("invalid attested outcome");
    const record = Object.freeze({ ...event, dataSource: "attested-on-chain" });
    this.ids.add(record.eventId);
    this.events.push(record);
    return record;
  }

  historyFor(agentId) {
    const events = this.events.filter((event) => event.agentId === String(agentId));
    return { successCount: events.filter((event) => event.outcome === "success").length,
      violationCount: events.filter((event) => event.outcome === "violation").length,
      expiryCount: events.filter((event) => event.outcome === "expired").length };
  }
}
