import { ProofQueue } from "./proof-queue.mjs";

// Adapter boundary for @gluwa/usc-sdk. Kept injectable so integration tests run without wallets.
export class AttestcoinProofWorker {
  constructor({ buildProof, submitProof, queue = new ProofQueue() }) {
    this.buildProof = buildProof;
    this.submitProof = submitProof;
    this.queue = queue;
  }

  enqueue(jobKey, sourceBlock) {
    return this.queue.enqueue(jobKey, { sourceBlock });
  }

  async process(jobKey) {
    const job = this.queue.get(jobKey);
    if (!job || job.state === "confirmed") return job;
    try {
      if (job.state === "queued") this.queue.transition(jobKey, "building");
      const proof = await this.buildProof(job);
      const txHash = await this.submitProof(job, proof);
      this.queue.transition(jobKey, "submitted", { txHash });
      return this.queue.get(jobKey);
    } catch (error) {
      const current = this.queue.get(jobKey);
      if (current && current.state !== "failed") this.queue.transition(jobKey, "failed", { error: String(error.message ?? error) });
      return this.queue.get(jobKey);
    }
  }

  confirm(jobKey, receipt) {
    return this.queue.transition(jobKey, "confirmed", { receipt });
  }
}
