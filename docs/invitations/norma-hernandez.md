# Norma Margarita Hernández Zabalsa — Invitation Preparation

## Identity

| Parameter              | Value                               |
| ---------------------- | ----------------------------------- |
| **Slug**               | `norma-hernandez`                   |
| **Host Login Alias**   | `norma_hernandez`                   |
| **Event Type**         | `cumple`                            |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS`           |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

Implementation is authorized by the owner-approved art-direction plan. Asset restoration candidates
are provisional until human acceptance; this record does not grant environment release authority.

## Sources

| Source                       | Reference                       | Use                                                                                                                    |
| ---------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Conversation and media       | `source:client-packet`          | 25 photos, 25 locally transcribed audios, handwritten drafts, video and PDF; originals retained outside the repository |
| Owner-approved specification | `source:approved-plan`          | Identity, visual direction, copy, six photo roles and personalized RSVP                                                |
| Venue reference              | `source:venue-official`         | Hotel San Luis Lindavista official El Conquistador page                                                                |
| Restoration candidates       | `source:restoration-candidates` | Non-destructive generated masters; not evidence of recovered original detail                                           |

## Fact Register

| field                 | value                                                                   | classification | source        | notes                                                                                  |
| --------------------- | ----------------------------------------------------------------------- | -------------- | ------------- | -------------------------------------------------------------------------------------- |
| slug                  | norma-hernandez                                                         | verified       | approved-plan | Orthography confirmed by supplied material and owner plan                              |
| celebrantName         | Norma Margarita Hernández Zabalsa                                       | verified       | approved-plan | Display name: Norma Margarita                                                          |
| eventLabel            | 65 años                                                                 | verified       | client-packet | Birthday                                                                               |
| eventDate             | 2026-11-14                                                              | verified       | client-packet | Saturday                                                                               |
| eventTime             | 17:00                                                                   | verified       | client-packet | Ceremony; reception at 18:00                                                           |
| timeZone              | America/Mazatlan                                                        | verified       | approved-plan | Ceremony UTC 2026-11-15T00:00:00Z                                                      |
| baseDemoId            | demo-cumple-luxury-hacienda                                             | verified       | approved-plan | Owner-selected technical base, not client demo selection                               |
| sourceAssetPath       | source:client-packet                                                    | verified       | approved-plan | Explicitly authorized provisional photo sources; no high-resolution originals supplied |
| sectionOrder          | quote, gallery, countdown, location, personalizedAccess, rsvp, thankYou | verified       | approved-plan | Envelope and hero precede sections                                                     |
| primaryVenueName      | Nuestra Señora de Guadalupe, La Lomita                                  | verified       | client-packet | Ceremony                                                                               |
| primaryVenueAddress   | Av. Juan Pablo II s/n, colonia Lomas de Guadalupe, Culiacán             | verified       | client-packet | Venue card                                                                             |
| receptionVenueName    | Salón El Conquistador, Hotel San Luis Lindavista                        | verified       | approved-plan | Reception                                                                              |
| receptionVenueAddress | Av. Obregón y Río Sinaloa n.º 1, colonia Guadalupe, Culiacán            | verified       | approved-plan | Official venue reference                                                               |
| rsvpConfirmationMode  | api                                                                     | verified       | approved-plan | Personalized-only access; existing assigned passes                                     |
| dressCode             | Formal                                                                  | verified       | client-packet | No adults-only restriction                                                             |
| clientColors          | Ivory, dusty pink, plum, deep rose                                      | verified       | approved-plan | Pastel pink originated with client                                                     |
| musicUrl              | —                                                                       | missing        | client-packet | A mi manera; exact recording pending, omit music until supplied                        |
| gifts                 | —                                                                       | not_applicable | approved-plan | Omit                                                                                   |

## Design Direction

| decision                 | value                                                                 | classification |
| ------------------------ | --------------------------------------------------------------------- | -------------- |
| Owner-selected base demo | demo-cumple-luxury-hacienda                                           | verified       |
| Visual profile           | norma-hernandez                                                       | verified       |
| Hero                     | framed-portrait, full childhood photograph and separate text          | verified       |
| Album                    | narrative-stack, four ordered photographs with permanent captions     | verified       |
| Closing                  | portrait-letter, blue dress composite with original portrait fallback | verified       |

Ivory `#FAF6F0`, dusty pink `#E8C9D0`, plum `#4B303B`, rose `#925D70`. Cormorant Garamond for
display and dedications; Montserrat for practical information. Light paper surfaces, a single NM
seal, restrained motion and neutral section boundaries. All source copy is the revised September 5
draft, as adapted in the approved plan. Earlier handwritten drafts and the PDF biography are not
public content.

