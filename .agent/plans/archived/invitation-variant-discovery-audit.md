---
title: Invitation-Specific Variation Discovery Audit
status: final
created: 2026-08-10
updated: 2026-08-10
type: diagnostic
autonomy: 0
related_docs:
  - docs/domains/theme/variant-system.md
  - docs/domains/theme/gallery-variants.md
supersedes: []
superseded_by: []
---

# Invitation-Specific Variation Discovery Audit (Goal A)

**Date:** 2026-08-10 **Project:** Celebra-me **Status:** READ-ONLY DIAGNOSTIC — no runtime, schema,
style, content, test, docs-of-record, or config mutations **Scope evidence:** Local managed
registry + local render corpus. Preview/Production were **not** probed.

---

## 1. Executive summary

Goal A audited invitation-owned section customizations across managed invitations, active legacy
clients, and representative demos to separate:

1. patterns already covered by the canonical variant catalog,
2. latent reusable structural variants,
3. presentation options, skins, documented exceptions, and accidental divergences.

### Verdict for Goal B

**Three consolidated candidate structural variants:**

| Section  | Proposed id    | Origins                              |
| -------- | -------------- | ------------------------------------ |
| Hero     | `split-cover`  | Romina Ríos                          |
| Family   | `split-groups` | Daniela y Martín; Victoria y Roberto |
| Location | `split-map`    | Alba Rosa                            |

Everything else either maps to an existing canonical variant, is absorbable into
skins/tokens/presentation options, is a documented exception, or is accidental legacy drift that
must not be promoted.

### Inventory counts (matrix rows)

| Classification                               | Count (approx.)                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Candidate structural variant                 | 4 rows → 3 groups                                                                            |
| Existing canonical variant                   | majority of demos + several clients                                                          |
| Existing variant with absorbable differences | Hero/gallery/itinerary/closing skins                                                         |
| Presentation option                          | countdown units, gifts legend-only, map preview, after-RSVP, mobile rail                     |
| Skin / visual customization                  | tokens, motion, map materiality, PA frames                                                   |
| Documented exception                         | Abril gallery storyboard; wedding nth-child; Alba photo-caption Family                       |
| Legacy / accidental divergence               | Daniela single portrait as uniform-grid; Alba dead Thank You CSS; Luna empty portrait column |

---

## 2. Scope and method

### 2.1 Managed invitations (local registry)

| Slug                         | Lifecycle   | Role in audit                                  |
| ---------------------------- | ----------- | ---------------------------------------------- |
| `alba-rosa-quinonez`         | published   | Location candidate; several options/exceptions |
| `abril-michelle-becerra-rea` | published   | Gallery documented exception                   |
| `romina-rios-chaparro`       | published   | Hero `split-cover` candidate                   |
| `daniela-y-martin`           | in_progress | Family `split-groups` candidate                |
| `victoria-y-roberto`         | in_progress | Family `split-groups` co-origin                |

All five verified as MANAGED in the local inventory. Preview/Production not verified.

### 2.2 Active legacy clients (10)

`america-johana`, `valentina-hernandez`, `xareni-iyarit`, `leah-lexa`, `luna-y-estrella`,
`cesar-ramses`, `ayrin-samantha-lerma-castro`, `ana-sofia-cota-guillen`, `ximena-meza-trasvina`,
`gerardo-sesenta`.

### 2.3 Representative demos (structural)

Included when they exercise a distinct renderer/selector: editorial-magazine, editorial,
celestial-blue, enchanted-rose, jewelry-box, jewelry-box-wedding, baby-shower celestial, cumple
luxury-hacienda, bautismo angelic-presence.

Excluded as skin/profile redundancy: Valentina-profile, Xareni-profile, editorial-rose,
primera-comunión illustrated, and similar visual-only demos.

### 2.4 Evidence sources

- Canonical catalog: `docs/domains/theme/variant-system.md`,
  `src/lib/invitation/structural-variants.ts`
- Ownership: invitation profiles under `src/styles/invitation-profiles/`, legacy section SCSS,
  provision definitions under `scripts/provision/invitations/`, local-render fixtures
- Targeted local DOM checks (existing `localhost:4321`): Alba Thank You runtime = standard; Alba
  gifts grid hidden; Romina desktop split-cover; Victoria family split-groups + flat itinerary; Luna
  md+ empty portrait column

