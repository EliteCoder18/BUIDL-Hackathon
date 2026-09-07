# TrustFutures Execution Adapter Boundary Design

## Goal

Separate mandate enforcement from exchange-specific swap calls while keeping deterministic local demos and the existing `createJob` ABI shape.

## Architecture

`TreasuryJobManager` stores an approved executor address per job. The deployer administers a narrow executor allowlist. During execution the manager grants an exact input-token allowance, calls the executor, clears the allowance, and determines success from both the returned amount and the client's observed output-token balance increase.

`MockDexExecutor` adapts the deterministic `MockDEX`. `UniswapV3Executor` adapts a configured V3-compatible `exactInputSingle` router with an immutable pool fee. Both pull only the mandate amount from the manager and approve only the downstream venue required for that call.

The existing seven-argument `createJob` selector remains unchanged: the former `dex` address parameter is now interpreted as an executor. Old public testnet deployments remain valid as v1 evidence; a fresh deployment is required to activate this v2 boundary.

## Safety and failure behavior

- Only the administrator can approve or disable executors.
- New jobs reject unapproved executors.
- Execution grants no unlimited allowances.
- Success requires the client to receive at least `minOut` output tokens.
- A reverting executor produces `Violation` and returns retained input to the client.
- A dishonest executor that consumes input without delivering output produces `Violation`; the associated bond remains the economic recovery path.
- Expiry remains permissionless and unchanged.

## Verification

Local EVM tests cover allowlist enforcement, deterministic success, violation/refund, and executor disablement. Compilation tests cover the Uniswap adapter. Deployment scripts deploy and approve `MockDexExecutor`, record it in manifests, and retain a manifest fallback for the already deployed v1 testnet contracts.
