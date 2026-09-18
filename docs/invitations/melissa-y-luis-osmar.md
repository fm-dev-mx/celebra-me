# Canonical Invitation Preparation State — `melissa-y-luis-osmar`

> Schema owner: `docs/core/invitation-preparation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Scope: preparation and Local implementation only; no persistent database or publication authority.

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

- None for Local implementation according to `evaluateEventCompleteness`.

### Non-blocking release dependencies

- Confirm both navigation pins and venue addresses with Melissa.
- Confirm the normalized capitalization and accents of family and godparent names.
- Obtain the host email and WhatsApp only when identity provisioning is separately authorized.
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
| contact  | missing-client-facts  | Host provisioning contact is absent                      | No authoritative contact supplied      | Supply email and WhatsApp when provisioning   | Do not invent or provision identity            |
| creative | photograph-acceptance | Generated venue art requires human review                | Six generated candidates; two selected | Accept / request bounded revision             | Review selected art in the complete invitation |

## Agent Recommendations

| topic     | recommendation                                                                   | basis                                                                  | status                            |
| --------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| venue art | Use interpretive architectural editorials, not simulated documentary photographs | Sparse public Belcanto evidence and client request for premium visuals | approved for Local implementation |
| palette   | Warm ivory editorial-light arc with a cacao closing band                         | Client neutral preference plus Jewelry Box foundation                  | approved for Local implementation |
| media     | Use only two venue interludes; omit couple photography and gallery               | Explicit client requirement and narrative restraint                    | approved for Local implementation |

## Sections

| bucket     | section keys                                                                             |
| ---------- | ---------------------------------------------------------------------------------------- |
| requested  | quote, countdown, family, location, itinerary, gifts, personalizedAccess, rsvp, thankYou |
| auxiliary  | interlude after family; interlude after itinerary                                        |
| omitted    | gallery, music                                                                           |
| unresolved | none for Local implementation                                                            |

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

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING`

| concern                     | decision / evidence                                                                         | status     |
| --------------------------- | ------------------------------------------------------------------------------------------- | ---------- |
| Typography roles            | Existing script display, editorial serif and sans metadata roles                            | verified   |
| Vertical rhythm and density | Editorial-light flow with two media pauses and dark closing action band                     | verified   |
| Surface hierarchy           | Maximum three tonal surfaces; functional sections remain open rather than nested cards      | verified   |
| Photographic treatment      | Two interpretive venue artworks; no couple photography; no embedded text                    | verified   |
| Section-intersection intent | Family→cathedral overlap; cathedral→location blend; Belcanto→gifts blend; gifts→access arch | verified   |
| Local exceptions            | `.event--melissa-y-luis-osmar` profile only                                                 | documented |

### Creative acceptance record

| field                                       | value                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| Mechanical render/capture result            | pending implementation QA                                              |
| Whole-invitation responsive inspection      | pending 390×844 and 1440×900 evidence                                  |
| Section boundaries and narrative continuity | pending                                                                |
| Human creative outcome                      | `PENDING`                                                              |
| Reviewer and date                           | —                                                                      |
| Blocking reason or owner follow-up          | Human review of final composition and both interpretive venue artworks |

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
- No Local/Preview/Production database writes, identity provisioning, publication, staging or
  commit.

## Preparation Readiness History

| date       | readiness                  | helper basis                   | notes                                                                                                         |
| ---------- | -------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 2026-09-18 | `READY_FOR_IMPLEMENTATION` | `evaluatePreparationReadiness` | Required boda fields resolved; two unique production-ready generated assets; design selected; no placeholders |