### 2.5 Classification rubric

| Label                                        | Meaning                                                              |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Candidate structural variant                 | Distinct dominant layout/renderer not expressible by current catalog |
| Existing canonical variant                   | Already selected by structural/presentation resolvers                |
| Existing variant with absorbable differences | Same structure; differences belong in tokens/skins/options           |
| Presentation option                          | Orthogonal visibility/media/behavior choice                          |
| Skin / visual customization                  | Color, type, motion, materiality without new structure               |
| Documented exception                         | Intentionally invitation-specific; do not promote yet                |
| Legacy / accidental divergence               | Drift, dead CSS, or wrong selector; do not promote                   |

Goal A allows single-invitation origins for candidates when the structure is reusable in principle.

---

## 3. Variant Discovery Matrix

Columns: Invitation/Demo · Section · Observed customization · Current owner · Existing canonical
variant · Classification · Consolidation group · Recommended action · Evidence.

### 3.1 Managed invitations

| Invitation         | Section             | Observed customization                                                                     | Current owner                                                 | Existing canonical                 | Classification                               | Group                     | Recommended action                                                                     | Evidence                                                                                                                                                                |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------------------------- | -------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abril Michelle     | Hero                | Open photo cover; copy centered on mobile, left-shifted on desktop                         | Profile SCSS on Hero standard                                 | Hero `standard`                    | Existing variant with absorbable differences | Standard open-photo cover | Keep `standard`; move alignment/offsets to tokens/options                              | `src/styles/invitation-profiles/abril-michelle-becerra-rea.scss:345`                                                                                                    |
| Abril Michelle     | Itinerary           | Paper panel with sequential rows                                                           | `itinerary.presentation.behavior`                             | `timeline-paper`                   | Existing canonical variant                   | Row program               | No catalog action                                                                      | `scripts/provision/invitations/abril-michelle-becerra-rea.ts:313`                                                                                                       |
| Abril Michelle     | Gallery             | Portrait pair → full-width feature → portrait pair                                         | Profile SCSS on `uniform-grid` + `layoutRole=feature`         | `uniform-grid` (extended)          | Documented exception                         | Abril storyboard          | Keep exception; do not promote without more portability evidence                       | `src/styles/invitation-profiles/abril-michelle-becerra-rea.scss:1085`; `docs/domains/theme/variant-system.md:108`                                                       |
| Abril Michelle     | Intersections       | Asymmetric Gallery→RSVP arch and photo overlaps                                            | `intersection-profiles` + profile SCSS                        | arch / overlap / atmospheric-blend | Skin / visual customization                  | Section seams             | Keep as inter-section composition, outside variant catalog                             | `src/lib/invitation/intersection-profiles.ts:19`; `src/styles/invitation-profiles/abril-michelle-becerra-rea.scss:1039`                                                 |
| Alba Rosa          | Hero                | Lockup 70/AÑOS; time and venue omitted from Hero                                           | Hero `standard` + profile SCSS                                | Hero `standard`                    | Presentation option                          | Hero metadata visibility  | Model metadata visibility if reused; no new renderer                                   | `src/styles/invitation-profiles/alba-rosa-quinonez.scss:865`                                                                                                            |
| Alba Rosa          | Countdown           | Days only; hides hours/minutes/seconds/labels                                              | Profile SCSS                                                  | Countdown shared                   | Presentation option                          | Countdown unit selection  | Propose visible-units option, not structural variant                                   | `src/styles/invitation-profiles/alba-rosa-quinonez.scss:1045`                                                                                                           |
| Alba Rosa          | Location            | Typographic record without card; content left, map+nav right                               | Profile SCSS on EventLocation/VenueCard                       | `with-map`                         | **Candidate structural variant**             | Location / `split-map`    | Extract `split-map`; separate surface/map tokens                                       | `src/styles/invitation-profiles/alba-rosa-quinonez.scss:1207`; `src/lib/invitation/presentation-options.ts:67`                                                          |
| Alba Rosa          | Gallery             | Tall feature left + two stacked supports right                                             | Profile SCSS + feature/standard/wide roles                    | `feature-mosaic`                   | Existing variant with absorbable differences | Feature mosaic            | Consolidate into `feature-mosaic`; absorb proportions/crops as tokens/roles            | `src/styles/invitation-profiles/alba-rosa-quinonez.scss:1711`; `src/styles/themes/sections/gallery/_luxury-hacienda.scss:152`                                           |
| Alba Rosa          | Gifts               | Title/legend only; gift grid fully hidden                                                  | Profile SCSS; content keeps cash stub                         | Gifts `standard`                   | Presentation option                          | Gifts / legend-only       | Model `legend-only`; remove synthetic item dependency in Goal B                        | `src/styles/invitation-profiles/alba-rosa-quinonez.scss:1832`; `scripts/provision/invitations/alba-rosa-quinonez.ts:268`                                                |
| Alba Rosa          | Family              | Arched photo + message as caption; lists/groups hidden                                     | Profile SCSS on `family.presentation=with-photo`              | Family shared / `with-photo`       | Documented exception                         | Alba photo-caption        | Register exception; do not promote (discards Family semantics)                         | `src/styles/invitation-profiles/alba-rosa-quinonez.scss:2106`; `scripts/provision/invitations/alba-rosa-quinonez.ts:310`                                                |
| Alba Rosa          | Thank You           | Runtime markup is `standard`; profile editorial block never matches `.thank-you-editorial` | Content `structuralVariant=standard` + residual editorial CSS | `standard`                         | Legacy / accidental divergence               | Dead editorial override   | Do not invent a variant; Goal B decides dead-CSS removal vs existing variant selection | `scripts/provision/invitations/alba-rosa-quinonez.ts:157`; `src/styles/invitation-profiles/alba-rosa-quinonez.scss:2248`; `src/components/invitation/ThankYou.astro:38` |
| Romina Ríos        | Hero                | Desktop splits viewport: contained photo right + independent type plane left               | Profile SCSS on Hero `standard`                               | `standard` / `editorial-cover`     | **Candidate structural variant**             | Hero / `split-cover`      | Extract `split-cover`; keep alignment/proportions/overlay as tokens                    | `src/styles/invitation-profiles/romina-rios-chaparro.scss:326`; `src/components/invitation/EditorialMagazineHero.astro:104`                                             |
| Romina Ríos        | Location            | Rustic map by slug + reinforced touch controls                                             | GoogleMap slug branch + profile SCSS                          | `with-map`                         | Skin / visual customization                  | Map skin                  | Keep as skin; retire slug branching only in later cleanup                              | `src/components/common/GoogleMap.astro:23`; `src/styles/invitation-profiles/romina-rios-chaparro.scss:281`                                                              |
| Daniela y Martín   | Hero                | Full-bleed with left column and compact metadata                                           | Profile SCSS on Hero `standard`                               | Hero `standard`                    | Existing variant with absorbable differences | Standard open-photo cover | Absorb axis, width, overlay into tokens/options                                        | `src/styles/invitation-profiles/daniela-y-martin.scss:233`                                                                                                              |
| Daniela y Martín   | Location            | Two equivalent chapters with SVG map preview + action footer                               | Profile SCSS on VenueCard                                     | Location shared / `with-map`       | Presentation option                          | Map preview renderer      | Model map-preview type; no new section layout                                          | `src/styles/invitation-profiles/daniela-y-martin.scss:780`                                                                                                              |
| Daniela y Martín   | Family              | Two mirrored family groups with central divider; stacks on mobile                          | Profile SCSS + `family.groups[]`                              | Family shared / `text-only`        | **Candidate structural variant**             | Family / `split-groups`   | Extract `split-groups` with optional spanning block                                    | `src/styles/invitation-profiles/daniela-y-martin.scss:1996`; `scripts/provision/invitations/daniela-y-martin.ts:244`                                                    |
| Daniela y Martín   | Gallery             | Single centered 2:3 portrait implemented as `uniform-grid` + local flex                    | Content + profile SCSS                                        | `single-keepsake`                  | Legacy / accidental divergence               | Single portrait           | Use `single-keepsake` + appropriate skin; no new variant                               | `scripts/provision/invitations/daniela-y-martin.ts:264`; `src/styles/invitation-profiles/daniela-y-martin.scss:1054`                                                    |
| Daniela y Martín   | Gifts               | Vertical cards in 1→2 column grid                                                          | Profile SCSS on Gifts `standard`                              | `standard`                         | Existing variant with absorbable differences | Gifts standard            | Keep `standard`; absorb visual proportions                                             | `src/styles/invitation-profiles/daniela-y-martin.scss:2503`                                                                                                             |
| Victoria y Roberto | Hero                | Open composition centered/shifted on photo, no card                                        | Profile SCSS on Hero `standard`                               | `standard`                         | Existing variant with absorbable differences | Standard open-photo cover | Keep `standard`; convert offsets/widths to tokens                                      | `src/styles/invitation-profiles/victoria-y-roberto.scss:326`                                                                                                            |
| Victoria y Roberto | Itinerary           | Flat hour\|event ledger; line and icons hidden                                             | Profile SCSS on TimelineList                                  | `timeline-paper`                   | Existing variant with absorbable differences | Row program               | Consolidate with `timeline-paper` row renderer; materiality as skin                    | `src/styles/invitation-profiles/victoria-y-roberto.scss:623`; `src/components/invitation/ItineraryProgram.astro:20`                                                     |
| Victoria y Roberto | Family              | Two parent columns + full-width padrinos block                                             | Profile SCSS + `family.groups[]`                              | Family shared / `text-only`        | **Candidate structural variant**             | Family / `split-groups`   | Same candidate as Daniela; do not duplicate                                            | `src/styles/invitation-profiles/victoria-y-roberto.scss:700`                                                                                                            |
| Victoria y Roberto | Gallery             | Single portrait with vertical label on desktop                                             | `gallery.variant` + shared Gallery CSS                        | `single-keepsake`                  | Existing canonical variant                   | Single keepsake           | No catalog action                                                                      | `scripts/provision/invitations/victoria-y-roberto.ts:308`; `src/styles/invitation/_gallery.scss:174`                                                                    |
| Victoria y Roberto | Personalized Access | Guest/quota in two columns, no ornaments/seal                                              | Profile SCSS on `ornamented`                                  | `standard` / `ornamented`          | Existing variant with absorbable differences | Access card skin          | Resolve with existing variant + skin; no new renderer                                  | `src/styles/invitation-profiles/victoria-y-roberto.scss:817`                                                                                                            |
| Victoria y Roberto | Thank You           | Desktop composes photo, message, signature, footer in grid                                 | Profile SCSS on `standard`                                    | `editorial-back-cover`             | Existing variant with absorbable differences | Editorial closing         | Compare migration to `editorial-back-cover`; no new variant                            | `src/styles/invitation-profiles/victoria-y-roberto.scss:997`                                                                                                            |

