import { ProofQueue } from "../prover/proof-queue.mjs";
import { boundedFailureProbability, priceQuote } from "../underwriter/risk-engine.mjs";
import { createRiskClient } from "../underwriter/risk-client.mjs";
import { ApiInputError, assertHex, parseOutcome, parseQuoteIndex, validateJobInput } from "./validation.mjs";

const MODEL_VERSION = "trustfutures-risk-v1-fixed-seed";
const json = (body, status = 200) => Response.json(serialize(body), { status });

export function createApi({ queue = new ProofQueue(), agentRisk = new Map(), quoteSigner = null, saga = null, riskClient = createRiskClient() } = {}) {
  return {
    async handle(request) {
      const url = new URL(request.url);
      try {
        if (request.method === "GET" && url.pathname === "/healthz") {
          return json({ ok: true, service: "trustfutures-api", mode: saga ? "embedded-local" : undefined });
        }
        if (saga) {
          const routed = await handleSagaRoute({ request, url, saga });
          if (routed) return routed;
        }
        if (request.method === "POST" && url.pathname === "/v1/quotes") {
          const { jobKey, coverageAmount, history, agentId, mandateCategory, liveOutcomeCount, attestedEventValid } = await request.json();
          if (!jobKey || !history || !agentId || !mandateCategory || !Number.isInteger(liveOutcomeCount) || typeof attestedEventValid !== "boolean") return json({ error: "jobKey, history, agentId, mandateCategory, liveOutcomeCount, and attestedEventValid are required" }, 400);
          const coverage = BigInt(coverageAmount);
          if (coverage > 1_000_000_000n) return json({ error: "maximum MVP coverage is 1,000 mUSDC" }, 400);
          const risk = await riskClient.score(history, { agentId, mandateCategory, coverageSizeBaseUnits: coverage, liveOutcomeCount, attestedEventValid });
          if (risk.abstain) return json({ error: "risk model abstained", diagnostics: risk.diagnostics }, 422);
          const rawQuotes = ["conservative", "balanced", "aggressive"].map((strategy, nonce) => {
            const quote = priceQuote(history, { coverageAmount: coverage, strategy });
            const failureProbabilityBps = boundedFailureProbability(history, { strategy, modelFailureProbabilityBps: risk.failureProbabilityBps });
            const premiumBps = Math.max(75, Math.min(3_000, Math.round(failureProbabilityBps * 1.35 + 50)));
            return { jobKey, coverageAmount: coverage, ...quote, failureProbabilityBps, premiumBps, premiumAmount: coverage * BigInt(premiumBps) / 10_000n, modelHash: risk.modelHash, validUntil: Math.floor(Date.now() / 1000) + 600, nonce, underwriter: "0x0000000000000000000000000000000000000000" };
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
        if (error instanceof ApiInputError) return json({ code: error.code, error: error.message }, error.status);
        const message = error instanceof Error ? error.message : "invalid request";
        return json({ code: domainErrorCode(message), error: message }, 400);
      }
    },
  };
}

async function handleSagaRoute({ request, url, saga }) {
  if (request.method === "GET" && url.pathname === "/v1/demo/state") return json(saga.getState());
  if (request.method === "POST" && url.pathname === "/v1/demo/reset") {
    return json({ data: saga.reset(), events: [{ type: "RESET" }], transactions: [] });
  }
  if (request.method === "GET" && url.pathname === "/v1/agents") return json({ agents: saga.getAgents() });
  if (request.method === "GET" && url.pathname === "/v1/vault") return json(await saga.getVault());

  const agentRiskRoute = url.pathname.match(/^\/v1\/agents\/([^/]+)\/risk$/);
  if (request.method === "GET" && agentRiskRoute) {
    const agentId = decodeURIComponent(agentRiskRoute[1]);
    const agent = saga.getAgents().find((entry) => entry.agentId === agentId);
    if (!agent) return json({ code: "NOT_FOUND", error: "agent not found" }, 404);
    return json({ agentId, attestedFeatures: agent.history, ...await saga.getRisk(agentId) });
  }

  if (request.method === "POST" && url.pathname === "/v1/jobs") return json(await saga.createJob(validateJobInput(await request.json())));
  if (request.method === "POST" && url.pathname === "/v1/policies") {
    const body = await request.json();
    return json(await saga.acceptPolicy({ jobKey: assertHex(body.jobKey, 32, "jobKey"), quoteIndex: parseQuoteIndex(body.quoteIndex) }));
  }
  if (request.method === "POST" && url.pathname === "/v1/proofs") {
    const body = await request.json();
    return json(await saga.proveOutcome(assertHex(body.jobKey, 32, "jobKey")));
  }

  const auction = url.pathname.match(/^\/v1\/jobs\/(0x[0-9a-fA-F]{64})\/open-auction$/);
  if (request.method === "POST" && auction) return json(await saga.openAuction(assertHex(auction[1], 32, "jobKey")));
  const execution = url.pathname.match(/^\/v1\/jobs\/(0x[0-9a-fA-F]{64})\/execute$/);
  if (request.method === "POST" && execution) {
    const body = await request.json();
    return json(await saga.executeJob(assertHex(execution[1], 32, "jobKey"), parseOutcome(body.outcome)));
  }
  const settlement = url.pathname.match(/^\/v1\/policies\/(0x[0-9a-fA-F]{64})\/settle$/);
  if (request.method === "POST" && settlement) return json(await saga.settlePolicy(assertHex(settlement[1], 32, "policyId")));

  const job = url.pathname.match(/^\/v1\/jobs\/(0x[0-9a-fA-F]{64})$/);
  if (request.method === "GET" && job) return json(saga.getJob(job[1]));
  const quotes = url.pathname.match(/^\/v1\/quotes\/(0x[0-9a-fA-F]{64})$/);
  if (request.method === "GET" && quotes) return json({ jobKey: quotes[1], quotes: saga.getQuotes(quotes[1]) });
  const policy = url.pathname.match(/^\/v1\/policies\/(0x[0-9a-fA-F]{64})$/);
  if (request.method === "GET" && policy) return json(saga.getPolicy(policy[1]));
  const proof = url.pathname.match(/^\/v1\/proofs\/(0x[0-9a-fA-F]{64})$/);
  if (request.method === "GET" && proof) {
    const value = saga.getProof(proof[1]);
    return value ? json(value) : json({ code: "NOT_FOUND", error: "proof not found" }, 404);
  }
  return null;
}

function domainErrorCode(message) {
  if (/quote.*expired|expired.*quote/i.test(message)) return "QUOTE_EXPIRED";
  if (/stake|junior/i.test(message)) return "INSUFFICIENT_JUNIOR";
  if (/proof.*confirmed|proof.*ready/i.test(message)) return "PROOF_NOT_READY";
  if (/not found/i.test(message)) return "NOT_FOUND";
  return "WRONG_SAGA_STATE";
}

function serialize(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, serialize(item)]));
  return value;
}

function serializeQuote(quote) {
  return Object.fromEntries(Object.entries(quote).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value]));
}
