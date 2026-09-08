import { createServer } from "node:http";
import { createApi } from "./app.mjs";
import { createDemoSaga } from "../demo/demo-saga.mjs";
import { createLocalChainRuntime } from "../local-chain/runtime.mjs";
import { signerFromEnvironment } from "../underwriter/quote-signer.mjs";
import { PostgresProofQueue } from "../prover/postgres-proof-queue.mjs";
import { corsHeaders } from "./cors.mjs";

const demoMode = process.env.TRUSTFUTURES_DEMO === "true";
const runtime = demoMode ? await createLocalChainRuntime({
  sepoliaPort: Number(process.env.SEPOLIA_LOCAL_PORT ?? 8545),
  creditcoinPort: Number(process.env.CREDITCOIN_LOCAL_PORT ?? 9545),
}) : null;
const queue = process.env.DATABASE_URL ? new PostgresProofQueue(process.env.DATABASE_URL) : undefined;
if (queue) await queue.migrate();
const api = createApi({ quoteSigner: signerFromEnvironment(), queue, saga: runtime ? createDemoSaga(runtime) : null });
const server = createServer(async (req, res) => {
  const cors = corsHeaders(req.headers.origin);
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  try {
    const body = await new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on("data", (chunk) => {
        size += chunk.length;
        if (size > 1_000_000) {
          chunks.length = 0;
          reject(Object.assign(new Error("request body too large"), { status: 413 }));
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
      req.on("aborted", () => reject(new Error("request aborted")));
    });
    const response = await api.handle(new Request(`http://localhost${req.url}`, { method: req.method, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }));
    res.writeHead(response.status, { ...cors, ...Object.fromEntries(response.headers) });
    res.end(await response.text());
  } catch (error) {
    if (res.destroyed) return;
    const status = error?.status === 413 ? 413 : 500;
    res.writeHead(status, { ...cors, "content-type": "application/json" });
    res.end(JSON.stringify({ error: status === 413 ? "request body too large" : "request failed" }));
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