### 3.2 Active legacy clients

| Invitation                                                 | Section                           | Observed customization                                                              | Current owner                                         | Existing canonical                                                                       | Classification                               | Group                     | Recommended action                                                                               | Evidence                                                                                                                                   |
| ---------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| América Johana                                             | Hero                              | Bottom content on mobile; left-aligned on desktop                                   | Profile SCSS on celestial standard                    | Hero `standard`                                                                          | Existing variant with absorbable differences | Standard open-photo cover | Absorb alignment and scroll/divider visibility as options                                        | `src/styles/themes/sections/_xv-america-johana.scss:256`                                                                                   |
| América Johana                                             | Personalized Access               | Circular quota frame; renderer/hierarchy unchanged                                  | Profile SCSS tokens/selectors                         | `ornamented`                                                                             | Skin / visual customization                  | Access card skin          | Keep as skin                                                                                     | `src/styles/themes/sections/_xv-america-johana.scss:91`                                                                                    |
| Valentina Hernández                                        | Envelope / Hero                   | Editorial reveal + Hero with folio, portrait, deck, credits                         | `revealVariant` + editorial-magazine fallback         | `editorial-cover`                                                                        | Existing canonical variant                   | Editorial cover           | No catalog action                                                                                | `scripts/provision/local-render-corpus/fixtures/valentina-hernandez.json:149`; `src/components/invitation/EditorialMagazineHero.astro:104` |
| Valentina Hernández                                        | Gallery                           | Magazine spread on desktop; horizontal scroll-snap rail on mobile                   | Profile SCSS on `magazine-spread`                     | `magazine-spread`                                                                        | Presentation option                          | Gallery / mobile-rail     | Keep magazine-spread layout; model mobile-rail as orthogonal presentation                        | `src/styles/themes/sections/_xv-valentina-hernandez.scss:309`                                                                              |
| Valentina Hernández                                        | Itinerary                         | Numbered editorial list without icons/line                                          | Profile SCSS on TimelineList                          | `timeline-paper`                                                                         | Existing variant with absorbable differences | Row program               | Consolidate with `timeline-paper`; numbers/materiality as skin                                   | `src/styles/themes/sections/_xv-valentina-hernandez.scss:877`                                                                              |
| Valentina Hernández                                        | Family / Location                 | Editorial hierarchy and custom grids without new contracts/renderers                | Editorial profile SCSS                                | Shared Family / Location                                                                 | Existing variant with absorbable differences | Editorial section skins   | Absorb into skins/tokens; apply Family/Location candidates only where dominant structure matches | `src/styles/themes/sections/_xv-valentina-hernandez.scss:728`                                                                              |
| Valentina Hernández                                        | Gifts / RSVP / Access / Thank You | Editorial catalog, press-pass, editorial-pass, back-cover stack                     | editorial-magazine fallbacks + profile                | `editorial-catalog` / `editorial-press-pass` / `editorial-pass` / `editorial-back-cover` | Existing canonical variant                   | Editorial stack           | No catalog action                                                                                | `src/lib/invitation/structural-variants.ts:52`                                                                                             |
| Xareni Iyarit                                              | Family                            | Hides media even when asset exists                                                  | `family.presentation=text-only`                       | `text-only`                                                                              | Presentation option                          | Family media              | No new variant                                                                                   | `scripts/provision/local-render-corpus/fixtures/xareni-iyarit.json:87`                                                                     |
| Xareni Iyarit                                              | Location                          | Prioritizes map via `presentation=with-map`                                         | Location presentation resolver                        | `with-map`                                                                               | Presentation option                          | Location media            | No new variant                                                                                   | `scripts/provision/local-render-corpus/fixtures/xareni-iyarit.json:203`                                                                    |
| Xareni Iyarit                                              | All sections / Envelope           | Mauve/champagne remap and seal color; structure unchanged                           | Token profile + `sealColor` resolver                  | celestial-blue skins                                                                     | Skin / visual customization                  | Theme skin                | Keep as skin                                                                                     | `src/styles/themes/sections/_xv-xareni-iyarit.scss:1`; `src/lib/invitation/presentation-options.ts:40`                                     |
| Leah Lexa                                                  | Gallery                           | Single pet-keepsake image                                                           | Legacy alias `single` + `gallery.presentation`        | `single-keepsake` + `pet-keepsake`                                                       | Existing canonical variant                   | Single keepsake           | Normalize alias in future migration; no new variant                                              | `scripts/provision/local-render-corpus/fixtures/leah-lexa.json:77`                                                                         |
| Leah Lexa                                                  | Location                          | Reduced map and editorial notes without card chrome                                 | Profile SCSS                                          | `with-map`                                                                               | Skin / visual customization                  | Location media skin       | Keep as skin; map size may be a token                                                            | `src/styles/themes/sections/location/_leah-lexa.scss:8`                                                                                    |
| Leah Lexa                                                  | Thank You                         | Contained card in two-column grid                                                   | Profile SCSS                                          | `editorial-back-cover`                                                                   | Existing variant with absorbable differences | Editorial closing         | Consolidate with back-cover + contained skin                                                     | `src/styles/themes/sections/thank-you/_leah-lexa.scss:15`                                                                                  |
| Luna y Estrella                                            | Hero                              | md+ grid reserves portrait column but runtime never renders portrait → empty column | Profile SCSS incompatible with published content      | Hero `standard`                                                                          | Legacy / accidental divergence               | Empty portrait column     | Do not promote; fix profile/content compatibility in Goal B or cleanup                           | `src/styles/themes/sections/_luna-y-estrella.scss:25`; `scripts/provision/local-render-corpus/fixtures/luna-y-estrella.json:14`            |
| Luna y Estrella                                            | Location / RSVP                   | Location removed from public plan; revealed inside RSVP after confirmation          | `location.visibility` + location-policy compatibility | `after-rsvp`                                                                             | Presentation option                          | Location access behavior  | Keep as access policy, outside structural catalog                                                | `src/lib/invitation/location-policy.ts:65`                                                                                                 |
| César Ramses                                               | Thank You                         | Full-bleed photographic close with subject-aware overlay                            | sacred-keepsake fallback + overlay fields             | `full-bleed-photo`                                                                       | Existing canonical variant                   | Full-bleed closing        | No catalog action                                                                                | `src/lib/invitation/structural-variants.ts:52`                                                                                             |
| Ayrin Samantha                                             | Gallery / Thank You               | Feature mosaic and back-cover via enchanted-rose                                    | Canonical preset fallbacks                            | `feature-mosaic` / `editorial-back-cover`                                                | Existing canonical variant                   | Enchanted stack           | No catalog action                                                                                | `src/lib/invitation/structural-variants.ts:52`                                                                                             |
| Ana Sofía                                                  | Gallery / Itinerary               | Index choreography and timeline-paper via celestial-blue compatibility              | Canonical resolvers / legacy alias                    | `index-choreography` / `timeline-paper`                                                  | Existing canonical variant                   | Celestial stack           | Normalize alias in future migration; no new variant                                              | `src/lib/invitation/structural-variants.ts:104`                                                                                            |
| Ximena Meza                                                | Gallery                           | Editorial mosaic via premiere-floral                                                | Canonical preset fallback                             | `editorial-mosaic`                                                                       | Existing canonical variant                   | Editorial mosaic          | No catalog action                                                                                | `src/lib/invitation/structural-variants.ts:119`                                                                                            |
| Gerardo Sesenta                                            | Gallery                           | Feature mosaic via luxury-hacienda; rest is content omission/order                  | Canonical preset fallback                             | `feature-mosaic`                                                                         | Existing canonical variant                   | Feature mosaic            | No catalog action                                                                                | `src/lib/invitation/structural-variants.ts:116`                                                                                            |
| Legacy without profile: César, Ayrin, Ana, Ximena, Gerardo | Remaining rendered sections       | No slug SCSS/wrapper/renderer branch; variation from content + shared preset        | Canonical bundle + generic adapters                   | Shared implementations                                                                   | Existing canonical variant                   | No invitation owner       | Do not invent variants from copy, order, assets, or omissions                                    | `src/lib/invitation/section-css-resolver-map.ts:194`                                                                                       |

