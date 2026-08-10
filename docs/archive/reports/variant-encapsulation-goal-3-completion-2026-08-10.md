# Goal 3 — Portability, Regression Proof, and Docs Closure

**Date:** 2026-08-10  
**Authority:** implementation against Goal 2 completion notes and the final post-migration runtime
contracts in `src/lib/invitation/structural-variants.ts`, `src/lib/adapters/event.ts`, and
`docs/domains/theme/variant-system.md`.

## Migrations performed (corpus + runtime)

1. **Content corpus** migrated to explicit `itinerary.presentation.behavior` and semantic Gallery
   layout IDs (`magazine-spread`, `feature-mosaic`, `index-choreography`, `single-keepsake`,
   `uniform-grid`, `editorial-mosaic`) across managed definitions, demos, and local-render fixtures.
2. **Theme structural fallbacks removed** from `resolve*StructuralVariant` /
   `resolveGalleryLayoutVariant` — omitted/invalid selectors resolve to section defaults (`standard`
   / Gallery `uniform-grid`).
3. **Itinerary theme-name fallback removed** from `buildItinerarySectionData` — authority is
   `itinerary.presentation.behavior` only; omitted → `standard`.
4. **Gallery** always emits `data-structural-variant` for the resolved layout ID.
5. **Itinerary `celestial-blue` → `timeline-paper` alias removed**; Ana Sofía fixture and Abril
   managed content author `presentation.behavior: 'timeline-paper'` explicitly.
6. **Identity branches** (Luna Location policy, Leah navigation map, Xareni seal bridge) retired in
   prior Goal 2 work; Goal 3 locks their content contracts in regression tests.

## Legacy removed (zero-consumer justification)

| Mechanism                                                                     | Justification                                                                                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme → structural fallbacks (Hero / Thank You / Gifts / RSVP / PA / Gallery) | Corpus authors explicit structural values or accepts `standard` / `uniform-grid`. Resolvers ignore theme for structure.                                             |
| Itinerary theme-name fallback (`variant = theme.preset`)                      | Managed + fixture itineraries declare `presentation.behavior` or accept `standard`. Adapter no longer reads theme / `sectionStyles.itinerary.variant` for behavior. |
| `celestial-blue` itinerary alias → `timeline-paper`                           | Last named consumer (Ana Sofía) migrated to explicit `timeline-paper`. Alias has zero remaining consumers.                                                          |

## Retained exceptions

| Exception                                          | Why retained                                                                                                                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jewelry-box-wedding` Gallery nth-child storyboard | Wedding demo uses canonical layout `gallery.variant: 'uniform-grid'` with visual skin `sectionStyles.gallery.variant: 'jewelry-box-wedding'` for the nth-child composition; no second reusable consumer proves a semantic layout replacement. |
| Abril local `uniform-grid` 2×2 profile composition | Single-invitation profile geometry under explicit `uniform-grid`; not promoted to a new variant without a second reusable contract.                                                                                                           |

## Portability proof status

Unit coverage in `tests/unit/structural-variant-portability.test.ts` proves identity-free selection
via `adaptEvent` / resolvers on non-origin jewelry-box (and non-origin demos for gallery layouts):

| Variant / behavior                                                                   | Proof surface                                                     |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Hero `editorial-cover`, `split-cover`                                                | jewelry-box overrides + resolvers                                 |
| Family `split-groups`                                                                | jewelry-box override                                              |
| Location `split-map`                                                                 | jewelry-box override                                              |
| Gallery `magazine-spread`, `single-keepsake`, `index-choreography`, `feature-mosaic` | editorial-magazine / celestial-blue demos + jewelry-box overrides |
| Gifts `editorial-catalog`                                                            | jewelry-box override                                              |
| RSVP `editorial-press-pass`                                                          | jewelry-box override                                              |
| Personalized Access `ornamented`, `editorial-pass`                                   | jewelry-box overrides                                             |
| Itinerary `timeline-paper`, `standard`                                               | jewelry-box presentation.behavior                                 |

Content regression locks live in `tests/content/canonical-corpus-contracts.test.ts` (plus existing
per-invitation suites): Alba split-map + days-only; Romina split-cover + itinerary standard;
Victoria itinerary/PA standard + single-keepsake; Daniela split-groups + single-keepsake; Abril
timeline-paper; Luna `revealSurface: 'rsvp'`; Leah explicit `navigation`; Ana Sofía timeline-paper.

E2E harnesses for Hero split-cover / Location split-map on jewelry-box
(`tests/e2e/structural-variant-portability.spec.ts`) and Alba/Romina managed routes
(`tests/e2e/canonical-managed-contracts.spec.ts`) remain available for browser confirmation.

## Docs updated

- `docs/domains/theme/variant-system.md` — final inventory without theme structural / itinerary
  theme-name fallbacks; Gallery always emits structural marker.
- `docs/domains/theme/gallery-variants.md` — layout resolution independent of theme preset; always
  emit `data-structural-variant`; retained Abril / wedding exceptions.
- `docs/domains/theme/architecture.md` — retired celestial itinerary alias guidance.

## Out of scope (unchanged)

- Preview / Production published-content sync for Leah `navigation`, Luna `revealSurface`, and any
  other migrated fixture fields.
- Victoria visual redesign.
- Promotion of jewelry-box-wedding storyboard or Abril 2×2 into new canonical layout IDs.
- Reintroduction of theme structural fallbacks.
