---
title: Leslie Perez — Section parity handoff (Phase 1)
status: active
created: 2026-08-17
updated: 2026-08-17
type: diagnostic
related_skills:
  - theme-architecture
  - frontend-design
related_docs:
  - docs/invitations/leslie-perez.md
  - docs/domains/theme/variant-system.md
  - docs/domains/theme/architecture.md
  - docs/domains/theme/gallery-variants.md
  - docs/domains/theme/section-intersections.md
  - docs/domains/content/section-contracts.md
  - scripts/provision/invitations/leslie-perez.ts
---

# Leslie Perez — Section parity handoff

**Phase:** Goal 1 complete. Goal 2 must not start until the owner accepts this file.

**Authorization for Goal 2 (when accepted):** local SCSS / Leslie definition / listed tests only.
No database, Preview, Production, `invitation:release`, publish, or Git mutation.

This file is the sole Phase 2 authority. It does not replace `docs/invitations/leslie-perez.md`.

## Current state

Leslie is an `in_progress` local definition (`celestial-blue`, no profile stylesheet). Canonical
variants are selected. The cheap look is not missing “Leslie CSS”. It is:

1. Theme-named section skins (`[data-variant='celestial-blue']`) fighting non-standard structural
   variants.
2. Variant SCSS that still embeds origin chroma.
3. Invitation knobs copied from peers (full-chain intersections, Renata overlay).
4. Gallery layout that cannot place 13 items; four of those items are landscape and will fight a
   square mosaic.
5. Family `asymmetric-groups` with a single parents block in a two-column grid.
6. **No interludes**, while every finished peer and the celestial demo use 1–4 full-bleed pauses.
   Omitting them stacks quote→family→countdown→location→itinerary→gallery with no photographic
   breath. Intersections without interludes cannot replace that beat.

Staged working-tree hunks exist on five files (user-owned). Classify them below; do not discard via
Git.

## Closed decisions

| Decision | Close |
|---|---|
| Gallery | **Switch to `editorial-mosaic`** (peer: romina-rios-chaparro) with **11 items** after interlude reallocation. `index-choreography` CSS/roles cover indices 0–9 only. Goal fallback `feature-stack` is infeasible (indices 0–2). Mosaic repeating `nth-child(3n)` scales. Remaining landscape still in gallery (13, 14) will be square-cropped; focals only. |
| RSVP | **Keep `standard`**. Cheapness is hero/thank-you/PA/gallery, not the RSVP renderer. `formal-pass` + `formal-register` pairing is a residual continuity risk, not a Phase 2 variant change. **Superseded (rhythm goal):** RSVP is now `formal-register`; see `leslie-perez.scss`. |
| Interludes | **In scope.** Shared renderer (`Interlude.astro` + `_interlude.scss`); no structural variant. Theme owns `--interlude-*` (already on celestial preset). Invitation owns image, `afterSection`, `height`, focals. **Two** interludes (restraint: one or two beats, not the demo’s four). Peer structure: Abril (quote + location), Alba/Romina (location), Victoria (countdown + gifts). Leslie placement: **after `location`** and **after `gallery`**. Do not copy peer/demo photos or `demo-xv-celestial-blue.scss` per-source filters. |
| Interlude assets | **Reallocate two landscape gallery photos** so each binary keeps one visible role. Do not duplicate 01/15, do not import demo celestial stock, do not invent decorative crown/palace assets. Use `photo-04` after location and `photo-08` after gallery (horizontal editorial frames). Gallery keeps the other 11 items in source order. |
| Intersections | **Revert the staged full-chain.** Keep only two overlaps on the interlude wrappers: `interlude-after-location` ← location, `interlude-after-gallery` ← gallery. All other boundaries stay neutral. `[data-after-interlude]` padding collapse is shared layout, not a profile. |
| Thank-you overlay | **Revert** staged `overlayAnchor` / `overlaySafeArea` (copied from Renata). Photo 15 has balloons on the left and the subject centered; Renata’s left safe-area is the wrong photo. Use variant default alignment. Do not re-add overlay unless a Leslie-specific crop collision is proven after render. |
| `showFlourishes` | **Promote default `false` for `split-map`** in the location renderer/presentation default (only consumers: Alba, Leslie). Then omit the flag from Leslie. Do not edit Alba’s definition. |
| Family columns | **Invitation content:** express mother and father as two `groups` so `asymmetric-groups` fills both columns. Do not split Renata’s combined parents block in the renderer. No godparents block. |
| Leslie profile | **Do not create** `src/styles/invitation-profiles/leslie-perez.scss`. `visualProfileId: 'leslie-perez'` may remain; missing file is a no-op. **Superseded (rhythm goal):** profile exists for cadence blends and dark-surface tracking only. |
| Locked variants | Do not use `stacked-venue-plates`, `editorial-program`, `editorial-ledger`, `feature-stack` (for Leslie), `index-choreography` (for Leslie). Do not add gifts or music. |
| Quote | Keep the section only while draft copy is an accepted placeholder. Prep already allows **omitting quote** until copy is approved; a visible `[[PENDIENTE]]` is itself cheap. Do not hang an interlude off quote. |
| Placeholders | Do not invent event time, song, quote, RSVP deadline, or seal initials. |

