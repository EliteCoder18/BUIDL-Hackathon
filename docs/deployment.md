# Deploying TrustFutures with Vercel, Render, and Supabase

This runbook deploys only the public testnet prototype. It does not authorize mainnet funds, production custody, or legal insurance claims.

## Service map

| Component | Host | Process |
| --- | --- | --- |
| Next.js dashboard | Vercel | `npm --prefix apps/web run build` |
| REST and quote API | Render web service | `npm run api` |
| Attestcoin proof processor | Render background worker | `npm run worker` |
| SHAP risk model | Render web service | `uvicorn app:app --host 0.0.0.0 --port $PORT` |
| Proof-job database | Supabase Postgres | `proof_jobs` |

The API and worker share Supabase through `DATABASE_URL`. The browser talks only to the Render API. The API talks to the risk service. All chain-signing credentials stay on Render.

## 1. Verify locally

Install the Node, web, Python, and Playwright dependencies:

```bash
npm ci
npm --prefix apps/web ci
python3 -m venv .venv
.venv/bin/pip install -r services/ml/requirements.txt
npx playwright install chromium
```

Run the deployment and service checks:

```bash
npm run verify:deployment
```

Run the authoritative local agent-to-transaction paths:

```bash
npm run dry-run:local
```

The browser dry run starts deterministic local Sepolia and Creditcoin chains. It creates an agent mandate, requests quotes, locks a policy, executes success and violation transactions, constructs the explicitly simulated local proof, settles the policy, and verifies both the payout waterfall and updated risk premium. It does not claim to submit a live Attestcoin proof.

## 2. Create Supabase Postgres

1. Create a Supabase project in the region nearest the selected Render region.
2. Open the SQL editor and execute `services/prover/migrations/001_proof_jobs.sql`.
3. In **Connect**, copy the session-pooler connection string on port `5432`. Render is a persistent client; do not use the transaction-pooler URL intended for serverless functions.
4. Replace the password placeholder locally, then store the complete value as `DATABASE_URL` in Render. Never put it in Vercel or a `NEXT_PUBLIC_*` variable.
5. Confirm database backups and retention meet the needs of the testnet demo. The queue is durable state and should not depend on a service filesystem.

The API also runs the same migration idempotently during startup, so deploying against an existing compatible project does not drop jobs.

## 3. Create the Render services

Create a Render Blueprint from the repository's `render.yaml`. It declares:

- `trustfutures-api`, a public Node web service;
- `trustfutures-proof-worker`, a Node background worker;
- `trustfutures-risk`, a Python web service.

Supply every Blueprint variable marked `sync: false` in the Render dashboard. Use `.env.example` as the key inventory, not as a source of values.

### API environment

| Variable | Value source |
| --- | --- |
| `DATABASE_URL` | Supabase session-pooler URL |
| `CORS_ORIGIN` | Final Vercel production origin, with no trailing slash |
| `RISK_SERVICE_URL` | Render URL for `trustfutures-risk`, with no trailing slash |
| `CREDITCOIN_CHAIN_ID` | `102031` |
| `POLICY_MANAGER_ADDRESS` | `creditcoin.policyManager` in `deployments/testnet.json` |
| `UNDERWRITER_CONSERVATIVE_PRIVATE_KEY` | Dedicated testnet signer |
| `UNDERWRITER_BALANCED_PRIVATE_KEY` | A second dedicated testnet signer |
| `UNDERWRITER_AGGRESSIVE_PRIVATE_KEY` | A third dedicated testnet signer |
| `OPENAI_API_KEY` | Optional advisory-explanation key |

The three underwriter keys must be distinct and must not reuse the deployment or worker signer.

### Proof-worker environment

| Variable | Value source |
| --- | --- |
| `DATABASE_URL` | Same Supabase session-pooler URL as the API |
| `SEPOLIA_RPC_URL` | Authenticated Sepolia RPC URL |
| `CREDITCOIN_RPC_URL` | Creditcoin CC3 Testnet RPC URL |
| `CREDITCOIN_CHAIN_ID` | `102031` |
| `PROOF_BUILDER_URL` | Attestcoin proof-builder endpoint |
| `USC_SEPOLIA_CHAIN_KEY` | `1` |
| `ATTESTCOIN_ADAPTER_ADDRESS` | `creditcoin.attestcoinOutcomeAdapter` in the manifest |
| `CREDITCOIN_PRIVATE_KEY` | Dedicated funded CC3 testnet worker signer |
| `PROOF_WORKER_POLL_MS` | `5000` initially |
| `PROOF_WORKER_MAX_ATTEMPTS` | `5` initially |

The worker fails closed before connecting if the chain IDs, required values, address, or private key formats are invalid. It logs job keys and public transaction hashes but sanitizes credential-bearing URLs from failures.

## 4. Deploy the Vercel frontend

Import the repository as a Vercel project. Keep the repository root selected because `vercel.json` runs the install and build commands against `apps/web` and publishes `apps/web/.next`.

Configure:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Public URL of `trustfutures-api`, with no trailing slash |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID, when external wallet mode is required |

No private key, RPC credential, database URL, OpenAI key, or Render secret belongs in Vercel's public environment.

## 5. Interconnect and smoke-check

Deploy the risk service first, then the API and worker, then Vercel. After Vercel assigns the final production domain, set that exact origin as `CORS_ORIGIN` on the API and redeploy the API.

Check the public health endpoints:

```bash
curl -fsS https://YOUR_API_HOST/healthz
curl -fsS https://YOUR_RISK_HOST/healthz
```

Expected services are `trustfutures-api` and `trustfutures-risk`. The background worker has no public HTTP port. Verify it through Render logs and a testnet proof job's state progression:

```text
queued -> building -> submitted -> confirmed
```

Submit live proof jobs only for already-mined Sepolia transactions produced by the configured `TreasuryJobManager`. A local dry run is not evidence that external RPC credentials, Attestcoin availability, or funded CC3 signing are live.

## 6. CI workflow

GitHub Actions runs independent core, web, Python-risk, and deployment-manifest jobs. Once they pass, `transaction-dry-run` installs Chromium and executes both browser settlement paths. Failed Playwright traces, screenshots, and video are uploaded as workflow artifacts.

CI validates repository behavior without receiving production secrets. Do not add signing keys merely to make CI submit public transactions.

## 7. Rollback and recovery

- **Vercel:** promote the last known-good deployment.
- **Render:** roll the affected service back to its last known-good deploy. API, worker, and risk can roll back independently.
- **Worker incident:** stop the worker before changing queue rows. Inspect `state`, `attempt_count`, `error`, `locked_at`, and `next_attempt_at`; do not delete the queue or blindly resubmit an already-mined proof.
- **Database:** restore through the configured Supabase backup mechanism. Do not replace the database while an API or worker instance is writing.
- **Signer exposure:** stop the affected Render service, rotate the testnet key, fund the replacement signer if required, update the secret, and redeploy. Treat transaction hashes and chain state as immutable.

Before any deployment beyond the testnet prototype, complete every gate in `docs/production-readiness.md`.
