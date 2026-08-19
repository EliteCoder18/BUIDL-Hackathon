CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS proof_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key TEXT NOT NULL UNIQUE,
  source_tx_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'queued',
  creditcoin_tx_hash TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
