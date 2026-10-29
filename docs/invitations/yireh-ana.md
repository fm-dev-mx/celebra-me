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
| **Preparation Status** | `READY_WITH_PLACEHOLDERS`                         |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

---

## Sources

| Source                        | Reference                            | Notes                                                         |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export` (opaque label)    | Intake answers from the client (mother Nichme), 2026-10-27    |
| High-res photos / assets root | `source:watercolor-session` (opaque) | Watercolor illustrations generated from client refs 40 and 31 |
| Owner decisions               | `source:owner-session` (2026-10-27)  | D1–D5 resolved; fast mode to develop + Preview                |
| Owner review v2               | `source:owner-session` (2026-10-28)  | D6 Level-América craft, removal of synthetic data             |

---

## Fact Register

| field                | value                                                            | classification | source        | notes                                                         |
| -------------------- | ---------------------------------------------------------------- | -------------- | ------------- | ------------------------------------------------------------- |
| slug                 | yireh-ana                                                        | verified       | owner-session | Canonical slug without eventType prefix                       |
| celebrantName        | Yireh Ana                                                        | verified       | wa-export     | First and second name of the quinceañera                      |
| motherName           | Nichme Margarita Urueta Hermosillo                               | verified       | wa-export     | Mother of the celebrant                                       |
| fatherName           | —                                                                | not_applicable | wa-export     | Not provided by client; explicitly left out                   |
| godparents           | —                                                                | not_applicable | wa-export     | Not provided by client; explicitly left out                   |
| eventLabel           | Mis XV Años                                                      | inferred       | wa-export     | XV celebration title                                          |
| eventDate            | 2027-10-23                                                       | verified       | wa-export     | Saturday, October 23, 2027                                    |
| eventTime            | 19:00                                                            | verified       | wa-export     | Reception start time (19:00)                                  |
| receptionTime        | 19:00                                                            | verified       | wa-export     | Reception at Salón Casino Imperial                            |
| ceremonyTime         | Por definir                                                      | missing        | wa-export     | Time pending; announced in lede; venue card hidden            |
| timeZone             | America/Chihuahua                                                | inferred       | wa-export     | Ciudad Delicias, Chihuahua (UTC−6)                            |
| sourceAssetPath      | source:watercolor-session                                        | verified       | owner-session | Opaque label; watercolor illustrations                        |
| sectionOrder         | quote, countdown, location, family, pass, rsvp, thankYou         | verified       | owner-session | Gallery, synthetic itinerary & unchosen gifts omitted         |
| primaryVenueName     | Salón Casino Imperial                                            | verified       | wa-export     | Ceremony and reception in the same venue                      |
| primaryVenueAddress  | Carr. Delicias–Ortiz km 1, Centro, Ciudad Delicias, Chihuahua    | verified       | wa-export     | Highway Delicias-Ortiz km 1                                   |
| distinctVenues       | false                                                            | verified       | wa-export     | Both moments take place in the same hall                      |
| dressCode            | Formal                                                           | verified       | wa-export     | Formal dress code                                             |
| dressColor           | Por definir                                                      | missing        | wa-export     | Celebrant gown color pending                                  |
| musicUrl             | Tie a Yellow Ribbon Round the Ole Oak Tree — Tony Orlando & Dawn | verified       | wa-export     | Hosted on Cloudflare R2 at 64 kbps MP3 (YouTube: 8N1UutuYlL0) |
| noPhotosConsent      | true                                                             | verified       | wa-export     | Celebrant explicitly requested no personal photos/gallery     |
| rsvpConfirmationMode | api                                                              | verified       | owner-session | Digital confirmation flow with personalized passes            |
| rsvpGuestCap         | 1                                                                | inferred       | owner-session | Documented default pass cap                                   |
| gifts                | —                                                                | missing        | owner-session | Omitted until client chooses format                           |

---

## Event Completeness

XV contract maturity: `evidence-backed`. Required and conditional fields are verified or validly
inferred. The celebrant explicitly requested that no personal photos or silhouettes be included, so
gallery sections are deactivated. Botanical watercolor illustrations (ref 40 corners without books,
and ref 31 oak tree with yellow ribbons) serve as production-authoritative artwork.

### Missing blockers

- None blocking initial implementation and preview delivery.

### Non-blocking gaps

- Ceremony exact start time (officiated by Pastor Jesús Manuel Ozaeta Pérez in the same hall;
  announced in lede, venue card hidden until supplied).
- Gown color (dress code is formal; reserved gown color pending confirmation).
- Father and godparents (not provided in intake; left out unless supplied later).
- Gifts preference (omitted until client specifies registry or gift/cash note).

Deterministic question: **Is the available information sufficient to prepare this invitation?**  
Answer: `yes`.

---

## Placeholders

Non-blocking informational placeholders:

- `[[PENDIENTE:HORA_CEREMONIA]]`: Exact hour of the religious ceremony.
- `[[PENDIENTE:COLOR_VESTIDO]]`: Gown color reservation.

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

| topic  | recommendation                                                                       | basis                       | status                       |
| ------ | ------------------------------------------------------------------------------------ | --------------------------- | ---------------------------- |
| preset | `storybook-lilac`: pale lilac paper, candle gold, and violet ink                     | client requested pale lilac | accepted (2026-10-27)        |
| motifs | Watercolor lilac and purple florals, tiny yellow blossoms, subtle golden-yellow bows | client family story context | accepted (2026-10-27)        |
| hero   | Framed watercolor arch with title lettering on separate clean paper                  | ref 40 without books        | proposed; acceptance pending |
| roble  | Oak tree illustration with yellow ribbons as thank-you closing keepsake              | ref 31 and song theme       | accepted (2026-10-27)        |
| music  | 64 kbps MP3 loop, hosted on media domain                                             | canonical standard R8       | accepted (2026-10-27)        |

---

## Composition & Cadence Map

```text
// Cadence map — non-neutral boundaries only (3 joins, Bridge/Bridge/Climax)
countdown: overlap from interlude-after-quote (Bridge)
interlude-after-countdown: overlap from countdown (Bridge)
thankYou: arch from rsvp (Climax)
```

Every other boundary is a clean neutral cut between ultra-pale lilac paper and lilac mist.

---

## Sections

| bucket                 | section keys                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| requested              | location (reception verified), family (mother only), dress code, music (Yellow Ribbon)   |
| inferred / recommended | envelope, hero, quote, interludes (2), countdown, personalizedAccess, rsvp, thankYou     |
| client-provided        | music track: «Tie a Yellow Ribbon Round the Ole Oak Tree — Tony Orlando & Dawn»          |
| omitted                | gallery (celebrant refusal of photos), father/godparents (unsupplied), itinerary & gifts |
| unresolved             | ceremony exact time, gown color reservation                                              |

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
| Unresolved visual decisions       | Owner/client acceptance pending for the editorial redesign        | verified            |

---

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING`

