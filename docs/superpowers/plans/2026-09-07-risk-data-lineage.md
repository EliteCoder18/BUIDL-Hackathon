# Risk Data Lineage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver reproducible risk data, agent-safe evaluation, explicit lineage, and an attested-outcome pipeline without representing synthetic data as production history.

**Architecture:** Python owns deterministic synthetic data, agent-disjoint evaluation, calibration selection, model serialization, and scoring lineage. Node owns settled-outcome ledger records, fallback provenance, and opt-in testnet ingestion. API and frontend pass through and display the resulting risk provenance.

**Tech Stack:** Python, NumPy, scikit-learn, FastAPI, Node ESM, node:test, Next.js and TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-07-risk-data-lineage-design.md`

## Global Constraints

- Dataset generation is fixed-seed and byte reproducible.
- Agent IDs—not individual records—define train/validation/test partitions.
- Isotonic calibration requires both outcome classes in validation; otherwise results are bounded uncalibrated GBM probabilities with `not-applied-insufficient-validation-classes`.
- Model hash includes runtime, library versions, hyperparameters, seed, manifest hash, split assignment, feature order, and fitted-model bytes.
- Unseen categories, unknown agents, missing/stale/invalid events, and material coverage range violations abstain directly.
- Bootstrap execution is opt-in and fails closed.

---

### Task 1: Deterministic mandate dataset

**Files:** Create `services/ml/data/generate_dataset.py`, `services/ml/data/synthetic-mandates-v1.jsonl`, `services/ml/data/synthetic-mandates-v1.manifest.json`, and `services/ml/test_dataset.py`.

**Interfaces:** `generate_dataset(output_dir: Path) -> dict` writes canonical JSONL rows and a manifest with dataset version, seed, generation version, row count, and SHA-256.

- [ ] Write `test_generator_is_byte_reproducible`, asserting two generated JSONL byte streams and manifest hashes are equal.
- [ ] Run `cd services/ml && pytest test_dataset.py -q`; expect import failure because the generator does not exist.
- [ ] Implement the generator with fixed seed, sorted-key compact JSON encoding, and atomic manifest writing; generate the committed artifact.
- [ ] Run `cd services/ml && pytest test_dataset.py -q && python data/generate_dataset.py --check`; expect PASS.
- [ ] Commit dataset, generator, and test with `feat: add reproducible mandate dataset`.

### Task 2: Agent-safe evaluation and runtime lineage

**Files:** Create `services/ml/evaluation.py`, `services/ml/lineage.py`, and `services/ml/test_evaluation.py`; modify `services/ml/test_model.py`.

**Interfaces:** `build_evaluation(records) -> EvaluationBundle`; `build_model_hash(fitted_model_bytes, manifest_hash, splits) -> str`.

- [ ] Write tests proving train/validation/test agent sets have no overlap and one-class validation returns `not-applied-insufficient-validation-classes` plus an explicit warning.
- [ ] Run `cd services/ml && pytest test_evaluation.py -q`; expect missing-module failure.
- [ ] Implement deterministic agent splits, Brier score, defined-or-null ROC-AUC, reliability buckets, probability limits, category vocabulary, training feature ranges, and calibration fallback.
- [ ] Implement canonical runtime lineage hash using Python/NumPy/sklearn versions, GBM params, seed, dataset hash, splits, ordered features, and `pickle.dumps(fitted_model)`.
- [ ] Run `cd services/ml && pytest test_evaluation.py -q`; expect PASS.
- [ ] Commit with `feat: evaluate risk model by agent with lineage`.

### Task 3: Safe model response contract

**Files:** Modify `services/ml/model.py`, `services/ml/app.py`, and `services/ml/test_model.py`.

**Interfaces:** `score_risk(features: dict[str, object]) -> dict` includes `trainingData`, `liveFeatures`, `calibrationMethod`, `dataLineage`, `diagnostics`, `probabilityBoundsBps`, and bounded `failureProbabilityBps`.

- [ ] Write tests for unseen category, unknown agent, missing history, stale/invalid event, and high coverage abstention; each asserts a named reason.
- [ ] Run `cd services/ml && pytest test_model.py -q`; expect failure under the current scalar-only request shape.
- [ ] Add `agent_id`, `mandate_category`, `coverage_size`, and event provenance to the FastAPI input schema, one-hot encode known categories, calculate numeric drift separately, and propagate all lineage/diagnostics.
- [ ] Write and run a test showing a same-agent added violation raises the subsequent score.
- [ ] Run `cd services/ml && pytest test_dataset.py test_evaluation.py test_model.py -q`; expect PASS.
- [ ] Commit with `feat: expose safe lineage risk responses`.

### Task 4: Attested mandate ledger and Node fallback

**Files:** Create `services/demo/mandate-event-ledger.mjs`; modify `services/demo/demo-store.mjs`, `services/demo/demo-saga.mjs`, `services/underwriter/risk-client.mjs`, `tests/risk-client.test.mjs`, and `tests/demo-saga.test.mjs`.

**Interfaces:** `MandateEventLedger.append(event)`, `historyFor(agentId)`, and fallback risk result with the expanded contract and a non-isotonic calibration label.

- [ ] Write a test proving settlement adds exactly one `attested-on-chain` event with both transaction hashes and violation increases later risk.
- [ ] Run `node --test tests/risk-client.test.mjs tests/demo-saga.test.mjs`; expect failure because no ledger exists.
- [ ] Implement duplicate, missing-reference, invalid-outcome, and stale timestamp rejection; derive aggregate agent history from appended events.
- [ ] Expand the risk client service input and fallback response while preserving outage behavior.
- [ ] Run the focused Node tests again; expect PASS.
- [ ] Commit with `feat: record attested mandate outcomes`.

### Task 5: API/frontend propagation and testnet bootstrap

**Files:** Create `scripts/bootstrap-attested-history.mjs`; modify `package.json`, `services/api/validation.mjs`, `services/api/app.mjs`, `apps/web/lib/api/schema.ts`, `apps/web/components/risk/RiskAnalyticsPanel.tsx`, `apps/web/app/agents/page.tsx`, `tests/api.test.mjs`, and `README.md`.

**Interfaces:** `validateAttestedEvent(event, ids, now)` and `npm run bootstrap:attested-history -- --count 50`; expanded `ApiRiskProfile` parser.

- [ ] Write tests that reject stale, duplicate, and incomplete attested event records and parse score lineage/diagnostics.
- [ ] Run `node --test tests/api.test.mjs`; expect failure because bootstrap validation and profile fields are absent.
- [ ] Implement a command that requires explicit count 50–100 and available deployment configuration, alternates deterministic outcomes, and writes only proof-confirmed/settled events.
- [ ] Extend frontend parsing and display model hash, data source, calibration state, and abstention reason without calling an abstained score calibrated.
- [ ] Run `node --test tests/api.test.mjs && npm --prefix apps/web run typecheck`; expect PASS.
- [ ] Document generation, testnet bootstrap, and explicit data limitations in README; commit with `feat: surface risk provenance and bootstrap testnet history`.

### Task 6: Full verification

**Files:** Modify `README.md` only if a documented command needs correction.

- [ ] Run `cd services/ml && pytest -q`; expect PASS.
- [ ] Run `npm test`; expect PASS.
- [ ] Run `npm --prefix apps/web run typecheck` and the existing web tests; expect PASS.
- [ ] Run `cd services/ml && python data/generate_dataset.py --check` and `git diff --check`; expect committed data reproducibility and no whitespace errors.
- [ ] Commit any README-only correction with `docs: document risk lineage verification`.
