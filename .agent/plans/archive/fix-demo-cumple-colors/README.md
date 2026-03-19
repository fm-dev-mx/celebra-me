# 🎨 Fix Demo Cumple Color Regressions

**Completion:** `100%` | **Status:** `ARCHIVED`

**Objective:** Restore the original 'luxury-hacienda' color palette for `demo-cumple` by ensuring proper CSS token injection in the presenter layer without modifying component DOM structures.

**Estimated Duration:** 3 phases / ~1 day
**Owner:** fm-dev-mx
**Created:** 2026-03-18

---

## 🎯 Scope

### In Scope

- Update the invitation page assembly layer (`src/lib/invitation/page-data.ts`) to inject all necessary color aliases from `PRESET_COLOR_MAP`.
- Update `src/lib/adapters/event.ts` to pass the full color map to the theme configuration.
- Align `color-tokens.ts` mappings for the `luxury-hacienda` preset.
- Visual verification to ensure parity with the pre-refactor state (commit `ac797e...`).

### Out of Scope

- Modifying Astro component HTML/structure (e.g., `Hero.astro`).
- Hardcoding inline styles directly into HTML elements.
- Altering the core 3-Layer Color Architecture principles.

---

## 🔴 Blockers & Risks

| Risk / Blocker     | Severity | Mitigation                                                                                               |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------- |
| Regression in themes | Medium   | Archive review confirmed the regression fix shipped cleanly and the current build remains green. |

---

## 🗺️ Phase Index

| #   | Phase                                                              | Weight | Status        |
| --- | ------------------------------------------------------------------ | ------ | ------------- |
| 01  | [Presenter Injection Refactor](./phases/01-presenter-injection.md) | 50%    | `COMPLETED`   |
| 02  | [Token Alignment](./phases/02-token-alignment.md)                  | 30%    | `COMPLETED`   |
| 03  | [Visual Validation](./phases/03-visual-validation.md)              | 20%    | `COMPLETED` |

---

## Closure Note

This plan is archived on 2026-03-19. The remaining open status on Phase 03 was stale plan metadata;
the fix had already shipped, build verification passed, and the owner confirmed the intended visual
parity before archival.

---

> **Governance Note:** This plan follows the rules defined in [Planning Governance Framework](../README.md). No phase may be committed without owner approval.
