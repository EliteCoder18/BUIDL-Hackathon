# TrustFutures Eclipse Observatory UI Design

Date: 2026-08-20

## Objective

Replace the existing command-center interface with a wholly new, award-inspired spatial product system while preserving every working route, API command, contract transaction, XState transition, accessibility contract, and end-to-end test flow.

## Creative Direction

The theme is **Eclipse Observatory**: users are operating a market that watches autonomous agents across chains. The interface should feel like an orbital risk instrument, not a conventional crypto dashboard.

The design takes directional cues from award-winning WebGL and data-visualization work: deep spatial canvases, restrained chrome, interactive objects as navigation anchors, and type/data overlays that remain readable. It must not copy layouts, assets, names, or branded motifs from any reference.

## Visual System

- Base: near-black violet `#07050d` with luminous radial depth.
- Primary: infrared coral `#ff5e66`, used for risk, active controls, and selected states.
- Verified: ion lime `#c8ff5a`, used for success, confirmation, and connected status.
- Neutral signal: spectral lilac `#a996ff` and mist `#eeeaf8`.
- Capital: solar amber `#ffb45d`.
- Surfaces: translucent violet glass with soft borders, inner light, and clipped orbital geometry.
- Typography: high-contrast grotesk for headlines, compact mono for evidence, humanist sans for explanation.

## Shell and Navigation

Remove the persistent left sidebar. Replace it with:

- a floating top orbital dock containing the brand, four route capsules, system state, and account mode;
- a vertical left-edge page coordinate and right-edge live chain legend;
- a background consisting of a radial eclipse, slow star drift, and fine orbit lines;
- responsive bottom dock navigation on mobile.

Navigation remains semantic and keyboard accessible. Active routes use a filled coral capsule with a lime coordinate marker.

## Dashboard

The landing route becomes an asymmetric observatory:

- a large 3D chain constellation occupies the left two-thirds;
- an orbital state lens overlays the scene rather than sitting in a separate console;
- liquidity, policies, agents, and proofs form four floating telemetry satellites;
- the saga rail becomes a curved sequence of evidence nodes;
- the primary action is a coral launch control labeled “Launch bonded mandate.”

## Product Routes

Every route uses the new shell and instrument surfaces:

- Agents: identity “specimens” with animated orbital portraits and SHAP spectra.
- Create Job: a two-column mission composer with a live mandate envelope.
- Quotes: three tilted underwriting instruments with distinct strategy colors and a shared risk horizon.
- Policy: full-width settlement chamber with a central loss waterfall.
- Vault: liquidity eclipse gauge and capital routing diagram.
- Proofs: vertical evidence beam connecting Sepolia, Attestcoin simulation, and CC3.

## 3D System

Rebuild the React Three Fiber scene around an orbital constellation:

- Sepolia is an open crystalline diamond.
- Attestcoin is a rotating verifier aperture with an inner luminous core.
- Creditcoin is a concentric capital gyroscope.
- Curved routes stay visible at rest; the active route gains flowing particles.
- A large translucent eclipse sphere and orbit rings provide depth.
- Camera interaction remains bounded and user-controlled; reduced motion disables idle motion.

## Motion

- Slow background drift, orbital ring rotation, and light breathing.
- Spring-like hover elevation on instruments.
- Route changes use short opacity/translate transitions.
- Loss settlement still derives from XState and preserves junior-first timing.
- `prefers-reduced-motion` disables continuous and decorative motion.

## Functional Constraints

- No API, contract, economic, or routing behavior may change.
- Embedded mode must remain wallet-free and produce no WalletConnect request.
- All dynamic values remain readable without WebGL.
- Current semantic locators used by Playwright must remain stable.
- Mobile width 390px must preserve navigation, forms, topology semantics, and action buttons.

## Acceptance

- The old sidebar, cyan-grid command-center appearance, and rectangular dashboard layout are gone.
- All seven routes visibly share Eclipse Observatory.
- Root, Python, web, build, and Playwright suites pass.
- Manual visual QA confirms desktop and mobile composition with no horizontal overflow.

