# Canonical Invitation Preparation State — `yireh-ana`

> Schema owner: `docs/core/invitation-creation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Skill: `.agent/skills/invitation-preparation/SKILL.md`

---

## Identity

| Parameter              | Value                                             |
| ---------------------- | ------------------------------------------------- |
| **Slug**               | `yireh-ana` (verified celebrant name)             |
| **Host Login Alias**   | `yireh_ana` (ASCII lowercase, celebrant identity) |
| **Event Type**         | `xv`                                              |
| **Preparation Status** | `READY_FOR_IMPLEMENTATION`                        |

**Preparation Readiness (prepReadiness):** `READY_FOR_IMPLEMENTATION`

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

---

## Sources

| Source                        | Reference                            | Notes                                                         |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export` (opaque label)    | Intake answers from the client (mother Nichme), 2026-10-27    |
| High-res photos / assets root | `source:watercolor-session` (opaque) | Watercolor illustrations generated from client refs 40 and 31 |
| Owner decisions               | `source:owner-session` (2026-10-27)  | D1–D5 resolved; fast mode to develop + Preview                |
| Owner review v2               | `source:owner-session` (2026-10-28)  | D6                                                            | quality-level | Level-América                     | owner-session                                                  | Standard v1 / Level-América v2 | Bespoke narrative of oak/ribbons, 2 interludes, custom seal |
| D7                            | design-direction                     | Cover and oak                                                 | owner-session | Oak in several sections / one oak | One oak on the cover and the seal only (2026-10-29)            |
| D8                            | design-direction                     | Motifs                                                        | owner-session | Repeated motifs / one job each    | Bow ends the ribbon and crowns the reply; quote on clean paper |
| D9                            | design-direction                     | Scenes                                                        | owner-session | Static sections / scroll-driven   | Every section moves with scroll; ribbon scene on program       |
| D10                           | release-scope                        | Friday scope                                                  | owner-session | Ribbon + accents / two scenes     | Ribbon scene and accents now; 2nd pinned scene follows         |
| D11                           | design-direction                     | Cover to quote                                                | owner-session | Corner bloom / oak approach       | Pinned cover closes in on the oak's ribbon; no branch          |
| Owner review v3               | `source:owner-session` (2026-10-29)  | D7–D11: cover oak, motif roles, scenes, delivery scope        |
| Client voice notes            | `source:wa-export` (2026-10-29)      | Thanksgiving, estimated program, food, punctuality, gifts     |

---

## Fact Register

| field                | value                                                                      | classification | source        | notes                                                         |
| -------------------- | -------------------------------------------------------------------------- | -------------- | ------------- | ------------------------------------------------------------- |
| slug                 | yireh-ana                                                                  | verified       | owner-session | Canonical slug without eventType prefix                       |
| celebrantName        | Yireh Ana                                                                  | verified       | wa-export     | First and second name of the quinceañera                      |
| motherName           | Nichme Margarita Urueta Hermosillo                                         | verified       | wa-export     | Mother of the celebrant                                       |
| fatherName           | —                                                                          | not_applicable | wa-export     | Not provided by client; explicitly left out                   |
| godparents           | —                                                                          | not_applicable | wa-export     | Not provided by client; explicitly left out                   |
| eventLabel           | Mis XV Años                                                                | inferred       | wa-export     | XV celebration title                                          |
| eventDate            | 2027-10-23                                                                 | verified       | wa-export     | Saturday, October 23, 2027                                    |
| eventTime            | 19:00                                                                      | verified       | wa-export     | Reception start time (19:00)                                  |
| receptionTime        | 19:00                                                                      | verified       | wa-export     | Reception at Salón Casino Imperial                            |
| ceremonyTime         | 19:30                                                                      | verified       | wa-export     | Thanksgiving by Pastor Jesús Manuel Ozaeta Pérez, same hall   |
| timeZone             | America/Chihuahua                                                          | inferred       | wa-export     | Ciudad Delicias, Chihuahua (UTC−6)                            |
| sourceAssetPath      | source:watercolor-session                                                  | verified       | owner-session | Opaque label; watercolor illustrations                        |
| sectionOrder         | quote, countdown, location, itinerary, family, gifts, pass, rsvp, thankYou | verified       | owner-session | Gallery omitted (no photos)                                   |
| primaryVenueName     | Salón Casino Imperial                                                      | verified       | wa-export     | Ceremony and reception in the same venue                      |
| primaryVenueAddress  | Carr. Delicias–Ortiz km 1, Centro, Ciudad Delicias, Chihuahua              | verified       | wa-export     | Highway Delicias-Ortiz km 1                                   |
| distinctVenues       | false                                                                      | verified       | wa-export     | Both moments take place in the same hall                      |
| dressCode            | Formal                                                                     | verified       | wa-export     | Formal dress code                                             |
| dressColor           | —                                                                          | not_applicable | wa-export     | Client chose not to reserve a gown color (2026-10-29)         |
| musicUrl             | Tie a Yellow Ribbon Round the Ole Oak Tree — Tony Orlando & Dawn           | verified       | wa-export     | Hosted on Cloudflare R2 at 64 kbps MP3 (YouTube: 8N1UutuYlL0) |
| noPhotosConsent      | true                                                                       | verified       | wa-export     | Celebrant explicitly requested no personal photos/gallery     |
| rsvpConfirmationMode | api                                                                        | verified       | owner-session | Digital confirmation flow with personalized passes            |
| rsvpGuestCap         | 1                                                                          | inferred       | owner-session | Documented default pass cap                                   |
| gifts                | Legend only                                                                | verified       | wa-export     | «Lo que disponga su corazón será bien recibido»               |