## Photograph Inventory

| source                            | dimensions         | role          | quality              | treatment                                                                        |
| --------------------------------- | ------------------ | ------------- | -------------------- | -------------------------------------------------------------------------------- |
| packet:00000128                   | 720x1280           | childhood     | provisional-whatsapp | Preserve historic tonality, remove print damage and external red border          |
| packet:00000180                   | 720x1280           | children      | provisional-whatsapp | Gentle exposure correction; preserve all four people                             |
| packet:00000184                   | 720x1280           | grandchildren | provisional-whatsapp | Remove specified adult and his hand; preserve grandmother and four grandchildren |
| packet:00000088                   | 900x1600           | family        | provisional-whatsapp | Rotate, remove specified seated adult, preserve all other people                 |
| packet:00000073                   | 960x1280           | life          | provisional-whatsapp | Ivory courtyard background; preserve identity, pose, clothes and bouquet         |
| packet:00000153 + packet:00000169 | 749x948 + 591x1280 | closing       | provisional-whatsapp | Blue dress composite; original portrait fallback if identity or anatomy fails    |

### Uniqueness table

| role                  | source                            | derivative         |
| --------------------- | --------------------------------- | ------------------ |
| hero                  | packet:00000128                   | childhood.webp     |
| gallery-children      | packet:00000180                   | children.webp      |
| gallery-grandchildren | packet:00000184                   | grandchildren.webp |
| gallery-family        | packet:00000088                   | family.webp        |
| gallery-life          | packet:00000073                   | life.webp          |
| thank-you             | packet:00000153 + packet:00000169 | closing.webp       |

Each role has a distinct source except the intentional two-source closing composite. Do not publish
raw packets. Generate WebP once from retained candidate masters; use original managed delivery,
role-aware budgets and no runtime enlargement. Human review must compare source and candidate.

## Placeholders

| token                          | missing datum    | blocking | reason                              | replacement requirement                                             |
| ------------------------------ | ---------------- | -------- | ----------------------------------- | ------------------------------------------------------------------- |
| [[PENDIENTE:MUSIC_RECORDING]]  | MUSIC_RECORDING  | no       | Owner permits silent design review  | Supply approved recording before release                            |
| [[PENDIENTE:PHOTO_ACCEPTANCE]] | PHOTO_ACCEPTANCE | no       | Provisional restoration candidates  | Accept identity, edits and six final photo roles before release     |
| [[PENDIENTE:CLIENT_CONTACT]]   | CLIENT_CONTACT   | no       | Administrative contact not supplied | Complete through guarded intake before new environment create       |
| [[PENDIENTE:GUEST_PASSES]]     | GUEST_PASSES     | no       | Guest roster not supplied           | Owner provides guests and assigned passes through existing workflow |

These are preparation-only markers; never render them in the invitation. Missing assets or human
acceptance remain release blockers. No arbitrary music URL, contact details or guest counts.

## Creative Direction & Acceptance

| concern                           | decision / evidence                                      | status   |
| --------------------------------- | -------------------------------------------------------- | -------- |
| Direction                         | Owner-approved album of life; six sequential photo roles | ACCEPTED |
| Photo candidates                  | Six v1 candidates; originals and masters retained        | PENDING  |
| Render evidence                   | Four viewport sizes; 200 percent text-size check         | CAPTURED |
| Whole-invitation human acceptance | Norma must review the identifiable final version         | PENDING  |

## Candidate delivery and review

Review version: `norma-v1-a309cfc1fa72`. The base checkout is
`7314f849483cd82681e930a56351b2f5e1e0388c`; this candidate is not a commit or a published release.
The local review manifest records exact source-file and asset SHA-256 hashes.

