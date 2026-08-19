import { ProofQueue } from "../prover/proof-queue.mjs";

const OUTCOMES = Object.freeze({ 1: "success", 2: "violation", 3: "expired" });

export class LocalProofBridge {
  constructor(runtime, { queue = new ProofQueue() } = {}) {
    this.runtime = runtime;
    this.queue = queue;
  }

  async prove(job) {
    const existing = this.queue.get(job.jobKey);
    if (existing?.state === "confirmed") return existing;
    const queued = this.queue.enqueue(job.jobKey, { sourceTxHash: job.executionTxHash });
    if (!job.executionTxHash) throw new Error("job has no settled source transaction");
    this.queue.transition(job.jobKey, "building");

    try {
      const receipt = await this.runtime.sepolia.provider.getTransactionReceipt(job.executionTxHash);
      if (!receipt || receipt.status !== 1) throw new Error("source receipt is missing or reverted");
      const managerAddress = (await this.runtime.contracts.jobs.getAddress()).toLowerCase();
      const settled = receipt.logs
        .filter((log) => log.address.toLowerCase() === managerAddress)
        .map((log) => {
          try { return this.runtime.contracts.jobs.interface.parseLog(log); } catch { return null; }
        })
        .find((entry) => entry?.name === "JobSettled");
      if (!settled) throw new Error("source receipt has no JobSettled event");
      const jobId = BigInt(settled.args.jobId);
      const outcome = Number(settled.args.outcome);
      if (jobId !== job.jobId || !OUTCOMES[outcome]) throw new Error("source outcome does not match job");
      const computedKey = await this.runtime.contracts.jobs.jobKey(jobId);
      if (computedKey !== job.jobKey) throw new Error("source job key mismatch");

      const submission = await this.runtime.contracts.outcomeAdapter.setOutcome(job.jobKey, outcome);
      const destinationReceipt = await submission.wait();
      this.queue.transition(job.jobKey, "submitted", { creditcoinTxHash: submission.hash });
      this.queue.transition(job.jobKey, "confirmed", {
        proofSource: "local-attestcoin-simulation",
        outcome: OUTCOMES[outcome],
        sourceBlockNumber: receipt.blockNumber,
        creditcoinBlockNumber: destinationReceipt.blockNumber,
      });
      return this.queue.get(job.jobKey);
    } catch (error) {
      const current = this.queue.get(job.jobKey) ?? queued;
      if (current.state !== "failed") this.queue.transition(job.jobKey, "failed", { error: String(error.message ?? error) });
      throw error;
    }
  }
}
