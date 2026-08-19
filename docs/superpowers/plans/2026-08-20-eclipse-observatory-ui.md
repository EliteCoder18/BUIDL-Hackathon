# Eclipse Observatory UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TrustFutures’ existing frontend with the Eclipse Observatory spatial product system without changing working lifecycle behavior.

**Architecture:** Keep route data orchestration and API contracts intact. Rebuild the shared shell, visual primitives, R3F topology, and CSS token/layout system so every route inherits a new theme with minimal behavioral surface area.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind/PostCSS, XState, React Three Fiber, Drei, Recharts, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-20-eclipse-observatory-ui-design.md`

## Global Constraints

- Do not change contract, API, quote, policy, proof, or economic behavior.
- Preserve existing accessible names used by browser tests.
- Avoid new runtime dependencies.
- Use CSS and existing Three.js libraries for all new visual work.
- Respect `prefers-reduced-motion` and 390px mobile layout.

---

### Task 1: Orbital Shell and Visual Primitives

**Files:**
- Modify: `apps/web/components/ui/TechnicalShell.tsx`
- Modify: `apps/web/components/ui/TechnicalPanel.tsx`
- Modify: `apps/web/components/ui/StatusChip.tsx`
- Modify: `apps/web/components/ui/MetricReadout.tsx`
- Test: `apps/web/tests/component-models.test.ts`

- [ ] Add a source-level test that asserts the floating dock, edge coordinates, chain legend, and no sidebar.
- [ ] Run `npm --prefix apps/web test` and confirm the new assertion fails.
- [ ] Replace shell markup with the orbital dock and ambient edge telemetry.
- [ ] Add panel corner geometry and satellite metric semantics while preserving props.
- [ ] Run web tests and TypeScript.

### Task 2: Orbital 3D Constellation

**Files:**
- Modify: `apps/web/components/cross-chain/CrossChainTopology.tsx`
- Test: `apps/web/tests/component-models.test.ts`

- [ ] Add a source test for the eclipse sphere, orbit rings, and gyroscope node.
- [ ] Confirm the source test fails.
- [ ] Rebuild the scene geometry and route beams while retaining semi-implicit Euler particle integration.
- [ ] Run web tests and TypeScript.

### Task 3: Dashboard Composition

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `tests/dashboard-content.test.mjs`

- [ ] Update the content smoke test to require observatory copy and launch control.
- [ ] Confirm the test fails.
- [ ] Replace the existing dashboard composition with an asymmetric scene, state lens, satellites, and evidence rail.
- [ ] Run the focused root content test and web typecheck.

### Task 4: Complete Theme Replacement

**Files:**
- Modify: `apps/web/app/styles.css`

- [ ] Replace all previous palette, shell, panel, route, chart, form, waterfall, and mobile rules with Eclipse Observatory tokens and geometry.
- [ ] Confirm no old sidebar or cyan-grid selectors remain in active markup.
- [ ] Run the production build.

### Task 5: Visual and Functional Verification

**Files:**
- Modify only if verification finds defects.

- [ ] Run root, Python, and web suites.
- [ ] Run Playwright success, violation, and mobile tests.
- [ ] Inspect desktop and mobile screenshots in the in-app browser.
- [ ] Verify no horizontal overflow or current-page console errors.
- [ ] Commit the redesign as one coherent frontend change.

