# Noir Premiere XV Restoration Plan

**Completion:** `100%` | **Status:** `READY_FOR_COMMIT`

**Objective:** Restore `xv/noir-premiere-xv` so it matches the visual result of commit
`ac797e8c2a4d3b25e74ce668c171aa7b9960212f` as closely as possible, while preserving the current
post-restructure architecture and without leaking demo-specific fixes into unrelated demos.

**Estimated Duration:** 4 phases / ~0.5 day **Owner:** fm-dev-mx **Created:** 2026-03-20

---

## 🎯 Scope

### In Scope

- Reconcile `src/content/event-demos/xv/noir-premiere-xv.json` with the supported 3-Layer pattern
  used by commit `ac797e8c2a4d3b25e74ce668c171aa7b9960212f`: class-scoped preset for Layer 1 palette
  plus explicit editorial section variants for Layer 2/3 composition.
- Restore `src/styles/events/noir-premiere-xv.scss` to the visual behavior of that commit, only
  adapting selectors or variable plumbing where the current runtime requires it.
- Preserve the simplified presenter/runtime introduced by the recent refactor.
- Validate that the restoration does not alter other demos, shared invitation sections, or the core
  component library.

### Out of Scope

- Building a new global `editorial` invitation preset.
- Refactoring presenter logic, adapter fallbacks, or content schema contracts unrelated to Noir.
- Retheming other demos that are currently stable under their existing preset and variant
  composition.

---

## 🔎 Diagnostic Summary

### Confirmed Regressions

- `src/content/event-demos/xv/noir-premiere-xv.json` now uses `theme.preset = "editorial"` instead
  of the previously supported composition of `theme.preset = "jewelry-box"` plus explicit
  `editorial` section variants.
- `src/styles/themes/presets/_invitation.scss` does not import any `editorial` preset, so
  `theme-preset--editorial` receives no preset-scoped invitation variables.
- `src/styles/events/noir-premiere-xv.scss` was partially converted from explicit noir literals to
  semantic variables such as `var(--color-text-on-dark)` and `var(--color-surface-dark)`. That made
  the demo dependent on the active preset semantics rather than its prior self-contained noir map.
- `src/components/invitation/InvitationSections.astro` now passes `themePreset` into interludes,
  which means Noir’s current page-level preset choice has broader visual influence than before.
- Commit `ac797e8c2a4d3b25e74ce668c171aa7b9960212f` already contains the approved Noir look and must
  be treated as the visual source of truth for this restoration.

### Root Cause

- The simplification collapsed two distinct responsibilities into one setting:
  - Layer 1 preset ownership moved from `jewelry-box` to `editorial`.
  - Layer 2/3 section styling relied on preset fallback instead of explicit editorial variants.
- Because invitation preset CSS for `editorial` does not exist, the page now mixes:
  - global `:root` tokens,
  - runtime color-token overrides,
  - event-local noir SCSS that still expects a dark editorial surface.

### Locked Restoration Strategy

- Use commit `ac797e8c2a4d3b25e74ce668c171aa7b9960212f` as the mandatory visual baseline.
- Revert Noir to the already supported architecture used by that commit:
  - use `jewelry-box` as the preset layer,
  - keep `editorial` as the section-level variant where the demo needs its cinematic layout,
  - keep noir-specific color refinements inside `src/styles/events/noir-premiere-xv.scss`.
- Restore Noir content and event SCSS from that commit’s behavior first, then adapt only the
  minimum required details for compatibility with the current runtime.
- Do **not** introduce a new shared `editorial` preset in this fix. That would broaden scope and
  harden a shared path used only by Noir’s current regression, while the target commit already
  proves the old composition model is sufficient.

---

## 🧭 Implemented File Modifications

