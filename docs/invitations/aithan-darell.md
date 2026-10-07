# Canonical Invitation Preparation State — `aithan-darell`

> Schema owner: `docs/core/invitation-preparation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Skill: `.agent/skills/invitation-preparation/SKILL.md`

---

## Identity

| Parameter              | Value                     |
| ---------------------- | ------------------------- |
| **Slug**               | `aithan-darell`           |
| **Host Login Alias**   | `aithan_ruiz`             |
| **Event Type**         | `cumple`                  |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS` |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

Helper outcome: every required `cumple` field is resolved, the base demo is owner-selected, and the
only placeholder (music) is non-blocking. All four photographs are messaging-app JPEGs, which the
owner accepted as the definitive set; `summarizeAssetQuality` therefore reports
`onlyNonProductionImages: true` and caps readiness below `READY_FOR_IMPLEMENTATION`. Implementation
may proceed.

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document.

Canonical route: `/cumple/aithan-darell` — slug must not include `eventType`. The slug uses the two
given names by explicit owner decision (the family presents the celebrant as "Aithan Darell"); the
host alias keeps the contract form `{primer_nombre}_{primer_apellido}`.

---

## Sources

| Source                  | Reference              | Notes                                                                        |
| ----------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| WhatsApp / conversation | `source:wa-export`     | Evidence only; client facts, the four photographs, and the song request      |
| Photographs             | `source:client-photos` | Four messaging-app JPEGs from the chat, accepted as definitive by the owner  |
| Owner session           | `source:owner-session` | Slug, base demo, photo acceptance, section omissions, guest cap (2026-10-07) |

---

## Fact Register

| field                | value                                                                   | classification | source    | notes                                                                            |
| -------------------- | ----------------------------------------------------------------------- | -------------- | --------- | -------------------------------------------------------------------------------- |
| slug                 | aithan-darell                                                           | verified       | owner     | Owner decision; two given names, no eventType prefix                             |
| hostLoginAlias       | aithan_ruiz                                                             | verified       | owner     | Contract form; owner may remap to `aithan_darell`                                |
| celebrantName        | Aithan Darell Ruiz Salgado                                              | verified       | wa-export | Written twice by the client; display name "Aithan Darell"                        |
| eventLabel           | Mis 3 años                                                              | verified       | wa-export | Client copy: "Aithan Darell / Mis 3 años"                                        |
| eventDate            | 2026-10-24                                                              | verified       | wa-export | Saturday 24 October 2026                                                         |
| eventTime            | 17:30                                                                   | verified       | wa-export | Client first wrote 4:30, then corrected to "Hora 5:30"                           |
| timeZone             | America/Mexico_City                                                     | inferred       | geography | Atizapán de Zaragoza, Estado de México; not client-stated                        |
| baseDemoId           | demo-cumple-editorial-magazine                                          | verified       | owner     | Owner-selected catalog entry (new); no children's demo existed                   |
| sourceAssetPath      | source:client-photos                                                    | verified       | owner     | Repo asset dir `src/assets/invitations/aithan-darell`; originals from the chat   |
| sectionOrder         | quote, countdown, location, gallery, personalizedAccess, rsvp, thankYou | inferred       | owner     | Family, itinerary, and gifts omitted: no data supplied                           |
| primaryVenueName     | Jardín de Teresita                                                      | verified       | wa-export |                                                                                  |
| primaryVenueAddress  | Avenida Juárez 49, Atizapán centro                                      | verified       | wa-export | Municipality (Atizapán de Zaragoza) inferred from the client's Maps link         |
| venueMapsUrl         | client Maps short link                                                  | verified       | wa-export | Published as `googleMapsUrl`                                                     |
| themeDescription     | Cars: carreras, McQueen, Mate, Mack                                     | verified       | wa-export | "todos los personajes"                                                           |
| clientColors         | rojo, negro, blanco                                                     | verified       | wa-export | First "rojo y negro", later "roja y negra y blanca"                              |
| heroPhoto            | ride-on car photograph                                                  | verified       | wa-export | "La imagen sería la que tiene el carro"                                          |
| rsvpConfirmationMode | api                                                                     | inferred       | owner     | Owner offered dashboard guest control and passes; client agreed ("Ok super")     |
| rsvpGuestCap         | 4                                                                       | inferred       | owner     | Owner default; passes are assigned per guest in the dashboard                    |
| musicUrl             | —                                                                       | missing        | wa-export | Client asked for "Life Is a Highway"; a hosted audio file is required            |
| dressCode            | —                                                                       | missing        | wa-export | Asked in the data list, not answered; optional, omitted                          |
| gifts                | —                                                                       | missing        | wa-export | Not requested; optional, omitted                                                 |
| hostsNames           | —                                                                       | missing        | wa-export | Parents not named; the purchaser is the celebrant's aunt. Family section omitted |
| clientContact        | Alin Salgado                                                            | verified       | wa-export | Purchaser; contact details stay outside this document                            |

