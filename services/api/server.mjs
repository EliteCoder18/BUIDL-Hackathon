import { createServer } from "node:http";
import { createApi } from "./app.mjs";
import { createDemoSaga } from "../demo/demo-saga.mjs";
import { createLocalChainRuntime } from "../local-chain/runtime.mjs";
import { signerFromEnvironment } from "../underwriter/quote-signer.mjs";
import { PostgresProofQueue } from "../prover/postgres-proof-queue.mjs";

const demoMode = process.env.TRUSTFUTURES_DEMO === "true";
const runtime = demoMode ? await createLocalChainRuntime({
  sepoliaPort: Number(process.env.SEPOLIA_LOCAL_PORT ?? 8545),
  creditcoinPort: Number(process.env.CREDITCOIN_LOCAL_PORT ?? 9545),
}) : null;
const queue = process.env.DATABASE_URL ? new PostgresProofQueue(process.env.DATABASE_URL) : undefined;
if (queue) await queue.migrate();
const api = createApi({ quoteSigner: signerFromEnvironment(), queue, saga: runtime ? createDemoSaga(runtime) : null });
const server = createServer(async (req, res) => {
  const origin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  const body = await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (Buffer.byteLength(data) > 1_000_000) reject(new Error("request body too large"));
    });
    req.on("end", () => resolve(data));
  });
  try {
    const response = await api.handle(new Request(`http://localhost${req.url}`, { method: req.method, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }));
    res.writeHead(response.status, { ...cors, ...Object.fromEntries(response.headers) });
    res.end(await response.text());
  } catch (error) {
    res.writeHead(413, { ...cors, "content-type": "application/json" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "request failed" }));
  }
});

server.listen(process.env.PORT ?? 3001, () => console.log(`TrustFutures API listening (${demoMode ? "embedded-local" : "service"})`));

async function shutdown() {
  server.close();
  if (queue) await queue.close();
  if (runtime) await runtime.close();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
