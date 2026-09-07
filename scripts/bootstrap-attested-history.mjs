/** Validate and persist proof-confirmed testnet mandate outcomes. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { JsonRpcProvider } from "ethers";

export function validateAttestedEvent(event, { now = Math.floor(Date.now() / 1000), maxAgeSeconds = 86_400, ids = new Set() } = {}) {
  if (!event?.eventId || ids.has(event.eventId)) throw new Error("duplicate attested event");
  if (!/^0x[0-9a-f]{64}$/i.test(event.sourceTxHash ?? "") || !/^0x[0-9a-f]{64}$/i.test(event.settlementTxHash ?? "")) throw new Error("attested event requires transaction references");
  if (!Number.isInteger(event.attestedAt) || event.attestedAt > now || now - event.attestedAt > maxAgeSeconds) throw new Error("stale attested event");
  if (!/^(success|violation|expired)$/.test(event.outcome)) throw new Error("invalid attested outcome");
  for (const key of ["agentId", "mandateCategory", "coverageSize", "deadline", "expectedOutput", "actualOutput", "slippageBps", "completionLatencySeconds", "sourceChainId", "settlementChainId"]) if (event[key] === undefined) throw new Error(`missing ${key}`);
  if (event.sourceChainId !== 11155111 || event.settlementChainId !== 102031) throw new Error("invalid chain IDs");
  return { ...event, dataSource: "attested-on-chain" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = Number(process.argv[process.argv.indexOf("--count") + 1]);
  if (!Number.isInteger(count) || count < 50 || count > 100) throw new Error("--count must be between 50 and 100");
  const execute = process.argv.includes("--execute");
  const input = process.env.ATTESTED_EVENT_FILE;
  if (execute) {
    const generated = [];
    for (let index = 0; index < count; index += 1) {
      const checkpoint = path.resolve(`deployments/testnet-history-loop-${index}.json`);
      const outcome = index % 2 === 0 ? "success" : "violation";
      const run = spawnSync(process.execPath, ["scripts/testnet-loop.mjs", "--outcome", outcome], { stdio: "inherit", env: { ...process.env, TESTNET_LOOP_FILE: checkpoint } });
      if (run.status !== 0 || !fs.existsSync(checkpoint)) throw new Error(`testnet mandate ${index} did not settle`);
      const state = JSON.parse(fs.readFileSync(checkpoint, "utf8"));
      if (state.status !== "complete" || !state.proof?.txBytes || !state.steps?.["settle-policy"]?.hash) throw new Error(`testnet mandate ${index} lacks proof-confirmed settlement`);
      const source = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
      const settlement = new JsonRpcProvider(process.env.CREDITCOIN_RPC_URL);
      try {
        const [sourceReceipt, settlementReceipt] = await Promise.all([source.getTransactionReceipt(state.steps["execute-job"].hash), settlement.getTransactionReceipt(state.steps["settle-policy"].hash)]);
        if (!sourceReceipt || sourceReceipt.status !== 1 || !settlementReceipt || settlementReceipt.status !== 1) throw new Error(`testnet mandate ${index} receipt verification failed`);
      } finally { source.destroy(); settlement.destroy(); }
      generated.push(JSON.stringify(state.attestedEvent));
    }
    const generatedFile = path.resolve("data/attested-testnet-bootstrap.jsonl");
    fs.mkdirSync(path.dirname(generatedFile), { recursive: true });
    fs.writeFileSync(generatedFile, `${generated.join("\n")}\n`);
    process.env.ATTESTED_EVENT_FILE = generatedFile;
  }
  const eventFile = execute ? process.env.ATTESTED_EVENT_FILE : input;
  if (!eventFile || !fs.existsSync(eventFile)) throw new Error("ATTESTED_EVENT_FILE must contain proof-confirmed testnet events");
  const ids = new Set();
  const events = fs.readFileSync(eventFile, "utf8").trim().split("\n").filter(Boolean).map((line) => {
    const event = validateAttestedEvent(JSON.parse(line), { ids }); ids.add(event.eventId); return event;
  });
  if (events.length < count) throw new Error(`expected ${count} attested events, found ${events.length}`);
  const target = path.resolve("data/attested-testnet-mandates.jsonl");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${events.slice(0, count).map((event) => JSON.stringify(event)).join("\n")}\n`);
  console.log(`ingested ${count} attested testnet outcomes into ${target}`);
}
