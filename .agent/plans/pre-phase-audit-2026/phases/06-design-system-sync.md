# Phase 06: Design System Synchronization

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

3.  **Visual Regression Check**:
    - Verify that current high-profile invitations (e.g., `noir-premiere-xv`) maintain their premium
      aesthetic after tokenization.

## ✅ Verification Criteria

- [ ] No hardcoded hex values in `.astro` or `.tsx` components.
- [ ] Components automatically adapt to theme preset changes via CSS variables.
- [ ] Full compliance with `docs/core/project-conventions.md` styling rules.

## 🏆 Success Criteria

- **Technical Benchmarks**:
  - Zero hardcoded hex values in `EnvelopeReveal.tsx` and related components.
  - Semantic tokens cover all 'Jewelry Box' aesthetic colors.
  - All components use CSS variables mapped to semantic tokens.
- **Validation Steps**:
  - Run `grep -r "#" src/components --include="*.tsx"` - expect zero matches for hardcoded colors.
  - Switch theme preset in staging; verify visual consistency.
  - Audit `_semantic.scss` against component inventory.

## ⚠️ Risk & Mitigation

| Risk                                | Impact | Mitigation Strategy                                                |
| ----------------------------------- | ------ | ------------------------------------------------------------------ |
| Visual regression in premium themes | High   | Establish baseline screenshots; compare post-tokenization renders. |

## 🧪 Regression Testing Note

- **Automated**: Add visual regression tests for `noir-premiere-xv`, `gold-wedding`,
  `rose-debutant`.
- **Manual**: Verify premium aesthetic (gold accents, wax seal) unchanged after refactor.

## 📚 Documentation Sync Required

- Update `docs/core/project-conventions.md` styling rules section.
- Document new semantic tokens in `docs/core/color-architecture.md`.
