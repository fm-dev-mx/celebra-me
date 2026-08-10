---
title: Invitation Presentation Options Canonicalization (Goal C)
status: validated
created: 2026-08-10
updated: 2026-08-10
type: implementation
autonomy: 2
related_docs:
  - docs/domains/theme/variant-system.md
  - .agent/plans/archived/invitation-variant-discovery-audit.md
  - .agent/plans/archived/invitation-variant-canonicalization-goal-b.md
supersedes: []
superseded_by: []
---

# Goal C — Canonicalize Discovered Presentation Options

## Decisions

| Behavior                        | Verdict          | Canonical contract                                                                                                                               |
| ------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Countdown days-only (Alba)      | **Implemented**  | `countdown.presentationOptions.visibleUnits` (min 1; default all four)                                                                           |
| Gifts legend-only (Alba)        | **Implemented**  | `gifts.presentation: 'legend-only'` (no catalog items; default `catalog`)                                                                        |
| Location map-preview (Daniela)  | **Reclassified** | Already owned by `presentation: 'simple'` + `presentationOptions.showNavigationButtons: false` + `mediaMode=none` → linked preview. No new enum. |
| Gallery mobile rail (Valentina) | **Implemented**  | `gallery.presentationOptions.mobileBrowse: 'rail'` orthogonal to `magazine-spread` (default `stack`)                                             |

No new structural variants were created.

## Migrations

- **Alba:** `visibleUnits: ['days']`; `gifts.presentation: 'legend-only'` (cash stub removed);
  profile unit-hide and gifts-grid hide CSS removed; skins retained.
- **Daniela:** explicit `location.presentation: 'simple'` + existing `showNavigationButtons: false`;
  SVG/map-preview skin retained.
- **Valentina:** `mobileBrowse: 'rail'` on demo + local-render fixture; rail geometry moved to
  `_editorial-magazine.scss`; profile keeps color/arrow skins.

## Coverage

- `tests/unit/presentation-options-goal-c.test.ts`
- Alba / Daniela payload updates
- `tests/e2e/gallery-mobile-rail.spec.ts`
- Existing Daniela location navigation e2e

## Out of scope (unchanged)

Abril storyboard, jewelry-box-wedding storyboard, Alba Family photo-caption, Luna Hero, general
profile cleanup, editor UI.

## Validation evidence

- `pnpm validate:changed`: passed
- Focused unit/content/e2e (presentation-options-goal-c, Alba/Daniela payloads, gallery-mobile-rail,
  location navigation contract): passed
- `pnpm run ci`: passed (type-check, structure, lint, styles, governance, parity, PII, preparation,
  Jest, e2e:ci, build:app)