---

## Event Completeness

XV contract maturity: `evidence-backed`. Required and conditional fields are verified or validly
inferred. The celebrant explicitly requested that no personal photos or silhouettes be included, so
gallery sections are deactivated. Botanical watercolor illustrations (ref 40 corners without books,
and one oak with a yellow ribbon on the cover) serve as production-authoritative artwork.

### Missing blockers

- None blocking initial implementation and preview delivery.

### Non-blocking gaps

- Father and godparents (not provided in intake; left out unless supplied later).
- Program hours are client estimates (19:00 Recepción, 19:30 Acción de gracias, 21:00 Vals and
  toast, 21:30 Bocadillos y aguas frescas and dance, 24:00 Cierre); the copy says so. No alcohol.
- Final art: the owner kept the v3 cover and the flower wax seal without initials (2026-10-30); the
  cover v4 plate and the oak seal stamp were dropped.

Deterministic question: **Is the available information sufficient to prepare this invitation?**  
Answer: `yes`.

---

## Placeholders

None. Cover v4 and the oak seal were dropped by the owner on 2026-10-30.

---

## Owner Decisions

| id  | category              | issue           | evidence      | options                             | outcome (2026-10-27)                                        |
| --- | --------------------- | --------------- | ------------- | ----------------------------------- | ----------------------------------------------------------- |
| D1  | demo-design-decisions | Base preset     | wa-export     | `storybook-lilac` / custom preset   | `storybook-lilac`: ultra-pale lilac paper, violet ink, gold |
| D2  | design-direction      | Visual theme    | wa-export     | Realistic / Watercolor illustration | Watercolor illustration: ref 40 (no books) + ref 31 roble   |
| D3  | photograph-acceptance | Personal photos | wa-export     | Include photos / Disable gallery    | Celebrant refuses photos; gallery sections turned off       |
| D4  | missing-client-facts  | Music file      | wa-export     | YouTube link supplied by client     | Downloaded, encoded to 64 kbps MP3, hosted on Cloudflare R2 |
| D5  | release-scope         | Target delivery | owner-session | Preview PR / Production             | Fast mode up to develop + Preview PR                        |
| D6  | quality-level         | Level-América   | owner-session | Standard v1 / Level-América v2      | Bespoke narrative of oak/ribbons, 2 interludes, custom seal |

---

## Agent Recommendations

| topic  | recommendation                                                                       | basis                       | status                |
| ------ | ------------------------------------------------------------------------------------ | --------------------------- | --------------------- |
| preset | `storybook-lilac`: pale lilac paper, candle gold, and violet ink                     | client requested pale lilac | accepted (2026-10-27) |
| motifs | Watercolor lilac and purple florals, tiny yellow blossoms, subtle golden-yellow bows | client family story context | accepted (2026-10-27) |
| hero   | Ref 40 without books: corners on top, name on clean paper, one oak with a ribbon     | ref 40, owner review v3     | accepted (2026-10-29) |
| roble  | Oak only on the cover; flower wax seal; interludes and closing have none             | owner review v3, 2026-10-30 | accepted (2026-10-30) |
| music  | 64 kbps MP3 loop, hosted on media domain                                             | canonical standard R8       | accepted (2026-10-27) |

