# Hybrid Wallet and Readable Risk UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent Demo/MetaMask execution mode, genuine client-signed testnet transactions, readable risk visualizations, and transaction-driven topology feedback without breaking the wallet-free demo.

**Architecture:** A focused execution-mode provider owns the persisted user choice while wagmi always exposes the injected MetaMask connector and conditionally exposes WalletConnect. Pure wallet-plan and chart-model modules isolate contract preparation and visualization math; page components consume these modules and dispatch normalized saga events only after confirmed receipts. The existing embedded API remains the default path, while the live quote API verifies the public Sepolia receipt before returning Creditcoin-domain signatures.

**Tech Stack:** Next.js 14, React 18, TypeScript, wagmi 2, viem 2, RainbowKit 2, Recharts, XState, Node HTTP API, ethers 6, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-10-hybrid-wallet-ui-design.md`

## Global Constraints

- Testnet-only: Sepolia chain ID `11155111` and Creditcoin CC3 chain ID `102031`; never add mainnet identifiers or production assets.
- Demo mode is the first-visit default and requires no wallet, RPC key, database, or user funds.
- Browser bundles receive only public RPC URLs and checked-in contract addresses; private keys and authenticated RPC URLs stay server-side.
- Body text is at least `16px`, supporting labels at least `12px`, critical transaction text at least `14px`, and interactive targets at least `44px`.
- Muted text meets WCAG AA contrast, keyboard focus remains visible, and non-essential motion respects `prefers-reduced-motion`.
- User wallets sign only client-owned mint/approve/create/accept actions; agent, underwriter, prover, and keeper roles remain separate.

---

### Task 1: Persisted execution mode and wallet configuration

**Files:**
- Create: `apps/web/lib/wallet/execution-mode.ts`
- Create: `apps/web/lib/wallet/chains.ts`
- Create: `apps/web/lib/wallet/provider-config.ts`
- Create: `apps/web/app/execution-mode-provider.tsx`
- Create: `apps/web/components/ui/ExecutionModeControl.tsx`
- Modify: `apps/web/app/providers.tsx`
- Modify: `apps/web/app/wallet-providers.tsx`
- Modify: `apps/web/components/ui/AppFrame.tsx`
- Modify: `apps/web/components/ui/TechnicalShell.tsx`
- Test: `apps/web/tests/execution-mode.test.ts`
- Test: `apps/web/tests/wallet-provider-config.test.ts`

**Interfaces:**
- Produces: `ExecutionMode = "demo" | "wallet"`, `readExecutionMode(Storage | undefined): ExecutionMode`, `writeExecutionMode(Storage, ExecutionMode): void`, and `useExecutionMode(): { mode, setMode }`.
- Produces: `creditcoinTestnet` viem chain and `walletConnectEnabled(projectId): boolean`.

- [ ] **Step 1: Write failing mode and provider tests**

```ts
test("execution mode defaults to demo and persists wallet choice", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  assert.equal(readExecutionMode(storage), "demo");
  writeExecutionMode(storage, "wallet");
  assert.equal(readExecutionMode(storage), "wallet");
});

