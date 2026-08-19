import pg from "pg";

const { Pool } = pg;

/// Durable queue used by the API/worker in Railway. Same idempotency contract as ProofQueue.
export class PostgresProofQueue {
  constructor(connectionString) { this.pool = new Pool({ connectionString }); }

  async migrate() {
    await this.pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await this.pool.query(`CREATE TABLE IF NOT EXISTS proof_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_key TEXT NOT NULL UNIQUE,
      source_tx_hash TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'queued',
      creditcoin_tx_hash TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  }

  async enqueue(jobKey, { sourceTxHash }) {
    const result = await this.pool.query(
      `INSERT INTO proof_jobs (job_key, source_tx_hash) VALUES ($1, $2)
       ON CONFLICT (job_key) DO UPDATE SET job_key = EXCLUDED.job_key
       RETURNING id, job_key AS "jobKey", source_tx_hash AS "sourceTxHash", state, creditcoin_tx_hash AS "creditcoinTxHash", error`,
      [jobKey, sourceTxHash],
    );
    return result.rows[0];
  }

  async get(jobKey) {
    const result = await this.pool.query(
      `SELECT id, job_key AS "jobKey", source_tx_hash AS "sourceTxHash", state, creditcoin_tx_hash AS "creditcoinTxHash", error FROM proof_jobs WHERE job_key = $1`,
      [jobKey],
    );
    return result.rows[0] ?? null;
  }

  async transition(jobKey, nextState, patch = {}) {
    const result = await this.pool.query(
      `UPDATE proof_jobs SET state = $2, creditcoin_tx_hash = COALESCE($3, creditcoin_tx_hash), error = COALESCE($4, error), updated_at = now()
       WHERE job_key = $1 AND ((state = 'queued' AND $2 IN ('building', 'failed')) OR (state = 'building' AND $2 IN ('submitted', 'failed')) OR (state = 'submitted' AND $2 IN ('confirmed', 'failed')) OR (state = 'failed' AND $2 = 'queued'))
       RETURNING id, job_key AS "jobKey", source_tx_hash AS "sourceTxHash", state, creditcoin_tx_hash AS "creditcoinTxHash", error`,
      [jobKey, nextState, patch.creditcoinTxHash ?? null, patch.error ?? null],
    );
    if (!result.rows[0]) throw new Error("invalid proof transition");
    return result.rows[0];
  }

  async close() { await this.pool.end(); }
}