Rules:

- `verified` requires explicit client/source evidence.
- `inferred` must include its basis and must never be phrased as a client statement.
- Absence of information never implies consent or preference.

---

## Event Completeness

Contract maturity for this event type: `partial` (`cumple`; evidenced from one adult birthday).
Contract gaps: family-name and itinerary requirement levels are under-evidenced, and age/occasion
lockups are not standardized. No fields were invented beyond the contract.

- **requirement:** required
  - **fields:** slug, celebrantName, eventDate, eventTime, baseDemoId, sourceAssetPath,
    sectionOrder, primaryVenueName, primaryVenueAddress, rsvpConfirmationMode
  - **status:** resolved
- **requirement:** recommended
  - **fields:** eventLabel, timeZone
  - **status:** resolved
- **requirement:** optional
  - **fields:** dressCode, gifts
  - **status:** missing (non-blocking, omitted)
- **requirement:** optional
  - **fields:** musicUrl, clientColors
  - **status:** musicUrl missing (non-blocking); clientColors verified

### Missing blockers

- None for implementation.

### Non-blocking gaps

- Music audio file pending (owner hosts the requested track).
- Parents' or hosts' names were never requested; the family section is omitted.

Deterministic question: **Is the available information sufficient to prepare this invitation?**  
Answer: `yes` (`evaluateEventCompleteness`).

---

## Placeholders

| token                     | missing datum | blocking | reason                                           | replacement requirement                                  |
| ------------------------- | ------------- | -------- | ------------------------------------------------ | -------------------------------------------------------- |
| `[[PENDIENTE:MUSIC_URL]]` | MUSIC_URL     | no       | Song named by the client, no audio file supplied | Host the track and add `music` to the managed definition |

Tokens are not written into the published payload: the music block is omitted until the file exists.

---

## Owner Decisions

| id               | category              | issue                                      | evidence                     | options                                        | recommendation                                                  |
| ---------------- | --------------------- | ------------------------------------------ | ---------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| PHOTO-ACCEPTANCE | photograph-acceptance | Only messaging-app JPEGs (518–768 px wide) | Four chat photographs        | request originals / accept as provided         | Resolved 2026-10-07: accepted as the definitive set             |
| SLUG             | demo-design-decisions | Public URL form                            | Client copy "Aithan Darell"  | aithan-ruiz / aithan-darell                    | Resolved 2026-10-07: `aithan-darell`                            |
| BASE-DEMO        | demo-design-decisions | No children's or Cars demo exists          | Catalog                      | editorial-magazine / hacienda remap / new demo | Resolved 2026-10-07: new `demo-cumple-editorial-magazine` entry |
| GUEST-CAP        | missing-client-facts  | Passes per guest not discussed             | Client asked how passes work | 4 / other                                      | Default 4; adjustable in the dashboard                          |
| HOSTS-NAMES      | missing-client-facts  | Parents not named                          | Purchaser is the aunt        | ask client / omit family section               | Omit; add `family` if the client supplies names                 |
| DRESS-CODE       | missing-client-facts  | Not answered                               | Owner data list              | ask client / omit                              | Omit                                                            |
| GIFTS            | missing-client-facts  | Not requested                              | —                            | ask client / omit                              | Omit                                                            |
| MUSIC-FILE       | missing-client-facts  | Song named, no file                        | "Life ls a highway canción"  | owner hosts audio / omit music                 | Owner hosts a trimmed audio file; add `music` afterwards        |