The local comparison is `.agent/tmp/norma-art-review/index.html`. It includes each original,
retained v1 PNG master, and both source photographs for the closing composite. `manifest.json`
records intrinsic dimensions, bytes, quality and hashes. These private review resources remain
outside public content.

| Candidate          | Dimensions  | Bytes  | WebP quality |
| ------------------ | ----------- | ------ | ------------ |
| childhood.webp     | 900 × 1600  | 55490  | 84           |
| children.webp      | 900 × 1600  | 177418 | 80           |
| grandchildren.webp | 900 × 1600  | 180542 | 80           |
| family.webp        | 1600 × 900  | 160732 | 80           |
| life.webp          | 1086 × 1448 | 183480 | 68           |
| closing.webp       | 1024 × 1536 | 176090 | 84           |

The six WebP files are provisional review exports from candidate masters, not accepted final assets.
Regenerate from the accepted master if human review changes an edit. Childhood is intentionally
reused for social sharing, without adding a repeated narrative chapter. All other visible
photographic roles have separate sources.

Review the local presentation at
`/test/variant?full=1&presentation=1&eventType=cumple&slug=norma-hernandez&envelope=1`.
This is an existing dev-only harness extended with opt-in envelope presentation; it is absent from
production builds. The intended public route remains `/cumple/norma-hernandez`.

## Validation and History

Preparation was recorded and evaluated before implementation on 2026-09-08. The readiness evaluator
returned `READY_WITH_PLACEHOLDERS` and allowed implementation; human photograph acceptance remains
pending.

- `pnpm type-check`: passed, zero diagnostics.
- `pnpm validate:changed`: passed; 174 related suites / 2243 tests and 24 local-corpus regression
  tests passed. Markdown narrative-table warnings remain advisory.
- `pnpm validate:invitation-preparation`: passed.
- `pnpm build:app`: passed. No deployment was performed.
- `pnpm run ci`: not green. 540 suites / 6263 tests passed; three tests in
  `canonical-status-format.test.ts` failed when attempting to read a protected local
  Production-backup manifest (EPERM). One test was skipped by the existing suite. No backup or
  permission settings were changed.
- `pnpm test:e2e:ci --workers=1`: 255 passed; two public-route tests for Norma returned 404 because
  the new managed definition has not been provisioned. Existing invitation regressions and
  neutral-fixture variant checks passed. A prior run had stale Vite dependency responses; the
  clean-server rerun removed those failures.
- `playwright test tests/e2e/norma-invitation.spec.ts tests/e2e/envelope-reveal-interaction.spec.ts --workers=1`:
  19 passed, including all eight Norma checks; one additional `@extended` seal-sizing assertion
  failed for Victoria y Roberto (6 px difference, existing 34 px minimum versus the test's 40 px
  expectation). No seal-sizing rules were changed.
- Local visual checks cover 360, 390, 768 and 1440 px, reduced motion, 200 percent text sizing,
  photograph proportions, permanently visible dedications, palette contrast and keyboard opening.
  Artifacts are under `output/playwright/norma-*`. Whole-page browser zoom and client acceptance are
  distinct from the automated text-size check.
- Existing RSVP component, guest-limit and submission-service tests ran with the suite. Persistent
  RSVP transactions and actual guest links were not exercised against a provisioned Norma event.

Validation used the available Node 26.7.0 / pnpm 11.19.0 runtime; the repository declares
Node >=22.13.0 <25 and pnpm 11.23.0. Repeat release checks with the declared runtime before
publication.

## Remaining release gates

Norma must accept the six edits and complete visual composition on the identified candidate. The
exact recording of “A mi manera” remains pending; the current presentation contains no audio player.
Administrative contact and real guest allocations must be supplied through the existing workflow.
Persistent provisioning, Storage upload, Git operations and Preview/Production release require their
own authorization. No such operations were performed.

The public-route tests must pass after authorized provisioning; the protected-backup test dependency
and supported runtime must also be resolved before claiming release readiness.

## Layout refinement — September 8, 2026

Current layout review: `norma-v2-6a263f3c7937`; `.agent/tmp/norma-art-review/layout-v2.json` records
the changed source hashes. The earlier v1 record above describes the photograph candidates and
historical validation.

