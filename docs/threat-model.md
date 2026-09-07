# TrustFutures threat model

| Threat | Control |
| --- | --- |
| Fake source outcome | CC3 Native Query Verifier proof plus configured Sepolia chain key and `TreasuryJobManager` emitter check. |
| Altered job or outcome | Adapter derives `jobKey` from configured chain ID, source contract, and indexed job ID. |
| Proof replay | USC query ID, proven job, and consumed policy outcome are each single-use. |
| Quote mutation/replay | EIP-712 signature, expiry, policy ID, `jobBound`, and underwriter nonce. |
| Agent no-show | Anyone can call `finalizeExpired` after the mandate deadline. |
| LP withdrawal during coverage | Vault withdraws only free assets; active policy senior capital is reserved. |
| Loss socialization before junior stake | Registry slash transfers junior collateral first, then vault pays senior collateral. |
| Reentrant policy settlement | `PolicyManager` uses a reentrancy guard and one active policy state transition. |
| LLM changes economics | Model and signed quote set economics. OpenAI only returns constrained explanation JSON; deterministic fallback handles outages. |
| Arbitrary swap target drains mandate funds | `TreasuryJobManager` accepts only administrator-approved executors and grants an exact per-execution allowance that is cleared after the call. |
| Executor reports output it did not deliver | Settlement compares the executor return value with the client's actual output-token balance increase; both must meet `minOut`. |
| Venue call reverts after pulling input | The nested executor call rolls back, the manager clears its allowance, marks a violation, and returns the retained input to the client. |

## Residual risk

This is testnet hackathon code. The executor allowlist is controlled by a single deployment administrator, and approved adapter/router bytecode is trusted. CC3 proof finality latency, official ERC-8004 registry configuration, fee-on-transfer or adversarial tokens, mock-token controls, oracle-like market-volatility inputs, and wallet key operations require review before any production use. No production funds or legal insurance claims are permitted.
