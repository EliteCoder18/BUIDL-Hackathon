# Execution Adapter Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add approved, balance-verified execution adapters without losing the deterministic demo or existing public-testnet evidence.

**Architecture:** Keep the `createJob` ABI shape, replace direct DEX coupling with an allowlisted `IJobExecutor`, and provide deterministic MockDEX and V3 router adapters. Fresh deployments use the adapter; the existing manifest remains documented as v1 evidence.

**Tech Stack:** Solidity 0.8.30, ethers 6, solc, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-07-execution-adapter-boundary-design.md`

## Global Constraints

- Preserve the seven-argument `createJob` selector.
- Preserve `Success`, `Violation`, and permissionless `Expired` outcomes.
- Use exact token allowances and validate received output balances.
- Do not claim that the Uniswap adapter has been deployed until a fresh public deployment exists.

---

### Task 1: Finish Priority 3 feature semantics

**Files:**
- Modify: `services/ml/evaluation.py`
- Modify: `services/ml/model.py`
- Test: `services/ml/test_evaluation.py`
- Test: `services/ml/test_model.py`

- [x] Add failing tests for canonical deadline tightness and cold-start history.
- [x] Confirm both tests fail for the expected reasons.
- [x] Align the training transform and distinguish absent from invalid attestation.
- [x] Confirm both focused tests pass.

### Task 2: Add the executor contract boundary

**Files:**
- Modify: `contracts/src/Interfaces.sol`
- Modify: `contracts/src/TreasuryJobManager.sol`
- Create: `contracts/src/MockDexExecutor.sol`
- Create: `contracts/src/UniswapV3Executor.sol`
- Test: `tests/contracts/execution-adapter.evm.test.mjs`

- [x] Write an EVM test for allowlisting, success, and violation.
- [x] Run it and confirm the missing adapter behavior fails.
- [x] Implement the interface, manager enforcement, and adapters.
- [x] Run the focused contract tests.

### Task 3: Integrate deployment and local runtime

**Files:**
- Modify: `services/local-chain/runtime.mjs`
- Modify: `scripts/deploy.mjs`
- Modify: `scripts/testnet-loop.mjs`
- Modify: `README.md`
- Test: `tests/deployment.test.mjs`
- Test: `tests/local-runtime.test.mjs`

- [x] Add failing manifest/runtime assertions for `mockDexExecutor`.
- [x] Run them and confirm failure.
- [x] Deploy, approve, expose, and document the adapter.
- [x] Run deployment and runtime tests.

### Task 4: Complete verification

**Files:**
- Verify only.

- [x] Regenerate and verify the deterministic dataset.
- [x] Run root, Python ML, frontend, typecheck, and production build checks.
- [x] Review the final diff for accidental generated files or secret material.
