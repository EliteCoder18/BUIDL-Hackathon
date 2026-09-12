import pg from "pg";

const { Pool } = pg;

function reportPoolError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[proof-queue] idle PostgreSQL client error: ${message}`);
}

/// Durable queue used by the API/worker in Railway. Same idempotency contract as ProofQueue.
export class PostgresProofQueue {
  constructor(connectionString, { pool, onPoolError = reportPoolError } = {}) {
    this.pool = pool ?? new Pool({ connectionString });
    this.onPoolError = onPoolError;
    this.pool.on?.("error", this.onPoolError);
  }

  async migrate() {
    await this.pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await this.pool.query(`CREATE TABLE IF NOT EXISTS proof_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_key TEXT NOT NULL UNIQUE,
      source_tx_hash TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'queued',
      creditcoin_tx_hash TEXT,
      error TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      locked_at TIMESTAMPTZ,
      next_attempt_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE proof_jobs ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE proof_jobs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
    ALTER TABLE proof_jobs ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS proof_jobs_worker_poll_idx ON proof_jobs (state, next_attempt_at, created_at)`);
  }

  async enqueue(jobKey, { sourceTxHash }) {
    const result = await this.pool.query(
      `INSERT INTO proof_jobs (job_key, source_tx_hash) VALUES ($1, $2)
       ON CONFLICT (job_key) DO UPDATE SET job_key = EXCLUDED.job_key
       RETURNING id, job_key AS "jobKey", source_tx_hash AS "sourceTxHash", state, creditcoin_tx_hash AS "creditcoinTxHash", error,
         attempt_count AS "attemptCount", locked_at AS "lockedAt", next_attempt_at AS "nextAttemptAt"`,
      [jobKey, sourceTxHash],
    );
    return result.rows[0];
  }

  async get(jobKey) {
    const result = await this.pool.query(
      `SELECT id, job_key AS "jobKey", source_tx_hash AS "sourceTxHash", state, creditcoin_tx_hash AS "creditcoinTxHash", error,
         attempt_count AS "attemptCount", locked_at AS "lockedAt", next_attempt_at AS "nextAttemptAt"
       FROM proof_jobs WHERE job_key = $1`,
      [jobKey],
    );
    return result.rows[0] ?? null;
  }

  async claimNext({ maxAttempts = 5 } = {}) {
    const result = await this.pool.query(
      `WITH candidate AS (
         SELECT id FROM proof_jobs
         WHERE (state = 'queued' OR (state = 'failed' AND next_attempt_at <= now()))
           AND attempt_count < $1
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE proof_jobs AS job
       SET state = 'building', attempt_count = job.attempt_count + 1, locked_at = now(),
           next_attempt_at = NULL, error = NULL, updated_at = now()
       FROM candidate WHERE job.id = candidate.id
       RETURNING job.id, job.job_key AS "jobKey", job.source_tx_hash AS "sourceTxHash", job.state,
         job.creditcoin_tx_hash AS "creditcoinTxHash", job.error, job.attempt_count AS "attemptCount",
         job.locked_at AS "lockedAt", job.next_attempt_at AS "nextAttemptAt"`,
      [maxAttempts],
    );
    return result.rows[0] ?? null;
  }

  async transition(jobKey, nextState, patch = {}) {
    const result = await this.pool.query(
      `UPDATE proof_jobs SET state = $2, creditcoin_tx_hash = COALESCE($3, creditcoin_tx_hash), error = $4,
         next_attempt_at = $5, locked_at = CASE WHEN $2 = 'building' THEN locked_at ELSE NULL END, updated_at = now()
       WHERE job_key = $1 AND ((state = 'queued' AND $2 IN ('building', 'failed')) OR (state = 'building' AND $2 IN ('submitted', 'failed')) OR (state = 'submitted' AND $2 IN ('confirmed', 'failed')) OR (state = 'failed' AND $2 = 'queued'))
       RETURNING id, job_key AS "jobKey", source_tx_hash AS "sourceTxHash", state, creditcoin_tx_hash AS "creditcoinTxHash", error,
         attempt_count AS "attemptCount", locked_at AS "lockedAt", next_attempt_at AS "nextAttemptAt"`,
      [jobKey, nextState, patch.creditcoinTxHash ?? null, patch.error ?? null, patch.nextAttemptAt ?? null],
    );
    if (!result.rows[0]) throw new Error("invalid proof transition");
    return result.rows[0];
  }

  async close() {
    await this.pool.end();
    this.pool.off?.("error", this.onPoolError);
  }
}
