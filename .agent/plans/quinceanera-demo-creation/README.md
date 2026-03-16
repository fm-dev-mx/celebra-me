# noir-premiere-xv Demo Creation

**Completion:** `90%` | **Status:** `IN-PROGRESS`

**Objective:** Create a fully isolated public XV showcase demo derived from the structure of
`/xv/ximena-meza-trasvina` without modifying any Ximena-specific content, styles, or assets.

**Estimated Duration:** 3 phases / ~1 day **Owner:** Codex **Created:** 2026-03-16

---

## 🎯 Scope

### In Scope

- Scaffold a governed plan at `.agent/plans/quinceanera-demo-creation/`.
- Create a new public XV demo at `/xv/noir-premiere-xv`.
- Duplicate and anonymize content, style, and asset artifacts into the new demo slug.
- Preserve the cinematic noir/editorial visual DNA while keeping full isolation from Ximena's files.
- Validate route resolution, asset discovery, and theme/style isolation.

### Out of Scope

- Modifying `src/content/events/ximena-meza-trasvina.json`.
- Modifying `src/styles/events/ximena-meza-trasvina.scss`.
- Modifying `src/assets/images/events/ximena-meza-trasvina/*`.
- Introducing a new `/demos/*` route.
- Extending the theme contract or adding a new preset unless a blocker is discovered.

---

## 🔴 Blockers & Risks

| Risk / Blocker                                  | Severity | Mitigation                                                           |
| ----------------------------------------------- | -------- | -------------------------------------------------------------------- |
| Editorial look depends on Ximena-only selectors | High     | Move all visual behavior into `.event--noir-premiere-xv` selectors.  |
| Missing asset keys after duplication            | High     | Keep symbolic asset keys aligned with the cloned `index.ts` mapping. |
| Demo/public content governance drift            | Medium   | Use `src/content/event-demos/xv/` as the canonical content source.   |
| Ximena regression through shared runtime        | Medium   | Avoid route changes unless validation proves them necessary.         |

---

## 🧭 State of the Union [STATUS: PENDING]

### Source Artifacts to Duplicate

- `src/content/events/ximena-meza-trasvina.json` Current production event entry with real personal
  data, Ximena-specific copy, editorial section variants, interlude sequence, envelope config, RSVP
  config, and sharing template.
- `src/styles/events/ximena-meza-trasvina.scss` Large per-event override file scoped to
  `.event--ximena-meza-trasvina`, but also containing Ximena-specific layout/body assumptions and
  selectors tied to the current editorial implementation.
- `src/assets/images/events/ximena-meza-trasvina/` Contains all event media and an `index.ts` module
  that maps symbolic keys used by the JSON and adapter layer.

### Runtime Dependencies Already Confirmed

- `src/pages/[eventType]/[slug].astro` Loads per-event SCSS lazily from
  `src/styles/events/<slug>.scss`, computes `.event--<slug>`, resolves routable events, and still
  contains one Ximena-only body-class exception.
- `src/lib/content/events.ts` Resolves live events first, then public `event-demos`. No new route
  file is required for a new public demo slug.
- `src/lib/assets/asset-registry.ts` Dynamically discovers event asset folders and `index.ts`
  modules. A new asset folder becomes routable without manual registry edits if it follows the
  existing pattern.
- `src/lib/adapters/event.ts` Derives the effective slug from the content entry id, resolves
  symbolic asset keys, and validates presets/variants via `theme-contract`.
- `src/lib/theme/theme-contract.ts` Supports `jewelry-box`, `jewelry-box-wedding`,
  `luxury-hacienda`, `top-premium-xv-ximena`, and `editorial` literals, but only some preset SCSS
  entrypoints actually exist.
- `src/styles/themes/presets/_invitation.scss` Imports `jewelry-box`, `jewelry-box-wedding`,
  `luxury-hacienda`, and `top-premium-xv-ximena`. There is no generic `_editorial.scss` preset file
  today.

### Key Constraints Derived from the Audit

- Public showcase demos are governed to live in `src/content/event-demos/`, not
  `src/content/events/`.
- The new demo must not reuse Ximena's content file, SCSS file, or asset folder in place.
- Reusing the preset name `top-premium-xv-ximena` for a catalog demo would be functionally possible
  but semantically coupled and should be avoided.
- Because there is no generic editorial preset stylesheet entrypoint, the cleanest implementation
  is:
  - keep a supported base preset in content,
  - keep editorial section variants where needed,
  - move the full visual identity into the new per-event SCSS namespace.

---

## 🗺️ Phase Index

| #   | Phase                                                                             | Weight | Status        |
| --- | --------------------------------------------------------------------------------- | ------ | ------------- |
| 01  | [Audit and Scaffold](./phases/01-audit-and-scaffold.md)                           | 20%    | `COMPLETED`   |
| 02  | [Demo Content and Assets](./phases/02-demo-content-and-assets.md)                 | 40%    | `COMPLETED`   |
| 03  | [Visual Isolation and Validation](./phases/03-visual-isolation-and-validation.md) | 40%    | `IN-PROGRESS` |

---

> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../README.md). No phase may be committed without owner approval.
