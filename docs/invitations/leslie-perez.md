# Canonical Invitation Preparation State — `leslie-perez`

> Schema owner: `docs/core/invitation-preparation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Workflow: `.agent/workflows/invitation-preparation.md`

---

## Identity

| Parameter              | Value              |
| ---------------------- | ------------------ |
| **Slug**               | `leslie-perez`     |
| **Canonical route**    | `/xv/leslie-perez` |
| **Host Login Alias**   | `leslie_perez`     |
| **Event Type**         | `xv`               |
| **Preparation Status** | `NOT_READY`        |

**Preparation Readiness (prepReadiness):** `NOT_READY`

The implementation is a local `in_progress` draft only. The helper keeps preparation blocked because
the primary event time is missing; the draft must not be released or published until that owner
datum is confirmed. Technical Local/Preview/Production readiness (**envReadiness**) remains owned by
the managed release workflow and is out of scope here.

---

## Sources

| Source                               | Reference                       | Notes                                                                                      |
| ------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------ |
| WhatsApp / conversation              | `source:wa-export` (opaque)     | Evidence for verified client facts; no raw chat or commercial details are reproduced here. |
| High-resolution photos / assets root | `source:hr-photos` (opaque)     | Owner-authorized source used for the 15 numbered originals; the real path is session-only. |
| Owner session                        | `source:owner-session` (opaque) | Slug, route, exact photo order, section scope, variant composition, and handoff criteria.  |

---

## Fact Register

| field                | value                                                                                      | classification | source                  | notes                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------ | -------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| slug                 | `leslie-perez`                                                                             | verified       | owner + creation        | Owner-selected slug; route does not repeat the `xv` event type.                                  |
| hostLoginAlias       | `leslie_perez`                                                                             | verified       | owner                   | Dedicated alias for the local managed definition.                                                |
| celebrantName        | Leslie                                                                                     | verified       | wa-export + owner       | Guest-facing name is kept as Leslie; no unverified surname is displayed.                         |
| eventLabel           | XV años                                                                                    | verified       | wa-export               | Event type and client context.                                                                   |
| eventDate            | 2026-09-26                                                                                 | verified       | wa-export               | Confirmed date.                                                                                  |
| eventTime            | `[[PENDIENTE:HORA_EVENTO]]`                                                                | missing        | wa-export               | Primary start time was not confirmed; this is a blocking preparation gap.                        |
| timeZone             | America/Monterrey                                                                          | inferred       | geography               | Venue is in Apodaca, Nuevo León; do not present this inference as client wording.                |
| baseDemoId           | `demo-xv-celestial-blue`                                                                   | verified       | owner + catalog         | Visual reference and theme-compatible provenance.                                                |
| sourceAssetPath      | `source:hr-photos`                                                                         | verified       | owner                   | High-resolution local source was inventoried and copied into the client namespace.               |
| sectionOrder         | quote, family, countdown, location, itinerary, gallery, personalizedAccess, rsvp, thankYou | verified       | owner                   | Gifts and interludes are omitted.                                                                |
| primaryVenueName     | San Carlos Eventos                                                                         | verified       | wa-export               | One reception venue; no ceremony block.                                                          |
| primaryVenueAddress  | Blvd. Julián Treviño Elizondo #500, Col. Huinalá, Apodaca, Nuevo León, 66645               | verified       | wa-export               | Preserved for the location section.                                                              |
| distinctVenues       | false                                                                                      | verified       | wa-export + owner       | Only the reception venue is included.                                                            |
| rsvpConfirmationMode | api                                                                                        | verified       | owner                   | Standard product RSVP flow.                                                                      |
| rsvpGuestCap         | 1                                                                                          | verified       | owner + product default | Safe draft fallback; the client-managed guest list may set individual allowances before release. |
| fatherName           | Luis Enrique Zacarias Oviedo                                                               | verified       | wa-export               | Parent name preserved as provided.                                                               |
| motherName           | Leticia Perez Moreno                                                                       | verified       | wa-export               | Parent name preserved as provided.                                                               |
| godparents           | —                                                                                          | not_applicable | wa-export + owner       | Client confirmed no padrinos; do not render a godparents block.                                  |
| clientColors         | azul marino                                                                                | verified       | wa-export               | Dominant atmosphere; separate reserved-color indication is required.                             |
| reservedColorNotice  | El azul marino está reservado para Leslie.                                                 | verified       | owner + wa-export       | Render as an independent location indication, not as a generic dress-code label.                 |
| ceremony             | —                                                                                          | not_applicable | wa-export + owner       | No misa; omit ceremony, church, and ceremony itinerary items.                                    |
| photosRequested      | 15                                                                                         | verified       | wa-export + owner       | Fifteen numbered originals supplied in the owner-authorized source.                              |
| photoOrder           | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15                                 | verified       | owner                   | Exact source order is preserved.                                                                 |
| familyPhoto          | —                                                                                          | not_applicable | source:hr-photos        | No family photograph was identified; family is text-only.                                        |
| music                | `[[PENDIENTE:CANCION]]`                                                                    | missing        | wa-export               | Music section is omitted until the song is confirmed; no demo audio is inherited.                |
| mapReference         | client-provided Google Maps link                                                           | verified       | wa-export               | Kept as client reference; no independent map verification is claimed.                            |

---

## Event Completeness

The event date, venue, parents, RSVP mode, and photo source are resolved. `eventTime` remains a
blocking missing field under the evidence-backed XV completeness contract. The local definition
therefore remains a draft and keeps `[[PENDIENTE:HORA_EVENTO]]` in the affected content.

---

## Placeholders

| token                             | missing datum            | blocking | reason                                     | replacement requirement                                                                        |
| --------------------------------- | ------------------------ | -------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `[[PENDIENTE:HORA_EVENTO]]`       | eventTime                | yes      | The reception start time is not confirmed. | Replace in event timing, location, and countdown with the verified local time and UTC instant. |
| `[[PENDIENTE:HORA_RECEPCION]]`    | itinerary reception time | no       | Draft program time is not confirmed.       | Replace with the owner-approved reception time or omit the item if the program changes.        |
| `[[PENDIENTE:HORA_CENA]]`         | itinerary dinner time    | no       | Draft program time is not confirmed.       | Replace with the owner-approved dinner time or omit the item if not needed.                    |
| `[[PENDIENTE:HORA_VALS]]`         | itinerary waltz time     | no       | Draft program time is not confirmed.       | Replace with the owner-approved waltz time or omit the item if not needed.                     |
| `[[PENDIENTE:HORA_BRINDIS]]`      | itinerary toast time     | no       | Draft program time is not confirmed.       | Replace with the owner-approved toast time or omit the item if not needed.                     |
| `[[PENDIENTE:HORA_BAILE]]`        | itinerary dance time     | no       | Draft program time is not confirmed.       | Replace with the owner-approved dance time or omit the item if not needed.                     |
| `[[PENDIENTE:HORA_CIERRE]]`       | itinerary closing time   | no       | Draft program time is not confirmed.       | Replace with the owner-approved closing time or omit the item if not needed.                   |
| `[[PENDIENTE:TEXTO_INVITACION]]`  | opening quote/copy       | no       | No final client text was supplied.         | Replace with approved copy or omit the quote section.                                          |
| `[[PENDIENTE:CANCION]]`           | music selection          | no       | Song was not confirmed.                    | Add only the owner-approved song and keep autoplay disabled.                                   |
| `[[PENDIENTE:FECHA_LIMITE_RSVP]]` | RSVP deadline            | no       | Confirmation deadline was not supplied.    | Replace with the verified deadline or remove the sentence.                                     |
| `[[PENDIENTE:INICIALES_SELLO]]`   | envelope initials        | no       | Seal initials were not confirmed.          | Add approved initials only if the seal lockup requires them.                                   |

`FOTO_HERO_FONDO`, `FOTO_HERO_RETRATO`, and `FOTO_FAMILIA` are not pending: the first is assigned to
photo 01, a separate portrait is intentionally omitted, and the family section is text-only because
no family photograph was identified.

---

## Owner Decisions

| decision              | resolution                                                                                  | status            |
| --------------------- | ------------------------------------------------------------------------------------------- | ----------------- |
| Canonical route       | `/xv/leslie-perez`                                                                          | accepted          |
| Base visual direction | Theme `celestial-blue`, with exact section variants reused from existing invitations        | accepted          |
| Photo sequencing      | Preserve source order 01–15; use 01 for Hero, 02–14 for Gallery, and 15 for ThankYou        | accepted          |
| Family content        | Parents only; no godparents; text-only presentation                                         | accepted          |
| Location content      | Reception only at San Carlos Eventos; no ceremony or misa block                             | accepted          |
| Itinerary draft       | Recepción, Cena, Vals, Brindis, Baile, Cierre; omit Pastel; all times remain placeholders   | accepted as draft |
| RSVP/access           | Standard RSVP flow; client supplies the guest list through the existing invitation workflow | accepted          |
| Music                 | Omit until the client confirms the song                                                     | accepted          |
| Publication scope     | Local draft only; no database, Preview, Production, or publication changes                  | accepted          |

---

## Agent Recommendations

- Keep the global `celestial-blue` theme as the only visual atmosphere.
- Reuse canonical section variants: `split-cover`, `asymmetric-groups` with `text-only`,
  `split-map`, `timeline-paper`, `index-choreography`, `standard` RSVP with `formal-pass`, and
  `full-bleed-photo`.
- Keep the navy reserved-color notice in the location indications as a separate semantic item.
- Do not add `sectionStyles`, legacy aliases, client-name CSS selectors, gifts, interludes, or
  personal photos to location/family surfaces.
- Keep each original asset in one visible role; use crops/focal points, not duplicate binaries.

---

## Sections

| section             | included | exact variant / presentation                                   | content and photo assignment                                             |
| ------------------- | -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Envelope / reveal   | yes      | `sealStyle: wax`, `sealIcon: wax-monogram`                     | Celestial envelope; initials omitted until confirmed.                    |
| Hero                | yes      | `hero.variant: split-cover`                                    | Photo 01; responsive focal points documented in the definition.          |
| Quote               | draft    | base composition; no new variant                               | `[[PENDIENTE:TEXTO_INVITACION]]`; omit if no copy is approved.           |
| Family              | yes      | `family.variant: asymmetric-groups`, `presentation: text-only` | Parents only; no family asset.                                           |
| Countdown           | draft    | inherited celestial presentation; days only                    | Confirmed date; event time remains blocked.                              |
| Location            | yes      | `location.variant: split-map`                                  | San Carlos Eventos; client-provided map reference; reserved navy notice. |
| Itinerary           | draft    | `itinerary.variant: timeline-paper`                            | Recepción, Cena, Vals, Brindis, Baile, Cierre; no Pastel.                |
| Gallery             | yes      | `gallery.variant: index-choreography`                          | Photos 02–14 in exact numeric order.                                     |
| Personalized access | draft    | `personalizedAccess.variant: formal-pass`                      | Activates with the client-managed guest list.                            |
| RSVP                | draft    | `rsvp.variant: standard`                                       | Existing API flow; no custom guest-list manager.                         |
| Gifts               | no       | omitted                                                        | Not requested.                                                           |
| Interludes          | no       | omitted                                                        | No personal photos used as interludes.                                   |
| ThankYou            | yes      | `thankYou.variant: full-bleed-photo`                           | Photo 15 as the closing image.                                           |

---

## Design Direction

| decision                                   | selected source / value                                                             | classification |
| ------------------------------------------ | ----------------------------------------------------------------------------------- | -------------- |
| Owner-selected base demo                   | `demo-xv-celestial-blue`                                                            | verified       |
| Theme preset                               | `celestial-blue`                                                                    | verified       |
| Reveal                                     | Existing celestial wax seal and `wax-monogram` lockup                               | verified       |
| Hero                                       | Existing `split-cover` variant from Romina’s invitation                             | verified       |
| Family                                     | Existing `asymmetric-groups` with `text-only` presentation from Renata’s invitation | verified       |
| Location                                   | Existing `split-map` variant from Alba Rosa’s invitation                            | verified       |
| Itinerary                                  | Existing `timeline-paper` variant from Abril / celestial practice                   | verified       |
| Gallery                                    | Existing `index-choreography` variant from celestial/Xareni practice                | verified       |
| RSVP                                       | Existing `standard` flow; no custom structural component                            | verified       |
| Personalized access                        | Existing `formal-pass` variant from Renata/Victoria practice                        | verified       |
| ThankYou                                   | Existing `full-bleed-photo` variant from Renata’s invitation                        | verified       |
| New structural variants                    | none                                                                                | verified       |
| New invitation-specific components or SCSS | none                                                                                | verified       |

No `sectionStyles` or legacy aliases are used to select these structures. The theme owns the
atmosphere and each section owns its canonical structural variant.

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque). Originals are preserved in the client namespace. Every
source photo is assigned once in the visible invitation narrative.

The managed release reads the one-to-one delivery derivatives `delivery/01.webp` through
`delivery/15.webp`. Each derivative preserves the source order and is normalized for delivery
(orientation applied, maximum dimension 2560 px, WebP output within the asset policy). The original
JPG files remain at the namespace root as source evidence and are not used as the declared release
inputs while they exceed the intake limit.

| source filename | dims      | format | orientation | quality          | role            | processing                                  |
| --------------- | --------- | ------ | ----------- | ---------------- | --------------- | ------------------------------------------- |
| 01.jpg          | 3920×5616 | JPG    | vertical    | production-ready | Hero background | Responsive focal crop; preserve original.   |
| 02.jpg          | 4742×6648 | JPG    | vertical    | production-ready | Gallery 01      | Index order; preserve original.             |
| 03.jpg          | 4000×5808 | JPG    | vertical    | production-ready | Gallery 02      | Index order; preserve original.             |
| 04.jpg          | 5328×3832 | JPG    | horizontal  | production-ready | Gallery 03      | Index order; preserve original.             |
| 05.jpg          | 3936×5680 | JPG    | vertical    | production-ready | Gallery 04      | Index order; preserve original.             |
| 06.jpg          | 4000×5792 | JPG    | vertical    | production-ready | Gallery 05      | Index order; preserve original.             |
| 07.jpg          | 3872×5728 | JPG    | vertical    | production-ready | Gallery 06      | Index order; preserve original.             |
| 08.jpg          | 5676×3856 | JPG    | horizontal  | production-ready | Gallery 07      | Index order; preserve original.             |
| 09.jpg          | 3904×5296 | JPG    | vertical    | production-ready | Gallery 08      | Index order; preserve original.             |
| 10.jpg          | 3584×5296 | JPG    | vertical    | production-ready | Gallery 09      | Index order; preserve original.             |
| 11.jpg          | 3936×5856 | JPG    | vertical    | production-ready | Gallery 10      | Index order; preserve original.             |
| 12.jpg          | 3904×5328 | JPG    | vertical    | production-ready | Gallery 11      | Index order; preserve original.             |
| 13.jpg          | 5292×3904 | JPG    | horizontal  | production-ready | Gallery 12      | Index order; preserve original.             |
| 14.jpg          | 5664×3892 | JPG    | horizontal  | production-ready | Gallery 13      | Index order; preserve original.             |
| 15.jpg          | 3744×5424 | JPG    | vertical    | production-ready | ThankYou        | Full-bleed closing crop; preserve original. |

### Uniqueness table

| role             | source        | derivative                | intentional multi-role? |
| ---------------- | ------------- | ------------------------- | ----------------------- |
| Hero background  | 01.jpg        | Responsive crop           | no                      |
| Gallery sequence | 02.jpg–14.jpg | Per-item responsive crops | no                      |
| ThankYou closing | 15.jpg        | Full-bleed closing crop   | no                      |

No family photograph was identified. No personal photograph is assigned to Location or an interlude.
No demo fallback asset is referenced by the Leslie definition.

---

## Implementation Constraints

- Keep `lifecycle: in_progress` and `deliveryScope: content-and-assets` in the local definition.
- Keep the asset namespace under `src/assets/invitations/leslie-perez`; reference assets only by
  semantic keys declared in the definition.
- Preserve the original 01–15 filenames and order; use only the matching `delivery/01.webp`–
  `delivery/15.webp` derivatives as declared release inputs. Do not create alternate copies for
  different invitation roles.
- Keep `themeId`, `baseDemoId`, `templateId`, and structural variants aligned to the catalog and
  canonical schemas.
- Omit music, gifts, ceremony, godparents, and interludes until explicitly needed.
- Do not apply `invitation:release`, mutate a database, use Preview/Production, publish, stage, or
  commit as part of this handoff. Read-only dry-runs may be used to verify package readiness.
- The event-time placeholder is a release blocker; replace it in event timing and all affected
  section copy before any managed release plan is generated.

---

## Handoffs and Acceptance Criteria

### Handoff 1 — Design and photo mapping → local implementation

Owner: design/photo mapping. Receiver: local implementation.

Acceptance evidence:

- `demo-xv-celestial-blue` is recorded as provenance, while section structure comes from the exact
  reused variants listed in Design Direction.
- Photos 01–15 are present, numbered, production-ready, and mapped exactly once as documented.
- The reserved navy notice is separate from any dress-code semantics.
- Pending data is represented only by controlled placeholders; no invented song, time, initials,
  copy, or RSVP deadline is introduced.

### Handoff 2 — Local implementation → independent review

Owner: local implementation. Receiver: independent reviewer.

Acceptance evidence:

- Definition is registered under `leslie-perez`, remains `in_progress`, and uses no client-specific
  component or stylesheet branch.
- Canonical content schema, variant normalization, asset namespace, and ordered photo-role checks
  pass.
- No database, Preview, Production, or publication state was changed.
- The helper-aligned preparation state remains `NOT_READY` until the event time is confirmed.

### Handoff 3 — Independent review → owner confirmation / release preparation

Owner: independent reviewer. Receiver: invitation owner.

Acceptance evidence:

- Inspect the narrative at 390×844 and 1440×900 after a safe local render is available.
- Verify envelope reveal, Hero crop, Gallery order, Location map treatment, navy notice, itinerary
  density, RSVP/access handoff, ThankYou crop, and absence of omitted sections.
- Record mechanical render status separately from human creative acceptance below.
- Return the time, song, opening copy, RSVP deadline, and optional seal initials for finalization.

---

## Creative Direction & Acceptance

| field                                       | value                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Mechanical render/capture result            | pending — local route requires a draft data source; no DB/Preview mutation authorized            |
| Whole-invitation responsive inspection      | pending — target viewports: 390×844 and 1440×900                                                 |
| Section boundaries and narrative continuity | pending independent review                                                                       |
| Human creative outcome                      | `PENDING`                                                                                        |
| Reviewer and date                           |                                                                                                  |
| Blocking reason or owner follow-up          | Confirm `[[PENDIENTE:HORA_EVENTO]]`; complete remaining non-blocking placeholders before release |

Successful schema or asset validation will not substitute for this human creative gate.

---

## Preparation Readiness History

| date       | readiness   | helper basis                   | notes                                                                                                                  |
| ---------- | ----------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 2026-08-14 | `NOT_READY` | `evaluatePreparationReadiness` | Event time is a blocking missing XV completeness field; local draft implementation is retained for owner handoff only. |
