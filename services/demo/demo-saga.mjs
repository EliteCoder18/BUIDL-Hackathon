import { Wallet } from "ethers";

import { createRiskClient } from "../underwriter/risk-client.mjs";
import { explainQuote } from "../underwriter/explanation.mjs";
import { DemoStore } from "./demo-store.mjs";
import { LocalProofBridge } from "../local-chain/local-proof-bridge.mjs";

const QUOTE_TYPES = {
  Quote: [
    { name: "jobKey", type: "bytes32" },
    { name: "underwriter", type: "address" },
    { name: "coverageAmount", type: "uint256" },
    { name: "premiumAmount", type: "uint256" },
    { name: "juniorAmount", type: "uint256" },
    { name: "validUntil", type: "uint64" },
    { name: "modelHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
};
const STRATEGIES = ["conservative", "balanced", "aggressive"];
const STRATEGY_MULTIPLIERS = [1.35, 1, 0.72];
const ZERO_JOB_KEY = `0x${"00".repeat(32)}`;

function transaction(chain, receipt) {
  return { chain, hash: receipt.hash, blockNumber: receipt.blockNumber };
}

export function createDemoSaga(runtime, {
  store = new DemoStore(),
  proofBridge = new LocalProofBridge(runtime),
  riskClient = createRiskClient({ baseUrl: process.env.RISK_SERVICE_URL ?? "http://127.0.0.1:8000" }),
} = {}) {
  const nonces = new Map(runtime.accounts.underwriters.map((account) => [account.address, 0n]));

  async function buildQuotes(agentId, coverageAmount, jobKey) {
    const agent = store.requireAgent(agentId);
    const riskProfile = await riskClient.score(agent.history, { agentId: `agent-${String(agentId).padStart(2, "0")}`, mandateCategory: "swap", coverageSize: Number(coverageAmount), liveOutcomeCount: store.liveOutcomeCount(agentId), attestedEventValid: store.liveOutcomeCount(agentId) > 0 });
    if (riskProfile.abstain) return {};
    const latestBlock = await runtime.creditcoin.provider.getBlock("latest");
    const validUntil = BigInt(latestBlock.timestamp + 600);
    const domain = {
      name: "TrustFutures",
      version: "1",
      chainId: runtime.creditcoin.chainId,
      verifyingContract: await runtime.contracts.policy.getAddress(),
    };
    const entries = await Promise.all(runtime.accounts.underwriters.map(async (underwriter, index) => {
      const failureProbabilityBps = Math.max(100, Math.min(9_500, Math.round(riskProfile.failureProbabilityBps * STRATEGY_MULTIPLIERS[index])));
      const premiumBps = Math.max(75, Math.min(3_000, Math.round(failureProbabilityBps * 1.35 + 50)));
      const premiumAmount = coverageAmount * BigInt(premiumBps) / 10_000n;
      const juniorAmount = coverageAmount / 5n;
      const nonce = nonces.get(underwriter.address) ?? 0n;
      const quote = {
        jobKey,
        underwriter: underwriter.address,
        coverageAmount,
        premiumAmount,
        juniorAmount,
        validUntil,
        modelHash: riskProfile.modelHash,
        nonce,
      };
      const signature = await new Wallet(underwriter.privateKey).signTypedData(domain, QUOTE_TYPES, quote);
      const factors = [...riskProfile.features]
        .sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue))
        .map((feature) => ({ ...feature, label: `${feature.name.replaceAll("_", " ")} (${feature.value})` }));
      const llmExplanation = await explainQuote({ failureProbabilityBps, premiumBps, factors, strategy: STRATEGIES[index] });
      return {
        ...quote,
        failureProbabilityBps,
        premiumBps,
        seniorAmount: coverageAmount - juniorAmount,
        factors,
        riskProfile,
        llmExplanation,
        signature,
        strategy: STRATEGIES[index],
      };
    }));
    return Object.fromEntries(entries.map((quote) => [quote.strategy, quote]));
  }

  return {
    store,

    async quoteForAgent(agentId, mandate) {
      return buildQuotes(String(agentId), BigInt(mandate.coverageAmount), ZERO_JOB_KEY);
    },

    async createJob(input) {
      const agent = store.requireAgent(input.agentId);
      const amountIn = BigInt(input.amountIn);
      const minOut = BigInt(input.minOut);
      const coverageAmount = BigInt(input.coverageAmount);
      const currentBlock = await runtime.sepolia.provider.getBlock("latest");
      const deadline = BigInt(currentBlock.timestamp + Number(input.deadlineSeconds));
      const managerAddress = await runtime.contracts.jobs.getAddress();
      await (await runtime.contracts.sepoliaUsdc.connect(runtime.accounts.client.sepoliaSigner).approve(managerAddress, amountIn)).wait();
      const jobId = await runtime.contracts.jobs.nextJobId();
      const tx = await runtime.contracts.jobs.connect(runtime.accounts.client.sepoliaSigner).createJob(
        BigInt(agent.agentId),
        await runtime.contracts.sepoliaUsdc.getAddress(),
        await runtime.contracts.sepoliaWeth.getAddress(),
        await runtime.contracts.dex.getAddress(),
        amountIn,
        minOut,
        deadline,
      );
      const receipt = await tx.wait();
      const jobKey = await runtime.contracts.jobs.jobKey(jobId);
      const job = { jobKey, jobId, agentId: agent.agentId, amountIn, minOut, coverageAmount, deadline, state: "SEPOLIA_MANDATE_MINED", createTxHash: tx.hash };
      store.jobs.set(jobKey, job);
      return {
        data: job,
        events: [
          { type: "START_MANDATE", jobKey, txHash: tx.hash },
          { type: "SEPOLIA_RECEIPT", txHash: tx.hash },
        ],
        transactions: [transaction("sepolia", receipt)],
      };
    },

    async openAuction(jobKey) {
      const job = store.requireJob(jobKey);
      const byStrategy = await buildQuotes(job.agentId, job.coverageAmount, jobKey);
      const quotes = STRATEGIES.map((strategy) => byStrategy[strategy]).filter(Boolean);
      store.quotes.set(jobKey, quotes);
      job.state = "AUCTION_ACTIVE";
      return { data: { jobKey, quotes }, events: [{ type: "OPEN_AUCTION" }], transactions: [] };
    },

    async acceptPolicy({ jobKey, quoteIndex }) {
      const job = store.requireJob(jobKey);
      const quote = store.quotes.get(jobKey)?.[quoteIndex];
      if (!quote) throw new Error("quote not found");
      const client = runtime.accounts.client.creditcoinSigner;
      const clientAddress = await client.getAddress();
      await (await runtime.contracts.creditcoinUsdc.mint(clientAddress, quote.premiumAmount)).wait();
      await (await runtime.contracts.creditcoinUsdc.connect(client).approve(await runtime.contracts.policy.getAddress(), quote.premiumAmount)).wait();
      const contractQuote = {
        jobKey: quote.jobKey,
        underwriter: quote.underwriter,
        coverageAmount: quote.coverageAmount,
        premiumAmount: quote.premiumAmount,
        juniorAmount: quote.juniorAmount,
        validUntil: quote.validUntil,
        modelHash: quote.modelHash,
        nonce: quote.nonce,
      };
      const tx = await runtime.contracts.policy.connect(client).acceptQuote(contractQuote, quote.signature);
      const receipt = await tx.wait();
      const policyId = await runtime.contracts.policy.policyId(contractQuote);
      const policy = {
        policyId,
        jobKey,
        agentId: job.agentId,
        underwriter: quote.underwriter,
        strategy: quote.strategy,
        coverageAmount: quote.coverageAmount,
        premiumAmount: quote.premiumAmount,
        juniorAmount: quote.juniorAmount,
        seniorAmount: quote.coverageAmount - quote.juniorAmount,
        state: "CREDITCOIN_POLICY_LOCKED",
        lockTxHash: tx.hash,
      };
      nonces.set(quote.underwriter, quote.nonce + 1n);
      store.policies.set(policyId, policy);
      job.policyId = policyId;
      return {
        data: policy,
        events: [
          { type: "QUOTE_SIGNED", quoteId: `${quote.strategy}-${quote.nonce}`, signature: quote.signature },
          { type: "POLICY_LOCKED", txHash: tx.hash },
        ],
        transactions: [transaction("creditcoin", receipt)],
      };
    },

    async executeJob(jobKey, requestedOutcome) {
      const job = store.requireJob(jobKey);
      if (!job.policyId) throw new Error("policy must be locked before execution");
      if (requestedOutcome !== "success" && requestedOutcome !== "violation") throw new Error("invalid outcome");
      await (await runtime.contracts.dex.setOutputBps(requestedOutcome === "success" ? 10_000 : 9_000)).wait();
      const agentAccount = runtime.accounts.agents?.find((entry) => String(entry.agentId) === String(job.agentId)) ?? runtime.accounts.agent;
      const tx = await runtime.contracts.jobs.connect(agentAccount.signer).execute(job.jobId);
      const receipt = await tx.wait();
      const onchain = await runtime.contracts.jobs.jobs(job.jobId);
      const outcome = Number(onchain.outcome) === 1 ? "success" : Number(onchain.outcome) === 2 ? "violation" : "expired";
      job.outcome = outcome;
      job.executionTxHash = tx.hash;
      job.state = outcome === "success" ? "EXECUTED_SUCCESS" : "EXECUTED_VIOLATION";
      return { data: job, events: [], transactions: [transaction("sepolia", receipt)] };
    },

    async proveOutcome(jobKey) {
      const job = store.requireJob(jobKey);
      const proof = await proofBridge.prove(job);
      store.proofs.set(jobKey, proof);
      return {
        data: proof,
        events: [{ type: "START_PROOF", requestId: proof.id }],
        transactions: [
          { chain: "sepolia", hash: proof.sourceTxHash, blockNumber: proof.sourceBlockNumber },
          { chain: "creditcoin", hash: proof.creditcoinTxHash, blockNumber: proof.creditcoinBlockNumber },
        ],
      };
    },

    async settlePolicy(policyId) {
      const policy = store.requirePolicy(policyId);
      const proof = store.proofs.get(policy.jobKey);
      if (proof?.state !== "confirmed") throw new Error("proof is not confirmed");
      const clientAddress = await runtime.accounts.client.creditcoinSigner.getAddress();
      const before = await runtime.contracts.creditcoinUsdc.balanceOf(clientAddress);
      const tx = await runtime.contracts.policy.connect(runtime.accounts.client.creditcoinSigner).settle(policyId);
      const receipt = await tx.wait();
      const after = await runtime.contracts.creditcoinUsdc.balanceOf(clientAddress);
      const success = proof.outcome === "success";
      policy.state = success ? "SETTLED_SUCCESS" : "SETTLED_SLASHED";
      policy.settlementTxHash = tx.hash;
      policy.clientPayout = success ? 0n : after - before;
      policy.juniorLoss = success ? 0n : policy.juniorAmount;
      policy.seniorLoss = success ? 0n : policy.seniorAmount;
      policy.underwriterPremium = success ? policy.premiumAmount * 3n / 10n : 0n;
      policy.lpPremium = success ? policy.premiumAmount - policy.underwriterPremium : 0n;
      store.recordAttestedOutcome({
        eventId: proof.id,
        agentId: policy.agentId,
        outcome: proof.outcome,
        sourceTxHash: proof.sourceTxHash,
        settlementTxHash: tx.hash,
        attestedAt: Number((await runtime.creditcoin.provider.getBlock(receipt.blockNumber)).timestamp),
      });
      return {
        data: policy,
        events: [{ type: "PROOF_SETTLED", outcome: success ? "success" : "slashed", proofId: proof.id }],
        transactions: [transaction("creditcoin", receipt)],
      };
    },

    getState() { return store.snapshot(); },
    reset() { return store.reset(); },
    getAgents() { return [...store.agents.values()]; },
    async getRisk(agentId) { const count = store.liveOutcomeCount(agentId); return riskClient.score(store.requireAgent(agentId).history, { agentId: `agent-${String(agentId).padStart(2, "0")}`, mandateCategory: "swap", coverageSize: 100_000, liveOutcomeCount: count, attestedEventValid: count > 0 }); },
    getJob(jobKey) { return store.requireJob(jobKey); },
    getQuotes(jobKey) { return store.quotes.get(jobKey) ?? []; },
    getPolicy(policyId) { return store.requirePolicy(policyId); },
    getProof(jobKey) { return store.proofs.get(jobKey) ?? null; },
    async getVault() {
      const [totalAssets, reserved, freeAssets, totalShares] = await Promise.all([
        runtime.contracts.vault.totalAssets(),
        runtime.contracts.vault.reserved(),
        runtime.contracts.vault.freeAssets(),
        runtime.contracts.vault.totalShares(),
      ]);
      return { totalAssets, reserved, freeAssets, totalShares };
    },
  };
}
