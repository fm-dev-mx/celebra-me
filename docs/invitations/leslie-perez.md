# Canonical Invitation Preparation State — `leslie-perez`

> Schema owner: `docs/core/invitation-preparation-contract.md` Executable evaluation:
> `src/lib/invitation-preparation/` (**prepReadiness SSOT**) Workflow:
> `.agent/workflows/invitation-preparation.md`

---

## Identity

| Parameter              | Value              |
| ---------------------- | ------------------ |
| **Slug**               | `leslie-perez`     |
| **Canonical route**    | `/xv/leslie-perez` |
| **Host Login Alias**   | `leslie_perez`     |
| **Event Type**         | `xv`               |
| **Preparation Status** | `READY_FOR_IMPLEMENTATION` |

**Preparation Readiness (prepReadiness):** `READY_FOR_IMPLEMENTATION`

The implementation is a published managed definition in the Local Render Corpus. The primary event
time and schedule are confirmed. Technical Local/Preview/Production readiness (**envReadiness**)
remains owned by the managed release workflow and is out of scope here.

---

## Sources

| Source                               | Reference                       | Notes                                                                                      |
| ------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------ |
| WhatsApp / conversation              | `source:wa-export` (opaque)     | Evidence for verified client facts; no raw chat or commercial details are reproduced here. |
| High-resolution photos / assets root | `source:hr-photos` (opaque)     | Owner-authorized source used for the 15 numbered originals; the real path is session-only. |
| Owner session                        | `source:owner-session` (opaque) | Slug, route, exact photo order, section scope, variant composition, and handoff criteria.  |

---

## Fact Register

| field                | value                                                                                             | classification | source                  | notes                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------- | -------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| slug                 | `leslie-perez`                                                                                    | verified       | owner + creation        | Owner-selected slug; route does not repeat the `xv` event type.                                     |
| hostLoginAlias       | `leslie_perez`                                                                                    | verified       | owner                   | Dedicated alias for the local managed definition.                                                   |
| celebrantName        | Leslie                                                                                            | verified       | wa-export + owner       | Guest-facing name is kept as Leslie; no unverified surname is displayed.                            |
| eventLabel           | XV años                                                                                           | verified       | wa-export               | Event type and client context.                                                                      |
| eventDate            | 2026-09-26                                                                                        | verified       | wa-export               | Confirmed date.                                                                                     |
| eventTime            | 19:00 (7:00 p. m.)                                                                                | verified       | owner                   | Confirmed reception start time.                                                                     |
| timeZone             | America/Monterrey                                                                                 | inferred       | geography               | Venue is in Apodaca, Nuevo León; do not present this inference as client wording.                   |
| baseDemoId           | `demo-xv-celestial-blue`                                                                          | verified       | owner + catalog         | Visual reference and theme-compatible provenance.                                                   |
| sourceAssetPath      | `source:hr-photos`                                                                                | verified       | owner                   | High-resolution local source was inventoried and copied into the client namespace.                  |
| sectionOrder         | family, countdown, quote, location, itinerary, gallery, gifts, personalizedAccess, rsvp, thankYou | verified       | owner                   | Interludes insert after location and gallery. Music is the overlay player, not a section-order key. |
| primaryVenueName     | San Carlos Eventos                                                                                | verified       | wa-export               | One reception venue; no ceremony block.                                                             |
| primaryVenueAddress  | Blvd. Julián Treviño Elizondo #500, Col. Huinalá, Apodaca, Nuevo León, 66645                      | verified       | wa-export               | Preserved for the location section.                                                                 |
| distinctVenues       | false                                                                                             | verified       | wa-export + owner       | Only the reception venue is included.                                                               |
| rsvpConfirmationMode | api                                                                                               | verified       | owner                   | Standard product RSVP flow.                                                                         |
| rsvpGuestCap         | 1                                                                                                 | verified       | owner + product default | Safe draft fallback; the client-managed guest list may set individual allowances before release.    |
| rsvpDeadline         | 15 de septiembre de 2026                                                                          | verified       | owner                   | Confirmed RSVP deadline.                                                                            |
| fatherName           | Luis Enrique Zacarias Oviedo                                                                      | verified       | wa-export               | Parent name preserved as provided.                                                                  |
| motherName           | Leticia Perez Moreno                                                                              | verified       | wa-export               | Parent name preserved as provided.                                                                  |
| godparents           | —                                                                                                 | not_applicable | wa-export + owner       | Client confirmed no padrinos; do not render a godparents block.                                     |
| clientColors         | azul marino                                                                                       | verified       | wa-export               | Dominant atmosphere; separate reserved-color indication is required.                                |
| reservedColorNotice  | El color azul marino está reservado exclusivamente para la quinceañera.                           | verified       | owner + wa-export       | Render as an independent location indication, not as a generic dress-code label.                    |

