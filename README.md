# TrustFutures

**Hire any AI agent. Market prices failure. Bond pays when trust breaks.**

TrustFutures is a testnet-only, cross-chain performance-bond market for ERC-8004 AI agents. A treasury client funds an objective Sepolia mandate. Competing underwriters price its failure risk, stake a 20% first-loss tranche, and draw the remaining 80% from senior LP liquidity on Creditcoin. Attestcoin proves the source-chain outcome before a policy settles. See [production-readiness boundary](docs/production-readiness.md).

No production funds. No legal insurance claim. No token or DAO.

## Economic loop

```text
Client creates Sepolia job ──► 3 quote bots ──► signed policy accepted on CC3
       │                            │                    │
       └─ JobSettled event ─► Attestcoin proof ─► outcome adapter
                                                       │
Success: unlock capital; premium 30% underwriter / 70% LPs
Failure or expiry: 100% coverage payout; junior stake consumed before senior LPs
```

MVP coverage is capped at **1,000 mUSDC**. Quotes contain `jobKey`, `underwriter`, `coverageAmount`, `premiumAmount`, `juniorAmount`, `validUntil`, `modelHash`, and nonce. `jobKey = keccak256(sourceChainId, sourceContract, jobId)`.

## Components

- `contracts/src/TreasuryJobManager.sol`: funded, constrained treasury-rebalance mandate bound to an ERC-8004 identity-registry `agentId`; `Success`, `Violation`, or permissionlessly finalized `Expired`.
- `contracts/src/AttestcoinOutcomeAdapter.sol`: validates a real CC3 Native Query Verifier proof, decodes the attested Sepolia `JobSettled` event via Gluwa's `EvmV1Decoder`, validates source contract/chain, and prevents replay.
- `contracts/src/CoverageVault.sol`, `UnderwriterRegistry.sol`, `PolicyManager.sol`: ERC-4626-style senior accounting, junior capital and nonce controls, EIP-712 quote acceptance, and 20/80 loss waterfall.
- `services/prover/attestcoin-worker.ts`: `@gluwa/usc-sdk` worker that waits for attestation, gets a continuity proof, and submits it to CC3. `PostgresProofQueue` makes retries durable when `DATABASE_URL` is set.
- `services/underwriter/risk-engine.mjs`: deterministic bounded risk score; `services/underwriter/explanation.mjs` keeps OpenAI explanation advisory with deterministic fallback.
- `services/api`: REST routes for quotes, proof queue, and agent risk. `apps/web`: Next.js dashboard with wagmi, viem, RainbowKit wallet connection, and live quote API hydration.

## Run locally

```bash
npm install
npm test
npm run typecheck
npm run test:contracts
npm run api

cd apps/web && npm install && npm run dev
```

The contract compile test resolves `@gluwa/usc-contracts` directly, and the local Ganache EVM test executes ERC-8004-bound jobs through success, violation, and permissionless expiry. This catches the source-chain integration boundary even where Foundry is not installed. If Foundry is available, `foundry.toml` is ready for `forge build` and future fuzz/invariant suites.

## Testnet deployment

Copy `.env.example` to `.env` and export the values into your shell. Then run:

```bash
npm run deploy:testnets
```

The script deploys fresh Sepolia source contracts against `ERC8004_IDENTITY_REGISTRY_ADDRESS` (the official Sepolia registry) and fresh CC3 policy contracts, links the vault/registry manager, and writes `deployments/testnet.json`. It intentionally cannot deploy without a funded testnet deployer key and RPC URLs. Never commit `.env` or deployment keys.

For each source `JobSettled` transaction, call `proveAndSubmit` from `services/prover/attestcoin-worker.ts`; it uses the CC3 proof builder flow from Gluwa's official USC examples. Submit the proof first, then call `PolicyManager.settle(policyId)` to consume it exactly once.

## API

- `POST /v1/quotes` — `{ jobKey, coverageAmount, history }`, three deterministic underwriting quotes.
- `POST /v1/proofs` — `{ jobKey, sourceTxHash }`, idempotent proof queue enqueue.
- `GET /v1/proofs/:jobKey` — state and transaction metadata.
- `GET /v1/agents/:agentId/risk` — attested feature basis, model version, score.

The quote service signs all three EIP-712 quotes when its `CREDITCOIN_CHAIN_ID`, `POLICY_MANAGER_ADDRESS`, and three underwriter keys are configured; otherwise it deliberately returns unsigned preview quotes. The on-chain policy manager rejects unsigned, expired, modified, or replayed quotes. The model trains only on committed fixed-seed synthetic data; settled attested outcomes are runtime evidence and never training data. Risk responses disclose dataset/model hashes, calibration, drift, OOD state, and settled live-outcome count. Generate testnet evidence only with `npm run bootstrap:attested-history -- --execute --count 50`; it alternates outcomes and writes proof-confirmed records separately from training data.

## Security model

- Source event must be a successful proof from the CC3 verifier precompile, emitted by the configured `TreasuryJobManager`, for the configured Sepolia chain key.
- USC query IDs, proven job outcomes, policy job bindings, underwriter nonces, and consumed settlements are all single-use.
- Treasury expiry is permissionless, preventing agent no-show deadlock.
- Vault withdrawals exclude capital reserved for active policies; junior capital is slashed first on a failure.
- This is still hackathon code: use mock tokens only, run a manual review before testnet demonstrations, and do not use it with real capital.

See [threat model](docs/threat-model.md) and [three-minute demo script](docs/demo-script.md) for submission-ready review material.

## Demo checklist