Owner authorization: proceed with the visual critique. Preserve all six photographs, their order,
approved dedications, event facts and personalized RSVP. Human photograph and whole-invitation
acceptance remain PENDING.

- Matte envelope with a single opening instruction; compact full childhood portrait on mobile.
- Narrative gallery uses delivery dimensions to identify landscape photographs. Landscape chapters
  span the available desktop width; portraits alternate with permanent captions. Chapter counters
  are removed.
- Norma-only surface tokens simplify the countdown, maps, RSVP spacing and closing signature.
  Existing map navigation remains available. Shared surface hooks retain their previous defaults.
- Header scrim and CTA colors follow the ivory/plum profile. Locked RSVP copy uses the formal usted
  register.
- Evidence: `output/playwright/norma-{360,390,768,1440}.png`, `norma-opening.png`,
  `norma-envelope.png`, and `norma-text-200.png`.
- Regression decision: extend the existing responsive test to assert landscape classification and a
  wider family photograph on desktop; reuse neutral variant and portrait-letter geometry checks.
- Validation: 15 focused browser tests passed, including eight Norma scenarios and seven
  neutral/shared-variant checks. Full CI and publication are outside this visual iteration; prior
  release blockers remain recorded above.

Tier B validation for this refinement: `pnpm validate:changed` passed (70 related suites, 909 tests,
plus 24 corpus regression tests); `pnpm type-check` reported zero errors/warnings;
`pnpm validate:invitation-preparation` and `pnpm validate:event-parity` passed. Existing five-column
table warnings and the Node/pnpm engine-version warning remain non-blocking tool observations. Four
additional shared-envelope interaction tests passed (19 focused browser tests in total). No
Git-write, database-write, upload or deployment operation was performed.

## Expressive visual revision — September 8, 2026

Current candidate: `norma-v3-8a7affbe4461`. Owner feedback rejected the flat, square character of
v2. The new candidate remains PENDING visual acceptance.

The envelope now contrasts ivory stationery against plum. The childhood composition uses a broad
rose curve, an arched outline around the uncropped photograph and a larger name. Narrative
photographs retain their full image bounds with curved rose surrounds; landscape chapters remain
wide. An italic rose dedication bridges into the album, while a plum countdown marks the transition
to the celebration. The closing regains a restrained rose color field. Content, photograph
candidates and RSVP behavior are unchanged.

The owning SCSS variants provide the geometry. Profile tokens control color and section curvature;
no new public schema or variant values are introduced. `layout-v3.json` in the private review
directory identifies the revised style files.

Validation for v3: `pnpm validate:changed` passed (909 related tests and 24 corpus tests). The 15
focused browser scenarios passed at 360, 390, 768 and 1440 px, including enlarged text, keyboard
opening and neutral variant fixtures. This iteration changes SCSS and documentation only relative to
v2; type checking and full CI were not repeated. Publication and human acceptance remain pending.

## Integrated photographs and hierarchy — September 8, 2026

Current local candidate: `norma-v4-bf1d98d9f804`, superseding v3 for visual review. Human acceptance
remains PENDING. The private `layout-v4.json` records the source hashes.

The owner approved soft corner cropping of background only. The hero photograph now owns its arch;
its double frame and the album's circular surrounds are removed. Album photographs retain native
proportions with 24 px corners, permanent captions and the existing full-image viewer. The closing
keeps its arch. Source photographs and candidate exports are unchanged. Manual review found no
additional person clipping from these contours.

The name scales from 64 to 104 px, section headings from 32 to 44 px, and dedications from 18 to 20
px. Italics are reserved for the initial thanks and the life dedication. Secondary desktop portraits
remain bounded at 352 px; family remains the widest chapter. The countdown has reduced padding and
internal gaps, with 112–160 px numerals. Venue hours are stronger, and the closing signature is
secondary to its message. Changes remain in canonical SCSS and profile tokens, without new variants,
public fields, APIs or content.

Comparable full-page evidence includes hero, family, countdown and closing at both widths:
`output/playwright/norma-v4-comparison-390.png` and `norma-v4-comparison-1440.png` (v3 left, v4
right). Separate before/after files are retained alongside those comparisons. Responsive checks also
cover 360 and 768 px, 200 percent text, reduced motion, keyboard opening, contrast and the album
viewer.

