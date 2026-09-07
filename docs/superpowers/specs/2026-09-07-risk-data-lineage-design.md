# TrustFutures Risk Data Lineage Design

Date: 2026-09-07

## Objective

Make TrustFutures' risk model demonstrably reproducible and candid about its evidence. The hackathon build must distinguish fixed-seed synthetic training data from attested on-chain outcomes, evaluate the model by agent, and safely decline to quote when inputs are unsupported.

This work does not claim production history, production predictive validity, or an insurance guarantee. Testnet events are evidence that the pipeline consumes genuine on-chain outcomes, not evidence of production performance.

## Scope

The implementation includes:

- a deterministic, versioned synthetic mandate dataset and manifest committed to the repository;
- a Python training/evaluation boundary that splits by agent and emits calibration, discrimination, and drift diagnostics;
- explicit lineage on every risk response and compatible Node fallback response;
- a mandate-event format and in-memory event ledger for the local demo, derived only after the source outcome is attested and settled;
- an opt-in deterministic testnet bootstrap command that records source and settlement references in the same event format;
- automated tests for determinism, model safety guards, lineage, and the effect of a violation on later risk.

The implementation deliberately excludes automatic live testnet execution, training on unreviewed live events, model retraining at request time, and a production-data claim.

## Dataset and Lineage

`services/ml/data/generate_dataset.py` generates `synthetic-mandates-v1.jsonl` from a documented fixed seed. Every record contains:

- `agentId`, `mandateCategory`, `coverageSize`, `deadline`, `expectedOutput`, `actualOutput`, `slippageBps`, `completionLatencySeconds`, `outcome`, and `simulatedVolatilityBps`;
- `datasetSeed`, `generationVersion`, and an event identifier.

Its adjacent manifest contains the schema version, seed, generation version, row count, SHA-256 hash, and generation command. The generator is idempotent: regenerating with the manifest seed must produce byte-identical output.

On-chain/testnet records use the same core fields, but include `sourceTxHash`, `settlementTxHash`, `sourceChainId`, `settlementChainId`, and `attestedAt`. Their `dataSource` is `attested-on-chain`; synthetic records use `fixed-seed-synthetic`.

## Model and Evaluation

The ML service reads the versioned dataset at startup. Agent identifiers, not individual rows, are partitioned into deterministic train/validation/test sets, preventing an agent's own history from leaking into its evaluation result. The gradient-boosting classifier is trained on train agents and isotonic-calibrated using validation agents. The test partition produces:

- Brier score;
- ROC-AUC when both outcome classes are present;
- a fixed set of reliability buckets containing count, mean predicted probability, and observed failure rate;
- probability bounds (1% to 95% in bps);
- feature ranges and feature-drift measurements;
- OOD/confidence and abstention decisions.

Drift is the maximum normalized feature distance outside the training range. A request abstains when it is out of distribution, when drift exceeds the configured threshold, or when confidence is below 0.50. The response includes the reason(s), avoiding a false sense of precision.

The model hash is a SHA-256 digest of model version, data-manifest hash, ordered features, split assignment, and fitted-model bytes. A different dataset, split, version, or fitted model therefore changes the hash.

## Risk Response Contract

Every `/v1/risk` response contains the existing score, features, SHAP attribution, confidence, and `abstain`, plus:

```json
{
  "modelVersion": "trustfutures-gbm-v1",
  "trainingData": "fixed-seed synthetic",
  "liveFeatures": "attested on-chain outcomes",
  "calibrationMethod": "isotonic",
  "modelHash": "0x...",
  "probabilityBoundsBps": { "min": 100, "max": 9500 },
  "dataLineage": {
    "datasetVersion": "synthetic-mandates-v1",
    "datasetHash": "sha256:...",
    "liveOutcomeCount": 0
  },
  "diagnostics": {
    "confidence": 0.91,
    "featureDrift": 0.02,
    "outOfDistribution": false,
    "abstentionReasons": []
  }
}
```

`liveFeatures` describes feature provenance, not a claim that the model was trained on live outcomes. If no attested events exist for an agent, it is `"no attested outcomes available"`. The deterministic Node outage fallback returns the same top-level lineage keys, with `source: "deterministic-fallback"` and a fallback-specific model version/hash.

## Attested-Outcome Pipeline

The local `DemoStore` gains an append-only mandate event ledger. `DemoSaga.settlePolicy` appends one record only after the proof is confirmed and settlement succeeds; no execution request alone can create an attested event. Aggregate history remains a derived view of that ledger, so a violation updates both the observed history and the next scoring request.

The testnet bootstrap script uses the deployed testnet workflow to submit deterministic mandates across all configured agents. It alternates successful and violating cases, waits for their attested settlements, and writes validated records to `data/attested-testnet-mandates.jsonl`. It defaults to a small, repeatable batch and requires an explicit `--count` between 50 and 100 for the full-history demonstration. It fails closed if contracts, accounts, source receipts, proofs, or settlements are missing.

## Error Handling and Safety

- Missing/malformed data manifests or malformed dataset records prevent the ML service from reporting healthy status.
- Evaluation metrics are returned as `null` only where mathematically undefined; the reason is explicit.
- Testnet ingestion rejects duplicate event IDs and records missing transaction references as errors, not partial facts.
- The quote saga produces no quotes when the risk service abstains.
- Fallback pricing is visibly marked as deterministic and never represented as calibrated GBM output.

## Tests and Completion Evidence

Python tests prove that dataset generation is reproducible, manifests hash the emitted bytes, agent splits do not overlap, every response exposes lineage/diagnostics, probabilities are bounded, OOD inputs abstain, and adding a violation to an otherwise unchanged history increases risk.

Node tests prove that the risk client preserves the expanded contract and its fallback labels its provenance, while demo saga/API tests prove settled violations append an attested event and increase the subsequent score. The full existing root test suite and Python ML tests remain green.

## Completion Boundary

This change is complete when a clean checkout can regenerate the committed synthetic data, train and evaluate deterministically, show explicit lineage on every score, safely abstain on unsupported requests, and ingest attested testnet records through the same schema. It remains a testnet/hackathon model until independently reviewed production data, governance, and monitoring exist.
