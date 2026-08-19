import { ProofQueue } from "../prover/proof-queue.mjs";
import { priceQuote } from "../underwriter/risk-engine.mjs";

const MODEL_VERSION = "trustfutures-risk-v1-fixed-seed";
const json = (body, status = 200) => Response.json(body, { status });

export function createApi({ queue = new ProofQueue(), agentRisk = new Map(), quoteSigner = null } = {}) {
  return {
    async handle(request) {
      const url = new URL(request.url);
      try {
        if (request.method === "POST" && url.pathname === "/v1/quotes") {
          const { jobKey, coverageAmount, history } = await request.json();
          if (!jobKey || !history) return json({ error: "jobKey and attested history are required" }, 400);
          const coverage = BigInt(coverageAmount);
          if (coverage > 1_000_000_000n) return json({ error: "maximum MVP coverage is 1,000 mUSDC" }, 400);
          const rawQuotes = ["conservative", "balanced", "aggressive"].map((strategy, nonce) => {
            const quote = priceQuote(history, { coverageAmount: coverage, strategy });
            return { jobKey, coverageAmount: coverage, ...quote, validUntil: Math.floor(Date.now() / 1000) + 600, nonce, underwriter: "0x0000000000000000000000000000000000000000" };
          });
          const signedQuotes = quoteSigner ? await Promise.all(rawQuotes.map(quoteSigner)) : rawQuotes;
          return json({ quotes: signedQuotes.map(serializeQuote), signing: quoteSigner ? "EIP-712 signed" : "Quotes require configured underwriter keys before on-chain acceptance." });
        }
        if (request.method === "POST" && url.pathname === "/v1/proofs") {
          const { jobKey, sourceTxHash } = await request.json();
          if (!jobKey || !sourceTxHash) return json({ error: "jobKey and sourceTxHash are required" }, 400);
          return json(await queue.enqueue(jobKey, { sourceTxHash }));
        }
        if (request.method === "GET" && url.pathname.startsWith("/v1/proofs/")) {
          const job = await queue.get(decodeURIComponent(url.pathname.slice("/v1/proofs/".length)));
          return job ? json(job) : json({ error: "proof not found" }, 404);
        }
        const agent = url.pathname.match(/^\/v1\/agents\/([^/]+)\/risk$/);
        if (request.method === "GET" && agent) {
          const history = agentRisk.get(decodeURIComponent(agent[1]));
          if (!history) return json({ error: "agent has no attested history" }, 404);
          const score = priceQuote(history, { coverageAmount: 100_000_000n, strategy: "balanced" });
          return json({ agentId: agent[1], attestedFeatures: history, failureProbabilityBps: score.failureProbabilityBps, modelVersion: MODEL_VERSION, modelHash: score.modelHash });
        }
        return json({ error: "not found" }, 404);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "invalid request" }, 400);
      }
    },
  };
}

function serializeQuote(quote) {
  return Object.fromEntries(Object.entries(quote).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value]));
}