Validation: `pnpm validate:changed` passed (70 related suites / 909 tests plus 24 corpus tests); all
15 focused Norma and shared-variant browser tests passed. Final token adjustments received the same
focused browser checks and scoped style validation. No TypeScript or runtime logic changed in this
iteration, so type checking and full CI were not repeated. Existing runtime warnings and historical
release gates above remain applicable. This is a local review only, not publication readiness.

## Readability refinement and second client audit — September 8, 2026

Current display identity: **Norma Hernandez**, monogram **NH**, explicitly requested by the owner.
Slug, managed UUID, asset paths and host login alias are unchanged. Earlier display names and NM
references above are historical.

The audit compared the complete WhatsApp text, 25 existing local audio transcriptions and the
September 5 handwritten draft (00000161). Transcriptions are imperfect evidence; the written draft
supports the three-line life caption. The owner selected the corrected English wording “Smile at
life”. Private correspondence and biography remain outside public content.

| Request                              | Evidence                                       | Implementation                                                          | Pending                |
| ------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------- | ---------------------- |
| Envelope and childhood first         | September 4 text; audio 00000176               | Folded envelope, external instruction, childhood hero                   | Visual acceptance      |
| Six ordered photos and captions      | September 5 written draft                      | Childhood, children, grandchildren, family, life, closing               | Photo acceptance       |
| Remove indicated adults              | September 3 text; audios 00000185 and 00000190 | Existing candidate derivatives retained                                 | Photo acceptance       |
| Patio background and three phrases   | Audios 00000192–00000193; written draft        | Three HTML lines on photo; enlarged text flows below                    | Visual acceptance      |
| Blue dress closing, natural identity | September 5 text; audios 00000173 and 00000194 | Existing arched candidate and closing thanks                            | Photo acceptance       |
| Final song: A mi manera              | September 5, 18:47 text                        | No arbitrary recording; earlier song links superseded                   | Exact recording/file   |
| Event details and RSVP               | September 2 text; audio 00000012               | Dates, times, formal attire and personalized API confirmation preserved | Real guest allocations |

Canonical SCSS owns structure and the Norma profile owns tokens. No new public fields, variants,
APIs or migrations. Only the life photo uses the existing feature layout role. Source masters and
exports are unchanged. Baseline real-route captures cover 360, 390, 440, 768 and 1440 px under
output/playwright/norma-v5-before-*.png.

Current visual candidate: `norma-v5-c046c79d6ad3`; source hashes are recorded in the private
`layout-v5.json`. Before/after real-route screenshots use
`output/playwright/norma-v5-{before,after}-{360,390,440,768,1440}.png`. Envelope, enlarged-text and
CSS-zoom captures are stored alongside them. CSS zoom is not certification of native browser menu
zoom. Human visual and photographic acceptance remain PENDING.

Validation: `pnpm type-check` passed with zero diagnostics; preparation validation passed. Eleven
Norma browser scenarios, seven neutral/shared-variant scenarios and four shared-envelope interaction
scenarios passed. The enlarged-caption test now waits for image decoding and fonts before comparing
geometry; the final Norma rerun passed. `pnpm validate:changed` passed 71 related suites / 911 tests
plus 24 corpus tests before the last scoped style adjustments; final validation is recorded in the
task handoff. Full CI was not run for this local visual iteration, and the existing runtime-version
warning remains.

The authorized managed lifecycle applied the revised content in Local and Preview as public version
v2. No photograph uploads or deletions were needed. Post-apply semantic content parity passed, and
the real Local route returned HTTP 200 with the new name. This content apply does not deploy the
uncommitted SCSS/Astro changes to the hosted Preview application. No Production operation or Git
write was performed.


## Visual review v6 — 2026-09-08

Candidate: norma-v6-20260908. Human visual and photographic acceptance remains pending.