### 3.3 Representative demos

| Invitation/Demo                | Section                           | Observed customization                                                                                   | Current owner                               | Existing canonical                        | Classification              | Group              | Recommended action                                                 | Evidence                                                                                                                      |
| ------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------- | --------------------------- | ------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Demo editorial-magazine        | Hero                              | Editorial cover with folio/portrait/deck/credits                                                         | `hero.structuralVariant`                    | `editorial-cover`                         | Existing canonical variant  | Editorial cover    | Canonical representative                                           | `src/content/event-demos/xv/demo-xv-editorial-magazine.json:38`                                                               |
| Demo editorial-magazine        | Gallery                           | Editorial spread with LOOK labels and 12-col grid                                                        | `gallery.variant`                           | `magazine-spread`                         | Existing canonical variant  | Magazine spread    | Canonical representative                                           | `src/content/event-demos/xv/demo-xv-editorial-magazine.json:134`                                                              |
| Demo editorial-magazine        | Gifts / RSVP / Access / Thank You | Catalog, press-pass, editorial-pass, back-cover                                                          | Explicit structural selectors               | Canonical editorial stack                 | Existing canonical variant  | Editorial stack    | Canonical representative                                           | `src/content/event-demos/xv/demo-xv-editorial-magazine.json:28`                                                               |
| Demo editorial                 | Gallery                           | Editorial mosaic without magazine stack                                                                  | `gallery.variant`                           | `editorial-mosaic`                        | Existing canonical variant  | Editorial mosaic   | Canonical representative                                           | `src/content/event-demos/xv/demo-xv-editorial.json:71`                                                                        |
| Demo celestial-blue            | Gallery                           | Index choreography; profile adds reveal sequencing only                                                  | `gallery.variant` + demo motion profile     | `index-choreography`                      | Existing canonical variant  | Index choreography | Keep motion as skin/profile                                        | `src/content/event-demos/xv/demo-xv-celestial-blue.json:90`; `src/styles/invitation-profiles/demo-xv-celestial-blue.scss:250` |
| Demo celestial-blue            | Itinerary                         | Row program on paper                                                                                     | `itinerary.presentation.behavior`           | `timeline-paper`                          | Existing canonical variant  | Row program        | Canonical representative                                           | `src/content/event-demos/xv/demo-xv-celestial-blue.json:148`                                                                  |
| Demo enchanted-rose            | Gallery / Thank You               | Feature mosaic and editorial back-cover explicit                                                         | Canonical selectors                         | `feature-mosaic` / `editorial-back-cover` | Existing canonical variant  | Enchanted stack    | Canonical representative                                           | `src/content/event-demos/xv/demo-xv-enchanted-rose.json:109`                                                                  |
| Demo jewelry-box               | Gallery / Access                  | Feature mosaic by fallback; access `standard`                                                            | Canonical preset resolvers                  | `feature-mosaic` / `standard`             | Existing canonical variant  | Jewelry baseline   | Canonical representative                                           | `src/lib/invitation/structural-variants.ts:90`                                                                                |
| Demo boda jewelry-box-wedding  | Gallery                           | nth-child storyboard kept by legacy `data-variant`; semantic resolver falls to `uniform-grid`            | Compatibility CSS                           | No proven equivalent                      | Documented exception        | Wedding storyboard | Keep compatibility until directed comparison with `feature-mosaic` | `src/styles/themes/sections/gallery/_jewelry-box.scss:60`; `docs/domains/theme/gallery-variants.md:94`                        |
| Demo baby-shower celestial     | Gallery / Location                | Index choreography by fallback; `venues[]` uses shared renderer                                          | Canonical resolvers + content shape         | `index-choreography` / shared Location    | Existing canonical variant  | Celestial baseline | Canonical representative                                           | `src/content/event-demos/baby-shower/demo-baby-shower-celestial.json:17`                                                      |
| Demo cumple luxury-hacienda    | Gallery / Family                  | Feature mosaic; Family consumes spouse/children via shared renderer                                      | Canonical fallback + shared Family contract | `feature-mosaic` / Family shared          | Existing canonical variant  | Hacienda baseline  | Canonical representative                                           | `src/content/event-demos/cumple/demo-cumple-luxury-hacienda.json:98`                                                          |
| Demo bautismo angelic-presence | Gallery                           | Regular grid without extra thematic layout                                                               | Canonical default                           | `uniform-grid`                            | Existing canonical variant  | Uniform grid       | Canonical representative                                           | `src/lib/invitation/structural-variants.ts:122`                                                                               |
| Profile/skin-redundant demos   | All                               | Valentina-profile, Xareni-profile, editorial-rose, primera-comunión illustrated add no distinct renderer | `visualProfileId` / theme / assets          | Representative demos above                | Skin / visual customization | Excluded demos     | Exclude from candidates; keep as visual/skin evidence              | `src/content/event-demos`                                                                                                     |

