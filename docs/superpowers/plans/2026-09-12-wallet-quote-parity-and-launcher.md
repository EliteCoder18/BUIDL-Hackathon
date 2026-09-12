# Wallet Quote Parity and Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the full TrustFutures demo start with `./start`, accept exact human-readable mUSDC coverage, and render the complete live-quote analytics in MetaMask mode while preserving duplicate-transaction recovery.

**Architecture:** A pure `parseMusdc` boundary converts decimal user input to six-decimal base-unit strings before either demo or wallet APIs see it. The live response parser preserves the backend's complete quote analytics while a pure display mapper gives demo and wallet cards the same rendering model. A root Bash launcher delegates process ownership to the existing demo supervisor via `exec`.

**Tech Stack:** Bash, Node.js ESM and `node:test`, Next.js 14, React 18, TypeScript, viem, Recharts, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-10-hybrid-wallet-ui-design.md` and `docs/superpowers/specs/2026-09-07-risk-data-lineage-design.md`, refined by the approved requirements in the current task.

## Global Constraints

- The coverage UI accepts mUSDC strings and never converts through JavaScript floating-point arithmetic.
- `900` maps to `900000000`; `12.5` maps to `12500000`.
- Zero, negatives, more than six fractional digits, malformed values, and values above `1,000` are rejected next to the form.
- Only the canonical eight-field `Quote` is EIP-712 signed; analytics accompany it and are cryptographically referenced only through `modelHash`.
- The confirmed-mandate recovery path must retry quote hydration without submitting a second `createJob` transaction.
- Existing user changes in the dirty worktree must be preserved.

---

### Task 1: Exact human-readable mUSDC parsing

**Files:**
- Create: `apps/web/lib/units/musdc.ts`
- Create: `apps/web/tests/musdc.test.ts`
- Modify: `apps/web/app/jobs/new/page.tsx`
- Modify: `apps/web/components/wallet/WalletMandateRecovery.tsx`

**Interfaces:**
- Produces: `parseMusdc(value: string): \`${bigint}\``.
- Consumes: form strings from `coverageAmount` and `recoveryCoverage`.

- [x] **Step 1: Write failing conversion and boundary tests**

```ts
test("parses human mUSDC without floating point", () => {
  assert.equal(parseMusdc("900"), "900000000");
  assert.equal(parseMusdc("12.5"), "12500000");
  assert.equal(parseMusdc("0.000001"), "1");
});

test("rejects coverage outside the supported decimal range", () => {
  for (const value of ["0", "-1", "1.0000001", "1000.000001", "1001", "1e2", ""]) {
    assert.throws(() => parseMusdc(value), /coverage/i);
  }
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm --prefix apps/web test -- tests/musdc.test.ts`

Expected: FAIL because `lib/units/musdc.ts` does not exist.

- [x] **Step 3: Implement exact decimal parsing**

```ts
const SCALE = 1_000_000n;
const MAX = 1_000n * SCALE;

export function parseMusdc(value: string): `${bigint}` {
  const candidate = value.trim();
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(candidate);
  if (!match) throw new TypeError("Enter coverage in mUSDC with at most six decimals.");
  const baseUnits = BigInt(match[1]) * SCALE + BigInt((match[2] ?? "").padEnd(6, "0") || "0");
  if (baseUnits <= 0n || baseUnits > MAX) throw new RangeError("Coverage must be greater than 0 and at most 1,000 mUSDC.");
  return baseUnits.toString() as `${bigint}`;
}
```

- [x] **Step 4: Apply the parser to both forms**

Parse `coverageAmount` once inside the job form's guarded submit path before building either `WalletMandateInput` or `CreateJobInput`. Change both coverage controls to `inputMode="decimal"`, `defaultValue="100"`, visible `mUSDC` labels, and nearby helper text explaining the `1,000` maximum. Use the same parser in `WalletMandateRecovery`; keep API and pending-mandate storage values in base units.

- [x] **Step 5: Run focused tests and typecheck**

Run: `npm --prefix apps/web test -- tests/musdc.test.ts tests/wallet-transaction-plan.test.ts && npm run typecheck`

Expected: PASS, including the existing confirmed-mandate retry invariant.

---

### Task 2: Complete live-quote parsing and display parity

**Files:**
- Modify: `apps/web/lib/api/schema.ts`
- Create: `apps/web/lib/risk/quote-display.ts`
- Modify: `apps/web/app/quotes/[jobKey]/page.tsx`
- Modify: `apps/web/components/risk/QuoteCard.tsx`
- Modify: `apps/web/components/risk/RiskAnalyticsPanel.tsx`
- Modify: `apps/web/tests/api-schema.test.ts`
- Create: `apps/web/tests/quote-display.test.ts`

**Interfaces:**
- Produces: `LiveQuote` containing the canonical signed quote plus `seniorAmount`, `failureProbabilityBps`, `premiumBps`, `factors`, `riskProfile`, and `llmExplanation`.
- Produces: `quoteToDisplay(quote: ApiQuote | LiveQuote, index: number): DisplayQuote`.
- Produces: `DisplayQuote.provenance` for the model-evidence disclosure.

- [x] **Step 1: Expand the live parser fixture and assert rich fields**

Extend the existing `parseLiveQuotes` test fixture with a complete risk profile, factors, explanation, `failureProbabilityBps`, `premiumBps`, and `seniorAmount`. Assert the parsed result retains `riskProfile.features`, probability, explanation, confidence, calibration method, drift, lineage, and signature.

