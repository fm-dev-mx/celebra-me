# Phase 06: Design System Synchronization

**Status:** `BLOCKED`
**Completion:** `0%`

> Blocked on 2026-03-16 after execution review found that the original verification and
> documentation targets do not map cleanly to the current repository workflows. No implementation
> changes have been applied yet.

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

3.  **Verification Alignment Gate**:
    - Amend the phase to use deterministic repository checks for styling compliance.
    - Replace staging-only or screenshot-baseline assumptions with executable repo-level validation.
    - Re-point documentation updates to the existing theme architecture docs in the repository.

## ✅ Verification Criteria

- [ ] No hardcoded hex values in `.astro` or `.tsx` components.
- [ ] Components automatically adapt to theme preset changes via CSS variables.
- [ ] Full compliance with `docs/core/project-conventions.md` styling rules.
- [ ] Validation uses repository-defined tests or scripts instead of undefined staging workflows.

## 🏆 Success Criteria

- **Technical Benchmarks**:
  - Zero hardcoded hex values in `EnvelopeReveal.tsx` and related components.
  - Semantic tokens cover all 'Jewelry Box' aesthetic colors.
  - All components use CSS variables mapped to semantic tokens.
- **Validation Steps**:
  - Run `grep -r "#" src/components --include="*.tsx"` - expect zero matches for hardcoded colors.
  - Run repository tests or scripts that assert the no-hex/component-token boundaries.
  - Audit `_semantic.scss` against component inventory.

## 🚫 Blocker

- The phase currently requires switching theme presets in staging and establishing screenshot
  baselines, but the repository does not define a Phase 06 visual-regression command, baseline
  process, or approval workflow for that requirement.
- The documentation sync target `docs/core/color-architecture.md` does not exist. The active theme
  architecture documentation currently lives in `docs/domains/theme/architecture.md`.
- The CSS-variable refactor requirement is directionally correct, but the plan does not distinguish
  between unsupported `define:vars` usage that should be removed and route/script variable injection
  that is still required for Astro runtime behavior.

## ⚠️ Risk & Mitigation

| Risk                                | Impact | Mitigation Strategy                                                |
| ----------------------------------- | ------ | ------------------------------------------------------------------ |
| Visual regression in premium themes | High   | Define repo-native verification before implementation continues.   |

## 🧪 Regression Testing Note

- **Automated**: Add deterministic repository tests that audit component token usage and banned
  inline hex colors.
- **Manual**: Any screenshot or staging review must be added to the repository workflow before it
  can be treated as a required acceptance gate.

## 📚 Documentation Sync Required

- Update `docs/core/project-conventions.md` styling rules section.
- Document new semantic tokens in the repository's theme architecture documentation. The current
  candidate target is `docs/domains/theme/architecture.md` unless Phase 06 also introduces a new
  core color architecture document.
