/** Validate and persist proof-confirmed testnet mandate outcomes. */
import fs from "node:fs";
import path from "node:path";

export function validateAttestedEvent(event, { now = Math.floor(Date.now() / 1000), maxAgeSeconds = 86_400, ids = new Set() } = {}) {
  if (!event?.eventId || ids.has(event.eventId)) throw new Error("duplicate attested event");
  if (!event.sourceTxHash || !event.settlementTxHash) throw new Error("attested event requires transaction references");
  if (!Number.isInteger(event.attestedAt) || now - event.attestedAt > maxAgeSeconds) throw new Error("stale attested event");
  if (!/^(success|violation|expired)$/.test(event.outcome)) throw new Error("invalid attested outcome");
  return { ...event, dataSource: "attested-on-chain" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = Number(process.argv[process.argv.indexOf("--count") + 1]);
  if (!Number.isInteger(count) || count < 50 || count > 100) throw new Error("--count must be between 50 and 100");
  const input = process.env.ATTESTED_EVENT_FILE;
  if (!input || !fs.existsSync(input)) throw new Error("ATTESTED_EVENT_FILE must contain proof-confirmed testnet events");
  const ids = new Set();
  const events = fs.readFileSync(input, "utf8").trim().split("\n").filter(Boolean).map((line) => {
    const event = validateAttestedEvent(JSON.parse(line), { ids }); ids.add(event.eventId); return event;
  });
  if (events.length < count) throw new Error(`expected ${count} attested events, found ${events.length}`);
  const target = path.resolve("data/attested-testnet-mandates.jsonl");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${events.slice(0, count).map((event) => JSON.stringify(event)).join("\n")}\n`);
  console.log(`ingested ${count} attested testnet outcomes into ${target}`);
}