## Staged diff classification

| File | Keep / finish | Revert |
|---|---|---|
| `src/styles/themes/presets/_celestial-blue.scss` | `--hero-split-*` and `--formal-chapter-*` chroma tokens | — |
| `src/styles/themes/sections/family/_asymmetric-groups.scss` | Semantic token wrappers (`var(--color-*)`, `--family-*-font`) | Centering / `margin-inline: auto` / header max-width widening — alignment change vs left-read peer (Victoria). Restore pre-staged alignment geometry. |
| `src/styles/themes/sections/hero/_split-cover.scss` | `.invitation-hero__title` consuming `--hero-split-title-*` | Unify title size: one clamp on the custom property. Do not leave the rule fallback (`3.2rem…5.5rem`) disagreeing with the property (`3.5rem…7.5rem`). Prefer the pre-staged `clamp(4rem, 7vw, 8rem)` unless Romina desktop proof requires otherwise. |
| `src/styles/themes/sections/thank-you/_full-bleed-photo.scss` | `--thank-you-ink/ivory/accent` aliases over semantic tokens | — |
| `scripts/provision/invitations/leslie-perez.ts` | `backgroundImageMobile` / `backgroundImageDesktop` (same photo-01); itinerary `subtitle` | Full-chain `composition.intersections`; `overlayAnchor` / `overlaySafeArea`; `presentationOptions.showFlourishes` after split-map default is false. Replace intersections with the two interlude overlaps. Add `interludes[]` and drop photo-04 / photo-08 from `gallery.items`. |

## Ownership reminder

- **Variant:** renderer, DOM, grid, order, breakpoints, required visibility, rhythm, default
  alignment. Public tokens with semantic fallbacks. No client/slug/theme-identity colors. No second
  layout keyed to a theme name.
- **Theme preset:** palette, type families, surfaces, shadows, motion, and chroma for public
  variant tokens. No section-internal selectors.
- **Theme-named section skins:** may style a section only when structural variant is `standard` or
  absent. Must not change geometry of a non-standard structural variant. Do not delete unused
  historical skins.
- **Invitation:** content, assets, variant selection, crop/focal, which photos are interludes vs
  gallery, and sparse `afterSection` placement. Existing color/font/alignment tokens only. No
  profile SCSS, `--leslie-*`, new `presentationOptions`, or decorative intersections on every
  boundary.

## Per-section contract

### Envelope — wax + `wax-monogram`

| Field | Value |
|---|---|
| Peer | abril-michelle-becerra-rea |
| Verdict | `needs-retint` |
| Ownership | Shared envelope geometry + celestial reveal skin (`_shared-light.scss`). Seal icon is content. Abril profile is color-only — do not copy. Leslie omits `sealInitials` until confirmed. |
| Phase 2 | None beyond preset atmosphere already present. |
| Acceptance | Same wax-monogram lockup as Abril; celestial chroma. One open control pattern unchanged. |
| Forbidden | Abril initials, Abril profile selectors. |

### Hero — `split-cover`