---

## 4. Inventory A — Confirmed canonical variants

| Section             | Confirmed variants                                                                                               | Representative evidence                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Hero                | `standard`; `editorial-cover`                                                                                    | Managed open covers; Valentina; demo editorial-magazine    |
| Thank You           | `standard`; `editorial-back-cover`; `full-bleed-photo`                                                           | Managed standard closings; editorial stack; César Ramses   |
| Gifts               | `standard`; `editorial-catalog`                                                                                  | Managed + editorial-magazine                               |
| RSVP                | `standard`; `editorial-press-pass`                                                                               | Managed + editorial-magazine                               |
| Personalized Access | `standard`; `ornamented`; `editorial-pass`                                                                       | Jewelry, managed ornamented, editorial                     |
| Gallery             | `uniform-grid`; `editorial-mosaic`; `magazine-spread`; `feature-mosaic`; `index-choreography`; `single-keepsake` | Representative demos + Victoria/Leah                       |
| Itinerary           | `standard`; `timeline-paper`                                                                                     | Managed/demos; ledger profiles consolidate into paper rows |
| Envelope seal       | `wax-organic`; `wax-medallion`; `monogram`; `vector-icon`; `raster`                                              | Real content and demos                                     |

---

## 5. Inventory B — Candidate structural variants

