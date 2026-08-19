const seededHistory = (overrides = {}) => ({
  successCount: 9,
  violationCount: 0,
  expiryCount: 1,
  meanSlippageBps: 24,
  meanLatenessBps: 42,
  amountVsP95Bps: 9_400,
  deadlineTightnessBps: 280,
  volatilityBps: 300,
  ...overrides,
});

export class DemoStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.agents = new Map([
      ["0", { agentId: "0", name: "Treasury Delta", history: seededHistory() }],
      ["1", { agentId: "1", name: "Liquidity Sigma", history: seededHistory({ successCount: 8, violationCount: 1, meanSlippageBps: 39 }) }],
    ]);
    this.jobs = new Map();
    this.quotes = new Map();
    this.policies = new Map();
    this.proofs = new Map();
    return this.snapshot();
  }

  requireAgent(agentId) {
    const agent = this.agents.get(String(agentId));
    if (!agent) throw new Error("agent not found");
    return agent;
  }

  requireJob(jobKey) {
    const job = this.jobs.get(jobKey);
    if (!job) throw new Error("job not found");
    return job;
  }

  requirePolicy(policyId) {
    const policy = this.policies.get(policyId);
    if (!policy) throw new Error("policy not found");
    return policy;
  }

  recordOutcome(agentId, outcome) {
    const history = this.requireAgent(agentId).history;
    if (outcome === "success") history.successCount += 1;
    else if (outcome === "violation") history.violationCount += 1;
    else history.expiryCount += 1;
    return history;
  }

  snapshot() {
    return {
      agents: [...this.agents.values()],
      jobs: [...this.jobs.values()],
      policies: [...this.policies.values()],
      proofs: [...this.proofs.values()],
    };
  }
}
