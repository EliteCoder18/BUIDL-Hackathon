# TrustFutures — Three-minute demo

## 0:00–0:25 — Problem

AI agents can execute real treasury actions, but a client cannot price failure before delegating. TrustFutures turns an attested execution history into a competitive performance bond: **hire any AI agent; market prices failure; bond pays when trust breaks.**

## 0:25–0:55 — Source mandate

Open the Agents view. Treasury Delta is an ERC-8004 identity. Create a Sepolia mandate: swap 100 mUSDC to mWETH before deadline, with a fixed minimum output. The funded `TreasuryJobManager` produces only Success, Violation, or Expired.

## 0:55–1:25 — Competitive pricing

Open Quote Auction. Three independent underwriting strategies quote the same job. Each locks 20% junior first-loss capital; the LP vault locks 80% senior capital. The API returns EIP-712 quotes; the deterministic model fixes probability and premium, while the LLM only explains evidence.

## 1:25–1:55 — Proof and settlement

Accept the balanced quote. Execute the mandate. The worker waits for the Sepolia block, uses `@gluwa/usc-sdk` to construct a CC3 continuity proof, and submits it to `AttestcoinOutcomeAdapter`. The adapter validates the CC3 verifier proof, source contract, source chain, `JobSettled` log, and replay state.

## 1:55–2:30 — Failure loop

Set `MockDEX` below the mandate minimum. The objective violation is attested and proven. Policy settlement pays 100 mUSDC: junior underwriter capital absorbs the first 20 mUSDC, then senior LP capital pays 80 mUSDC. No subjective dispute path.

## 2:30–3:00 — Why it matters

Show a subsequent quote: the same agent’s attested violation raises modeled risk. On success, capital unlocks and premium splits 30% to the underwriter and 70% to LPs. The market rewards reliable agents and prices the downside of unreliable ones.

## Demo fallback

Keep a previously confirmed CC3 failure proof and settlement transaction in `deployments/testnet.json`. During network latency, show the confirmed proof first, then show a new live proof queue entry separately.
