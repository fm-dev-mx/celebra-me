# 🎨 Post-Refactor Color Regression Remediation

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Correct visual regressions in the `demo-cumple` (Luxury Hacienda) and
`noir-premiere-xv` (Editorial) event demos by strictly applying the intended 3-Layer Color
Architecture and stripping hardcoded variables.

**Estimated Duration:** 4 phases / ~1 day **Owner:** Antigravity **Created:** 2026-03-18

---

## 🎯 Scope

### In Scope

- Alignment of 'editorial' and 'luxury-hacienda' color tokens in `src/lib/theme/color-tokens.ts`.
- Replacing hardcoded colors in `src/styles/events/noir-premiere-xv.scss` with valid 3-Layer system
  tokens.
- Updating presets (`_luxury-hacienda.scss` and `_jewelry-box.scss`) to fix inherited variables that
  caused the recent regression.
- Correcting potential mapping discrepancies where `surfacePrimary` inadvertently applies light
  backgrounds to dark themes.

### Out of Scope

- Applying the fix to other unaffected themes or demos.
- Architectural modifications to `theme-variants.ts` beyond what's needed for the 3-Layer token
  mappings.

---

## 🔴 Blockers & Risks

| Risk / Blocker                                    | Severity | Mitigation                                                                                                    |
| ------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| Removing hardcoded CSS could break layout/spacing | Medium   | Rely heavily on `rgba()` manipulation over existing CSS variables. Ensure variables only map to `color` tags. |

---

## 🗺️ Phase Index

| #   | Phase                                                            | Weight | Status      |
| --- | ---------------------------------------------------------------- | ------ | ----------- |
| 01  | [Analysis & Final Audit](./phases/01-analysis-audit.md)          | 10%    | `COMPLETED` |
| 02  | [Token Unification](./phases/02-token-unification.md)            | 30%    | `PENDING`   |
| 03  | [Refactoring Stylesheets](./phases/03-refactor-noir-premiere.md) | 40%    | `PENDING`   |
| 04  | [Visual Validation](./phases/04-visual-validation.md)            | 20%    | `PENDING`   |

---

> **Governance Note:** This plan follows the rules defined in `../README.md` (Planning Governance
> Framework). No phase may be committed without owner approval.