Consolidated from matrix rows. Single-invitation origin is allowed when the structure is reusable
beyond copy/skin.

### 5.1 Hero — `split-cover`

| Field                     | Value                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Section                   | Hero                                                                                                                         |
| Proposed id               | `split-cover`                                                                                                                |
| Origins                   | Romina Ríos                                                                                                                  |
| Structure                 | Independent typographic plane + contained lateral photograph; collapses to cover on mobile                                   |
| Why not current catalog   | `standard` assumes full-bleed background; `editorial-cover` adds rigid folio/deck/credits. Neither expresses a neutral split |
| Recommended Goal B action | Extract structural variant; keep alignment, proportions, and overlay as tokens/skins                                         |
| Evidence                  | `src/styles/invitation-profiles/romina-rios-chaparro.scss:326`; local DOM desktop split verified                             |

### 5.2 Family — `split-groups`

| Field                     | Value                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Section                   | Family                                                                                                                                                       |
| Proposed id               | `split-groups`                                                                                                                                               |
| Origins                   | Daniela y Martín; Victoria y Roberto                                                                                                                         |
| Structure                 | Two parallel semantic family groups with divider; optional full-width spanning block (padrinos)                                                              |
| Why not current catalog   | `text-only` only controls media presence; it does not express parallel hierarchy or spanning block                                                           |
| Recommended Goal B action | Extract one shared variant with optional spanning support; do not create two invitation-specific variants                                                    |
| Evidence                  | `src/styles/invitation-profiles/daniela-y-martin.scss:1996`; `src/styles/invitation-profiles/victoria-y-roberto.scss:700`; local DOM Victoria split verified |