| Field | Value |
|---|---|
| Peer | romina-rios-chaparro |
| Verdict | `skin-collision` |
| Evidence | `Hero.astro` sets `data-variant='celestial-blue'` and `data-structural-variant='split-cover'`. Skin `src/styles/themes/sections/hero/_celestial-blue.scss` (full-bleed, `justify-content: flex-end`, overlay `::after`) and variant `_split-cover.scss` (lg contained photo + type plane) both apply. Bundle loads before structural CSS. Romina profile only sets `--hero-split-*` tokens (no grid). |
| Phase 2 files | `src/styles/themes/sections/hero/_celestial-blue.scss` — guard: `:not([data-structural-variant='split-cover'])`. `src/styles/themes/sections/hero/_split-cover.scss` — finish staged title token consumption; restore/unify size. Preset `--hero-split-*` keep. |
| Consumers to re-check | romina-rios-chaparro; jewelry-box portability fixture (`tests/unit/structural-variant-portability.test.ts`). |
| Acceptance | Desktop: two-plane split (contained image, type plane). Mobile: variant-owned stack. Celestial overlay/full-bleed skin must not apply. Chroma from preset `--hero-split-*`. |
| Forbidden | Romina profile type scales; `leslie` hero SCSS; new hero variant. |

### Quote — no structural variant

| Field | Value |
|---|---|
| Peer | celestial-blue tokens |
| Verdict | `encapsulated` |
| Phase 2 | None. Placeholder copy is content. |
| Acceptance | Shared quote renderer; celestial type/color tokens. |

### Family — `asymmetric-groups` + `text-only`

| Field | Value |
|---|---|
| Peer | victoria-y-roberto (finished). renata = origin evidence only; do not copy `renata.scss` grid/order (L431–538). |
| Verdict | `needs-promotion` + `needs-retint` |
| Evidence | Parents-only maps to one `#parents` block (`Family.astro` L181–189) inside a 2-col grid (`_asymmetric-groups.scss`). Victoria uses two `groups`. Celestial preset still sets paper rotate/watermark/surface (`_celestial-blue.scss` family tokens); variant resets bg/border/shadow but not those. |
| Phase 2 files | Definition: two `groups` (mother, father) from existing names/labels. `_asymmetric-groups.scss`: finish token wrap; revert centering; zero remaining warm RGB except `var(..., fallback)`; reset `--family-panel-rotate`, watermark, extra shadow, surface tokens on this structural variant. |
| Consumers | victoria-y-roberto, renata. Alignment revert exists to protect Victoria’s left-read. |
| Acceptance | Two staggered columns, text-only, no media, no godparents row. Type/color from celestial tokens. No paper tilt/watermark. |
| Forbidden | Renata profile grid; godparents placeholder; `split-groups`. |

### Countdown — shared + days-only

| Field | Value |
|---|---|
| Peer | alba-rosa-quinonez |
| Verdict | `encapsulated` |
| Ownership | `visibleUnits: ['days']` is content. Skin `countdown/_celestial-blue.scss` is valid (no structural variant). |
| Phase 2 | None. |
| Acceptance | Days unit only; celestial segment chrome. Footer may keep `[[PENDIENTE:HORA_EVENTO]]`. |

### Location — `split-map`

| Field | Value |
|---|---|
| Peer | alba-rosa-quinonez |
| Verdict | `encapsulated` |
| Evidence | `_split-map.scss` is geometry-only. Alba profile tints map chrome, not grid. Default `showFlourishes` in `EventLocation.astro` is `true`. |
| Phase 2 files | Location presentation default for `split-map` → flourishes off. Remove Leslie `presentationOptions.showFlourishes`. Do not copy Alba map tint CSS. |
| Consumers | alba-rosa-quinonez (already sets false). |
| Acceptance | Split content/map geometry; no flourish ornaments; reserved-navy indication remains content. |
| Forbidden | `stacked-venue-plates`; Alba profile map filters. |

### Itinerary — `timeline-paper`