## Design Direction

| decision                           | selected source / value                                                             | classification |
| ---------------------------------- | ----------------------------------------------------------------------------------- | -------------- |
| Owner-selected base demo           | `demo-xv-celestial-blue`                                                            | verified       |
| Theme preset                       | `celestial-blue`                                                                    | verified       |
| Reveal                             | Existing celestial wax seal and `wax-monogram` lockup                               | verified       |
| Hero                               | Existing `split-cover` variant from Romina’s invitation                             | verified       |
| Family                             | Existing `asymmetric-groups` with `text-only` presentation from Renata’s invitation | verified       |
| Location                           | Existing `split-map` variant from Alba Rosa’s invitation                            | verified       |
| Itinerary                          | Existing `standard` variant with Leslie rhythm treatment                            | verified       |
| Gallery                            | Existing `index-choreography` variant with Leslie rhythm treatment                  | verified       |
| RSVP                               | Existing `formal-register` paired with `formal-pass` (Victoria practice)            | verified       |
| Personalized access                | Existing `formal-pass` variant from Renata/Victoria practice                        | verified       |
| ThankYou                           | Existing `full-bleed-photo` variant from Renata’s invitation                        | verified       |
| Tonal band                         | `celestial-bookend` (dark overture → light body → dark finale)                      | verified       |
| Rhythm profile                     | `src/styles/invitation-profiles/leslie-perez.scss` (blends + tracking only)         | verified       |
| New structural variants            | none                                                                                | verified       |
| New invitation-specific components | none (profile is rhythm tokens only)                                                | verified       |

No `sectionStyles` or legacy aliases are used to select these structures. The theme owns the
atmosphere and each section owns its canonical structural variant. Rhythm cadence lives in
`composition.intersections` plus `leslie-perez.scss` (atmospheric-blend tokens only).

**Residual:** without a guest, public render omits Personalized Access, so light `gifts` meets dark
`formal-register` with no bridge. Finale rhythm acceptance assumes guest context or local PA
preview.

## Photograph Inventory

Source label: `source:hr-photos` (opaque). Originals are preserved in the client namespace. Every
source photo is assigned once in the visible invitation narrative, except 01.jpg which produces two
role-encoded hero derivatives (desktop and mobile).

The managed release reads the one-to-one delivery derivatives `delivery/01.webp` through
`delivery/15.webp`, plus the role-specific mobile hero `delivery/01-mobile.webp`. Each numbered
derivative preserves the source order and is normalized for delivery (orientation applied, maximum
dimension 2560 px, WebP output within the asset policy). The original JPG files remain at the
namespace root as source evidence and are not used as the declared release inputs while they exceed
the intake limit.

Role-aware delivery budgets are enforced for this invitation: `photo-01` uses `hero-desktop` with a
500 KB maximum, `photo-01-mobile` uses `hero-mobile` with a 350 KB maximum, `photo-02` through
`photo-03` and `photo-05` through `photo-07` plus `photo-09` through `photo-14` use `gallery` with a
180 KB maximum each, `photo-04` and `photo-08` (interludes) plus `photo-15` use `editorial-featured`
with a 300 KB maximum, and `venue-san-carlos` uses `standard-section` with a 220 KB maximum.

| source filename | dims      | format | orientation | quality          | role            | processing                                  |
| --------------- | --------- | ------ | ----------- | ---------------- | --------------- | ------------------------------------------- |
| 01.jpg          | 3920×5616 | JPG    | vertical    | production-ready | Hero background | Responsive focal crop; preserve original.   |
| 02.jpg          | 4742×6648 | JPG    | vertical    | production-ready | Gallery         | Mosaic order; preserve original.            |
| 03.jpg          | 4000×5808 | JPG    | vertical    | production-ready | Gallery         | Mosaic order; preserve original.            |
| 04.jpg          | 5328×3832 | JPG    | horizontal  | production-ready | Interlude       | After location; preserve original.          |
| 05.jpg          | 3936×5680 | JPG    | vertical    | production-ready | Gallery         | Mosaic order; preserve original.            |
| 06.jpg          | 4000×5792 | JPG    | vertical    | production-ready | Gallery         | Mosaic order; preserve original.            |
| 07.jpg          | 3872×5728 | JPG    | vertical    | production-ready | Gallery         | Mosaic order; preserve original.            |
| 08.jpg          | 5676×3856 | JPG    | horizontal  | production-ready | Interlude       | After gallery; preserve original.           |
| 09.jpg          | 3904×5296 | JPG    | vertical    | production-ready | Gallery         | Mosaic order; preserve original.            |
| 10.jpg          | 3584×5296 | JPG    | vertical    | production-ready | Gallery         | Mosaic order; preserve original.            |
| 11.jpg          | 3936×5856 | JPG    | vertical    | production-ready | Gallery         | Mosaic order; preserve original.            |
| 12.jpg          | 3904×5328 | JPG    | vertical    | production-ready | Gallery         | Mosaic order; preserve original.            |
| 13.jpg          | 5292×3904 | JPG    | horizontal  | production-ready | Gallery         | Square mosaic crop; preserve original.      |
| 14.jpg          | 5664×3892 | JPG    | horizontal  | production-ready | Gallery         | Square mosaic crop; preserve original.      |
| 15.jpg          | 3744×5424 | JPG    | vertical    | production-ready | ThankYou        | Full-bleed closing crop; preserve original. |

