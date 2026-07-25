# Demo Premium Quality Improvement

Updated: 2026-07-01

## Baseline

Source triage: `.agent/plans/archived/demo-counterpart-architecture.spec.md`.

Initial checks:

- `pnpm test -- tests/content/demo-counterpart-audit.test.ts` passed, 113 tests.
- In-app Browser QA on `http://localhost:4322/` showed no relevant console warnings/errors for the
  inspected demo routes.
- Astro requested port `4321`, but it was occupied; dev server ran on `4322`.

## Cycle 1

- Demo(s) worked on: `/baby-shower/demo-baby-shower-celestial`
- Score before: 6.5/10
- Issues addressed:
  - Copy still used informal `tu` phrasing in RSVP and thank-you areas.
  - Gallery captions were generic and made the three images feel like equal cards.
  - Page lacked image-led rhythm between early emotional sections.
- Files changed:
  - `src/content/event-demos/baby-shower/demo-baby-shower-celestial.json`
- Design rationale:
  - Kept the existing celestial-blue theme and demo-safe assets.
  - Reframed the gallery as three curated scenes rather than a generic detail grid.
  - Added two full-screen interludes using existing demo-safe images to give the route stronger
    editorial pauses without shared component changes.
  - Rewrote RSVP and gratitude copy in a more formal Spanish register.
- Card/grid abuse reduced: yes
- Mobile quality improved: yes
- Risks introduced:
  - Added interludes increase page length slightly.
  - Needs a human visual pass on actual photo crops after deployment preview.
- Remaining work:
  - Dedicated baby-shower-specific hero/portrait variation would further reduce repeated use of
    `hero`.

## Cycle 2

- Demo(s) worked on: `/xv/demo-xv-jewelry-box`
- Score before: 6/10
- Issues addressed:
  - Gallery had 12 equal-weight items on mobile, creating a long catalog feel.
  - Gifts section exposed four options, including PayPal/transfer fallbacks that felt like
    placeholders.
  - RSVP and location copy mixed informal phrasing with otherwise formal XV copy.
- Files changed:
  - `src/content/event-demos/xv/demo-xv-jewelry-box.json`
- Design rationale:
  - Curated the gallery from 12 images to 6 stronger editorial beats while preserving demo-safe
    media.
  - Reduced gift cards from 4 to 2 so the section reads like a premium courtesy note, not an
    operations menu.
  - Kept existing interlude structure but remapped two interludes to stronger retained images.
  - Sharpened Spanish copy toward formal guest-facing language.
- Card/grid abuse reduced: yes
- Mobile quality improved: yes
- Risks introduced:
  - Some existing E2E screenshots may change intentionally because the gallery length is much
    shorter.
  - Browser screenshots were partially affected by the envelope layer, so section-level visual
    confirmation should be repeated in Playwright reduced-motion mode or on preview.
- Remaining work:
  - Consider a small jewelry-box gallery SCSS pass to make 6-item mobile layout more editorial and
    less stacked.

## Cycle 3

- Demo(s) worked on: `/boda/demo-boda-jewelry-box-wedding`
- Score before: 6/10
- Issues addressed:
  - Wedding copy leaned on generic phrases such as "boda de ensueño" and mixed formal/informal guest
    tone.
  - Gallery, gifts, and itinerary inherited shared card styling, making the route feel like a
    sequence of similar grids rather than a premium wedding narrative.
  - RSVP and WhatsApp decline copy used casual language that clashed with the gala register.
- Files changed:
  - `src/content/event-demos/boda/demo-boda-jewelry-box-wedding.json`
  - `src/styles/invitation-sections-by-preset/jewelry-box-wedding.scss`
  - `src/styles/themes/sections/gallery/_jewelry-box.scss`
  - `src/styles/themes/sections/gifts/_elegant.scss`
  - `src/styles/themes/sections/itinerary/_jewelry-box.scss`
- Design rationale:
  - Reframed the route as a Puebla editorial wedding with formal guest-facing copy.
  - Curated gallery from 6 to 5 images and changed captions from generic keepsakes to a tighter
    visual sequence.
  - Loaded gallery, gifts, and itinerary section modules for the wedding preset, then scoped
    overrides to `jewelry-box-wedding`.
  - Changed gifts into a compact editorial list and itinerary into a lighter program treatment.