| Field | Value |
|---|---|
| Peer | abril-michelle-becerra-rea |
| Verdict | `needs-retint` |
| Evidence | Variant owns paper DOM. Preset already sets `--itinerary-paper-*`. Abril profile tweaks monogram placement — do not copy. |
| Phase 2 | Keep itinerary subtitle (content). No Abril profile geometry. Optional: replace remaining `liquid-silver` coupling in `_timeline-paper.scss` with public tokens if it blocks celestial retint. |
| Consumers | abril, celestial demos, P0 fixtures (behavior alias). |
| Acceptance | Same `ItineraryProgram` paper rows as Abril; celestial paper tokens. Times may stay placeholders. |

### Gallery — `editorial-mosaic` (changed)

| Field | Value |
|---|---|
| Peer | romina-rios-chaparro |
| Verdict | `wrong-variant` on current `index-choreography` |
| Evidence | `_index-choreography.scss` places `data-gallery-index='0'..'9'` only; `getLayoutClass.ts` feature/wide indices `[0,5,6]` / `[2,3,7]`. Leslie items photo-02…14 = 13. Embedded ice/graphite colors in the choreography partial. `feature-stack` only styles indices 0–2. `editorial-mosaic` repeats `nth-child(3n+*)` (`_editorial-mosaic.scss` L30–39). Celestial gallery skin targets `single-keepsake` only — no collision with mosaic. |
| Phase 2 files | `leslie-perez.ts`: `gallery.variant: 'editorial-mosaic'`. Items = photo-02, 03, 05, 06, 07, 09, 10, 11, 12, 13, 14 (drop 04 and 08). Keep remaining focals. No `layoutRole`. Do not restyle mosaic grid in celestial gallery skin. |
| Consumers of mosaic | romina-rios-chaparro (must not regress). Choreography consumers stay on `index-choreography`. |
| Acceptance | `data-structural-variant='editorial-mosaic'`. Eleven gallery photos place via repeating mosaic. |
| Forbidden | New gallery variant; index 10–12 forks; copying Romina profile; `feature-stack`; keeping choreography; duplicating 04/08 in gallery and interludes. |

### Personalized access — `formal-pass`

| Field | Value |
|---|---|
| Peer | victoria-y-roberto |
| Verdict | `skin-collision` |
| Evidence | `data-variant='celestial-blue'` + `data-structural-variant='formal-pass'`. Skin `personalized-access/_celestial-blue.scss` (paper tilt, ice background, fiber) vs `_formal-pass.scss` (dark chapter band, credential card). `:where(.event-theme-wrapper)` still defaults terracotta chapter RGB; staged preset `--formal-chapter-*` retints — keep. Victoria profile does not redefine formal-pass geometry. |
| Phase 2 files | Guard celestial PA skin with `:not([data-structural-variant='formal-pass'])`. Keep preset `--formal-chapter-*`. Do not copy Renata/Victoria profile chapter tokens beyond the preset. |
| Consumers | victoria-y-roberto, renata. |
| Acceptance | Dark chapter + credential card geometry identical to Victoria; celestial chapter chroma from preset. No paper tilt. |
| Forbidden | Leslie PA SCSS; changing RSVP to `formal-register` in this goal. |

### RSVP — `standard`

| Field | Value |
|---|---|
| Peer | celestial-blue / abril |
| Verdict | `encapsulated` |
| Phase 2 | None. Residual: formal-pass chapter then celestial glass RSVP. Accepted. |
| Acceptance | Existing celestial RSVP skin. Placeholders may remain. |

### Thank you — `full-bleed-photo`

| Field | Value |
|---|---|
| Peer | renata (structure only) |
| Verdict | `skin-collision` |
| Evidence | Skin `thank-you/_celestial-blue.scss` sets root min-height, padding, ice gradients, `::before/::after` on `[data-variant='celestial-blue']`. Full-bleed uses non-editorial DOM (`ThankYou.astro`) but root/pseudo rules still apply. Renata profile L1520+ kills scrim/glass — do not copy. Overlay copy from Renata is a style leak (see closed decisions). |
| Phase 2 files | Guard celestial thank-you skin: `:not([data-structural-variant='full-bleed-photo'])`. Keep staged semantic aliases in `_full-bleed-photo.scss`. Revert overlay fields on Leslie. Photo-15 + existing focals stay. |
| Consumers | renata; fixture cesar-ramses if still on this variant. |
| Acceptance | Full-bleed photo + variant overlay chrome; celestial ink/ivory/accent tokens. No celestial editorial circle/ice root. Overlay uses variant default, not Renata numbers. |
| Forbidden | `renata.scss` thank-you overrides; Leslie thank-you profile. |

