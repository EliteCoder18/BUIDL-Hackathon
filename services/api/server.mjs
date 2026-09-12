import { createServer } from "node:http";
import { JsonRpcProvider } from "ethers";
import { createApi } from "./app.mjs";
import { createDemoSaga } from "../demo/demo-saga.mjs";
import { createLocalChainRuntime } from "../local-chain/runtime.mjs";
import { signerFromEnvironment } from "../underwriter/quote-signer.mjs";
import { PostgresProofQueue } from "../prover/postgres-proof-queue.mjs";
import { corsHeaders } from "./cors.mjs";
import { validateApiEnvironment } from "../deployment/config.mjs";
import { verifyLiveJob } from "./live-job-verifier.mjs";
import { createLiveMarketReader } from "./live-market-reader.mjs";

const demoMode = process.env.TRUSTFUTURES_DEMO === "true";
if (process.env.DEPLOYMENT_ENV === "render") validateApiEnvironment(process.env);
const runtime = demoMode ? await createLocalChainRuntime({
  sepoliaPort: Number(process.env.SEPOLIA_LOCAL_PORT ?? 8545),
  creditcoinPort: Number(process.env.CREDITCOIN_LOCAL_PORT ?? 9545),
}) : null;
const queue = process.env.DATABASE_URL ? new PostgresProofQueue(process.env.DATABASE_URL) : undefined;
if (queue) await queue.migrate();
const saga = runtime ? createDemoSaga(runtime) : null;
const quoteSigner = signerFromEnvironment();
const liveWallet = process.env.TRUSTFUTURES_LIVE_WALLET === "true";
const sourceProvider = liveWallet ? new JsonRpcProvider(process.env.SEPOLIA_RPC_URL, 11155111) : null;
const liveMarketReady = [process.env.CREDITCOIN_RPC_URL, process.env.POLICY_MANAGER_ADDRESS, process.env.COVERAGE_VAULT_ADDRESS, process.env.ATTESTCOIN_OUTCOME_ADAPTER_ADDRESS, process.env.CREDITCOIN_DEPLOYMENT_BLOCK].every(Boolean);
const creditcoinProvider = liveMarketReady ? new JsonRpcProvider(process.env.CREDITCOIN_RPC_URL, 102031) : null;
const liveMarketReader = creditcoinProvider ? createLiveMarketReader({
  provider: creditcoinProvider,
  policyManagerAddress: process.env.POLICY_MANAGER_ADDRESS,
  coverageVaultAddress: process.env.COVERAGE_VAULT_ADDRESS,
  outcomeAdapterAddress: process.env.ATTESTCOIN_OUTCOME_ADAPTER_ADDRESS,
  fromBlock: Number(process.env.CREDITCOIN_DEPLOYMENT_BLOCK),
}) : null;
const liveAgentId = process.env.LIVE_AGENT_ID ?? "10130";
const liveJobVerifier = liveWallet && sourceProvider
  ? (sourceTxHash) => verifyLiveJob({ sourceTxHash, expectedManager: process.env.TREASURY_JOB_MANAGER_ADDRESS, provider: sourceProvider })
  : null;
const api = createApi({
  quoteSigner,
  queue,
  saga,
  liveJobVerifier,
  liveAgentHistory: liveWallet ? (agentId) => agentId === liveAgentId ? saga?.getAgents()[0]?.history : null : null,
  liveSigningDomain: liveWallet ? { chainId: 102031, verifyingContract: process.env.POLICY_MANAGER_ADDRESS } : null,
  liveMarketReader,
});
const server = createServer(async (req, res) => {
  const cors = corsHeaders(req.headers.origin);
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
  if (sourceProvider) sourceProvider.destroy();
  if (creditcoinProvider) creditcoinProvider.destroy();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