- Card/grid abuse reduced: yes
- Mobile quality improved: pending visual QA
- Risks introduced:
  - New SCSS selectors depend on the current section class names for gallery, gifts, and itinerary.
  - Wedding section styling should be verified against responsive screenshots before merging.

## Cycle 4

- Demo(s) worked on: `/xv/demo-xv-editorial-rose`
- Score before: 5.5/10
- Issues addressed:
  - `_mediaFallback` route relied on repeated full-screen decorative beats, amplifying the fallback
    feel.
  - Location, RSVP, family, gifts, and gallery copy used casual or generic language.
  - Indications and interludes were denser than needed for a fallback-media demo.
- Files changed:
  - `src/content/event-demos/xv/demo-xv-editorial-rose.json`
- Design rationale:
  - Kept the temporary asset fallback explicit in metadata but made the public copy read curated.
  - Reduced gallery from 6 to 5 images, indications from 3 to 2, and interludes from 4 to 2.
  - Rewrote RSVP and guest instructions in a formal plural register.
- Card/grid abuse reduced: yes
- Mobile quality improved: pending visual QA
- Risks introduced:
  - Dedicated editorial-rose media is still required before this route can be considered final for
    premium production sales.

## Cycle 5

- Demo(s) worked on: `/xv/demo-xv-enchanted-rose`
- Score before: 5/10
- Issues addressed:
  - This was the highest-ranked remaining density/fallback risk after cycle 4 selection.
  - Gallery title had a persona mismatch: "Instantes de Ayrin" on an Isabella Rose demo.
  - Gallery, gifts, itinerary, and RSVP copy made the route feel like a variant stuffed with extra
    cards.
- Files changed:
  - `src/content/event-demos/xv/demo-xv-enchanted-rose.json`
- Design rationale:
  - Corrected the identity mismatch and tightened the palace/gala register.
  - Reduced gallery from 8 to 5 images, gifts from 2 to 1, and itinerary from 5 to 4 moments.
  - Replaced bank-transfer demo data with a softer envelope option to lower operational clutter.
- Card/grid abuse reduced: yes
- Mobile quality improved: pending visual QA
- Risks introduced:
  - Dedicated enchanted-rose media is still required before this route can be considered final for
    premium production sales.

## Global Card/Grid Sweep

Post-cycle sweep scoring formula: `gallery + gifts*2 + itinerary + indications + fallback*8`.

| Rank | Route                                                 | Preset              | Fallback | Gallery | Gifts | Itinerary | Indications | Interludes | Score | Notes                                                                                  |
| ---- | ----------------------------------------------------- | ------------------- | -------- | ------: | ----: | --------: | ----------: | ---------: | ----: | -------------------------------------------------------------------------------------- |
| 1    | `/xv/demo-xv-editorial-rose`                          | editorial-rose      | yes      |       5 |     2 |         3 |           2 |          2 |    22 | Still ranks high because fallback carries an 8-point penalty. Raw density was reduced. |
| 2    | `/xv/demo-xv-editorial`                               | editorial           | no       |       8 |     3 |         6 |           2 |          7 |    22 | Strong next density target; not part of required cycles.                               |
| 3    | `/xv/demo-xv-celestial-blue`                          | celestial-blue      | no       |      10 |     2 |         5 |           2 |          4 |    21 | Strong next gallery-rhythm target.                                                     |
| 4    | `/xv/demo-xv-enchanted-rose`                          | enchanted-rose      | yes      |       5 |     1 |         4 |           2 |          2 |    21 | Raw density reduced; still penalized for fallback media.                               |
| 5    | `/xv/demo-xv-editorial-magazine`                      | editorial-magazine  | yes      |       5 |     2 |         0 |           3 |          3 |    20 | Fallback route remains a later media-risk pass.                                        |
| 6    | `/cumple/demo-cumple-luxury-hacienda`                 | luxury-hacienda     | no       |       6 |     3 |         4 |           2 |          2 |    18 | Gift-card density is the main issue.                                                   |
| 7    | `/xv/demo-xv-jewelry-box`                             | jewelry-box         | no       |       6 |     2 |         6 |           2 |          4 |    18 | Improved in cycle 2; itinerary remains longer by design.                               |
| 8    | `/xv/demo-xv-xareni-profile`                          | celestial-blue      | no       |       6 |     2 |         5 |           2 |          4 |    17 | Profile route could use a future rhythm pass.                                          |
| 9    | `/boda/demo-boda-jewelry-box-wedding`                 | jewelry-box-wedding | no       |       5 |     2 |         5 |           2 |          2 |    16 | Improved in cycle 3; style pass should reduce perceived density.                       |
| 10   | `/bautizo/demo-bautismo-angelic-presence`             | angelic-presence    | no       |       5 |     1 |         4 |           2 |          2 |    13 | Moderate density.                                                                      |
| 11   | `/xv/demo-xv-valentina-profile`                       | editorial-magazine  | no       |       5 |     2 |         0 |           3 |          3 |    12 | Indication/interlude density only.                                                     |
| 12   | `/baby-shower/demo-baby-shower-celestial`             | celestial-blue      | no       |       3 |     1 |         4 |           2 |          2 |    11 | Improved in cycle 1.                                                                   |
| 13   | `/primera-comunion/demo-primera-comunion-illustrated` | angelic-presence    | no       |       2 |     1 |         3 |           2 |          2 |     9 | Lowest density.                                                                        |

