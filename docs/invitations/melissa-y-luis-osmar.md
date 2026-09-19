# Canonical Invitation Preparation State — `melissa-y-luis-osmar`

> Schema owner: `docs/core/invitation-preparation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Scope: implementation and managed application in Local and Preview only, including the dedicated
> technical host identity created by the canonical release workflow. Production, guest creation and
> RSVP persistence remain outside the authorized boundary.

## Identity

| Parameter              | Value                      |
| ---------------------- | -------------------------- |
| **Slug**               | `melissa-y-luis-osmar`     |
| **Host Login Alias**   | `melissa_landell`          |
| **Event Type**         | `boda`                     |
| **Preparation Status** | `READY_FOR_IMPLEMENTATION` |

**Preparation Readiness (prepReadiness):** `READY_FOR_IMPLEMENTATION`

This state must remain aligned with `evaluatePreparationReadiness`. Technical Local, Preview, and
Production readiness (**envReadiness**) remains separately owned by the managed release workflow.

## Sources

| Source                      | Reference                        | Notes                                                                         |
| --------------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| WhatsApp / conversation     | `source:wa-export`               | Evidence only; the raw export and attachments are not committed               |
| Client reference sheet      | `source:client-reference-sheet`  | Event facts and visual direction; not reused as a production asset            |
| Generated architectural art | `source:generated-venue-art`     | Project-local masters and prepared derivatives; interpretive, not documentary |
| Public venue references     | `source:public-venue-references` | Address evidence; navigation links still require client confirmation          |

## Fact Register

Classification is one of: `verified` | `inferred` | `ambiguous` | `missing` | `not_applicable` |
`requires_owner_decision`.

| field                 | value                                                                                    | classification | source                         | notes                                                           |
| --------------------- | ---------------------------------------------------------------------------------------- | -------------- | ------------------------------ | --------------------------------------------------------------- |
| slug                  | melissa-y-luis-osmar                                                                     | verified       | owner implementation plan      | Orthography and canonical route explicitly approved             |
| celebrantName         | Melissa Landell Osuna                                                                    | verified       | source:client-reference-sheet  | Full name supplied by client                                    |
| secondaryName         | Luis Osmar Muñoz Rodríguez                                                               | verified       | source:client-reference-sheet  | Full name supplied by client                                    |
| eventDate             | 2026-12-16                                                                               | verified       | source:client-reference-sheet  | Wednesday, 16 December 2026                                     |
| eventTime             | 12:00                                                                                    | verified       | source:client-reference-sheet  | Religious ceremony start                                        |
| timeZone              | America/Mazatlan                                                                         | inferred       | venue city + IANA zone         | Must be reconfirmed before publication                          |
| baseDemoId            | demo-boda-jewelry-box-wedding                                                            | verified       | source:wa-export               | Client selected the shared wedding demo direction               |
| sourceAssetPath       | src/assets/invitations/melissa-y-luis-osmar                                              | verified       | source:generated-venue-art     | Repository-relative root; no client filesystem path persisted   |
| sectionOrder          | quote, countdown, family, location, itinerary, gifts, personalizedAccess, rsvp, thankYou | verified       | owner implementation plan      | Interludes are auxiliary narrative inserts                      |
| primaryVenueName      | Catedral Basílica de la Inmaculada Concepción                                            | verified       | source:client-reference-sheet  | Ceremony venue                                                  |
| primaryVenueAddress   | 21 de Marzo s/n, Centro, 82000 Mazatlán, Sinaloa                                         | inferred       | source:public-venue-references | Confirm exact navigation pin with client before publication     |
| receptionVenueName    | Belcanto Jardín                                                                          | verified       | source:client-reference-sheet  | Reception and civil ceremony venue                              |
| receptionVenueAddress | Lib. 3 12100, Valle del Ejido, 82129 Mazatlán, Sinaloa                                   | inferred       | source:public-venue-references | Public listing; confirm with client before publication          |
| distinctVenues        | true                                                                                     | verified       | source:client-reference-sheet  | Ceremony and reception use different venues                     |
| rsvpConfirmationMode  | api                                                                                      | verified       | owner implementation plan      | Canonical RSVP API                                              |
| rsvpAccessMode        | personalized-only                                                                        | verified       | owner implementation plan      | Assigned guest pass determines capacity                         |
| rsvpDeadline          | 2026-11-16                                                                               | verified       | owner implementation plan      | Thirty days before the event                                    |
| dressCode             | Gala formal                                                                              | verified       | owner implementation plan      | No reserved colors invented                                     |
| childPolicy           | Celebración reservada para adultos                                                       | verified       | source:client-reference-sheet  | Formal visible wording                                          |
| gifts                 | Liverpool event 60019030; lluvia de sobres                                               | verified       | source:client-reference-sheet  | No payment buttons or bank data                                 |
| musicUrl              | —                                                                                        | not_applicable | owner implementation plan      | Music omitted unless a licensed direct source is later approved |
| clientColors          | marfil, perla, taupe, cacao y champagne                                                  | verified       | owner implementation plan      | Champagne restricted to decorative emphasis                     |

### Family and godparents

| role                  | name                            | classification | source                        | publication note                                      |
| --------------------- | ------------------------------- | -------------- | ----------------------------- | ----------------------------------------------------- |
| Madre de Melissa      | Martha Elena Osuna Rubio        | verified       | source:client-reference-sheet | Confirm final accents before publication              |
| Padre de Melissa      | Rodrigo Landell Osuna           | inferred       | source:client-reference-sheet | Capitalization normalized; confirm before publication |
| Madre de Luis Osmar   | Martha Leticia Rodríguez Vargas | verified       | source:client-reference-sheet | Confirm final accents before publication              |
| Padre de Luis Osmar   | Jesús Gerardo Muñoz Silva       | verified       | source:client-reference-sheet | Confirm final accents before publication              |
| Padrino de matrimonio | Leonardo Campuzano              | verified       | source:client-reference-sheet | —                                                     |
| Madrina de matrimonio | María Laura Moraga              | verified       | source:client-reference-sheet | —                                                     |
| Madrina de velación   | Lucina Elsi Morán               | inferred       | source:client-reference-sheet | Accent normalized; confirm before publication         |
| Padrino de velación   | Darío Osuna Rubio               | inferred       | source:client-reference-sheet | Accent normalized; confirm before publication         |

## Event Completeness

Contract maturity for `boda`: `partial`.

- **requirement:** required
  - **fields:** slug, celebrantName, secondaryName, eventDate, baseDemoId, sourceAssetPath,
    sectionOrder, primaryVenueName, primaryVenueAddress, rsvpConfirmationMode
  - **status:** resolved
- **requirement:** conditional
  - **fields:** receptionVenueName, receptionVenueAddress
  - **status:** resolved; distinct venues
- **requirement:** contract gaps
  - **fields:** family, gifts, music, dress and palette are not standardized in the boda
    completeness matrix
  - **status:** captured as invitation facts

### Missing blockers

- None for Local and Preview implementation according to `evaluateEventCompleteness`.

### Non-blocking release dependencies

- Confirm both navigation pins and venue addresses with Melissa.
- Confirm the normalized capitalization and accents of family and godparent names.
- Obtain a client contact email and WhatsApp only if later required for a human handoff; the managed
  release uses the canonical technical identity derived from `hostLoginAlias`.
- Record an explicit final music decision; the current implementation omits music.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

## Placeholders

No content placeholder tokens are used. Unverified operational details are omitted rather than
rendered as plausible navigation links.

| token | missing datum | blocking | reason | replacement requirement |
| ----- | ------------- | -------- | ------ | ----------------------- |

## Owner Decisions

| id       | category              | issue                                                    | evidence                               | options                                       | recommendation                                 |
| -------- | --------------------- | -------------------------------------------------------- | -------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| maps     | missing-client-facts  | Exact navigation pins are not client-confirmed           | Public address references only         | Confirm both links / keep buttons hidden      | Keep navigation buttons hidden until confirmed |
| names    | ambiguous-data        | Three names received capitalization/accent normalization | Client reference sheet                 | Approve normalized forms / supply corrections | Confirm normalized forms before publication    |
| contact  | missing-client-facts  | Client handoff contact is absent                         | No authoritative contact supplied      | Supply email and WhatsApp before handoff      | Use only the canonical technical host identity |
| creative | photograph-acceptance | Generated venue art requires human review                | Six generated candidates; two selected | Accept / request bounded revision             | Review selected art in the complete invitation |

## Agent Recommendations

| topic     | recommendation                                                                   | basis                                                                  | status                                        |
| --------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| venue art | Use interpretive architectural editorials, not simulated documentary photographs | Sparse public Belcanto evidence and client request for premium visuals | approved for Local and Preview implementation |
| palette   | Warm ivory editorial-light arc with a cacao closing band                         | Client neutral preference plus Jewelry Box foundation                  | approved for Local and Preview implementation |
| media     | Use only two venue interludes; omit couple photography and gallery               | Explicit client requirement and narrative restraint                    | approved for Local and Preview implementation |

## Sections

| bucket     | section keys                                                                             |
| ---------- | ---------------------------------------------------------------------------------------- |
| requested  | quote, countdown, family, location, itinerary, gifts, personalizedAccess, rsvp, thankYou |
| auxiliary  | interlude after family; interlude after itinerary                                        |
| omitted    | gallery, music                                                                           |
| unresolved | none for Local and Preview implementation                                                |

## Design Direction

| decision                          | value                                                            | classification      |
| --------------------------------- | ---------------------------------------------------------------- | ------------------- |
| Client-selected demo              | `demo-boda-jewelry-box-wedding`                                  | verified            |
| Recommended demo alternatives     | —                                                                | not_applicable      |
| Selected variant / visual profile | `jewelry-box-wedding` / `melissa-y-luis-osmar`                   | verified            |
| Client color requirements         | neutral palette                                                  | verified            |
| Recommended palette               | `#F7F3ED`, `#FFFDF9`, `#302925`, `#75675E`, `#3A312C`, `#A9825A` | owner-approved plan |
| Unresolved visual decisions       | —                                                                | not_applicable      |

