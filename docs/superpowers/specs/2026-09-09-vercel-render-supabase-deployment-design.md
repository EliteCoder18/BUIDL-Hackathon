# Vercel, Render, and Supabase Deployment Design

## Goal

Make TrustFutures deployable with the Next.js dashboard on Vercel, all persistent backend processes on Render, and durable proof-job state in Supabase Postgres. Preserve a one-command local dry run that proves the agent mandate, quote, policy, source transaction, proof, settlement, and post-settlement risk update before cloud services are connected.

## Scope and safety boundary

This remains a testnet-only hackathon deployment. No mainnet chain identifiers, production tokens, real insurance claims, or production custody are introduced. Private keys remain server-side Render secrets and must never be exposed through `NEXT_PUBLIC_*` variables or committed files.

## Deployment architecture

The repository produces four independently deployable processes:

1. `apps/web` is a Vercel Next.js project. Browser requests use `NEXT_PUBLIC_API_URL` to reach the public Render API.
2. `trustfutures-api` is a Render Node web service. It exposes `/healthz` and `/v1/*`, signs quotes with server-side underwriting keys, and enqueues proof jobs in Supabase through `DATABASE_URL`.
3. `trustfutures-proof-worker` is a Render background worker. It atomically claims queued Postgres jobs, waits for Sepolia attestation, submits the proof to Creditcoin CC3, and persists submitted, confirmed, failed, and retry metadata.
4. `trustfutures-risk` is a Render Python web service. The Node API calls it through `RISK_SERVICE_URL`; the deterministic Node risk implementation remains the explicit fallback.

The API and proof worker share only the Postgres queue contract. They do not share process memory or a filesystem. The web application never connects directly to Postgres and never receives signing keys.

## Durable queue behavior

`proof_jobs` remains idempotent by `job_key`. A worker claim is an atomic database operation using `FOR UPDATE SKIP LOCKED`, so multiple workers cannot process the same queued job simultaneously. Claims increment `attempt_count` and set `locked_at`. A failed proof records the error and schedules a bounded retry; an exhausted job remains failed. Startup migration is idempotent and upgrades existing tables without dropping data.

The worker polls at a configurable interval, handles `SIGINT` and `SIGTERM`, and closes its database pool before exit. Required worker configuration is validated before polling begins. Testnet chain IDs and the source chain key are validated to preserve the repository's testnet-only boundary.

## Configuration contract

Vercel receives only:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` when external wallet mode is enabled

Render API receives:

- `DATABASE_URL`, `CORS_ORIGIN`, `RISK_SERVICE_URL`
- `CREDITCOIN_CHAIN_ID`, `POLICY_MANAGER_ADDRESS`
- three distinct `UNDERWRITER_*_PRIVATE_KEY` values
- `OPENAI_API_KEY` only when advisory explanations are enabled

Render proof worker receives:

- `DATABASE_URL`, `SEPOLIA_RPC_URL`, `CREDITCOIN_RPC_URL`
- `PROOF_BUILDER_URL`, `USC_SEPOLIA_CHAIN_KEY`
- `ATTESTCOIN_ADAPTER_ADDRESS`, `CREDITCOIN_PRIVATE_KEY`
- bounded polling and retry settings

Supabase uses its session-pooler connection string for the persistent Render services. TLS is controlled by the connection string/provider configuration; secrets are never embedded in `render.yaml`.

## Deployment manifests and workflows

`render.yaml` declares the API, proof worker, and risk service with health checks and explicit commands. `vercel.json` fixes the monorepo frontend location and build behavior. GitHub Actions retains core and web checks, adds Python tests, validates deployment manifests, and runs the browser-level local dry run as a separate job with Playwright artifacts on failure.

Deployment readiness tests parse the manifests and environment example to detect missing services, unsafe public secrets, incorrect commands, or lost health checks without contacting Vercel, Render, or Supabase.

## Local parity and dry run

`npm run verify:deployment` performs manifest checks, root tests, typechecking, web tests/build, and Python tests. `npm run dry-run:local` runs the existing Playwright transaction paths against `npm run demo`. The success path must create an agent mandate, accept a signed policy, execute a source-chain transaction, build and submit a local proof equivalent, settle the bond, and verify released capital. The violation path must verify the payout, junior-first loss, and increased subsequent premium.

Local dry runs intentionally use deterministic local chains and disclose that the proof is not a live Attestcoin proof. Live RPC and signing configuration is validated separately and is not exercised without explicit funded testnet authorization.

## Error handling and observability

Every service has a health endpoint or process-health contract. The API returns bounded JSON errors and configured CORS headers. The worker logs structured job/state messages without connection strings, private keys, or authenticated RPC URLs. Failed jobs retain a sanitized error message and retry time. Render captures stdout/stderr; no vendor-specific logging dependency is required.

## Acceptance criteria

- Deployment manifests describe one Vercel frontend and three Render backend processes.
- Supabase-backed jobs are idempotent and safe for concurrent worker claims.
- Worker configuration fails closed when required values or testnet constraints are invalid.
- CI validates Node, Next.js, Python, deployment manifests, and the browser transaction dry run.
- The full local success and violation paths pass from agent creation through transaction settlement.
- Documentation lists exact setup, environment, Supabase migration, Vercel, Render, interconnection, health-check, and rollback steps.
- No secret value is committed or exposed as a public frontend variable.