| File | Why it changes |
| --- | --- |
| `src/content/event-demos/xv/noir-premiere-xv.json` | Restored Noir content composition to the `ac797e8` baseline and authored `sectionStyles.footer.variant = "editorial"` so the footer follows the same section-variant contract as the rest of the demo. |
| `src/styles/events/noir-premiere-xv.scss` | Restored the Noir event stylesheet to the visual behavior of `ac797e8`. |
| `src/components/invitation/Footer.astro` | Removed slug-specific editorial branching and switched the footer to a `variant`-driven API. |
| `src/styles/invitation/_footer.scss` | Replaced the slug-specific editorial footer selector with `.invitation-footer[data-variant='editorial']`. |
| `src/lib/invitation/page-data.ts` | Added footer variant delivery through the presenter so the page-level footer behaves like any other themed section. |
| `src/lib/schemas/content/section-styles.schema.ts` | Added `sectionStyles.footer.variant` to the content contract. |
| `src/pages/[eventType]/[slug].astro` | Passed the presenter footer variant into the invitation footer component. |
| `.agent/plans/noir-premiere-restoration/**` | Tracks execution, validation, and commit preparation. |

### Explicit Non-Changes

- `src/styles/themes/presets/_invitation.scss`
- `src/lib/adapters/event.ts`
- shared section theme partials under `src/styles/themes/sections/`

The only compatibility-driven scope expansion was the invitation footer path. That expansion was
kept architectural rather than demo-specific:

- no new shared `editorial` preset was introduced
- no slug-specific footer branch remains
- the footer now follows `sectionStyles.footer.variant`, matching the same ownership model used by
  the other invitation sections

---

## ⚠️ Risks and Mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Restoring `jewelry-box` preset could make noir text inherit light-theme tokens again. | High | Phase 03 restores the event stylesheet from `ac797e8` first and only introduces semantic aliases if the current runtime truly requires them. |
| Envelope or music styling could drift if the preset/variant mapping is not made explicit in content. | Medium | Phase 02 restores the target commit’s Noir content contract and Phase 04 validates envelope/interlude mood against the baseline. |
| Fixing Noir could accidentally change Ximena or other editorial sections. | Medium | Scope all styling changes to `.event--noir-premiere-xv` and avoid shared section partial edits. |

---

## 🗺️ Phase Index

| # | Phase | Weight | Status |
| --- | --- | --- | --- |
| 01 | [Diagnostic Lock and Composition Reset](./phases/01-diagnostic-lock-and-composition-reset.md) | 20% | `COMPLETED` |
| 02 | [Content and Variant Restoration](./phases/02-content-and-variant-restoration.md) | 30% | `COMPLETED` |
| 03 | [Event SCSS Realignment](./phases/03-event-scss-realignment.md) | 35% | `COMPLETED` |
| 04 | [Visual Verification and Isolation Audit](./phases/04-visual-verification-and-isolation-audit.md) | 15% | `COMPLETED` |

---

## ✅ Success Criteria

- Noir again renders with a dark noir background, pearl body text, and metallic gold accents across
  hero, location, itinerary, gallery-adjacent surfaces, countdown, gifts, RSVP, and thank-you.
- Noir visually matches commit `ac797e8c2a4d3b25e74ce668c171aa7b9960212f` for the demo-defining
  areas: content composition, section palette balance, interludes, and envelope mood.
- The demo follows the documented 3-Layer Architecture:
  - preset for palette and semantic roles,
  - section variants for layout/section treatment,
  - event-local SCSS only for demo-specific refinement.
- Shared invitation theme behavior is only changed where it improves architectural consistency:
  the footer now consumes a section-style variant instead of a slug exception.
- No regression is introduced to `xv/ximena-meza-trasvina`, `xv/demo-xv`, or `cumple/demo-cumple`.

---

## 🧪 Validation Outcome

- `git diff ac797e8c2a4d3b25e74ce668c171aa7b9960212f -- src/content/event-demos/xv/noir-premiere-xv.json src/styles/events/noir-premiere-xv.scss`
  was reduced to a baseline match before the footer simplification work.
- `pnpm type-check` passed after the final implementation.
- `pnpm build` passed after the final implementation.
- Remaining warnings were pre-existing Astro content warnings for the auto-generated `archive`
  collection, not theme regressions.

---

## 📝 Commit Preparation

Recommended commit sequence for the currently staged work:

1. `docs(agent): finalize noir premiere restoration plan`
2. `refactor(invitation): drive footer styling from section variants`
3. `fix(theme): restore noir premiere xv jewelry-box baseline`

These messages and file groupings are recorded in
`./commit-map.json` so `gatekeeper-commit` can execute without recomputing the split.

For a no-analysis execution path, use
`./GATEKEEPER_READY.md`.
