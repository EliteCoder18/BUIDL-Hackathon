import { createServer } from "node:http";
import { createApi } from "./app.mjs";
import { signerFromEnvironment } from "../underwriter/quote-signer.mjs";
import { PostgresProofQueue } from "../prover/postgres-proof-queue.mjs";

const queue = process.env.DATABASE_URL ? new PostgresProofQueue(process.env.DATABASE_URL) : undefined;
if (queue) await queue.migrate();
const api = createApi({ quoteSigner: signerFromEnvironment(), queue });
createServer(async (req, res) => {
  const body = await new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => resolve(data));
  });
  const response = await api.handle(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}).listen(process.env.PORT ?? 3001, () => console.log("TrustFutures API listening"));
