# TrustFutures End-to-End Local Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a one-command, contract-backed local TrustFutures application that completes success and violation sagas through a technical 3D UI, with SHAP analytics and browser E2E proof.

**Architecture:** Two deterministic Ganache chains host the real mandate and policy contracts while a local proof bridge substitutes only the unavailable CC3 verifier precompile. A unified Node command API returns authoritative domain state plus typed XState events; the Next.js application consumes those commands through route-specific modules. The Python risk service supplies calibrated probabilities and tree SHAP values with the existing deterministic TypeScript engine as a labeled fallback.

**Tech Stack:** Node.js 20+, Next.js 14.2.35, React 18.3.1, TypeScript, Tailwind CSS, shadcn-style primitives, wagmi/viem, XState 5, React Three Fiber 8, Drei 9, Recharts, Ganache, ethers 6, Solidity 0.8.30, FastAPI, scikit-learn, SHAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-20-trustfutures-end-to-end-design.md`

## Global Constraints

- Deployment, funded testnet accounts, explorer links, and live Attestcoin finality remain out of scope.
- Local proof results must be labeled `local-attestcoin-simulation`; never label them as live Attestcoin proofs.
- Embedded demo mode is the default and must require no wallet, RPC key, database, or OpenAI key.
- External wallet controls render only when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and chain configuration are valid.
- API and contract state are authoritative; component state is presentation-only.
- Amounts cross JSON boundaries as decimal strings; typed adapters convert them to `bigint`.
- Every behavior change follows red-green-refactor and each task ends with its focused tests passing.
- Preserve the real `AttestcoinOutcomeAdapter` and `attestcoin-worker.ts` for later testnet deployment.
- The final interface uses a graphite technical command-center visual system, not the existing cream/red poster treatment.

---

## File Map

### Runtime and domain

- `services/local-chain/compile.mjs`: compile and link local contract artifacts once.
- `services/local-chain/runtime.mjs`: start both RPC servers, deploy contracts, seed identities/capital, expose signers and manifest.
- `services/local-chain/local-proof-bridge.mjs`: validate Sepolia receipts and submit outcomes to the local CC3 adapter.
- `services/demo/demo-store.mjs`: normalized agents, jobs, quotes, policies, proofs, histories, and event stream.
- `services/demo/demo-saga.mjs`: command methods that execute transactions and update the store.
- `services/api/app.mjs`: validation and HTTP routes only.
- `services/api/server.mjs`: runtime boot, API server, CORS, and shutdown.
- `scripts/demo.mjs`: one-command process orchestration.

### Risk

- `services/ml/model.py`: deterministic dataset, calibrated model, model hash, SHAP calculation.
- `services/ml/app.py`: FastAPI schemas, health route, risk route.
- `services/ml/test_model.py`: deterministic probability, SHAP, and abstention tests.
- `services/underwriter/risk-client.mjs`: Python service adapter and deterministic fallback.

### Web

- `apps/web/app/providers.tsx`: query, optional wallet, and saga providers.
- `apps/web/components/shell/*`: technical navigation and status shell.
- `apps/web/components/topology/*`: WebGL topology, telemetry, and SVG fallback.
- `apps/web/components/risk/*`: SHAP chart and explanation viewer.
- `apps/web/components/policy/*`: loss waterfall and policy controls.
- `apps/web/lib/api/*`: validated API client and mutation hooks.
- `apps/web/lib/orchestration/*`: XState actor, hydration, and external-event normalization.
- `apps/web/app/{agents,jobs,quotes,policies,vault,proofs}/**`: complete product routes.
- `apps/web/app/globals.css` and `tailwind.config.ts`: technical visual system.

### Verification

- `tests/local-runtime.test.mjs`: dual-chain deployment and seed assertions.
- `tests/demo-saga.test.mjs`: success, failure, idempotency, repricing.
- `apps/web/tests/*.test.ts`: orchestration and typed client tests.
- `e2e/success.spec.ts`, `e2e/violation.spec.ts`, `e2e/mobile.spec.ts`: browser acceptance.
- `playwright.config.ts`: full-stack web server configuration.

---

### Task 1: Deterministic Dual-Chain Runtime

**Files:**
- Create: `services/local-chain/compile.mjs`
- Create: `services/local-chain/runtime.mjs`
- Create: `tests/local-runtime.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `createLocalChainRuntime(): Promise<LocalChainRuntime>`.
- Produces: `LocalChainRuntime = { sepolia, creditcoin, accounts, contracts, close() }` where each contract entry contains `address`, `abi`, and connected ethers instance.

- [ ] **Step 1: Write the failing runtime test**

```js
test("local runtime deploys both chains and seeds underwriting capital", async (t) => {
  const runtime = await createLocalChainRuntime();
  t.after(() => runtime.close());
  assert.equal((await runtime.sepolia.provider.getNetwork()).chainId, 11155111n);
  assert.equal((await runtime.creditcoin.provider.getNetwork()).chainId, 102031n);
  assert.equal(await runtime.contracts.identity.ownerOf(0), runtime.accounts.agent.address);
  assert.equal(await runtime.contracts.vault.totalAssets(), 800_000_000n);
  for (const underwriter of runtime.accounts.underwriters) {
    assert.equal(await runtime.contracts.registry.deposited(underwriter.address), 200_000_000n);
  }
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `node --test tests/local-runtime.test.mjs`

Expected: FAIL because `services/local-chain/runtime.mjs` does not exist.

- [ ] **Step 3: Implement compilation, dual RPC startup, deployment, and seeding**

Use `ganache.server({ chain: { chainId }, wallet: { deterministic: true } })`, compile all contracts with the existing Gluwa decoder link reference, deploy the Sepolia and CC3 local sets, mint assets, approve/deposit three junior stakes, and deposit senior liquidity. Bind ports with `listen(0)` during tests and fixed ports `8545`/`9545` in demo mode.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/local-runtime.test.mjs`

Expected: PASS and both servers close without open handles.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json services/local-chain tests/local-runtime.test.mjs
git commit -m "feat: add deterministic dual-chain runtime"
```

### Task 2: Contract-Backed Demo Saga

**Files:**
- Create: `services/demo/demo-store.mjs`
- Create: `services/demo/demo-saga.mjs`
- Create: `services/local-chain/local-proof-bridge.mjs`
- Create: `tests/demo-saga.test.mjs`

**Interfaces:**
- Consumes: `LocalChainRuntime` from Task 1.
- Produces: `createDemoSaga(runtime, options): DemoSaga`.
- Produces commands: `createJob(input)`, `openAuction(jobKey)`, `acceptPolicy(input)`, `executeJob(jobKey, outcome)`, `proveOutcome(jobKey)`, `settlePolicy(policyId)`, `reset()`.
- Every command returns `{ data, events: CrossChainEvent[], transactions: TransactionReference[] }`.

- [ ] **Step 1: Write failing success and violation saga tests**

```js
const validMandate = {
  agentId: "0",
  amountIn: "100000000",
  minOut: "99000000",
  deadlineSeconds: 3600,
  coverageAmount: "100000000",
};

test("success saga releases both tranches and splits premium", async (t) => {
  const runtime = await createLocalChainRuntime();
  t.after(() => runtime.close());
  const saga = createDemoSaga(runtime);
  const job = await saga.createJob(validMandate);
  await saga.openAuction(job.data.jobKey);
  const policy = await saga.acceptPolicy({ jobKey: job.data.jobKey, quoteIndex: 1 });
  await saga.executeJob(job.data.jobKey, "success");
  const proof = await saga.proveOutcome(job.data.jobKey);
  const settled = await saga.settlePolicy(policy.data.policyId);
  assert.equal(proof.data.proofSource, "local-attestcoin-simulation");
  assert.equal(settled.data.state, "SETTLED_SUCCESS");
  assert.equal(settled.data.underwriterPremium + settled.data.lpPremium, settled.data.premiumAmount);
});

test("violation consumes junior before senior and raises the next premium", async (t) => {
  const runtime = await createLocalChainRuntime();
  t.after(() => runtime.close());
  const saga = createDemoSaga(runtime);
  const before = await saga.quoteForAgent("0", validMandate);
  const job = await saga.createJob(validMandate);
  await saga.openAuction(job.data.jobKey);
  const policy = await saga.acceptPolicy({ jobKey: job.data.jobKey, quoteIndex: 1 });
  await saga.executeJob(job.data.jobKey, "violation");
  await saga.proveOutcome(job.data.jobKey);
  const settled = await saga.settlePolicy(policy.data.policyId);
  const after = await saga.quoteForAgent("0", validMandate);
  assert.equal(settled.data.clientPayout, settled.data.coverageAmount);
  assert.equal(settled.data.juniorLoss, settled.data.coverageAmount / 5n);
  assert.ok(after.balanced.premiumAmount > before.balanced.premiumAmount);
});
```

- [ ] **Step 2: Run the tests and verify both fail on missing saga modules**

Run: `node --test tests/demo-saga.test.mjs`

- [ ] **Step 3: Implement the normalized store and transaction commands**

Calculate `jobKey` from the deployed chain ID, manager address, and emitted `jobId`. Sign quotes with the three seeded underwriter keys and the deployed `PolicyManager` EIP-712 domain. Persist transaction hashes and receipt block numbers after every command.

- [ ] **Step 4: Implement the local proof bridge**

Fetch the source receipt, require status `1`, require exactly one `JobSettled` log from the configured manager, decode `jobId/outcome`, recompute `jobKey`, call `MockOutcomeAdapter.setOutcome`, and transition the proof queue through `building`, `submitted`, and `confirmed`.

- [ ] **Step 5: Run focused and existing contract tests**

Run: `node --test tests/demo-saga.test.mjs tests/contracts/*.test.mjs`

Expected: both saga branches and all Solidity integration tests PASS.

- [ ] **Step 6: Commit**

```bash
git add services/demo services/local-chain/local-proof-bridge.mjs tests/demo-saga.test.mjs
git commit -m "feat: execute complete local policy sagas"
```

### Task 3: Unified Command API

**Files:**
- Modify: `services/api/app.mjs`
- Modify: `services/api/server.mjs`
- Create: `services/api/validation.mjs`
- Modify: `tests/api.test.mjs`

**Interfaces:**
- Consumes: `DemoSaga` from Task 2.
- Produces the read and command endpoints defined in the approved spec.
- Produces JSON values with bigint fields serialized as decimal strings.

- [ ] **Step 1: Add failing API tests for every command boundary**

```js
test("API drives a job from mandate to confirmed proof", async () => {
  const runtime = await createLocalChainRuntime();
  const saga = createDemoSaga(runtime);
  const api = createApi({ saga });
  const validJobBody = { agentId: "0", amountIn: "100000000", minOut: "99000000", deadlineSeconds: 3600, coverageAmount: "100000000" };
  const created = await requestJson(api, "POST", "/v1/jobs", validJobBody);
  assert.equal(created.events[0].type, "START_MANDATE");
  const auction = await requestJson(api, "POST", `/v1/jobs/${created.data.jobKey}/open-auction`, {});
  assert.equal(auction.data.quotes.length, 3);
  const proof = await requestJson(api, "POST", "/v1/proofs", { jobKey: created.data.jobKey });
  assert.equal(proof.data.proofSource, "local-attestcoin-simulation");
  await runtime.close();
});
```

Define `requestJson` in `tests/api.test.mjs` as:

```js
async function requestJson(api, method, pathname, body) {
  const response = await api.handle(new Request(`http://local${pathname}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  }));
  assert.equal(response.status, 200);
  return response.json();
}
```

Also assert `400` for malformed hashes, nonpositive amounts, excessive coverage, invalid outcome, and expired deadlines; assert repeated proof requests return the same proof ID.

- [ ] **Step 2: Run the API tests and confirm route failures**

Run: `node --test tests/api.test.mjs`

- [ ] **Step 3: Implement validators and thin route handlers**

Use `assertHex(value, bytes)`, `parsePositiveAmount(value, max)`, and `parseOutcome(value)` before calling saga methods. Map domain errors to stable codes such as `QUOTE_EXPIRED`, `INSUFFICIENT_JUNIOR`, `PROOF_NOT_READY`, and `WRONG_SAGA_STATE`.

- [ ] **Step 4: Run API, saga, and queue tests**

Run: `node --test tests/api.test.mjs tests/demo-saga.test.mjs tests/proof-queue.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add services/api tests/api.test.mjs
git commit -m "feat: expose authoritative saga command API"
```

### Task 4: Calibrated Risk and Real SHAP Output

**Files:**
- Create: `services/ml/model.py`
- Modify: `services/ml/app.py`
- Modify: `services/ml/requirements.txt`
- Create: `services/ml/test_model.py`
- Create: `services/underwriter/risk-client.mjs`
- Modify: `services/api/app.mjs`
- Modify: `tests/underwriting.test.mjs`

**Interfaces:**
- Produces `score_risk(features) -> RiskResult` with `failureProbabilityBps`, `modelVersion`, `modelHash`, `features[{name,value,shapValue}]`, `confidence`, and `abstain`.
- Produces `createRiskClient({ baseUrl, fetchImpl }).score(features)` with deterministic TypeScript fallback.

- [ ] **Step 1: Write failing Python model tests**

```python
def test_score_is_deterministic_and_exposes_real_shap_values():
    first = score_risk(STRONG_FEATURES)
    second = score_risk(STRONG_FEATURES)
    assert first == second
    assert len(first["features"]) == 6
    assert any(abs(item["shapValue"]) > 0 for item in first["features"])
    assert 100 <= first["failureProbabilityBps"] <= 9500

def test_low_confidence_abstains():
    result = score_risk(OUT_OF_DISTRIBUTION_FEATURES)
    assert result["abstain"] is True
```

- [ ] **Step 2: Install Python dependencies and verify the test fails**

Run: `python -m pip install -r services/ml/requirements.txt && python -m pytest services/ml/test_model.py -q`

- [ ] **Step 3: Implement the fixed-seed model and SHAP transformation**

Train `GradientBoostingClassifier(random_state=8004)` and `CalibratedClassifierCV(method="sigmoid", cv=3)`. Use `shap.TreeExplainer(base_model).shap_values(vector)` for named contributions. Hash the model version, training matrix bytes, labels, and feature order.

- [ ] **Step 4: Add failing Node risk-client tests**

Assert successful Python responses are preserved, HTTP failures select `deterministic-fallback`, and an abstaining result removes that underwriter from the quote auction.

- [ ] **Step 5: Implement the risk client and connect quote responses**

Include the explanation source and SHAP features in every quote. Preserve the rule that neither OpenAI nor descriptive text changes signed economics.

- [ ] **Step 6: Run Python and Node risk suites**

Run: `python -m pytest services/ml/test_model.py -q && node --test tests/underwriting.test.mjs tests/api.test.mjs`

- [ ] **Step 7: Commit**

```bash
git add services/ml services/underwriter/risk-client.mjs services/api/app.mjs tests
git commit -m "feat: add calibrated SHAP risk analytics"
```

### Task 5: Shared Frontend Orchestration and Typed API

**Files:**
- Create: `apps/web/lib/api/schema.ts`
- Create: `apps/web/lib/api/client.ts`
- Create: `apps/web/lib/api/hooks.ts`
- Create: `apps/web/lib/orchestration/provider.tsx`
- Move/Modify: `apps/web/lib/trustfutures/orchestrator.ts` to `apps/web/lib/orchestration/machine.ts`
- Modify: `apps/web/app/providers.tsx`
- Create: `apps/web/tests/api-client.test.ts`
- Modify: `apps/web/tests/orchestrator.test.ts`

**Interfaces:**
- Produces `api.command<T>(path, body): Promise<CommandResult<T>>`.
- Produces `useCrossChainOrchestrator(): { snapshot, send, applyCommandResult }`.
- Produces `hydrateSaga(serverState): CrossChainEvent[]` for refresh reconstruction.

- [ ] **Step 1: Write failing serialization, hydration, and provider-boundary tests**

```ts
test("typed client converts amount strings without losing precision", async () => {
  const client = createApiClient({
    baseUrl: "http://local",
    fetchImpl: async () => Response.json({
      policyId: "0xpolicy",
      jobKey: "0x0000000000000000000000000000000000000000000000000000000000000449",
      coverageAmount: "1000000000",
      premiumAmount: "10000000",
      juniorAmount: "200000000",
      seniorAmount: "800000000",
      state: "ACTIVE",
    }),
  });
  const result = await client.getPolicy("0xpolicy");
  assert.equal(result.coverageAmount, 1000_000000n);
});

test("hydration reconstructs a confirmed failure without skipping transitions", () => {
  const failedPolicyFixture = {
    state: "SETTLED_SLASHED",
    jobKey: "0x0000000000000000000000000000000000000000000000000000000000000449",
    sepoliaTxHash: "0x01",
    quoteId: "quote-1",
    signature: "0xsig",
    creditcoinTxHash: "0x02",
    proofRequestId: "proof-request-1",
    proofId: "proof-1",
  } as const;
  const events = hydrateSaga(failedPolicyFixture);
  const actor = createActor(crossChainOrchestrator).start();
  events.forEach((event) => actor.send(event));
  assert.equal(actor.getSnapshot().value, "SETTLED_SLASHED");
});
```

- [ ] **Step 2: Run web tests and confirm missing-module failures**

Run: `cd apps/web && npm test`

- [ ] **Step 3: Implement schemas, client, hooks, and actor provider**

Use runtime guards for hashes, addresses, outcomes, proof states, and decimal amount strings. Query hooks use keys `['agent', id]`, `['job', jobKey]`, `['quotes', jobKey]`, `['policy', policyId]`, `['proof', jobKey]`, and `['vault']`.

- [ ] **Step 4: Gate RainbowKit without a placeholder project ID**

Build wagmi config only when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is a nonempty value and external chain URLs exist. Otherwise render the query and saga providers with `EmbeddedDemoAccount` and never initialize WalletConnect.

- [ ] **Step 5: Run web tests and production build**

Run: `cd apps/web && npm test && npm run build`

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib apps/web/app/providers.tsx apps/web/tests
git commit -m "feat: connect frontend to authoritative saga state"
```

### Task 6: Technical Application Shell and Core Routes

**Files:**
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`
- Replace: `apps/web/app/page.tsx`
- Create: `apps/web/components/shell/AppShell.tsx`
- Create: `apps/web/components/shell/SideNav.tsx`
- Create: `apps/web/components/shell/NetworkStatus.tsx`
- Create: `apps/web/components/ui/{button,card,badge,input,skeleton}.tsx`
- Create: `apps/web/app/agents/page.tsx`
- Create: `apps/web/app/jobs/new/page.tsx`
- Create: `apps/web/app/vault/page.tsx`
- Create: `apps/web/tests/routes.test.ts`

**Interfaces:**
- Consumes query/mutation hooks from Task 5.
- Produces semantic navigation and complete overview, agent, mandate-builder, and vault routes.

- [ ] **Step 1: Install Tailwind, Recharts, class utilities, and form validation dependencies**

Run: `cd apps/web && npm install recharts clsx tailwind-merge zod react-hook-form @hookform/resolvers && npm install -D tailwindcss@3 postcss autoprefixer`

- [ ] **Step 2: Write failing route-render and form-validation tests**

Assert all six navigation destinations exist, the mandate form rejects zero amount and past deadlines, embedded mode is visible, and no poster headline or cream paper token remains.

- [ ] **Step 3: Run web tests and verify failures**

Run: `cd apps/web && npm test`

- [ ] **Step 4: Implement the shell and visual tokens**

Use CSS variables `--surface-0:#05080d`, `--surface-1:#0a111a`, `--surface-2:#101b28`, `--line:#1b3346`, `--cyan:#52e5ff`, `--green:#71ff9c`, `--amber:#ffc857`, `--danger:#ff5b6e`. Use 12–16px body text, compact uppercase telemetry labels, one-pixel borders, and no large poster typography.

- [ ] **Step 5: Implement overview, agents, mandate builder, and vault**

Submitting `/jobs/new` calls `POST /v1/jobs`, applies returned events, then routes to `/quotes/{jobKey}` after opening the auction. Vault renders real total/free/reserved values and utilization from the API.

- [ ] **Step 6: Run tests and build**

Run: `cd apps/web && npm test && npm run build`

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat: build technical TrustFutures application shell"
```

### Task 7: Quote Auction and SHAP Analytics

**Files:**
- Create: `apps/web/app/quotes/[jobKey]/page.tsx`
- Create: `apps/web/components/risk/RiskAnalyticsPanel.tsx`
- Create: `apps/web/components/risk/ShapBarChart.tsx`
- Create: `apps/web/components/quotes/QuoteCard.tsx`
- Create: `apps/web/hooks/useSignQuote.ts`
- Create: `apps/web/tests/quote-auction.test.ts`

**Interfaces:**
- Consumes `Quote`, `RiskProfile`, `useQuotes`, `useAcceptPolicy`, and orchestration `send`.
- Produces policy navigation after a server-signed embedded quote or wagmi `useSignTypedData` external signature succeeds.

- [ ] **Step 1: Write failing quote transformation and selection tests**

Assert three strategy names map by `strategy`, not response index; positive SHAP values use danger/amber, negative values use cyan/green; JSON explanation includes `topRisks` and `protectiveTerms`; expired quotes disable acceptance.

- [ ] **Step 2: Run web tests and confirm failures**

Run: `cd apps/web && npm test`

- [ ] **Step 3: Implement the horizontal SHAP chart and structured explanation**

Use Recharts `BarChart` with `layout="vertical"`, a numeric domain symmetric around zero, `ReferenceLine x={0}`, and per-cell colors derived from the contribution sign. Preserve exact signed quote fields in a collapsible monospace panel.

- [ ] **Step 4: Implement embedded and external signing paths**

Embedded mode calls the policy command using the API-provided underwriter signature. External mode calls wagmi `useSignTypedData`, waits for success, and only then dispatches `QUOTE_SIGNED`. Rejection keeps the state at `AUCTION_ACTIVE`.

- [ ] **Step 5: Run tests and build**

Run: `cd apps/web && npm test && npm run build`

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/quotes apps/web/components/risk apps/web/components/quotes apps/web/hooks apps/web/tests
git commit -m "feat: add signed quote auction and SHAP analytics"
```

### Task 8: Policy, Proof Explorer, and Loss Waterfall

**Files:**
- Create: `apps/web/app/policies/[policyId]/page.tsx`
- Create: `apps/web/app/proofs/[jobKey]/page.tsx`
- Create: `apps/web/components/policy/LossWaterfall.tsx`
- Create: `apps/web/components/policy/PolicyActions.tsx`
- Create: `apps/web/components/proof/ProofTimeline.tsx`
- Create: `apps/web/tests/policy-flow.test.ts`

**Interfaces:**
- Consumes policy/job/proof hooks and XState snapshot.
- Produces success/failure execution, proof enqueue/retry, settlement, and capital animations.

- [ ] **Step 1: Write failing waterfall and action-gating tests**

```ts
test("slashed settlement depletes junior before senior", () => {
  const frames = waterfallFrames({ coverage: 1000n, state: "SETTLED_SLASHED" });
  assert.deepEqual(frames[1], { junior: 0n, senior: 800n });
  assert.deepEqual(frames[2], { junior: 0n, senior: 0n });
});
```

Also assert prove is disabled before execution, settle is disabled before confirmed proof, retry appears only for failed proof, and success displays a 30/70 premium split.

- [ ] **Step 2: Run web tests and confirm failures**

Run: `cd apps/web && npm test`

- [ ] **Step 3: Implement policy commands and proof timeline**

Render each transaction with chain, block, shortened hash, and copy action. Apply all command events to XState and invalidate policy, proof, vault, agent, and job queries after settlement.

- [ ] **Step 4: Implement the deterministic waterfall animation**

Use one absolutely positioned coverage track, 20% amber junior segment, and 80% cyan senior segment. CSS data attributes derived from XState control flash/depletion; `prefers-reduced-motion` jumps directly to the final state while preserving labels.

- [ ] **Step 5: Run tests and build**

Run: `cd apps/web && npm test && npm run build`

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/policies apps/web/app/proofs apps/web/components/policy apps/web/components/proof apps/web/tests
git commit -m "feat: complete policy proof and loss waterfall flows"
```

### Task 9: Technical 3D Topology and Accessible Fallback

**Files:**
- Refactor: `apps/web/components/cross-chain/CrossChainTopology.tsx` into `apps/web/components/topology/CrossChainTopology.tsx`
- Create: `apps/web/components/topology/NetworkNode.tsx`
- Create: `apps/web/components/topology/TransactionBeam.tsx`
- Create: `apps/web/components/topology/TopologyTelemetry.tsx`
- Create: `apps/web/components/topology/TopologyFallback.tsx`
- Create: `apps/web/components/topology/WebGLErrorBoundary.tsx`
- Create: `apps/web/lib/topology/routes.ts`
- Create: `apps/web/tests/topology.test.ts`

**Interfaces:**
- Consumes `OrchestratorState`, transaction references, proof state, and block heights.
- Produces `getActiveRoute(state): RouteDescriptor | null` and a WebGL/SVG equivalent topology.

- [ ] **Step 1: Write failing state-to-route and fallback tests**

Assert mandate states activate Sepolia, quote/policy states activate CC3, proving routes Sepolia → Attestcoin, settlement routes Attestcoin → CC3, and the SVG fallback exposes all three network names plus current state.

- [ ] **Step 2: Run the topology tests and confirm failures**

Run: `cd apps/web && npm test`

- [ ] **Step 3: Implement focused memoized scene modules**

Use octahedron wireframe for Sepolia, six-sided cylinder for Attestcoin, three cylindrical meshes for CC3, bounded DPR `[1,1.75]`, node picking, no automatic camera rotation, and semi-implicit Euler integration capped at `1/30` seconds. Route labels show transaction type and block number.

- [ ] **Step 4: Implement WebGL fallback and reduced-motion behavior**

The error boundary swaps the canvas for a semantic SVG DAG. Reduced motion freezes particles at route midpoints and disables glow pulsing without hiding state.

- [ ] **Step 5: Run tests and build**

Run: `cd apps/web && npm test && npm run build`

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/topology apps/web/lib/topology apps/web/tests apps/web/app
git commit -m "feat: deliver technical cross-chain topology"
```

### Task 10: One-Command Demo and Browser E2E

**Files:**
- Create: `scripts/demo.mjs`
- Create: `playwright.config.ts`
- Create: `e2e/success.spec.ts`
- Create: `e2e/violation.spec.ts`
- Create: `e2e/mobile.spec.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Produces `npm run demo`, `npm run test:e2e`, and `npm run verify`.
- `npm run demo` starts risk on `8000`, API on `3001`, Sepolia simulation on `8545`, CC3 simulation on `9545`, and web on `3000`, with coordinated shutdown.

- [ ] **Step 1: Install Playwright and process orchestration dependencies**

Run: `npm install -D @playwright/test concurrently wait-on && npx playwright install chromium`

- [ ] **Step 2: Write the failing success browser scenario**

```ts
test("success unlocks capital and distributes premium", async ({ page }) => {
  await page.goto("/jobs/new");
  await page.getByLabel("Agent").selectOption("0");
  await page.getByLabel("Amount in mUSDC").fill("100");
  await page.getByLabel("Minimum output").fill("99");
  await page.getByRole("button", { name: "Create mandate" }).click();
  await page.getByRole("button", { name: /Accept Vector/ }).click();
  await page.getByRole("button", { name: "Execute success" }).click();
  await page.getByRole("button", { name: "Generate proof" }).click();
  await page.getByRole("button", { name: "Settle policy" }).click();
  await expect(page.getByText("SETTLED SUCCESS")).toBeVisible();
  await expect(page.getByText("30% underwriter / 70% LP")).toBeVisible();
});
```

- [ ] **Step 3: Write the failing violation and repricing scenario**

Execute a violation, assert confirmed local proof labeling, assert junior reaches zero before senior, assert full payout, return to the same agent with identical terms, and assert the balanced premium is higher.

- [ ] **Step 4: Write the failing mobile/reduced-motion smoke test**

Use a 390×844 viewport and reduced motion. Assert drawer navigation reaches every route, the topology has an accessible current-state label, forms fit without horizontal scrolling, and no console errors occur.

- [ ] **Step 5: Implement the demo supervisor and root scripts**

The supervisor imports `createLocalChainRuntime`, starts services with explicit ports, waits for `/healthz` endpoints, forwards termination signals, and closes child processes plus Ganache servers. `npm run verify` runs root tests, web tests/build, Python tests, and Playwright.

- [ ] **Step 6: Run browser E2E**

Run: `npm run test:e2e`

Expected: success, violation/repricing, and mobile/reduced-motion scenarios PASS with no console errors.

- [ ] **Step 7: Run the complete acceptance suite**

Run: `npm run verify`

Expected: root unit/integration tests, Solidity compilation/EVM tests, web tests, Next.js production build, Python SHAP tests, and all browser tests PASS.

- [ ] **Step 8: Update documentation with exact local workflow and proof boundary**

Document `npm install`, Python environment setup, `npm run demo`, the embedded accounts, service ports, both demo paths, and the distinction between local proof simulation and the preserved real Attestcoin worker.

- [ ] **Step 9: Commit**

```bash
git add scripts/demo.mjs playwright.config.ts e2e package.json package-lock.json README.md .env.example
git commit -m "test: verify complete TrustFutures browser sagas"
```

---

## Final Requirement Audit

- Poster UI removed: proven by route screenshots, token scan, and browser inspection.
- Create Job, Agents, Quotes, Policy, Vault, and Proof Explorer routes: proven by route tests and Playwright navigation.
- Placeholder WalletConnect configuration removed: proven by embedded-mode browser logs and provider test.
- UI actions execute backend and contract state: proven by transaction hashes, on-chain assertions, and browser sagas.
- Actual SHAP values: proven by Python tests with nonzero named contributions and API response tests.
- API, proof queue, XState, contracts, and UI operate as one saga: proven by both end-to-end scenarios.
- Success and failure browser E2E: proven by Playwright and absence of console errors.
- Deployment is the only deferred boundary: proven by README disclosure and preservation of real USC/Testnet adapters.