### Interludes — shared renderer (added)

| Field | Value |
|---|---|
| Peer | Structure: Abril (2 beats, overlap on interludes). Skin tokens: celestial preset (already has `--interlude-*`). Do not copy Abril crown/palace assets or `demo-xv-celestial-blue.scss` per-`data-intersection-source` filters. |
| Verdict | `needs-promotion` (content/composition missing), not a new variant |
| Evidence | `interludes.schema.ts`: `afterSection`, image, `height` (`screen` / `tall` / `medium`), focals, optional `overlayOpacity`. Renderer is shared; `variant` is a theme-preset skin, not a structural variant. No `themes/sections/interlude/` partial. Peers: Abril 2, Alba 1, Romina 1, Victoria 2, Renata 3, Daniela 2, celestial demo 4. Leslie prep omitted them because no leftover people-photos; uniqueness still holds if gallery items are reassigned, not copied. Landscape sources 04 and 08 are a poor fit for square mosaic and a good fit for `object-fit: cover` interludes. |
| Phase 2 files | `leslie-perez.ts`: `interludes` + two overlap intersections; drop those keys from gallery. `docs/invitations/leslie-perez.md` uniqueness/section table (design-direction correction only). Preset `--interlude-*` already exist — retint only if celestial overlay is wrong; do not add profile rules or `--interlude-min-height-1`. Height: `tall`. |
| Acceptance | Two full-bleed pauses: after location, after gallery. One photo each, unique roles. Overlap only on those two wrappers. Celestial interlude tokens, not Victoria/Alba/demo profile CSS. |
| Forbidden | Demo/peer image imports; duplicating hero/thank-you; four demo-like interludes; per-index profile filters; hanging an interlude off the draft quote. |

### Gifts / music

Omitted. Client did not request gifts; song is still `[[PENDIENTE:CANCION]]`. Do not add.

### Other surfaces this audit originally skipped

| Surface | Verdict | Phase 2 |
|---|---|---|
| Header | Celestial header skin exists (`header/_celestial-blue.scss`). No structural variant. | No Leslie override. Confirm it does not restyle `split-cover` internals (it should not). |
| Footer | No celestial footer partial; shared footer + preset. | None. |
| Quote | Draft placeholder. Prep allows omit until copy exists. | Do not style around the placeholder. Omit the section if owner agrees the pending text is cheaper than absence. Not required to omit in Phase 2 unless owner confirms. |
| PA without guest | Public render omits formal-pass until guest context. Narrative becomes gallery → interlude → RSVP. | The after-gallery interlude is the pacing for that gap. Do not fake a guest in preview. |
| Envelope | Already contracted. | Unchanged. |
| OG / sharing | Not a visible invitation section. | Out of scope. |
| Motion | Interlude ambient pan is shared `_interlude.scss`. | Do not copy profile motion exceptions from the celestial demo. |

## Phase 2 file list (closed)

**May write**

- `src/styles/themes/sections/hero/_celestial-blue.scss` (guard only)
- `src/styles/themes/sections/hero/_split-cover.scss` (finish tokens; unify size)
- `src/styles/themes/sections/thank-you/_celestial-blue.scss` (guard only)
- `src/styles/themes/sections/thank-you/_full-bleed-photo.scss` (keep aliases)
- `src/styles/themes/sections/personalized-access/_celestial-blue.scss` (guard only)
- `src/styles/themes/sections/family/_asymmetric-groups.scss` (tokens + panel reset; revert centering)
- `src/styles/themes/presets/_celestial-blue.scss` (keep staged public tokens; interlude tokens already present)
- `src/components/invitation/EventLocation.astro` and/or `src/lib/invitation/location-presentation.ts` (split-map flourish default)
- `scripts/provision/invitations/leslie-perez.ts` (gallery mosaic + 11 items, two family groups, two interludes, two overlap intersections, revert overlay/flourishes)
- `docs/invitations/leslie-perez.md` (section/uniqueness table only — interludes in, photo-04/08 roles)
- Tests listed below if they fail because of the above