### Uniqueness table

| role               | source                   | derivative                | intentional multi-role? |
| ------------------ | ------------------------ | ------------------------- | ----------------------- |
| Hero desktop       | 01.jpg                   | `delivery/01.webp`        | no                      |
| Hero mobile        | 01.jpg                   | `delivery/01-mobile.webp` | yes (same source)       |
| Location interlude | 04.jpg                   | Full-bleed tall crop      | no                      |
| Gallery mosaic     | 02, 03, 05–07, 09–14.jpg | Per-item responsive crops | no                      |
| Gallery interlude  | 08.jpg                   | Full-bleed tall crop      | no                      |
| ThankYou closing   | 15.jpg                   | Full-bleed closing crop   | no                      |

No family photograph was identified. Photos 04 and 08 leave the gallery so each binary keeps one
visible role. No demo fallback asset is referenced by the Leslie definition.

---

## Implementation Constraints

- Keep `lifecycle: published` and `deliveryScope: content-and-assets` in the local definition.
- Keep the asset namespace under `src/assets/invitations/leslie-perez`; reference assets only by
  semantic keys declared in the definition.
- Preserve the original 01–15 filenames and order; use the matching `delivery/01.webp`–
  `delivery/15.webp` derivatives as declared release inputs, plus `delivery/01-mobile.webp` for the
  mobile hero path. Same source photograph may produce two role-encoded derivatives; do not bind one
  uploaded asset to `hero.backgroundImage` and `hero.backgroundImageMobile`.
- Keep `themeId`, `baseDemoId`, `templateId`, and structural variants aligned to the catalog and
  canonical schemas.
- Omit ceremony and godparents. Do not invent a song URL, event time, RSVP deadline, or seal
  initials.
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
- Pending data is represented only by controlled placeholders; no invented song URL, time, initials,
  or RSVP deadline is introduced.

### Handoff 2 — Local implementation → independent review

Owner: local implementation. Receiver: independent reviewer.

Acceptance evidence:

- Definition is registered under `leslie-perez`, is `published`, and uses no client-specific
  component or stylesheet branch.
- Canonical content schema, variant normalization, asset namespace, and ordered photo-role checks
  pass.
- No database, Preview, Production, or publication state was changed.
- The helper-aligned preparation state is `READY_FOR_IMPLEMENTATION`; the event time and RSVP deadline
  are confirmed.

### Handoff 3 — Independent review → owner confirmation / release preparation

Owner: independent reviewer. Receiver: invitation owner.

Acceptance evidence:

- Inspect the narrative at 390×844 and 1440×900 after a safe local render is available.
- Verify envelope reveal, Hero crop, Gallery mosaic, both interludes, gifts, music button without
  playback, Location map treatment, navy notice, itinerary density, RSVP/access handoff, ThankYou
  crop, and local PA visibility.
- Record mechanical render status separately from human creative acceptance below.
- Return the song URL and optional seal initials for finalization, if applicable.

---

## Creative Direction & Acceptance

| field                                       | value                                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Mechanical render/capture result            | pending — local route requires a draft data source; no DB/Preview mutation authorized                 |
| Whole-invitation responsive inspection      | pending — target viewports: 390×844 and 1440×900                                                      |
| Section boundaries and narrative continuity | pending independent review                                                                            |
| Human creative outcome                      | `PENDING`                                                                                             |
| Reviewer and date                           |                                                                                                       |
| Blocking reason or owner follow-up          | Confirm optional song URL and seal initials before release, if applicable                         |

Successful schema or asset validation will not substitute for this human creative gate.

---

## Preparation Readiness History

| date       | readiness   | helper basis                   | notes                                                                                                                  |
| ---------- | ----------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 2026-08-14 | `NOT_READY` | `evaluatePreparationReadiness` | Event time is a blocking missing XV completeness field; local draft implementation is retained for owner handoff only. |
| 2026-08-17 | `READY_FOR_IMPLEMENTATION` | `evaluatePreparationReadiness` | Event time and RSVP deadline confirmed; optional song URL and seal initials remain omitted. |