---

## Agent Recommendations

| topic    | recommendation                                                                | basis                                       | status                    |
| -------- | ----------------------------------------------------------------------------- | ------------------------------------------- | ------------------------- |
| demo     | editorial-magazine preset (ink, paper, racing red) as a racing-poster look    | client colors red/black/white; no kids demo | accepted by owner session |
| palette  | keep the preset tokens; disable the editorial desaturation so the red stays   | the car and race suit are the subject       | accepted by owner session |
| variants | avoid press-pass, editorial-pass, and editorial-catalog (XV labels in markup) | component literals                          | accepted by owner session |
| display  | `--font-display` to Instrument Sans if Bodoni reads too formal for a child    | preset fonts                                | pending owner review      |

---

## Sections

| bucket                 | section keys                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| requested              | hero (car photo), gallery, rsvp with passes, music (pending)     |
| inferred / recommended | quote, countdown, location, personalizedAccess, thankYou         |
| omitted                | family, itinerary, gifts, interludes, music (until audio exists) |
| unresolved             | music file                                                       |

---

## Design Direction

| decision                          | value                                                       | classification      |
| --------------------------------- | ----------------------------------------------------------- | ------------------- |
| Client-selected demo              | none (no children's demo to choose from)                    | not_applicable      |
| Owner-selected base demo          | demo-cumple-editorial-magazine                              | verified            |
| Recommended demo alternatives     | luxury-hacienda remap (rejected by owner)                   | recommendation only |
| Selected variant / visual profile | visualProfileId `aithan-darell`; theme `editorial-magazine` | verified            |
| Client color requirements         | red, black, white                                           | verified            |
| Recommended palette               | preset ink / paper / racing red, no desaturation            | verified            |
| Unresolved visual decisions       | display font (optional)                                     | pending             |

The preset folios carry an XV edition label; they now resolve from `--editorial-folio-*` custom
properties (fallbacks unchanged) and the `aithan-darell` profile relabels them for a 3-year-old's
party. Documented shared change, byte-identical for existing editorial-magazine invitations.

---

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING`

| concern                                                  | decision / evidence                                            | status     |
| -------------------------------------------------------- | -------------------------------------------------------------- | ---------- |
| Typography roles (display, heading, body, metadata)      | Preset editorial-magazine roles retained                       | pending    |
| Vertical rhythm and density                              | Preset rhythm retained; seven sections, no interludes          | pending    |
| Surface hierarchy (open flow vs cards/containers)        | Paper surfaces with ink countdown and RSVP chapters            | pending    |
| Photographic treatment (role, crop, focal point, filter) | Full color (desaturation disabled); car photo leads cover/hero | pending    |
| Section-intersection intent and narrative cadence        | Neutral intersections                                          | pending    |
| Local exceptions to the selected preset                  | Folio relabel tokens; no layout overrides                      | documented |

### Creative acceptance record

| field                                       | value                                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Mechanical render/capture result            | pass — Local v2 renders every section; full-page captures at mobile-standard and desktop (2026-10-07) |
| Whole-invitation responsive inspection      | 375×812 and 1440×900 inspected in the browser (agent review); no XV copy, no console errors           |
| Section boundaries and narrative continuity | pending human review                                                                                  |
| Human creative outcome                      | `PENDING`                                                                                             |
| Reviewer and date                           | —                                                                                                     |
| Blocking reason or owner follow-up          | Music file; optional display-font decision                                                            |

---

## Photograph Inventory

Source label: `source:client-photos` (opaque)  
All four files are messaging-app JPEGs; the owner accepted them as the definitive set, so no
originals are expected. Quality labels stay truthful.

| source filename | dims     | format | orientation | weight | quality              | role      | duplicate | processing                                | derivative     |
| --------------- | -------- | ------ | ----------- | ------ | -------------------- | --------- | --------- | ----------------------------------------- | -------------- |
| chat-054        | 704×1421 | jpeg   | portrait    | 171 KB | provisional-whatsapp | hero      | no        | ingested as provided                      | hero.jpg       |
| chat-053        | 768×1364 | jpeg   | portrait    | 128 KB | provisional-whatsapp | gallery01 | no        | ingested as provided                      | gallery-01.jpg |
| chat-055        | 739×1600 | jpeg   | portrait    | 166 KB | provisional-whatsapp | gallery02 | no        | letterbox bars removed (rows 302–1584)    | gallery-02.jpg |
| chat-052        | 518×1120 | jpeg   | portrait    | 29 KB  | provisional-whatsapp | gallery03 | no        | ingested as provided; low light, smallest | gallery-03.jpg |

### Uniqueness table (required before READY_*)

| role         | source   | derivative     | intentional multi-role?       |
| ------------ | -------- | -------------- | ----------------------------- |
| hero         | chat-054 | hero.jpg       | yes (cover, desktop card, OG) |
| heroPortrait | chat-054 | hero.jpg       | yes (same source, own key)    |
| gallery01    | chat-053 | gallery-01.jpg | no                            |
| gallery02    | chat-055 | gallery-02.jpg | no                            |
| gallery03    | chat-052 | gallery-03.jpg | no                            |

The client chose chat-054 (the ride-on car) as the main photograph. chat-052 is weak; the owner may
drop it, in which case the gallery switches to `paired-portraits`.

---

## Implementation Constraints

- Helper prepReadiness is `READY_WITH_PLACEHOLDERS`; implementation is allowed.
- Lane A inheritance resets: preset image desaturation disabled (hero, portrait, family, location,
  gallery filters set to `none`); folio labels relabelled through `--editorial-folio-*`.
- Variants: hero `editorial-cover`, countdown `magazine-folio`, location `standard`, gallery
  `feature-stack`, rsvp `formal-register`, personalizedAccess `formal-pass`, thankYou
  `editorial-back-cover`. The editorial press-pass, editorial-pass, and editorial-catalog variants
  print an XV edition label in their markup and are not used here.
- Envelope: `revealVariant: editorial-cover` with an explicit `coverEdition` ("3 años"); the reveal
  falls back to an XV mark when it is omitted. The cover face prints `envelope.coverLines` ("Una
  tarde de carreras" / "Retrato de un piloto"), a new optional field whose defaults are the original
  XV lines.
- Hero folio marks: `hero.presentation.coverMark` ("3", the watermark behind the cover) and
  `hero.presentation.coverPage` ("PÁG. 3") replace the editorial-cover renderer's XV defaults. Both
  are new optional fields; omitted values keep the previous output.
- Copy is owner-authored in the "usted" register, in the celebrant's first person ("Mis 3 años"); no
  client facts were invented. Client phrases used literally: "Mis 3 años", venue, address.
- Music omit / include: omitted until the owner hosts the audio file; then add
  `music: { url, title: 'Life Is a Highway', autoPlay: true }`.
- Shared change: `src/styles/invitation-sections-by-preset/editorial-magazine.scss` folio `content:`
  values now read `var(--editorial-folio-<section>, '<original text>')`.

---

## Preparation Readiness History

| date       | readiness                 | helper basis                                             | notes                                                          |
| ---------- | ------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| 2026-10-07 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` + `summarizeAssetQuality` | Initial preparation; provisional photos accepted as definitive |
