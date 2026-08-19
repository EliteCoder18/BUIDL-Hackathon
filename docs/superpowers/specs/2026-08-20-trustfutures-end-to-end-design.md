# TrustFutures End-to-End Local Product Design

Date: 2026-08-20

## Objective

Complete every non-deployment part of TrustFutures as a working local product. A user must be able to create a funded ERC-8004 agent mandate, receive three explainable signed quotes, accept a 20/80 policy, execute either a successful or violating job, generate a deterministic local Attestcoin-equivalent proof, settle the Creditcoin policy, and see balances, risk, capital, proof state, and transaction references update across the application.

Testnet deployment, explorer URLs, funded external accounts, and a live Attestcoin proof are explicitly outside this completion pass. The real USC proof worker and production adapter remain available for later deployment. Local mode must never represent its simulated proof as a live Attestcoin proof.

## Product Modes

### Embedded demo mode (default)

`npm run demo` starts two local JSON-RPC chains, deploys and seeds all contracts, starts the API and risk service, and starts the Next.js app. The runtime owns deterministic, pre-funded client, agent, underwriter, and LP accounts. Server-side signers submit transactions, so the complete demo works without a browser wallet or secrets.

### External wallet mode (optional)

When valid chain configuration and a WalletConnect project ID exist, wagmi and RainbowKit expose the user wallet path. Missing WalletConnect configuration hides external connection controls and shows an explicit “Embedded demo account” status instead of issuing invalid remote configuration requests.

Both modes use the same typed command/result interfaces and XState events. Only the transaction transport differs.

## Runtime Architecture

### Local chain runtime

A local runtime service starts two Ganache JSON-RPC servers:

- Sepolia simulation on port `8545`, chain ID `11155111`.
- Creditcoin CC3 simulation on port `9545`, chain ID `102031`.

It compiles and deploys:

- Sepolia: `MockERC8004IdentityRegistry`, `MockUSDC`, `MockWETH`, `MockDEX`, `TreasuryJobManager`.
- CC3: `MockUSDC`, `CoverageVault`, `UnderwriterRegistry`, `MockOutcomeAdapter`, `PolicyManager`.

The runtime mints two agent identities, funds the client, seeds at least ten historical outcomes, deposits senior LP liquidity, deposits junior capital for three underwriters, and writes a generated local manifest. Startup is idempotent for one process lifetime and cleanly closes both servers.

### Unified saga API

The existing Node API becomes the single command boundary for embedded mode. It owns a durable in-process demo store, chain clients, quote signer, proof queue, and event stream.

Read endpoints:

- `GET /v1/demo/state`
- `GET /v1/agents`
- `GET /v1/agents/:agentId/risk`
- `GET /v1/jobs/:jobKey`
- `GET /v1/quotes/:jobKey`
- `GET /v1/policies/:policyId`
- `GET /v1/vault`
- `GET /v1/proofs/:jobKey`

Command endpoints:

- `POST /v1/demo/reset`
- `POST /v1/jobs`
- `POST /v1/jobs/:jobKey/open-auction`
- `POST /v1/policies`
- `POST /v1/jobs/:jobKey/execute` with `success` or `violation`
- `POST /v1/proofs`
- `POST /v1/policies/:policyId/settle`

Every command returns normalized domain data, transaction references, and one or more typed orchestration events. Commands are idempotent by job or policy key where appropriate.

### Local proof bridge

The local proof worker verifies the Sepolia `JobSettled` receipt, configured job-manager address, job ID, and outcome. It then writes the corresponding outcome through `MockOutcomeAdapter` on the CC3 simulation and records both source and destination transaction hashes. Queue states are `queued`, `building`, `submitted`, `confirmed`, or `failed`, with retry support.

This exercises the same job key, outcome, policy, and settlement boundaries as the deployed USC path without pretending that a local chain can call the CC3 verifier precompile. The existing `attestcoin-worker.ts` remains the testnet transport.

## Risk and Underwriting

The Python FastAPI service trains a fixed-seed gradient-boosting classifier and a calibrated probability model at startup. It returns:

- bounded failure probability;
- deterministic model version and model hash;
- named feature values;
- genuine SHAP values from the underlying tree model;
- confidence and abstention signal.

The Node quote API consumes this result when available and uses its existing deterministic engine as an outage fallback. Three underwriters apply independent pricing multipliers and sign the canonical EIP-712 quote. The LLM explanation remains advisory and schema-constrained; deterministic SHAP-derived copy is always available.

After a violating or expired job settles, agent history is updated. A subsequent quote request must produce a higher balanced premium for that agent under the same mandate terms.

## Frontend Architecture

### Application shell

Replace the current poster treatment with a dense technical command-center interface:

