# Vercel, Render, and Supabase Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TrustFutures locally verifiable and ready to deploy with Vercel, Render, and Supabase.

**Architecture:** Deploy the Next.js workspace to Vercel and three independent Render processes for the Node API, Postgres proof worker, and Python risk service. Use an atomic Supabase Postgres queue as the API/worker boundary while preserving the deterministic local-chain browser dry run.

**Tech Stack:** Node.js 22, Next.js 14, Python 3.11/FastAPI, PostgreSQL/Supabase, Render Blueprint, Vercel, GitHub Actions, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-09-vercel-render-supabase-deployment-design.md`

## Global Constraints

- Deploy only to Sepolia chain ID `11155111` and Creditcoin CC3 Testnet chain ID `102031`.
- Never expose database credentials, RPC credentials, or private keys through `NEXT_PUBLIC_*` variables.
- API and worker coordination must use Postgres rather than process memory or local files.
- The local proof path must remain explicitly labeled as an Attestcoin-equivalent simulation.
- Preserve deterministic risk fallback when the Python service is unavailable.

---

### Task 1: Deployment contract validation

**Files:**
- Create: `services/deployment/config.mjs`
- Create: `tests/deployment-config.test.mjs`
- Modify: `.env.example`

**Interfaces:**
- Produces: `validateApiEnvironment(env)`, `validateWorkerEnvironment(env)`, and `publicEnvironmentKeys(env)`.

- [x] Write tests that reject missing worker values, incorrect Creditcoin chain IDs, reused underwriting keys, and sensitive `NEXT_PUBLIC_*` keys.
- [x] Run `node --test tests/deployment-config.test.mjs` and confirm failure because the module does not exist.
- [x] Implement minimal environment validation and extend `.env.example` with the exact Vercel/Render/Supabase variables.
- [x] Run the focused test and root test suite.

### Task 2: Concurrent Supabase proof queue

**Files:**
- Modify: `services/prover/migrations/001_proof_jobs.sql`
- Modify: `services/prover/postgres-proof-queue.mjs`
- Create: `tests/postgres-proof-queue.test.mjs`

**Interfaces:**
- Produces: `claimNext()`, existing `enqueue()`, `get()`, `transition()`, and `close()` methods.
- `claimNext()` returns one job in `building` state or `null`.

- [x] Write a fake-pool behavioral test for atomic claims, retry metadata, mapped job fields, and parameterized SQL.
- [x] Run the focused test and confirm the missing `claimNext()` behavior fails.
- [x] Add idempotent migration columns and the `FOR UPDATE SKIP LOCKED` claim operation.
- [x] Run focused and root tests.

### Task 3: Render proof-worker process

**Files:**
- Create: `services/prover/worker-runner.mjs`
- Create: `tests/proof-worker-runner.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `createProofWorkerRunner({ queue, proveAndSubmit, config, pollIntervalMs, logger })` with `runOnce()`, `start()`, and `stop()`.
- Consumes: `PostgresProofQueue.claimNext()` and the existing Attestcoin submission adapter.

- [x] Write tests for idle polling, successful submitted/confirmed transitions, sanitized failure/retry handling, and clean shutdown.
- [x] Run the focused test and confirm failure because the runner is absent.
- [x] Implement the runner with dependency injection and a CLI entry point that validates environment before opening Postgres.
- [x] Add `worker` and focused test scripts, then run focused and root tests.

### Task 4: Cloud deployment manifests

**Files:**
- Create: `render.yaml`
- Create: `vercel.json`
- Create: `scripts/validate-deployment.mjs`
- Create: `tests/deployment-manifests.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateDeploymentFiles(root)` and CLI command `npm run validate:deployment`.

- [x] Write tests requiring the Render API, worker, risk service, health checks, secret placeholders, Vercel web root, and non-secret public configuration.
- [x] Run the focused test and confirm it fails because manifests are missing.
- [x] Add manifests and validation script with no embedded secret values.
- [x] Run focused validation and root tests.

### Task 5: CI and local deployment verification workflows

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `scripts/verify-deployment.mjs`
- Create: `tests/deployment-workflow.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run verify:deployment` and `npm run dry-run:local`.

- [x] Write tests that require Python, manifest, web-test/build, and Playwright dry-run jobs and scripts.
- [x] Run the focused test and confirm missing workflow coverage fails.
- [x] Add orchestration scripts and CI jobs, including Playwright failure artifacts.
- [x] Run focused and root tests.

### Task 6: Operator documentation and full dry run

**Files:**
- Modify: `README.md`
- Modify: `docs/production-readiness.md`
- Create: `docs/deployment.md`

**Interfaces:**
- Produces: an operator runbook covering Supabase, Render, Vercel, interconnection, health checks, dry run, and rollback.

- [x] Write the deployment runbook and link it from the README/readiness boundary. Human-facing prose is reviewed directly rather than protected by brittle source-text tests.
- [x] Run `npm run validate:deployment`, `npm run verify:deployment`, and `npm run dry-run:local`.
- [x] Inspect the final diff for secrets, unrelated files, placeholders, and acceptance-criteria coverage.
