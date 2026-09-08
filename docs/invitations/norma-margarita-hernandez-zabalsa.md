# Norma Margarita Hernández Zabalsa — Invitation Preparation

## Identity

| Parameter              | Value                               |
| ---------------------- | ----------------------------------- |
| **Slug**               | `norma-margarita-hernandez-zabalsa` |
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
| slug                  | norma-margarita-hernandez-zabalsa                                       | verified       | approved-plan | Orthography confirmed by supplied material and owner plan                              |
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
| Visual profile           | norma-margarita-hernandez-zabalsa                                     | verified       |
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
`/test/variant?full=1&presentation=1&eventType=cumple&slug=norma-margarita-hernandez-zabalsa&envelope=1`.
This is an existing dev-only harness extended with opt-in envelope presentation; it is absent from
production builds. The intended public route remains `/cumple/norma-margarita-hernandez-zabalsa`.

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
