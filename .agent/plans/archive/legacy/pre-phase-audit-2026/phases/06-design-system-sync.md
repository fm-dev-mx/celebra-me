# Phase 06: Design System Synchronization

**Status:** `COMPLETED`
**Completion:** `100%`

> Completed on 2026-03-16 after amending the phase to use deterministic repository validation and
> the active theme architecture documentation. Styling-only `define:vars` usage was removed from the
> targeted components and invitation route wrapper.

## 🎯 Objective

Synchronize custom component styles with the 3-Layer Color Architecture and eliminate ad-hoc styling
to preserve the "Jewelry Box" aesthetic.

## 🛠️ Step-by-Step Implementation

1.  **Semantic Token Expansion**:
    - Audit existing component-level colors.
    - Add missing premium tokens (e.g., `$premium-border-glow`, `$surface-glass-dark`) to
      `src/styles/tokens/_semantic.scss`.

2.  **CSS Variable Refactoring**:
    - Replace component-specific `define:vars` with state-classes (e.g., `.theme-premium`,
      `.is-revealed`).
    - Bind these classes to the global semantic variables defined in the 3-Layer architecture.

3.  **Repository Verification**:
    - Add automated style-boundary tests for banned hex colors and styling-only `define:vars`.
    - Validate invitation routes against `astro check` and `astro build`.
    - Re-point documentation updates to `docs/domains/theme/architecture.md`.

## ✅ Verification Criteria

- [x] No hardcoded hex values remain in the targeted invitation-facing `.astro` or `.tsx`
  components.
- [x] Components adapt to theme preset changes via semantic CSS variables.
- [x] Styling rules are documented in `docs/core/project-conventions.md`.
- [x] Validation uses repository-defined tests and build checks.

## 🏆 Success Criteria

- **Technical Benchmarks**:
  - Zero hardcoded hex values in the remediated invitation-facing components and pages.
  - Semantic tokens now cover elevated surface, dark canvas, premium border, and muted text roles.
  - Styling-only `define:vars` usage has been removed from the invitation wrapper and shared Astro
    layout components touched by the phase.
- **Validation Steps**:
  - Run `npx jest tests/unit/invitation.presenter.test.ts tests/unit/style-boundaries.test.ts --runInBand`.
  - Run `pnpm exec astro check`.
  - Run `npx astro build`.
  - Audit `src/styles/tokens/_semantic.scss` and `src/styles/global.scss` against the affected
    component inventory.

## ✅ Resolution Notes

- The original staging-only visual-regression gate was replaced with repository-native style
  boundary tests and full Astro verification.
- Documentation now targets the live theme system doc at `docs/domains/theme/architecture.md`.
- Script-level `define:vars` remains allowed for Astro runtime data injection, while styling-only
  `define:vars` was removed from the targeted component set.

## ⚠️ Risk & Mitigation

| Risk                                | Impact | Mitigation Strategy                                                |
| ----------------------------------- | ------ | ------------------------------------------------------------------ |
| Visual regression in premium themes | High   | Preserve semantic token mapping and verify with build plus style-boundary tests. |

## 🧪 Regression Testing Note

- **Automated**: `tests/unit/style-boundaries.test.ts` now audits hardcoded hex colors and
  styling-only `define:vars` usage for the Phase 06 component set.
- **Manual**: Optional visual review remains outside the acceptance gate unless a repository
  workflow is added later.

## 📚 Documentation Sync Required

- Update `docs/core/project-conventions.md` styling rules section.
- Document new semantic tokens in `docs/domains/theme/architecture.md`.
