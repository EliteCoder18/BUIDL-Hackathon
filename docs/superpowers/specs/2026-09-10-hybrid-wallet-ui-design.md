# Hybrid Wallet and Readable Risk UI Design

## Goal

Make the hosted TrustFutures demo legible, responsive, and credible for BUIDL CTC judges. The application must preserve a zero-friction embedded demo while adding an explicit MetaMask path in which a user signs real testnet client transactions. Risk and cross-chain visualizations must reflect the data and transaction state they claim to show.

## Product boundary

TrustFutures remains testnet-only. No mainnet configuration, production assets, custody, or insurance claim is introduced. The embedded demo remains the default for first-time visitors so a judge can complete the entire narrative without installing a wallet or obtaining gas tokens.

The navigation exposes a persistent two-option control:

- **Demo** runs the existing Render-hosted embedded saga and labels every simulated/local-chain action clearly.
- **MetaMask** connects an injected browser wallet and submits client-owned transactions to the deployed Sepolia and Creditcoin CC3 testnet contracts.

The selected mode is stored in browser local storage. Changing modes resets transient transaction UI but does not erase on-chain history. A mode change never silently submits, signs, or switches a network.

## Wallet architecture

Wallet availability must not depend on a WalletConnect project ID. The web application always supports an injected EIP-1193 wallet such as MetaMask. WalletConnect remains optional and is added only when a valid `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is configured.

The wagmi configuration contains Sepolia and an explicit Creditcoin CC3 testnet chain definition. RPC URLs come from public-safe frontend environment variables. Contract addresses come from the checked-in `public/testnet.json` manifest. The application rejects a manifest whose expected chain IDs are not Sepolia `11155111` and Creditcoin CC3 `102031`.

Only client-owned operations are sent from the browser wallet:

1. On Sepolia, obtain mock mUSDC when required, approve the deployed `TreasuryJobManager`, and call `createJob`.
2. Parse the confirmed `JobCreated` receipt, compute or read the canonical job key, and request public-domain EIP-712 underwriter quotes from the existing API.
3. On Creditcoin CC3, obtain mock mUSDC when required, approve the deployed `PolicyManager`, and call `acceptQuote` with the selected server-signed underwriter quote.

Agent execution stays assigned to the registered agent account. Underwriter quote signatures stay assigned to the configured underwriter keys. Attestcoin proof submission and settlement stay assigned to the existing prover/keeper path. The UI explains this role separation after policy acceptance instead of asking the client wallet to impersonate an agent, underwriter, or keeper.

Each wallet action uses an explicit state machine: `idle`, `needs-wallet`, `needs-network`, `needs-funds`, `awaiting-signature`, `confirming`, `confirmed`, or `failed`. Rejected signatures, wrong networks, insufficient gas, insufficient token balance, reverted receipts, expired quotes, and missing backend signing configuration receive distinct messages. Transaction hashes link to the appropriate explorer.

## API and live-session boundary

The existing embedded demo endpoints remain unchanged. Wallet mode uses the existing public quote endpoint, extended only as required to return a fully typed signing domain and signed quote payload for the deployed Creditcoin policy manager. The server verifies the submitted Sepolia transaction receipt and `JobCreated` event before pricing a job; browser-supplied job keys or agent histories are never trusted without that receipt validation.

Wallet progress is maintained in a focused client-side session model keyed by connected address and job key. Supabase remains the durable proof queue and server-side evidence store; private keys and authenticated RPC URLs never enter the browser bundle or local storage.

## Navigation and interaction design

The top navigation includes a keyboard-accessible segmented control labelled **Execution mode**, with **Demo** and **MetaMask** options. In MetaMask mode, the wallet control sits beside the toggle and shows connection, abbreviated address, active network, and a wrong-network action. On narrow screens the mode and wallet controls move into the existing navigation drawer/compact header without horizontal overflow.

The current cyber-observatory visual language remains, but legibility becomes a hard constraint:

- Body text is at least `16px` with a `1.5` line height.
- Supporting copy and data labels are at least `12px`; critical form and transaction text is at least `14px`.
- Interactive targets are at least `44px` high and retain visible keyboard focus.
- Muted text meets WCAG AA contrast against its rendered background.
- Motion is subtle and disabled under `prefers-reduced-motion`.
- Routes remain usable at 375px, 768px, 1024px, and 1440px viewport widths.

The mode control is not decorative. Page calls to action and copy change with the active mode: demo actions say **Run demo transaction**, while wallet actions say **Sign in MetaMask** and preview the chain, contract, and amount before opening the wallet.

## Risk visualization

The agent risk chart displays all returned model features and makes three concepts visually distinct:

- the observed feature value,
- the signed SHAP contribution,
- the direction of risk impact.

The horizontal SHAP axis uses a symmetric domain derived from the largest absolute contribution, with a safe minimum domain for all-zero data. Positive risk contributions extend right in coral, protective contributions extend left in lime, and zero contributions render a visible neutral marker instead of disappearing. Each row includes a readable feature label, formatted value, signed impact, and accessible text equivalent. Hover/focus details repeat the same information; no meaning relies on color alone.

The chart removes unused vertical space, uses stable row heights, and adapts to one- and two-column agent layouts. Model provenance moves into a collapsed **Model evidence** disclosure so the primary card emphasizes reliability, failure probability, and causal drivers. Raw JSON remains available inside that disclosure for technical judges.

## Cross-chain visualization

The existing topology and saga rail consume the same normalized transaction events in both modes. In wallet mode:

- submitting and confirming the Sepolia mandate activates the Sepolia segment,
- quote readiness activates the underwriting segment,
- network switching and policy acceptance activate the Creditcoin segment,
- confirmed transaction hashes and block numbers appear beside the relevant nodes,
- rejected or reverted actions mark the affected edge without advancing the saga.

This prevents the graph from remaining static while the user signs transactions and keeps the visual narrative tied to verifiable receipts.

## Testing and verification

Implementation follows test-driven development.

- Unit tests cover execution-mode persistence, optional WalletConnect configuration, CC3 chain configuration, transaction-stage reduction, receipt/event validation, quote-domain parsing, and symmetric SHAP chart scaling including all-zero input.
- Component tests cover the mode control, readable chart output, distinct wallet error states, keyboard interaction, and reduced-motion behavior.
- The existing wallet-free Playwright success and violation flows remain unchanged and passing.
- A browser test with an injected EIP-1193 test provider covers MetaMask mode, chain switching, transaction confirmation, graph progression, and rejection recovery without using production keys.
- Production builds must contain no server private key or authenticated RPC credential.
- Final manual verification covers Firefox desktop and a 375px mobile viewport, then the deployed Vercel site is checked against the free Render service.

## Hackathon submission deliverables

The implementation is not the entire submission. Before the official BUIDL CTC 2026 Fall deadline, the project also needs:

1. A stable public Vercel URL and healthy free Render/Supabase integration.
2. A clean public repository with setup instructions, architecture, testnet addresses, explorer evidence, license, and explicit testnet/simulation disclosures.
3. A concise DoraHacks project description mapped to the AI track and the requirement to use Attestcoin.
4. A three-minute demo video showing both the instant demo path and one genuine MetaMask-signed testnet transaction, followed by the existing confirmed Attestcoin proof and Creditcoin payout evidence.
5. A short pitch deck covering problem, users, solution, why Creditcoin/Attestcoin is necessary, architecture, live evidence, business model, security boundary, roadmap, and team.
6. Final submission metadata: team members, contact details, project logo/banner, repository URL, deployed application URL, video URL, and track selection.

## Acceptance criteria

- A new visitor can complete the embedded demo without a wallet.
- A visitor can switch to MetaMask from the top navigation, connect an injected wallet without a WalletConnect project ID, and see the required network and transaction state.
- Client-owned Sepolia and Creditcoin transactions require explicit wallet approval and display confirmed explorer links.
- The UI never asks the client wallet to perform an agent-, underwriter-, prover-, or keeper-owned action.
- Risk charts show every feature, including zero contributions, at readable sizes and without excessive empty space.
- The cross-chain graph advances from normalized confirmed wallet receipts.
- Existing unit, build, contract, Python, and embedded browser flows pass.
- The live `/agents` route renders agent cards rather than an API error.
