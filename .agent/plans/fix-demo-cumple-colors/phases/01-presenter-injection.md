# Phase 01: Presenter Injection Refactor

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Ensure the presenter injects the complete suite of semantic color overrides required by the SCSS presets.

**Weight:** 50% of total plan

---

## 🎯 Analysis / Findings

The current `presentInvitationPage` only overrides `--color-surface-primary` and `--color-action-accent`. Themes like `luxury-hacienda` require more specific overrides such as `--color-surface-dark-override` and `--color-text-primary-override` to ensure their SCSS logic applies the correct fallback behavior while respecting the dynamic theme layer.

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### Update Adapter Payload

- [x] Modify `src/lib/adapters/event.ts` so the `theme` object includes the full resolved palette from `color-tokens.ts`, including `surfaceDark` and `textPrimary`. (30% of Phase) (Completed: 2026-03-18 22:36)

### Update Presenter Injection

- [x] Modify `buildWrapperData` in `src/lib/presenters/invitation-presenter.ts` to dynamically map and inject all provided color keys as CSS variables. (70% of Phase) (Completed: 2026-03-18 22:36)

---

## ✅ Acceptance Criteria

- [x] `demo-cumple` HTML output contains a `<style>` block with `--color-surface-dark-override`, `--color-text-primary-override`, and `--color-action-primary-override`.
- [x] No type errors in `invitation-presenter.ts` or `event.ts`.

---

## 📎 References

- [color-tokens.ts](../../../src/lib/theme/color-tokens.ts)
- [invitation-presenter.ts](../../../src/lib/presenters/invitation-presenter.ts)