The reference collage informs materiality and hierarchy only. It is not copied and is not a
production asset. Lane A owns invitation data, generated assets and profile SCSS. Lane B is empty:
no shared preset, schema or renderer change is required.

## Sistema tipográfico

La referencia principal es el diseño actual de dev-extra, trasladado selectivamente al perfil local.
La portada combina papel marfil, monograma Cinzel y paisaje mediterráneo; conserva los nombres y la
fecha como texto real. Las ilustraciones de los recintos y sus recortes se mantienen. El paisaje es
decorativo y no representa un recinto confirmado del evento.

| Role                               | Family                       | Treatment                                             |
| ---------------------------------- | ---------------------------- | ----------------------------------------------------- |
| Hero and primary headings          | Cinzel                       | Restrained tracking; balanced wrapping                |
| Family names and prose             | Cormorant Garamond           | Names above roles; 18–20 px body prose                |
| Practical information and controls | Instrument Sans              | 16 px information; 12 px metadata                     |
| Formal pass and RSVP chapter       | Canonical variant typography | Bodoni retained; no local scale or geometry overrides |

All fonts reuse installed dependencies. Dark taupe replaces ornamental gold for small text on paper.
Champagne remains available for borders and decoration. Countdown uses canonical grid reflow at 200%
text size; copy controls retain a 44 px minimum. Motion follows semantic timing and disables
decorative hover transforms for reduced motion.