test("injected MetaMask remains available without WalletConnect", () => {
  assert.equal(walletConnectEnabled(undefined), false);
  assert.equal(creditcoinTestnet.id, 102031);
});
```

- [ ] **Step 2: Verify the new tests fail because the modules do not exist**

Run: `npm --prefix apps/web test`
Expected: FAIL resolving `execution-mode` or `provider-config`.

- [ ] **Step 3: Implement pure mode storage, chain metadata, and connector selection**

```ts
export type ExecutionMode = "demo" | "wallet";
export const EXECUTION_MODE_KEY = "trustfutures:execution-mode";
export function readExecutionMode(storage?: Pick<Storage, "getItem">): ExecutionMode {
  return storage?.getItem(EXECUTION_MODE_KEY) === "wallet" ? "wallet" : "demo";
}
export function writeExecutionMode(storage: Pick<Storage, "setItem">, mode: ExecutionMode) {
  storage.setItem(EXECUTION_MODE_KEY, mode);
}
```

Create a client provider that hydrates from local storage after mount, exposes `useExecutionMode`, and renders a `role="radiogroup"` segmented control labelled `Execution mode`. Configure wagmi with `injected({ target: "metaMask" })` unconditionally and add `walletConnect({ projectId })` only when `resolveWalletMode` accepts the ID.

- [ ] **Step 4: Integrate the mode control into the navigation**

Render `<ExecutionModeControl />` before the wallet area. Demo mode shows `DEMO ACCOUNT`; wallet mode renders the RainbowKit connection control and reports the active chain. Use `aria-checked`, 44px controls, and no automatic chain switch on toggle.

- [ ] **Step 5: Run tests and commit**

Run: `npm --prefix apps/web test && npm run typecheck`
Expected: all web tests and TypeScript checks PASS.

```bash
git add apps/web/lib/wallet apps/web/app/providers.tsx apps/web/app/wallet-providers.tsx apps/web/app/execution-mode-provider.tsx apps/web/components/ui/ExecutionModeControl.tsx apps/web/components/ui/AppFrame.tsx apps/web/components/ui/TechnicalShell.tsx apps/web/tests
git commit -m "feat: add hybrid execution mode"
```

---

### Task 2: Readable, truthful risk visualization

**Files:**
- Modify: `apps/web/components/risk/risk-model.ts`
- Modify: `apps/web/components/risk/RiskAnalyticsPanel.tsx`
- Modify: `apps/web/app/agents/page.tsx`
- Modify: `apps/web/app/styles.css`
- Test: `apps/web/tests/component-models.test.ts`

**Interfaces:**
- Produces: `riskChartModel(features): { rows: RiskChartRow[]; domain: [number, number] }` where every row includes `name`, `label`, `valueLabel`, `impactLabel`, `shapValue`, and `direction`.

- [ ] **Step 1: Write failing chart-model tests**

```ts
test("risk chart uses a symmetric domain and retains zero rows", () => {
  const model = riskChartModel([
    { name: "failure_rate", value: 0.2, shapValue: 0.4 },
    { name: "volatility_bps", value: 300, shapValue: 0 },
    { name: "mean_slippage_bps", value: 50, shapValue: -0.2 },
  ]);
  assert.deepEqual(model.domain, [-0.4, 0.4]);
  assert.equal(model.rows.length, 3);
  assert.equal(model.rows[1].impactLabel, "0.000");
});
```

- [ ] **Step 2: Verify the chart-model test fails**

Run: `npm --prefix apps/web test`
Expected: FAIL because `riskChartModel` is missing.

- [ ] **Step 3: Implement chart data and accessible rendering**

Compute `bound = Math.max(0.05, ...features.map(feature => Math.abs(feature.shapValue)))` and return `[-bound, bound]`. Replace the fixed Recharts height with `Math.max(210, rows.length * 48)`, pass the symmetric domain to `XAxis`, render a neutral dot for zero rows, and add an off-screen list whose text includes each feature value, signed impact, and risk direction.

- [ ] **Step 4: Improve card hierarchy and typography**

Move provenance and raw JSON into `<details className="model-evidence">`; keep reliability, calibrated risk, and driver rows visible. Raise CSS typography tokens to `12px`, `14px`, and `16px`, remove the staggered second-card offset, reduce empty chart padding, and add single-column rules below 900px.

- [ ] **Step 5: Run tests/build and commit**

Run: `npm --prefix apps/web test && npm --prefix apps/web run build`
Expected: tests and production build PASS.

```bash
git add apps/web/components/risk apps/web/app/agents/page.tsx apps/web/app/styles.css apps/web/tests/component-models.test.ts
git commit -m "feat: make risk telemetry readable"
```

---

### Task 3: Pure client transaction planning and receipt decoding

**Files:**
- Create: `apps/web/lib/wallet/contracts.ts`
- Create: `apps/web/lib/wallet/transaction-plan.ts`
- Create: `apps/web/lib/wallet/transaction-state.ts`
- Test: `apps/web/tests/wallet-transaction-plan.test.ts`

**Interfaces:**
- Produces: minimal typed ABIs for `mint`, `approve`, `createJob`, `jobKey`, `acceptQuote`, and `policyId`.
- Produces: `walletTransactionPlan(manifest, input): WalletStep[]` and `reduceWalletTransaction(state, event): WalletTransactionState`.
- Produces: `decodeCreatedJob(receipt, managerAddress): { jobId: bigint; jobKeyInput: { chainId, manager, jobId } }`.

- [ ] **Step 1: Write failing plan and reducer tests**

```ts
test("wallet plan assigns client actions to the correct chains", () => {
  const steps = walletTransactionPlan({
    sepolia: { chainId: 11155111, mockUsdc: `0x${"11".repeat(20)}`, mockWeth: `0x${"22".repeat(20)}`, mockDexExecutor: `0x${"33".repeat(20)}`, treasuryJobManager: `0x${"44".repeat(20)}` },
    creditcoin: { chainId: 102031, mockUsdc: `0x${"55".repeat(20)}`, policyManager: `0x${"66".repeat(20)}` },
  }, { agentId: 10130n, amountIn: 100_000_000n, minOut: 99_000_000n, coverageAmount: 100_000_000n, deadline: 2_000_000_000n });
  assert.deepEqual(steps.map(({ chainId, action }) => [chainId, action]), [
    [11155111, "mint"], [11155111, "approve"], [11155111, "create-job"],
    [102031, "mint"], [102031, "approve"], [102031, "accept-policy"],
  ]);
});

