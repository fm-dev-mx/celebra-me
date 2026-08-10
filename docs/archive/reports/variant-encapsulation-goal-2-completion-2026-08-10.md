# Goal 2 — Canonical Variant Migration Completion Notes

**Date:** 2026-08-10  
**Authority:** implementation against `variant-encapsulation-migration-scope-2026-08-10.md` and
`variant-encapsulation-consumer-corpus-delta-2026-08-10.md`.

## Completed in Goal 2

1. **Victoria** Personalized Access → `standard`; Itinerary → explicit
   `presentation.behavior: 'standard'`; profile visual refinement (no new structural variants).
2. **Romina** Itinerary → explicit `presentation.behavior: 'standard'` (Hero `split-cover`
   preserved).
3. **Luna** Location identity branch removed; content capability
   `location.presentationOptions.revealSurface: 'rsvp'` drives the former slug/eventType policy.
4. **Leah** navigation slug map removed; fixture declares explicit `navigation` content metadata.
5. **Xareni** adapter/token bridge removed; seal accents owned by profile CSS via `data-seal-skin`.
6. **Identity CSS** for Luna, Leah, América, Xareni, and Valentina relocated to
   `src/styles/invitation-profiles/**` (no remaining `.event--*` invitation rules under
   `src/styles/themes/sections/**`).

## Deferred to Goal 3 (named remaining consumers)

| Mechanism                                                            | Remaining active consumers                                            | Reason retained                                 |
| -------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| Itinerary theme-name fallback                                        | Legacy fixtures + most demos without explicit `presentation.behavior` | Named corpus still depends on it                |
| `celestial-blue` → `timeline-paper` alias                            | Ana Sofía fixture                                                     | Explicit migration not in Goal 2                |
| Theme structural fallbacks (Hero/Gifts/RSVP/Access/ThankYou/Gallery) | Legacy/demos without explicit structural values                       | Whole-corpus migration out of scope             |
| Gallery dual `data-variant` / `data-structural-variant`              | Broad gallery corpus                                                  | Dual CSS selectors still active                 |
| Jewelry-box wedding nth-child storyboard                             | Wedding demo / jewelry-box gallery path                               | Needs second reusable consumer before promotion |
| Abril local `uniform-grid` 2×2                                       | Abril only                                                            | Documented single-invitation exception          |

Goal 3 should prove portability, run full regression, and retire only mechanisms that reach zero
named consumers after migration.

## Local verification note

Persistent-local published content for `leah-lexa` and `luna-y-estrella` was refreshed from the
updated corpus fixtures via:

`pnpm invitation:local-corpus --apply --slug leah-lexa --slug luna-y-estrella`

Preview/Production published content was not mutated. Those environments need an authorized content
sync before runtime picks up Leah `navigation` and Luna `revealSurface: 'rsvp'`.