Recommended next pass after this loop: `/xv/demo-xv-editorial` or `/xv/demo-xv-celestial-blue`,
depending on whether the priority is card density or gallery rhythm.

## Visual QA

Completed on local Astro dev server `http://localhost:4322/` with Chrome/Playwright:

- `/baby-shower/demo-baby-shower-celestial` at 390, 768, 1280: 200 responses, no relevant console
  errors.
- `/xv/demo-xv-jewelry-box` at 390, 768, 1280: 200 responses, no relevant console errors.
- `/boda/demo-boda-jewelry-box-wedding` at 390, 768, 1280: 200 responses, no relevant console
  errors.
- `/xv/demo-xv-editorial-rose` at 390, 768, 1280: 200 responses, no relevant console errors.
- `/xv/demo-xv-enchanted-rose` at 390, 768, 1280: 200 responses, no relevant console errors.

Notes:

- Used `?skipEnvelope=true` for final page QA so the envelope overlay did not obscure section
  screenshots.
- Targeted wedding gallery/gifts/itinerary screenshots caught and fixed a mobile gift-card overflow
  regression.
- Wedding gallery was remapped away from repeated ring crops to existing varied demo-safe assets:
  `jardin`, `family`, `gallery01`, `signature`, `portrait`.
- The final smoke sweep still reports existing decorative/off-canvas elements such as mobile nav,
  itinerary line decorations, oversized hero imagery, and full-bleed interludes; no new text/card
  clipping remained after the gifts fix.

## Validation

Completed:

- JSON parse check for all five changed demo files: passed.
- `pnpm test -- tests/content/demo-counterpart-audit.test.ts`: passed, 113 tests.
- `pnpm test -- tests/unit/event.adapter.test.ts tests/unit/invitation.presenter.test.ts tests/unit/validate-schema-script.test.ts`:
  passed after updating expectations for intentional content/CSS changes.
- `pnpm lint`: passed with 0 errors and 1 pre-existing warning in `tests/e2e/debug-styles.spec.ts`.
- `pnpm type-check`: passed, 0 errors/warnings/hints.
- `pnpm test`: passed, 225 suites passed, 1 skipped; 3023 tests passed, 2 skipped.
- `pnpm build`: passed.
- `pnpm agent:git-safety:check`: passed; HEAD and staged state unchanged.
- `pnpm agent:git-safety:end`: passed; baseline removed.

## Asset Safety

- No real client photo directories were introduced or referenced.
- All changed media references point to existing demo asset keys.
- No production invitation data, RSVP routes, tracking, or lead-routing code was modified.

## Paco Manual Review

- Review `/baby-shower/demo-baby-shower-celestial` on mobile for interlude crop quality.
- Review `/xv/demo-xv-jewelry-box` on mobile to confirm the 6-image gallery still shows enough
  variety.
- Review `/boda/demo-boda-jewelry-box-wedding` for the new wedding-specific section styling.
- Confirm the more formal RSVP wording is acceptable for demo marketing across boda and XV routes.
- Decide whether to produce dedicated media for `demo-xv-editorial-rose` and
  `demo-xv-enchanted-rose` before exposing those routes as premium sale-ready demos.

## Recommended Next Cycle

Target `/xv/demo-xv-editorial` next if reducing card/grid abuse remains the priority. Target
`/xv/demo-xv-celestial-blue` next if the priority is mobile gallery rhythm.