**Must not write**

- `src/styles/invitation-profiles/leslie-perez.scss`
- Peer definitions (romina, victoria, alba, abril, renata, xareni)
- New variant partials
- Historical profile catalog cleanup
- Other theme-named skins except the three guards above

## Implementation order

1. Hero skin guard + split-cover token finish
2. Thank-you skin guard + overlay revert
3. Family token finish, alignment revert, two groups in definition
4. Formal-pass skin guard
5. Gallery → `editorial-mosaic` (11 items)
6. Interludes (photo-04 after location, photo-08 after gallery) + two overlap intersections
7. Location flourish default; itinerary/quote/countdown/envelope/RSVP/header/footer only if a listed file still requires it

## Verification (Phase 2)

Commands:

- `pnpm validate:changed`
- `pnpm type-check`
- `pnpm lint:styles` if SCSS in the diff
- Tests: `tests/unit/structural-variant-portability.test.ts`, `tests/content/canonical-corpus-contracts.test.ts`, `tests/content/romina-local-invitation.test.ts`, `tests/content/victoria-y-roberto-payload.test.ts`, `tests/content/renata-payload.test.ts`, `tests/content/leslie-image-budgets.test.ts`, `tests/e2e/romina-audit.spec.ts` if hero CSS delivery changes

Grep (must be zero in variant SCSS/renderers touched): `leslie`, peer slugs as selectors, `leslie-perez.scss`.

Visual: 390×844 and 1440×900 Leslie vs peer **after** a separately authorized local apply. This Phase 1 audit did **not** render those viewports (see below).

Peer non-regression: Romina hero + mosaic, Victoria/Renata family + formal-pass, Renata thank-you, Alba location, Abril itinerary + interlude overlap pattern (tokens only).

## Validation this audit ran

- Read definitions, variant SCSS, celestial section skins, preset staged diff, CSS resolver map, Family renderer, gallery layout strategy, photo-15 composition, interlude schema/renderer/`_interlude.scss`, peer and celestial-demo interlude placement, `[data-after-interlude]` layout, celestial `--interlude-*` tokens.
- Confirmed missing `leslie-perez.scss` is a no-op (`invitation-profile-css` / resolver).
- Confirmed `/xv/leslie-perez` is not static: `resolveInvitationContent` needs DB published content.

## Validation intentionally not run

- Browser captures at 390×844 and 1440×900 for Leslie and peers. Leslie is `in_progress` and not in the local render corpus; rendering requires `invitation:release` local apply, which this goal forbids.
- `pnpm validate:changed` / `pnpm type-check` (no implementation yet).

## Unresolved uncertainty

- Exact split-cover title clamp after Romina desktop proof (unify first; adjust only if Romina regresses).
- Whether `_timeline-paper.scss` liquid-silver references are visible under celestial tokens.
- Whether owner prefers omitting the quote section until copy exists (prep already allows it).
- Whether photo-13/14 should also leave the mosaic (still landscape). Default: stay in gallery.

## Residual risks

- Formal-pass chapter then standard celestial RSVP will still change register at that boundary.
- `editorial-mosaic` forces square cells; leftover landscapes 13/14 rely on focals.
- Two family `groups` is content shaping to the variant’s two-column contract, not a profile.
- Skin guards must not starve `standard` celestial hero/PA/thank-you on demos that still use those skins.
- Public preview without a guest hides PA; the after-gallery interlude is what prevents gallery→RSVP from feeling abrupt.
- Reallocating 04/08 changes the owner photo-role table; that is a documented uniqueness update, not a second binary.

## Stop conditions

Stop and reopen Phase 1 if a section needs a new variant, a slug branch, or a Leslie profile to look correct.

## Next responsibility

Owner accepts or amends this handoff. Then Phase 2 implements only the file list and closed decisions above.