---

## Composition & Cadence Map

```text
// Cadence map — non-neutral boundaries only (3 joins, Bridge/Bridge/Climax)
countdown: overlap from quote (Bridge)
interlude-after-countdown: overlap from countdown (Bridge)
thankYou: arch from rsvp (Climax)
```

Every other boundary is a clean neutral cut between ultra-pale lilac paper and lilac mist. The night
surface appears only for contrast, on the countdown and the closing.

### Scene plan (D9–D11)

| section        | movement with scroll                                                       |
| -------------- | -------------------------------------------------------------------------- |
| hero           | **Pinned scene:** the cover closes in on the oak's ribbon; the text leaves |
| quote          | The words appear one by one on clean paper                                 |
| interludes 1/2 | Framed bouquet settles flat; envelope unfolds                              |
| countdown      | The count unfolds into place                                               |
| location       | The dress-code tag swings on its cord                                      |
| itinerary      | **Pinned scene:** a yellow ribbon draws past each moment and ends in a bow |
| family         | The divider draws from the centre                                          |
| gifts          | The gift line rises                                                        |
| pass / rsvp    | The pass settles flat; the reply card rises                                |
| thankYou       | The wreath unfolds into the night                                          |

Two pinned scenes, never adjacent, about 28 % of the page height at 390×844 and 26 % at 1440×900.
Reduced motion and browsers without scroll timelines show the resting layout. Motif roles: the bow
ends the ribbon and crowns the reply card; flowers appear only on the cover, the bouquet and
envelope stills and the closing wreath.

---

## Sections

| bucket                 | section keys                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------ |
| requested              | location, itinerary (estimated hours), family (mother only), gifts line, dress code  |
| inferred / recommended | envelope, hero, quote, interludes (2), countdown, personalizedAccess, rsvp, thankYou |
| client-provided        | music track: «Tie a Yellow Ribbon Round the Ole Oak Tree — Tony Orlando & Dawn»      |
| omitted                | gallery (celebrant refusal of photos), father/godparents (unsupplied), gown color    |
| unresolved             | none                                                                                 |

Guest-facing copy: Voice in first person, «usted» register, formal and emotive.

---

## Design Direction

| decision                          | value                                                             | classification      |
| --------------------------------- | ----------------------------------------------------------------- | ------------------- |
| Selected theme preset             | `storybook-lilac` (D1)                                            | verified            |
| Recommended preset alternatives   | —                                                                 | recommendation only |
| Selected variant / visual profile | `yireh-ana` (token-only profile on `storybook-lilac`)             | verified            |
| Client color requirements         | Fondo lila ultra pálido, flores lilas y moradas, toques amarillos | verified            |
| Recommended palette               | Lilac paper, soft mist, violet ink, leaf gold, yellow ribbons     | recommendation only |
| Unresolved visual decisions       | None; owner accepted the editorial redesign on 2026-10-30         | verified            |

---

## Creative Direction & Acceptance

**Human creative outcome:** `ACCEPTED`

- **concern:** Typography roles (display, heading, body, metadata)
  - **decision / evidence:** Preset serif display, gold accents, violet ink
  - **status:** accepted
- **concern:** Photographic treatment & art
  - **decision / evidence:** Hand-painted botanical watercolor; no human figures; oak tree with
    ribbon on the cover; 3 illustrated interludes
  - **status:** accepted
- **concern:** Section cadence and surface hierarchy
  - **decision / evidence:** Pale lilac watercolor paper throughout, gold divider rules, keepsake
    closing
  - **status:** accepted
- **concern:** Voice and copy
  - **decision / evidence:** Formal «usted» register, warm and respectful tone
  - **status:** accepted

### Creative acceptance record

| field                                       | value                                                    |
| ------------------------------------------- | -------------------------------------------------------- |
| Mechanical render/capture result            | Captures at 390×844 and 1440×900                         |
| Whole-invitation responsive inspection      | Inspected on mobile and desktop viewports                |
| Section boundaries and narrative continuity | Harmonious watercolor palette across all sections        |
| Human creative outcome                      | `ACCEPTED` (owner, 2026-10-30)                           |
| Reviewer and date                           | Owner, 2026-10-30                                        |
| Blocking reason or owner follow-up          | None; father/godparents only if the client supplies them |

