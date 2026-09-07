# Production-readiness boundary

TrustFutures is deliberately a **testnet prototype**. The approved plan explicitly prohibits production funds and legal insurance claims. This repository is hardened for staging and hackathon demonstration, not authorized for mainnet custody.

## Completed staging controls

- EIP-712 quote binding, nonce replay protection, coverage cap, one policy per job, and reentrancy guard.
- CC3 proof adapter validates the configured source, USC proof query uniqueness, outcome event, and proof consumption.
- Vault reserves active coverage; junior collateral is consumed before senior LP assets.
- API has bounded request body handling, health check, idempotent proof queue, optional Postgres persistence, deterministic quote fallback, and structured LLM fallback.
- CI and local EVM tests cover source outcomes, quote acceptance, and failure payout.
- A public v2 Sepolia-to-Attestcoin-to-CC3 failure loop verifies the approved executor, real USC proof submission, junior-first payout, and capital release; transaction evidence is recorded in `deployments/testnet.json`.

## Required before any mainnet consideration

1. Independent Solidity audit, including USC decoder/library linkage and token compatibility review.
2. Formal invariants/fuzzing, multisig/timelock operational controls, pause/recovery design, and incident runbook.
3. Replace test-only mock tokens/DEX and run a legal/compliance review for the target jurisdictions.
4. Dedicated secrets manager, hardware-backed deployer controls, monitored RPC providers, rate limits, authentication, metrics, alerting, backups, and disaster-recovery exercises.
5. External review of the ML data lineage, calibration, drift policy, and model-governance process.

Until these gates are independently approved, deploy only to Sepolia and Creditcoin CC3 Testnet.