- graphite-black background, subdued grid and scanline layers;
- cyan, green, amber, and red used only as semantic network/risk signals;
- compact typography, monospace telemetry, restrained headings;
- persistent left navigation and top network/account status bar;
- responsive drawer navigation on small screens;
- clear demo/testnet labels and keyboard-visible focus states.

The interface must not use paper textures, festival blocks, giant marketing headlines, ticket motifs, or neumorphic poster shadows.

### Routes

- `/`: operational overview, active saga, network topology, agent and capital summary.
- `/agents`: both seeded agents, attested histories, reliability telemetry, and current risk.
- `/jobs/new`: mandate builder with validated amount, minimum output, deadline, agent, and desired outcome scenario.
- `/quotes/[jobKey]`: three competing signed underwriter quotes with SHAP analytics and acceptance.
- `/policies/[policyId]`: capital lock, premium split, job execution, proof progress, settlement, and loss waterfall.
- `/vault`: deposits, reserved/free senior liquidity, utilization, policies, and simulated LP return.
- `/proofs/[jobKey]`: proof state machine, source receipt, validated fields, CC3 submission, retries, and transaction references.

### Shared orchestration

A client `CrossChainOrchestratorProvider` owns one XState actor. Route loaders hydrate the actor from server state. Command results and normalized WebSocket-compatible events advance it; invalid or out-of-order events are ignored by the machine. Refreshing a route reconstructs the same state from authoritative API data rather than browser-only state.

### 3D technical system

The 3D topology remains a real React Three Fiber scene and becomes a technical network visualization rather than decoration:

- Sepolia diamond, Attestcoin hexagonal verifier, and CC3 capital stack.
- Directed routes, block-height labels, transaction particles, and active-state glow.
- Semi-implicit Euler particle integration with bounded delta.
- Camera orbit with conservative limits; no forced continuous rotation while users inspect data.
- Picking a node opens its telemetry panel.
- Canvas quality adapts to device pixel ratio and respects reduced motion.
- WebGL failure renders an accessible SVG topology fallback.

Three.js is used where spatial topology explains the cross-chain saga. Tables, forms, risk values, and transaction data remain normal accessible DOM.

### Quote analytics and loss waterfall

`RiskAnalyticsPanel` uses Recharts to render positive and negative SHAP contributions around a zero axis. Each quote displays the signed EIP-712 fields, risk probability, premium, model hash, validity, junior stake, and senior capacity. The explanation renders structured risks and protective terms.

`LossWaterfall` represents one coverage bar with 20% junior and 80% senior capital. On failure, junior flashes and depletes first, followed by senior. On success, both unlock and the premium distribution animates 30/70. Animation state is derived from XState, not timers independent of policy state.

## State and Data Rules

- API/contract state is authoritative; React state controls only temporary presentation.
- Amounts cross boundaries as decimal strings and become `bigint` only in typed adapters.
- Addresses and hashes use template-literal hex types with runtime validation.
- Query keys include job, policy, agent, and chain identity.
- Mutations invalidate only affected queries.
- No endpoint silently substitutes fake live data. Fallbacks are labeled.
- Loading, empty, failed, retrying, disconnected, and settled states are visible.

## Error Handling

- Contract reverts become domain errors with the failed operation and recovery action.
- Reverted receipts never advance XState.
- Proof retries preserve the same idempotency key.
- Risk-service outage returns deterministic pricing and clearly labels the explanation source.
- External wallet mode reports wrong chain, rejected signature, insufficient funds, and expired quote separately.
- The UI includes a resettable demo error boundary around WebGL and a page-level error boundary around route data.

## Testing and Completion Evidence

### Unit and integration

- XState ordered transitions, invalid events, both settlement branches, hydration, and reset.
- API validation, idempotency, quote signatures, proof transitions, and risk fallback.
- Actual SHAP response shape, deterministic model hash, bounded probability, and abstention.
- Solidity compilation plus existing success, violation, expiry, EIP-712, and junior-first settlement tests.
- Local runtime deployment and seed assertions on both chains.

### Browser E2E

Playwright starts the complete demo stack and runs two independent scenarios:

1. Create mandate → receive three quotes → accept one → execute success → prove → settle → confirm capital unlock and 30/70 premium display.
2. Create mandate → accept policy → execute violation → prove → settle → confirm full client payout, junior-first depletion, and a higher later premium.

The tests assert URL transitions, visible state labels, transaction references, proof confirmation, capital values, and absence of browser console errors. A reduced-motion/mobile smoke test confirms navigation and topology fallback accessibility.

## Completion Boundary

This pass is complete only when a clean local checkout can install dependencies, launch the full demo with one command, execute both browser scenarios without manual wallet steps, and pass root, web, risk, contract, and browser tests. Real Sepolia/CC3 deployment, funded keys, explorer links, and live Attestcoin finality remain the only deferred items.