test("a rejected signature does not advance a transaction", () => {
  assert.deepEqual(reduceWalletTransaction({ stage: "awaiting-signature" }, { type: "REJECTED" }), {
    stage: "failed", code: "USER_REJECTED", message: "Signature request rejected. Nothing was submitted.",
  });
});
```

- [ ] **Step 2: Verify the tests fail because the wallet plan is absent**

Run: `npm --prefix apps/web test`
Expected: FAIL resolving the new modules.

- [ ] **Step 3: Implement minimal ABIs, plans, and state reduction**

Use `parseAbi` from viem. Validate manifest chain IDs and each address with `isAddress`. Model the states from the spec exactly and map error code `4001` to `USER_REJECTED`, insufficient native balance to `INSUFFICIENT_GAS`, ERC-20 balance failure to `INSUFFICIENT_TOKEN`, chain mismatch to `WRONG_NETWORK`, and reverted receipts to `REVERTED`.

- [ ] **Step 4: Run tests and commit**

Run: `npm --prefix apps/web test && npm run typecheck`
Expected: all tests PASS.

```bash
git add apps/web/lib/wallet apps/web/tests/wallet-transaction-plan.test.ts
git commit -m "feat: model signed testnet transactions"
```

---

### Task 4: Verified live quote boundary

**Files:**
- Create: `services/api/live-job-verifier.mjs`
- Modify: `services/api/app.mjs`
- Modify: `services/api/server.mjs`
- Modify: `services/deployment/config.mjs`
- Modify: `apps/web/lib/api/client.ts`
- Modify: `apps/web/lib/api/schema.ts`
- Test: `tests/live-job-verifier.test.mjs`
- Test: `tests/api.test.mjs`
- Test: `apps/web/tests/api-schema.test.ts`

**Interfaces:**
- Produces: `verifyLiveJob({ sourceTxHash, expectedManager, provider }): Promise<VerifiedLiveJob>`.
- Produces: `POST /v1/live/quotes` accepting `{ sourceTxHash, coverageAmount }` and returning `{ job, domain, quotes, signing }`.
- Produces: `api.getLiveQuotes(sourceTxHash, coverageAmount)`.

- [ ] **Step 1: Write a failing receipt-verification test**

```js
test("live quote verification rejects a receipt from another manager", async () => {
  const sourceTxHash = `0x${"11".repeat(32)}`;
  const expectedManager = `0x${"22".repeat(20)}`;
  const provider = { getTransactionReceipt: async () => ({ status: 1, to: `0x${"33".repeat(20)}`, logs: [] }) };
  await assert.rejects(
    () => verifyLiveJob({ sourceTxHash, expectedManager, provider }),
    /configured TreasuryJobManager/,
  );
});
```

Add an API test proving `/v1/live/quotes` returns 422 when the receipt is unmined and 200 with the exact Creditcoin signing domain only after a valid `JobCreated` receipt.

- [ ] **Step 2: Verify the API tests fail**

Run: `node --test tests/live-job-verifier.test.mjs tests/api.test.mjs`
Expected: FAIL because verifier and route do not exist.

- [ ] **Step 3: Implement receipt verification and live quote response**

Use ethers `Interface` for the checked contract event, require `receipt.status === 1`, require `receipt.to` and log address equal `TREASURY_JOB_MANAGER_ADDRESS`, derive `jobKey = keccak256(abi.encode(11155111, manager, jobId))`, obtain trusted agent history from the server-side store, and sign quotes with the configured Creditcoin domain. Return `SIGNING_UNAVAILABLE` when public underwriter keys are not configured; never return preview quotes as acceptable live quotes.

- [ ] **Step 4: Add deployment validation and frontend parsing**

Require public-chain manager and policy addresses only when `TRUSTFUTURES_LIVE_WALLET=true`. Parse all addresses, uint strings, quote signatures, and the `{ chainId: 102031, verifyingContract }` domain in the frontend.

- [ ] **Step 5: Run backend/frontend tests and commit**

Run: `node --test tests/live-job-verifier.test.mjs tests/api.test.mjs && npm --prefix apps/web test && npm run validate:deployment`
Expected: all tests PASS.

```bash
git add services/api services/deployment/config.mjs tests apps/web/lib/api apps/web/tests/api-schema.test.ts
git commit -m "feat: verify wallet jobs before quoting"
```

---

### Task 5: MetaMask transaction UI and topology events

**Files:**
- Create: `apps/web/components/wallet/WalletTransactionStepper.tsx`
- Create: `apps/web/lib/wallet/useWalletMandate.ts`
- Create: `apps/web/lib/wallet/useWalletPolicy.ts`
- Modify: `apps/web/app/jobs/new/page.tsx`
- Modify: `apps/web/app/quotes/[jobKey]/page.tsx`
- Modify: `apps/web/components/cross-chain/CrossChainTopology.tsx`
- Modify: `apps/web/lib/trustfutures/orchestrator.ts`
- Test: `apps/web/tests/orchestrator.test.ts`
- Test: `e2e/wallet-mode.spec.ts`

**Interfaces:**
- Produces: `useWalletMandate(input)` and `useWalletPolicy(quote)` hooks returning current step, receipt hashes, explorer URLs, and an explicit `advance()` action.
- Consumes: execution mode, transaction plan, live quote endpoint, and orchestrator `send`.

- [ ] **Step 1: Write failing orchestration and browser tests**

```ts
test("confirmed wallet receipts advance Sepolia then Creditcoin topology", () => {
  const actor = createActor(orchestratorMachine).start();
  actor.send({ type: "WALLET_TX_CONFIRMED", operation: "createJob", txHash: `0x${"11".repeat(32)}` });
  assert.equal(actor.getSnapshot().value, "AUCTION_ACTIVE");
  actor.send({ type: "WALLET_TX_CONFIRMED", operation: "acceptQuote", txHash: `0x${"22".repeat(32)}` });
  assert.equal(actor.getSnapshot().value, "CREDITCOIN_POLICY_LOCKED");
});
```

The Playwright test injects an EIP-1193 provider, chooses MetaMask, verifies no RPC request occurs on toggle alone, confirms the Sepolia sequence, rejects one Creditcoin request, retries it, and asserts the topology state and explorer link update.

- [ ] **Step 2: Verify the orchestration test fails**

Run: `npm --prefix apps/web test`
Expected: FAIL because `WALLET_TX_CONFIRMED` is not handled.

- [ ] **Step 3: Implement the hooks and stepper**

Use `useAccount`, `useChainId`, `useSwitchChain`, `useWriteContract`, and `useWaitForTransactionReceipt`. Every step requires a user click, displays contract/amount/chain before signing, sets `aria-busy` while confirming, and exposes rejection and retry without advancing.

- [ ] **Step 4: Branch the existing job and quote pages by execution mode**

Demo mode retains the exact API commands and text selectors used by current E2E tests. Wallet mode replaces the single submit with the signed Sepolia stepper, stores only public hashes/job keys in session storage, requests verified live quotes, then runs the signed Creditcoin acceptance stepper. After acceptance, show `Client signatures complete — agent/prover/keeper continue` with explorer links.

- [ ] **Step 5: Drive topology from confirmed wallet events**

Add normalized confirmed/rejected wallet events; render chain, abbreviated hash, and block alongside the active node. A rejection colors only the current edge and preserves the last confirmed state.

- [ ] **Step 6: Run tests and commit**

Run: `npm --prefix apps/web test && npm run typecheck && npx playwright test e2e/wallet-mode.spec.ts`
Expected: unit, type, and injected-wallet browser tests PASS.

```bash
git add apps/web e2e/wallet-mode.spec.ts
git commit -m "feat: sign client transactions with MetaMask"
```

---

### Task 6: Responsive polish, deployment configuration, and final verification

**Files:**
- Modify: `apps/web/app/styles.css`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/ui/TechnicalShell.tsx`
- Modify: `.env.example`
- Modify: `docs/deployment.md`
- Modify: `README.md`
- Modify: `e2e/mobile.spec.ts`