- [x] **Step 2: Write a failing wallet display-mapping test**

```ts
test("wallet quote display retains analytics accompanying the signed quote", () => {
  const display = quoteToDisplay(richLiveQuote, 0);
  assert.equal(display.coverageAmount, 900);
  assert.equal(display.probability, 0.1234);
  assert.deepEqual(display.features, richLiveQuote.riskProfile.features);
  assert.equal(display.provenance?.confidence, richLiveQuote.riskProfile.confidence);
  assert.equal(display.explanation, richLiveQuote.llmExplanation);
});
```

- [x] **Step 3: Run parser and mapper tests and verify RED**

Run: `npm --prefix apps/web test -- tests/api-schema.test.ts tests/quote-display.test.ts`

Expected: FAIL because rich live fields are discarded and the mapper does not exist.

- [x] **Step 4: Preserve the complete response and share one display mapper**

Make `LiveQuote` extend the analytics-bearing quote contract while retaining a 65-byte signature type. Reuse `parseQuote` for each live quote, then validate the signature length. Move the unit conversion, probability, features, explanation, and provenance mapping out of the page into `quoteToDisplay`; use it for both modes.

- [x] **Step 5: Render provenance and accurate terminology**

Pass `DisplayQuote.provenance` into `RiskAnalyticsPanel`. Keep the visible `SIGNED` indicator scoped to the quote card and label the disclosure copy so probability, SHAP values, and lineage are described as analytics accompanying the EIP-712 quote and committed through `modelHash`, not independently signed analytics.

- [x] **Step 6: Run focused tests and typecheck**

Run: `npm --prefix apps/web test -- tests/api-schema.test.ts tests/quote-display.test.ts && npm run typecheck`

Expected: PASS with no TypeScript errors.

---

### Task 3: Root launcher and signal-safe shutdown

**Files:**
- Create: `start`
- Create: `tests/start-launcher.test.mjs`

**Interfaces:**
- Produces: executable `./start` runnable from any current directory.
- Consumes: existing `npm run demo` supervisor and its SIGINT/SIGTERM shutdown handling.

- [x] **Step 1: Write the failing launcher integration test**

Create a temporary fake `npm` executable that records its PID, traps `INT`/`TERM`, and waits. Spawn `./start` with the temporary directory prepended to `PATH`, wait for the PID marker, assert the fake npm PID equals the launcher PID (proving `exec`), send `SIGINT`, and assert the trap marker is written and the process exits.

- [x] **Step 2: Run the launcher test and verify RED**

Run: `node --test tests/start-launcher.test.mjs`

Expected: FAIL with `ENOENT` because `start` does not exist.

- [x] **Step 3: Add the minimal launcher**

```bash
#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"

if ! command -v npm >/dev/null 2>&1; then
  echo "TrustFutures requires npm on PATH." >&2
  exit 127
fi

exec npm run demo
```

Mark it executable with `chmod +x start`.

- [x] **Step 4: Verify syntax, delegation, and signal forwarding**

Run: `bash -n start && node --test tests/start-launcher.test.mjs`

Expected: PASS; no fake child remains after SIGINT.

---

### Task 4: Full regression and runtime verification

**Files:**
- Modify only if a verified failure requires a scoped correction.

**Interfaces:**
- Consumes all prior changes and existing recovery, demo, API, ML, contract, and browser flows.

- [x] **Step 1: Run complete static and unit verification**

Run: `npm test && npm --prefix apps/web test && npm run typecheck && npm --prefix apps/web run build && .venv/bin/python -m pytest services/ml -q`

Expected: all root, web, TypeScript, production-build, and ML checks PASS.

- [x] **Step 2: Run both end-to-end settlement paths**

Ensure no demo process holds the fixed local-chain ports, then run: `npm run dry-run:local`.

Expected: Playwright success and violation flows PASS, including capital release and junior-first loss behavior.

- [x] **Step 3: Exercise real launcher lifecycle**

Run `./start`, condition-wait until `http://localhost:3000`, `http://localhost:3001/healthz`, and `http://127.0.0.1:8000/healthz` respond successfully, then send Ctrl+C to the launcher.

Expected: frontend returns 200, API reports `embedded-local`, risk health returns 200, and no listeners remain on ports 3000, 3001, 8000, 8545, or 9545 after shutdown.

- [x] **Step 4: Verify the rendered wallet quote model**

Use a complete live-quote fixture through the parser and display mapper, then inspect the running UI/browser test evidence to confirm non-zero mUSDC values, a percentage, SHAP rows, explanation, and model lineage appear in wallet mode. Do not submit a new public-chain transaction solely for verification.

- [x] **Step 5: Audit the patch**

Run: `git diff --check && git status --short && git diff -- start tests/start-launcher.test.mjs apps/web/lib/units/musdc.ts apps/web/tests/musdc.test.ts apps/web/lib/api/schema.ts apps/web/lib/risk/quote-display.ts apps/web/app/jobs/new/page.tsx apps/web/components/wallet/WalletMandateRecovery.tsx apps/web/app/quotes/[jobKey]/page.tsx apps/web/components/risk/QuoteCard.tsx apps/web/components/risk/RiskAnalyticsPanel.tsx apps/web/tests/api-schema.test.ts apps/web/tests/quote-display.test.ts`

Expected: no whitespace errors and no unrelated user changes overwritten.
