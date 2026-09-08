# TrustFutures Public Wallet Frontend Implementation Plan

> **Execution note:** Implement incrementally with tests first. Preserve embedded demo mode and never expose signer secrets.

**Goal:** Deliver a publicly hostable frontend and direct testnet transaction layer for deployed TrustFutures contracts.

**Architecture:** A wagmi injected-connector provider supports Sepolia and Creditcoin CC3. Pure deployment/transaction modules own chain validation and ABI encoding. Small role-specific client components execute writes and feed confirmed receipts into the existing XState saga. Public pages degrade to deployment evidence when the local API is absent.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, wagmi 2, viem 2, XState 5.

---

### Task 1: Public chain and deployment configuration

**Files:**
- Create: `apps/web/lib/wallet/chains.ts`
- Create: `apps/web/lib/contracts/deployments.ts`
- Test: `apps/web/tests/public-config.test.ts`
- Modify: `apps/web/lib/wallet/mode.ts`
- Modify: `apps/web/tests/wallet-mode.test.ts`

- [ ] Write failing tests for CC3 metadata, public-default mode, embedded override, and deployment manifest validation.
- [ ] Implement custom CC3 chain, supported chains, mode resolution, and typed deployment loader.
- [ ] Run focused tests.

### Task 2: Injected wallet provider and control surface

**Files:**
- Modify: `apps/web/app/wallet-providers.tsx`
- Modify: `apps/web/app/providers.tsx`
- Modify: `apps/web/app/wallet-control.tsx`
- Modify: `apps/web/components/ui/AppFrame.tsx`
- Modify: `apps/web/app/styles.css`
- Test: `apps/web/tests/public-shell.test.ts`

- [ ] Write source-contract tests for injected connector and non-custodial public labels.
- [ ] Replace WalletConnect-gated provider with an injected wagmi config.
- [ ] Build connect/disconnect/network-switch UI with installation fallback.
- [ ] Make public API health optional and label the active mode honestly.

### Task 3: Pure transaction planning layer

**Files:**
- Create: `apps/web/lib/contracts/abis.ts`
- Create: `apps/web/lib/contracts/transactions.ts`
- Test: `apps/web/tests/transactions.test.ts`

- [ ] Write failing tests for mint, approval, job, vault, underwriter, quote acceptance, and job-key derivation.
- [ ] Implement ABI constants and validated write plans.
- [ ] Run focused tests.

### Task 4: Reusable receipt-driven transaction console

**Files:**
- Create: `apps/web/lib/wallet/errors.ts`
- Create: `apps/web/lib/wallet/useTransactionAction.ts`
- Create: `apps/web/components/wallet/TransactionStatus.tsx`
- Test: `apps/web/tests/wallet-errors.test.ts`

- [ ] Test wallet error normalization before implementation.
- [ ] Implement chain switching, write submission, receipt confirmation, and explorer links.
- [ ] Ensure callbacks fire only after successful receipts.

### Task 5: Public Sepolia mandate flow

**Files:**
- Create: `apps/web/components/transactions/PublicMandateForm.tsx`
- Modify: `apps/web/app/jobs/new/page.tsx`
- Test: `apps/web/tests/public-mandate.test.ts`

- [ ] Add failing behavior/source tests.
- [ ] Add faucet, approve, and create-job actions with user-entered agent ID and validated units.
- [ ] Read `nextJobId`, derive `jobKey`, dispatch confirmed lifecycle events, and route to a public job receipt view.
- [ ] Retain the embedded API-backed form.

### Task 6: Public CC3 capital and quote lab

**Files:**
- Create: `apps/web/components/transactions/PublicCapitalDesk.tsx`
- Create: `apps/web/app/underwrite/page.tsx`
- Modify: `apps/web/app/vault/page.tsx`
- Modify: `apps/web/components/ui/TechnicalShell.tsx`
- Test: `apps/web/tests/public-capital.test.ts`

- [ ] Add failing source tests for LP and underwriter role flows.
- [ ] Implement mock mint, approval, senior deposit, junior deposit, and live balance reads.
- [ ] Add a canonical EIP-712 quote builder/signer and portable JSON export.

### Task 7: Public evidence and offline-first home

**Files:**
- Create: `apps/web/components/deployments/PublicEvidence.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/styles.css`
- Test: `apps/web/tests/public-evidence.test.ts`

- [ ] Test presence of explorer-linked public-loop evidence.
- [ ] Render deployment status and transaction proof independently of the local API.
- [ ] Replace the local-API error with a public-mode informational state.

### Task 8: Documentation, full verification, and integration

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `scripts/demo.mjs`

- [ ] Document free MetaMask, faucets, public mode, embedded mode, RPC overrides, and Vercel deployment.
- [ ] Run web tests, root tests, typecheck, and production build.
- [ ] Exercise key UI routes in a browser, fix console/layout issues, and merge the isolated branch into `main`.