**Interfaces:**
- Consumes all prior mode, wallet, visualization, API, and orchestration interfaces.
- Produces deployer-facing public environment documentation and submission-facing user guidance.

- [ ] **Step 1: Extend the mobile test before CSS changes**

Assert at 375px that body width equals viewport width, all mode buttons have at least 44px height, the risk chart feature labels are visible, the navigation is operable, and reduced-motion disables orbit/feature animations.

- [ ] **Step 2: Verify the mobile test fails on current sizing**

Run: `npx playwright test e2e/mobile.spec.ts`
Expected: FAIL on undersized controls or horizontal overflow.

- [ ] **Step 3: Complete responsive and reduced-motion CSS**

Use the approved typography minimums, wrap/compact the orbital dock below 1100px, collapse agent and quote grids below 900px, remove fixed offsets below 768px, prevent long hashes from widening panels, and add `@media (prefers-reduced-motion: reduce)` rules that disable orbit, orb, bar, and transform animations.

- [ ] **Step 4: Document and validate public deployment variables**

Document `NEXT_PUBLIC_SEPOLIA_RPC_URL`, `NEXT_PUBLIC_CREDITCOIN_RPC_URL`, optional `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, and server-only `TRUSTFUTURES_LIVE_WALLET`. State that public RPC URLs are not secrets and that signing keys must never use the `NEXT_PUBLIC_` prefix.

- [ ] **Step 5: Run the complete verification suite**

Run: `npm test && npm run typecheck && npm --prefix apps/web test && npm --prefix apps/web run build && .venv/bin/python -m pytest services/ml && npm run dry-run:local && npx playwright test e2e/mobile.spec.ts e2e/wallet-mode.spec.ts`
Expected: all Node, TypeScript, frontend, build, Python, demo, mobile, and wallet checks PASS.

- [ ] **Step 6: Inspect and commit the final patch**

Run: `git diff --check && git status --short`
Expected: no whitespace errors and only intended files changed.

```bash
git add apps/web .env.example docs/deployment.md README.md e2e/mobile.spec.ts
git commit -m "feat: polish hybrid hackathon experience"
```

- [ ] **Step 7: Push and verify the free deployment**

Push `main` to `origin/master`, wait for GitHub Actions, Render auto-deploy, and Vercel production deployment, then verify `/healthz`, `/v1/agents`, `/agents`, Demo mode, MetaMask toggle, Firefox desktop layout, and 375px responsive layout.