1. Seed two agents with ten historical success/violation/expiry outcomes.
2. Create a Sepolia rebalance mandate and accept one CC3 EIP-712 quote.
3. Show success: prove `JobSettled`, settle, release capital and split premium 30/70.
4. Show failure: force `MockDEX` below `minOut`, prove outcome, settle full coverage junior-first.
5. Request new quotes; show the deterministic risk price rises after the attested failure.

Deployment addresses, explorer links, video, deck, and a real proof transaction should be added to `deployments/testnet.json` and this README after the funded testnet run.

### Reproducible public testnet run

`npm run deploy:preflight` loads the git-ignored `.env`, checks Sepolia (11155111) and CC3 Testnet (102031), funded deployer balances, official identity registry bytecode, the USC Sepolia chain key, and proof-builder availability without sending transactions. `npm run deploy:testnets` reports gas estimates, stores transaction hashes before broadcast in `deployments/testnet-progress.json`, records receipts and constructor arguments, and verifies deployed code and manager roles before writing `deployments/testnet.json`.

Run only one deployment process at a time. To resume an interrupted run, keep the same configuration and rerun the command. If a prepared transaction never reached the RPC or a transaction reverted, inspect its recorded hash and nonce before taking further action; do not delete the checkpoint and blindly redeploy. Keys and authenticated RPC URLs are never written to the manifest.

`npm run smoke:testnets` uses the three separate underwriting keys from `.env`, funds them with testnet CTC and mock USDC, registers an ERC-8004 agent, creates three signed quotes, accepts the balanced quote, and triggers a deliberate source mandate violation. It waits for a real Attestcoin proof, submits it to CC3, settles the policy, checks the coverage payout, and records the higher model premium after failure. The run is checkpointed in `deployments/testnet-loop.json`; final transaction hashes are copied into the authoritative manifest. All amounts and transfers in this workflow are testnet-only.

Public configuration sources: [Creditcoin endpoints](https://docs.creditcoin.org/smart-contract-guides/creditcoin-endpoints), [Gluwa SDK proof service](https://github.com/gluwa/cc-next-query-builder), [ERC-8004 registry deployments](https://github.com/erc-8004/erc-8004-contracts). The live CC3 chain-info precompile identifies Sepolia as chain key 1; preflight verifies that mapping on every run.

After deployment or a completed smoke run, `npm run sync:testnets` copies the manifest to the web app's public `/testnet.json` and updates the local backend `POLICY_MANAGER_ADDRESS`. Start the service backend with `node --env-file=.env services/api/server.mjs` to load these keys and addresses. The interactive embedded demo remains a local simulation; the public manifest and smoke evidence identify actual testnet transactions.

### Confirmed public deployment

The authoritative address and receipt record is [`deployments/testnet.json`](deployments/testnet.json).

| Network | Contract | Explorer |
| --- | --- | --- |
| Sepolia | erc8004IdentityRegistry | [0x8004A818BFB912233c491871b3d84c89A494BD9e](https://sepolia.etherscan.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| Sepolia | mockUsdc | [0x815438629fFF40Df72d61FF84C85209085d526a4](https://sepolia.etherscan.io/address/0x815438629fFF40Df72d61FF84C85209085d526a4) |
| Sepolia | mockWeth | [0xF4d6E442d0Ca875008A89C372a143aAF3D01F3ae](https://sepolia.etherscan.io/address/0xF4d6E442d0Ca875008A89C372a143aAF3D01F3ae) |
| Sepolia | mockDex | [0x025896e39d7cdE833De022e721266A11e4c1659C](https://sepolia.etherscan.io/address/0x025896e39d7cdE833De022e721266A11e4c1659C) |
| Sepolia | treasuryJobManager | [0x91eD4049Bab2A6f9f8eA1C9BcbC5316918D3CEB8](https://sepolia.etherscan.io/address/0x91eD4049Bab2A6f9f8eA1C9BcbC5316918D3CEB8) |
| Creditcoin CC3 | mockUsdc | [0x7e8133cAdD8827B6b80Fb93cca745A4AC148c43d](https://creditcoin-testnet.blockscout.com/address/0x7e8133cAdD8827B6b80Fb93cca745A4AC148c43d) |
| Creditcoin CC3 | evmV1Decoder | [0x91eD4049Bab2A6f9f8eA1C9BcbC5316918D3CEB8](https://creditcoin-testnet.blockscout.com/address/0x91eD4049Bab2A6f9f8eA1C9BcbC5316918D3CEB8) |
| Creditcoin CC3 | coverageVault | [0xF4d6E442d0Ca875008A89C372a143aAF3D01F3ae](https://creditcoin-testnet.blockscout.com/address/0xF4d6E442d0Ca875008A89C372a143aAF3D01F3ae) |
| Creditcoin CC3 | underwriterRegistry | [0x025896e39d7cdE833De022e721266A11e4c1659C](https://creditcoin-testnet.blockscout.com/address/0x025896e39d7cdE833De022e721266A11e4c1659C) |
| Creditcoin CC3 | attestcoinOutcomeAdapter | [0x42D005c6c66f57Ddb9D178d0BE507b7174F2610A](https://creditcoin-testnet.blockscout.com/address/0x42D005c6c66f57Ddb9D178d0BE507b7174F2610A) |
| Creditcoin CC3 | policyManager | [0x9E0cfe67A2332cf003615dca6764bEc0184BD302](https://creditcoin-testnet.blockscout.com/address/0x9E0cfe67A2332cf003615dca6764bEc0184BD302) |
