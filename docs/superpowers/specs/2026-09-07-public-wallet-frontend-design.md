# TrustFutures Public Wallet Frontend Design

## Goal

Turn the existing local digital twin into a zero-cost public testnet application while preserving the deterministic local demo. Public visitors connect an injected EIP-1193 wallet, switch between Sepolia and Creditcoin CC3, inspect the deployed evidence, mint permissionless mock assets, and submit wallet-owned transactions.

## Product boundary

- Default mode is public testnet. `NEXT_PUBLIC_EMBEDDED_DEMO=1` explicitly restores the local API-backed twin.
- The public build uses MetaMask or another injected wallet directly; it does not require WalletConnect or a paid RPC account.
- Sepolia and Creditcoin CC3 are the only transaction networks.
- Testnet asset interactions are clearly labelled and production-insurance claims are prohibited.
- Attestcoin proof generation remains an operator service because it requires cross-chain proof construction. The already confirmed public loop is always visible as verifiable evidence.
- Underwriter signatures remain client-side EIP-712 signatures. No private keys are shipped in browser bundles.

## Transaction surfaces

1. Wallet control: connect/disconnect, current address, balance, chain health, and one-click chain switching/addition.
2. Sepolia mandate: mint mock USDC, approve the TreasuryJobManager, create a job, wait for its receipt, derive the canonical job key, and advance XState from pending to mined/auction-active.
3. Creditcoin capital: mint mock USDC, approve the vault or underwriter registry, deposit LP senior capital or junior underwriter stake, and show confirmed receipts.
4. Quote laboratory: construct and EIP-712-sign a canonical quote on CC3 without transmitting the signature to a custodial service. The signed payload can be copied/downloaded for a client to accept.
5. Public evidence: load deployment metadata from `/testnet.json`, link every address and public-loop transaction to explorers, and remain useful when the local API is offline.

## State and failure handling

- Pure transaction builders validate addresses, units, deadlines, coverage limits, and required chain IDs before wallet prompts.
- React hooks use wagmi receipt waiting and dispatch only confirmed receipts into the XState orchestrator.
- Rejected wallet prompts, reverted transactions, wrong-network states, missing injected wallets, and RPC failures receive explicit recovery instructions.
- No transaction is marked successful from a submitted hash alone.

## Hosting

The frontend is a static/client-heavy Next.js application suitable for a free Vercel deployment. Public RPC defaults are used with optional environment overrides. The local API is not a prerequisite in public mode.