---

## Photograph Inventory

Source label: `source:watercolor-session` (opaque). Custom high-resolution botanical watercolor
artwork created specifically for this invitation, honoring the client's explicit request for no
photographs.

| source filename       | dims        | format | orientation | weight  | quality          | role         | duplicate   | processing                                      | derivative              |
| --------------------- | ----------- | ------ | ----------- | ------- | ---------------- | ------------ | ----------- | ----------------------------------------------- | ----------------------- |
| v3/hero-v3.webp       | 1080 x 1920 | WebP   | portrait    | 214 KiB | production-ready | hero         | no          | WebP, quality 82                                | hero-cover.webp         |
| v3/hero-v3.webp       | 1920 x 1080 | WebP   | landscape   | 193 KiB | production-ready | hero desktop | intentional | Plate composed on wide paper                    | hero-cover-wide.webp    |
| og/oak-ribbon         | 1200 x 630  | WebP   | landscape   | 77 KiB  | production-ready | og-share     | no          | Native 1.91:1 card; oak + ribbon in centre 630² | og-share.webp           |
| v3/interlude-bouquet  | 1536 x 1024 | WebP   | landscape   | 124 KiB | production-ready | interlude 1  | no          | WebP                                            | interlude-bouquet.webp  |
| v3/interlude-envelope | 1536 x 1024 | WebP   | landscape   | 44 KiB  | production-ready | interlude 2  | no          | Edges feathered into paper                      | interlude-envelope.webp |
| v3/closing-wreath     | 1254 x 1254 | WebP   | square      | 156 KiB | production-ready | thank-you    | no          | Round medallion                                 | closing-wreath.webp     |
| v3/bow                | 360 x 308   | WebP   | landscape   | 27 KiB  | production-ready | bow          | intentional | Trimmed alpha WebP; ribbon end and crest        | bow.webp                |

### Uniqueness table (required before READY_*)

| role         | source                | derivative              | intentional multi-role?               |
| ------------ | --------------------- | ----------------------- | ------------------------------------- |
| hero         | v3/hero-v3.webp       | hero-cover.webp         | no                                    |
| hero desktop | v3/hero-v3.webp       | hero-cover-wide.webp    | yes - wide composition of the cover   |
| og-share     | og/oak-ribbon         | og-share.webp           | no - own painted card (square-safe)   |
| interlude 1  | v3/interlude-bouquet  | interlude-bouquet.webp  | no                                    |
| interlude 2  | v3/interlude-envelope | interlude-envelope.webp | no                                    |
| thank-you    | v3/closing-wreath     | closing-wreath.webp     | no                                    |
| bow          | v3/bow                | bow.webp                | yes - ribbon end and reply-card crest |

Source label: source:editorial-watercolor-session. Generated botanical watercolor plates share one
translucent pigment treatment. No client photos or human figures are included. Dimensions, formats
and weights above describe the delivered derivatives; source filenames are logical labels.

---

## Implementation Constraints

- Client folder: `src/invitations/clients/yireh-ana/` (definition `invitation.ts`, token-only
  `profile.scss`, `assets/`).
- No photos of celebrant; gallery disabled in `sectionOrder`.
- Music: 64 kbps MP3 hosted on Cloudflare R2 at
  `https://media.celebra-me.com/invitations/xv/yireh-ana/music-b35b0e7c7aea0a11fa5f13fa0537bb5f4df26e09a1e94919362b59f5c671b80e.mp3`.
- Voice register: strict «usted».

---

## Preparation Readiness History

| date       | readiness                  | helper basis                   | notes                                                           |
| ---------- | -------------------------- | ------------------------------ | --------------------------------------------------------------- |
| 2026-10-27 | `READY_WITH_PLACEHOLDERS`  | `evaluatePreparationReadiness` | Full intake and production watercolor assets ready (T417)       |
| 2026-10-28 | `READY_WITH_PLACEHOLDERS`  | `evaluatePreparationReadiness` | v2 Level-América craft, synthetic data removed (T423)           |
| 2026-10-29 | `READY_WITH_PLACEHOLDERS`  | `evaluatePreparationReadiness` | v3 stationery, client program, two scenes (T455)                |
| 2026-10-30 | `READY_FOR_IMPLEMENTATION` | `evaluatePreparationReadiness` | Owner accepted v3 cover and flower seal; no placeholders remain |