- Envelope: clean lower pocket; triangular upper flap and NH seal retained.
- Hero: viewport-aware portrait height, full image, compact spacing; venue and time remain in Location.
- Quote: 26–32 px, weight 500, 1.5 line height; decorative dividers removed.
- Album: alternating placement, rose backing for grandchildren, ivory family caption surface; original images preserved.
- Patio: the latest explicit user instruction supersedes the earlier three-line copy. Only “Smile at life” remains, inside the lower ground area with a dark contrast transition. Enlarged text reflows below the image when needed.
- Direct URL simulation: only Norma in Local and Preview, without any invite parameter. “Familia de ejemplo”, two places, no API writes; reload resets the simulated response. Valid personalized links keep the real flow. Empty or invalid invite parameters never enable simulation.
- Editorial-light tonal arc retained: hero to quote Bridge, quote to album Neutral; album background variation is internal to narrative-stack; subsequent section cadence unchanged.

Evidence: output/playwright/norma-v6-{360,390,440,768,1440}.png; dedicated norma-v6-hero.png, norma-v6-quote.png, norma-v6-patio.png and norma-v6-envelope.png. Prior v5 captures remain available for comparison.

Verification: 11 visual/accessibility Norma tests and 4 real-route simulation/exclusion tests passed. Astro check: 1,725 files with zero diagnostics; native TypeScript check passed. validate:changed passed with 103 suites / 1,351 tests and 24 render-corpus cases. The temporary harness runtime had an outdated Vite dependency during the first simulation run; the real local runtime passed both confirmation and declination without API writes.

Managed content was applied to Local and Preview as public v3; semantic parity passed, with no Storage changes. This is not a deployment of the visual/runtime code to hosted Preview. Production was not changed. Live personalized guest writes were not performed; the existing real RSVP flow is preserved. Exact “A mi manera” recording, human acceptance, native browser-menu zoom certification and hosted code deployment remain pending.

Shared regression follow-up: 16 envelope/neutral-variant browser tests passed (31 distinct browser cases including Norma). pnpm type-check passed. Full CI was not run for this local review. Node 26.7.0 / pnpm 11.19.0 differ from the declared supported toolchain; the existing toolchain warning remains.


## Browser refinement v7 — 2026-09-08

The user requested the grandchildren dedication entirely inside its rose backing, a single-line italic “Smile at life”, clearer venue hierarchy, smaller section navigation with an animated chevron, and senior-readable pass contrast. Implemented in canonical SCSS and Norma profile tokens without content or RSVP changes. Pass copy uses opaque ivory on solid plum (10.93:1 measured contrast); count uses the inverse pair. Navigation is 16 px and only its chevron moves, disabled for reduced motion. Verified at 360, 390, 430, 768 and 1440 px, including 200% text without overflow. Review images: output/playwright/norma-refine-grandchildren-430.png, norma-refine-life-430.png, norma-refine-location-430.png, norma-refine-navigation-430.png and norma-refine-access-430.png. This remains a local code review, pending human visual acceptance and hosted code deployment.


## Photo and pass refinement v8 — 2026-09-08

Latest user feedback removes the patio gradient entirely. “Smile at life” is dark italic HTML directly over the original photograph, with a subpixel light edge around the letterforms for variable stone texture. No raster edits or image filters. The pass now uses a raised ivory guest/quota panel between plum header and footer, a larger sentence-case title and quota, and no small quota box. High-contrast ivory/plum pair remains intact. Browser checks at 360, 430, 768 and 1440 px plus 200% text found no overflow. Local review screenshots: output/playwright/norma-paper-life-430.png and output/playwright/norma-paper-pass-430.png. Human aesthetic acceptance and hosted code deployment remain pending.


## Final polish v9 — 2026-09-08

Reviewed the real invitation at mobile and desktop sizes. Kept the palette, asymmetry, photos, copy and section order. Reduced heavy header/closing shadows, tightened the gap before the pass, increased narrative type weight, removed quote text glow and excessive signature tracking, and refined the RSVP title, border radius and field contrast. Venue headings now wrap safely at 200% text, and address copy targets measure 44 by 44 px. Real-route confirmation/declination simulations and invalid/empty invite exclusion: four browser tests passed. Five viewport checks (360, 390, 430, 768, 1440) retained full-height hero without normal-scale overflow. Evidence: output/playwright/norma-final-before-mobile.png, norma-final-before-desktop.png, norma-final-after-mobile.png, norma-final-after-desktop.png and norma-final-rsvp-after.png. Local review only; human visual acceptance and hosted deployment remain outstanding.