- **concern:** Typography roles (display, heading, body, metadata)
  - **decision / evidence:** Preset serif display, gold accents, violet ink
  - **status:** accepted
- **concern:** Photographic treatment & art
  - **decision / evidence:** Hand-painted botanical watercolor; no human figures; oak tree with
    ribbons; 2 illustrated interludes
  - **status:** accepted
- **concern:** Section cadence and surface hierarchy
  - **decision / evidence:** Pale lilac watercolor paper throughout, gold divider rules, keepsake
    closing
  - **status:** accepted
- **concern:** Voice and copy
  - **decision / evidence:** Formal «usted» register, warm and respectful tone
  - **status:** accepted

### Creative acceptance record

| field                                       | value                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| Mechanical render/capture result            | Captures at 390×844 and 1440×900                                       |
| Whole-invitation responsive inspection      | Inspected on mobile and desktop viewports                              |
| Section boundaries and narrative continuity | Harmonious watercolor palette across all sections                      |
| Human creative outcome                      | `PENDING`                                                              |
| Reviewer and date                           | Antigravity agent & Owner direction, 2026-10-27/28                     |
| Blocking reason or owner follow-up          | Ceremony time, dress color and father/godparents stay owner follow-ups |

---

## Photograph Inventory

Source label: `source:watercolor-session` (opaque). Custom high-resolution botanical watercolor
artwork created specifically for this invitation, honoring the client's explicit request for no
photographs.

| source filename             | dims        | format | orientation | weight  | quality          | role        | duplicate   | processing                                  | derivative            |
| --------------------------- | ----------- | ------ | ----------- | ------- | ---------------- | ----------- | ----------- | ------------------------------------------- | --------------------- |
| botanical-cover-source.png  | 1084 x 1451 | WebP   | portrait    | 242 KiB | production-ready | hero        | no          | WebP, quality 86                            | hero-watercolor.webp  |
| botanical-ribbon-source.png | 1200 x 630  | WebP   | landscape   | 96 KiB  | production-ready | og-share    | intentional | 1200 x 630 cover crop, WebP                 | og-share.webp         |
| botanical-oak-source.png    | 1200 x 1400 | WebP   | portrait    | 168 KiB | production-ready | thank-you   | intentional | Full-tree portrait contain derivative, WebP | oak-tree.webp         |
| botanical-ribbon-source.png | 1440 x 1080 | WebP   | landscape   | 150 KiB | production-ready | interlude 1 | intentional | 1440 px WebP                                | interlude-ribbon.webp |
| botanical-oak-source.png    | 1440 x 960  | WebP   | landscape   | 228 KiB | production-ready | interlude 2 | intentional | 1440 px WebP                                | interlude-oak.webp    |

### Uniqueness table (required before READY_*)

| role        | source                      | derivative            | intentional multi-role?            |
| ----------- | --------------------------- | --------------------- | ---------------------------------- |
| hero        | botanical-cover-source.png  | hero-watercolor.webp  | no                                 |
| og-share    | botanical-ribbon-source.png | og-share.webp         | yes - dedicated social crop        |
| thank-you   | botanical-oak-source.png    | oak-tree.webp         | yes - separate portrait derivative |
| interlude 1 | botanical-ribbon-source.png | interlude-ribbon.webp | yes - landscape plate              |
| interlude 2 | botanical-oak-source.png    | interlude-oak.webp    | yes - landscape plate              |

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

| date       | readiness                 | helper basis                   | notes                                                     |
| ---------- | ------------------------- | ------------------------------ | --------------------------------------------------------- |
| 2026-10-27 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | Full intake and production watercolor assets ready (T417) |
| 2026-10-28 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | v2 Level-América craft, synthetic data removed (T423)     |