### 5.3 Location — `split-map`

| Field                     | Value                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| Section                   | Location                                                                                            |
| Proposed id               | `split-map`                                                                                         |
| Origins                   | Alba Rosa                                                                                           |
| Structure                 | Cardless typographic venue record beside lateral map/actions plane                                  |
| Why not current catalog   | `with-map` selects media, but base VenueCard remains vertical and carded                            |
| Recommended Goal B action | Extract structural layout; keep map surface/materiality as tokens/skins                             |
| Evidence                  | `src/styles/invitation-profiles/alba-rosa-quinonez.scss:1207`; local DOM location override verified |

---

## 6. Inventory C — Exceptions and non-variants

| Bucket                      | Examples                                                                                                                            | Disposition                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Presentation option         | Alba days-only countdown; Alba legend-only gifts; Valentina mobile gallery rail; Daniela SVG map preview; Luna after-RSVP location  | Model as orthogonal options/policies if reused; not structural variants         |
| Skin / visual               | Hero alignment within `standard`; map materiality; PA frame shapes; crops; typography; color; motion; intersections                 | Keep outside structural catalog                                                 |
| Documented exception        | Abril gallery storyboard; jewelry-box-wedding nth-child gallery; Alba photo-caption Family                                          | Preserve invitation-specific compatibility; do not promote without new evidence |
| Legacy / accidental         | Daniela `uniform-grid` single portrait (should be `single-keepsake`); Alba dead Thank You editorial CSS; Luna empty portrait column | Cleanup / remapping only; never promote as catalog variants                     |
| Existing variant absorption | Alba feature mosaic; Victoria/Valentina itinerary rows; Victoria/Leah editorial closings                                            | Absorb into confirmed canonical variants + skins                                |

---

## 7. Caveats and stop conditions

1. **Diagnostic only.** This report must not be treated as authorization to change runtime code,
   styles, schemas, content, tests, or durable docs.
2. **Local evidence boundary.** Managed inventory and render checks are local. Preview/Production
   content ownership was not probed.
3. **Single-origin candidates are intentional.** Goal A allows one-invitation origins when the
   structure is reusable; Goal B must still prove extraction cost and portability before promotion.
4. **No unresolved structural candidates remain** after consolidation of the four matrix candidate
   rows into three groups. Remaining ambiguities are classified as presentation, skin, exception, or
   accidental.

---

## 8. Handoff for Goal B

Goal B should treat this report as the discovery SSOT and limit structural extraction work to:

1. Hero `split-cover`
2. Family `split-groups`
3. Location `split-map`

Plus optional non-catalog cleanup/options work:

- Alba Thank You dead CSS decision
- Daniela gallery remapping to `single-keepsake`
- Luna Hero profile/content compatibility
- Alba gifts `legend-only` and countdown unit options if productized

Interactive companion (local Cursor canvas, not in repo):
`invitation-variant-discovery-audit.canvas.tsx`. `)
