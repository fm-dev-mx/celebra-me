# Phase 02: Token Unification

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Standardize `color-tokens.ts` and token imports across the `luxury-hacienda` and
`editorial` presets to match the intended 3-Layer architecture scale.

**Weight:** 30% of total plan

---

## 🎯 Analysis / Findings

Tokens outlined in `src/lib/theme/color-tokens.ts` diverge from SCSS tokens. If we depend on a
unified API, `editorial` must receive accurate dark/noir colors and `luxury-hacienda` must correctly
pull `$base-parchment-100` approximations.

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

### Update `color-tokens.ts`

- [x] Refactor `editorial` preset mapping in `PRESET_COLOR_MAP` to utilize proper dark backgrounds
      (`#0d0d0d` or similar) and metallic accents (`#D4AF37`) (Completed: 2026-03-18 22:04).
- [x] Refactor `luxury-hacienda` preset mapping in `PRESET_COLOR_MAP` to utilize `$base-parchment`
      hex equivalent instead of generic `#F5F5F5` and `#FFFFFF` (Completed: 2026-03-18 22:04).

### SCSS Primitive Alignments

- [x] Modify `_luxury-hacienda.scss` to ensure that standard 3-Layer SCSS abstractions
      (`--color-surface-primary`, `--color-action-accent`) propagate identically when injected. (Completed: 2026-03-18 22:04)

---

## ✅ Acceptance Criteria

- [x] `color-tokens.ts` correctly reflects specific thematic colors for Noir Premiere and Hacienda.
- [x] Standardized variables output exactly what the individual refactored global layout expects.