Lane A scope: profile, decorative landscape, reference copy and focused verification. Existing
shared responsive fixes and envelope geometry are preserved. No new Lane B contract is added. The
reference's extra family intersection is omitted: the existing canonical section flow remains.

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING`

| concern                     | decision / evidence                                                                                     | status     |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| Typography roles            | Cinzel headings, Cormorant names/prose, Instrument Sans practical information; canonical formal chapter | verified   |
| Vertical rhythm and density | Editorial-light flow with two media pauses and dark closing action band                                 | verified   |
| Surface hierarchy           | Maximum three tonal surfaces; functional sections remain open rather than nested cards                  | verified   |
| Photographic treatment      | Two interpretive venue artworks; no couple photography; no embedded text                                | verified   |
| Section-intersection intent | Family→cathedral overlap; cathedral→location blend; Belcanto→gifts blend; gifts→access arch             | verified   |
| Local exceptions            | `.event--melissa-y-luis-osmar` profile only                                                             | documented |

### Creative acceptance record

| field                                       | value                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| Mechanical render/capture result            | 19 focused browser checks passed for editorial polish                  |
| Whole-invitation responsive inspection      | 320, 360, 390, 430, 768 and 1440 px; 200% text at 320/360; 1440×600    |
| Section boundaries and narrative continuity | Local harness evidence complete; Preview route evidence still required |
| Human creative outcome                      | `PENDING`                                                              |
| Reviewer and date                           | —                                                                      |
| Blocking reason or owner follow-up          | Human review of editorial polish, landscape and venue artworks         |

The reference transfer was validated locally on 2026-09-19. The comparison uses the reference
worktree's existing harness captures and equivalent local routes/viewports. Published-route and
Preview parity remain unverified; no managed content was applied.

Decorative hero asset: `hero-landscape.webp`, 1600×893, 87314 bytes, reused unchanged from the
reference. It replaces the unused botanical SVG. No package dependency was added.

## Editorial Polish Evidence — 2026-09-19

This pass is presentation-only and local-only. It does not extend earlier release permissions.
Content, section order, artwork and existing shared corrections are frozen. SHA-256 checks of the
payload and local image assets match the pre-polish baseline. Interlude dimensions and object
positions match at all five measured viewports.

### Implementation and cleanup

- Necessary configuration: palette, typography roles, section rhythm, artwork geometry, envelope
  material tokens and the formal chapter's chromatic remap remain local.
- Public location/gift variables replace equivalent direct rules. The legacy elegant gifts bundle
  hardcodes padding, radius, hover and shadows, so a small documented local bridge remains; no
  shared component or new API was introduced.
- Local exceptions: landscape hero composition, centered family introduction, balanced godparent
  columns, readable itinerary typography, gift-code reflow and the blocked RSVP card treatment.
- Removed duplicate card styles, formal-pass/register geometry and type-scale overrides, repeated
  diamonds/dividers, closing watermark, extra artwork masks, card blur/lifts, the location cue's
  continuous pulse and the unused `--env-ink` assignment (no consumer in `src`).
- EB Garamond and Montserrat imports were removed from this profile. Installed packages remain:
  other project consumers exist. No image asset became unused in this pass.
- The fixed outer gift gutters and bounded card padding preserve reading width at 200% text size.
  The hero reserves landscape space and grows instead of overlapping its date.

### Before/after measurements

| Metric                                 | Before  | After   | Change    |
| -------------------------------------- | ------- | ------- | --------- |
| Profile source bytes                   | 45,660  | 25,783  | −43.5%    |
| Profile source lines                   | 1,710   | 886     | −48.2%    |
| Compressed Sass output bytes           | 63,181  | 35,079  | −44.5%    |
| Profile declarations observed in CSSOM | 1,040   | 489     | −53.0%    |
| Complete harness CSSOM bytes           | 614,897 | 583,389 | −5.1%     |
| Requested font files                   | 6       | 6       | unchanged |
| Requested WOFF2 file bytes             | 199,636 | 192,516 | −3.6%     |

Measurements use the same local full-invitation harness with `presentation=1` (global/base CSS),
animations disabled, fresh Chromium contexts, device scale 1, UTC and the same viewport sizes. CSSOM
bytes measure the parsed styles delivered to the harness, not compressed production transfer size.
Sass output includes font-face imports. Font bytes are the summed local files matching observed font
requests, excluding headers. The before baseline is reconstructed by intercepting only the profile
stylesheet with Sass output from its saved pre-edit source; no worktree file is reverted. Earlier
captures without `presentation=1` omitted base styles and are superseded by these measurements. The
restored Bodoni formal chapter and Cormorant extended subset explain the unchanged request count; EB
Garamond and Montserrat are no longer requested by this invitation.

Evidence resides in ignored `.tmp/visual-review/melissa-polish/{before-full,after-full}/`: complete
screenshots and `metrics.json`. Reference captures are in `.tmp/visual-review/melissa-transfer/`.
The reference worktree's recorded HEAD, index entries and scoped file hashes remain unchanged.

### Validation scope and limits

- `pnpm validate:changed`: ESLint, Stylelint and formatting checks; 76 related Jest suites (968
  tests) and the local corpus regression suite (26 tests) passed. Five advisory warnings concern
  pre-existing wide Markdown tables.
- `pnpm test:e2e tests/e2e/melissa-y-luis-osmar.spec.ts --workers=1`: 19 checks, using the existing
  local harness server through `PLAYWRIGHT_REUSE_EXISTING_SERVER` and `PLAYWRIGHT_WEB_SERVER_URL`.
- Tier A: no shared contract or executable application code changed. Full CI/build/type-check are
  not rerun for this presentation pass.

The initial full-presentation run exposed a 360 px countdown label wrap and a shared,
higher-specificity ambient animation overriding the local media arrival. Both were corrected in the
profile; the latter also removed capture stability timeouts. Focused regression assertions now cover
both findings.

The focused browser suite covers the complete invitation, short desktop, text zoom, landscape/date
separation, countdown columns, unbroken countdown labels, stationary information cards, 44 px copy
controls, visible focus, envelope, synthetic passes for 1/2/6 seats, non-persistent RSVP states, a
single media arrival (no inherited ambient loop), reduced motion and no-JavaScript content. Visual
inspection additionally reviews hierarchy, section transitions and artwork framing. The taupe
metadata on paper has a 4.92:1 contrast ratio; quote attribution and the scroll cue no longer reduce
that contrast through opacity.

The formal chapter intentionally retains its canonical typography, including its 10.88 px eyebrow;
changing that shared contract is outside this presentation pass. Production transfer size and Core
Web Vitals are not measured. Published and Preview routes are not exercised. Human creative
acceptance remains **PENDING**, independently of technical checks.

## Photograph Inventory

Source label: `source:generated-venue-art`. Masters are preserved. The assets are explicitly
interpretive architectural artwork and must not be described as documentary venue photographs.

| source filename                | dims      | format | orientation | weight    | quality          | role        | duplicate | processing                               | derivative               |
| ------------------------------ | --------- | ------ | ----------- | --------- | ---------------- | ----------- | --------- | ---------------------------------------- | ------------------------ |
| source/cathedral-editorial.png | 1024×1536 | png    | portrait    | 3023047 B | production-ready | interlude01 | no        | selected from three candidates; WebP q84 | cathedral-editorial.webp |
| source/belcanto-editorial.png  | 1024×1536 | png    | portrait    | 2807452 B | production-ready | interlude02 | no        | selected from three candidates; WebP q84 | belcanto-editorial.webp  |

### Uniqueness table

| role        | source                         | derivative               | intentional multi-role? |
| ----------- | ------------------------------ | ------------------------ | ----------------------- |
| interlude01 | source/cathedral-editorial.png | cathedral-editorial.webp | no                      |
| interlude02 | source/belcanto-editorial.png  | belcanto-editorial.webp  | no                      |

Prepared derivative sizes:

- `cathedral-editorial.webp`: 298834 B (`editorial-featured`).
- `belcanto-editorial.webp`: 288264 B (`editorial-featured`).

Generated with the built-in ImageGen workflow. Prompts required portrait 2:3 composition,
architectural editorial interpretation, believable materials, natural light, no people, no text, no
logos, no signage and no watermark.

## Implementation Constraints

- `prepReadiness` must remain helper-aligned before payload or profile work.
- Reuse canonical variants; no slug or profile branching in shared renderers.
- Invitation-specific styling remains under `.event--melissa-y-luis-osmar`.
- Generated art is decorative/atmospheric; essential venue information remains real text.
- Navigation buttons remain hidden until client-confirmed map URLs exist.
- RSVP uses `confirmationMode: api` and `accessMode: personalized-only`; no guest records are
  seeded.
- Music and gallery remain omitted.
- Managed application is authorized only through `invitation:release` for the exact slug in Local
  and Preview, after dry-run and environment identity checks.
- The canonical release may create the dedicated `host_client` technical identity derived from
  `hostLoginAlias` in Local and Preview; it must not provision any guest or client-contact data.
- Synthetic pass and RSVP fixtures remain test-only and never create accounts, guests or responses.
- Production writes, Production dry-run promotion, schema migration and Preview content mirror are
  outside scope.

## Preparation Readiness History

| date       | readiness                  | helper basis                   | notes                                                                                                         |
| ---------- | -------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 2026-09-18 | `READY_FOR_IMPLEMENTATION` | `evaluatePreparationReadiness` | Required boda fields resolved; two unique production-ready generated assets; design selected; no placeholders |
