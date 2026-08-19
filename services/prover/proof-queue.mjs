import { randomUUID } from "node:crypto";

const transitions = Object.freeze({
  queued: new Set(["building", "failed"]),
  building: new Set(["submitted", "failed"]),
  submitted: new Set(["confirmed", "failed"]),
  confirmed: new Set(),
  failed: new Set(["queued"]),
});

export class ProofQueue {
  #jobs = new Map();

  enqueue(jobKey, payload = {}) {
    const existing = this.#jobs.get(jobKey);
    if (existing) return existing;
    const job = { id: randomUUID(), jobKey, state: "queued", ...payload };
    this.#jobs.set(jobKey, job);
    return job;
  }

  transition(jobKey, nextState, patch = {}) {
    const job = this.#jobs.get(jobKey);
    if (!job) throw new Error("proof not found");
    if (!transitions[job.state].has(nextState)) throw new Error("invalid proof transition");
    job.state = nextState;
    Object.assign(job, patch);
    return job;
  }

  get(jobKey) {
    return this.#jobs.get(jobKey) ?? null;
  }
}
