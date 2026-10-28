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

---

## Fact Register

| field                | value                                                                      | classification | source        | notes                                                     |
| -------------------- | -------------------------------------------------------------------------- | -------------- | ------------- | --------------------------------------------------------- |
| slug                 | yireh-ana                                                                  | verified       | owner-session | Canonical slug without eventType prefix                   |
| celebrantName        | Yireh Ana                                                                  | verified       | wa-export     | First and second name of the quinceañera                  |
| motherName           | Nichme Margarita Urueta Hermosillo                                         | verified       | wa-export     | Mother of the celebrant                                   |
| fatherName           | —                                                                          | not_applicable | wa-export     | Not provided by client; explicitly left out               |
| godparents           | —                                                                          | not_applicable | wa-export     | Not provided by client; explicitly left out               |
| eventLabel           | Mis XV Años                                                                | inferred       | wa-export     | XV celebration title                                      |
| eventDate            | 2027-10-23                                                                 | verified       | wa-export     | Saturday, October 23, 2027                                |
| eventTime            | 19:00                                                                      | verified       | wa-export     | Reception start time (19:00)                              |
| receptionTime        | 19:00                                                                      | verified       | wa-export     | Reception at Salón Casino Imperial                        |
| ceremonyTime         | Por definir                                                                | missing        | wa-export     | Time pending; officiated by Pastor Jesús Manuel Ozaeta    |
| timeZone             | America/Chihuahua                                                          | inferred       | wa-export     | Ciudad Delicias, Chihuahua (UTC−6)                        |
| sourceAssetPath      | source:watercolor-session                                                  | verified       | owner-session | Opaque label; watercolor illustrations                    |
| sectionOrder         | quote, countdown, location, family, itinerary, gifts, pass, rsvp, thankYou | verified       | owner-session | Gallery disabled per celebrant explicit request           |
| primaryVenueName     | Salón Casino Imperial                                                      | verified       | wa-export     | Ceremony and reception in the same venue                  |
| primaryVenueAddress  | Carr. Delicias–Ortiz km 1, Centro, Ciudad Delicias, Chihuahua              | verified       | wa-export     | Highway Delicias-Ortiz km 1                               |
| distinctVenues       | false                                                                      | verified       | wa-export     | Both moments take place in the same hall                  |
| dressCode            | Formal                                                                     | verified       | wa-export     | Formal dress code                                         |
| dressColor           | Por definir                                                                | missing        | wa-export     | Celebrant gown color pending                              |
| musicUrl             | Tie a Yellow Ribbon Round the Ole Oak Tree                                 | verified       | wa-export     | Hosted on Cloudflare R2 at 64 kbps MP3                    |
| noPhotosConsent      | true                                                                       | verified       | wa-export     | Celebrant explicitly requested no personal photos/gallery |
| rsvpConfirmationMode | api                                                                        | verified       | owner-session | Digital confirmation flow with personalized passes        |
| rsvpGuestCap         | 2                                                                          | inferred       | owner-session | Standard default pass cap                                 |
| gifts                | Lluvia de sobres                                                           | inferred       | owner-session | Legend-only note                                          |

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
  currently «Por definir»).
- Gown color (dress code is formal; reserved gown color pending confirmation).
- Father and godparents (not provided in intake; left out unless supplied later).

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

---

## Agent Recommendations

| topic  | recommendation                                                                       | basis                       | status                |
| ------ | ------------------------------------------------------------------------------------ | --------------------------- | --------------------- |
| preset | `storybook-lilac`: pale lilac paper, candle gold, and violet ink                     | client requested pale lilac | accepted (2026-10-27) |
| motifs | Watercolor lilac and purple florals, tiny yellow blossoms, subtle golden-yellow bows | client family story context | accepted (2026-10-27) |
| hero   | Standard watercolor cover with negative space for elegant title lettering            | ref 40 without books        | accepted (2026-10-27) |
| roble  | Oak tree illustration with yellow ribbons as thank-you closing keepsake              | ref 31 and song theme       | accepted (2026-10-27) |
| music  | 64 kbps MP3 loop, hosted on media domain                                             | canonical standard R8       | accepted (2026-10-27) |

---

## Sections

| bucket                 | section keys                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| requested              | location (ceremony + reception), family (mother only), dress code, music (Yellow Ribbon) |
| inferred / recommended | envelope, hero, quote, countdown, itinerary, gifts, personalizedAccess, rsvp, thankYou   |
| client-provided        | music track: «Tie a Yellow Ribbon Round the Ole Oak Tree»                                |
| omitted                | gallery (celebrant refusal of photos), father/godparents (unsupplied)                    |
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
| Unresolved visual decisions       | None; artwork generated and validated against brief               | verified            |

---

## Creative Direction & Acceptance

**Human creative outcome:** `ACCEPTED`

- **concern:** Typography roles (display, heading, body, metadata)
  - **decision / evidence:** Preset serif display, gold accents, violet ink
  - **status:** accepted
- **concern:** Photographic treatment & art
  - **decision / evidence:** Hand-painted botanical watercolor; no human figures; oak tree with
    ribbons
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
| Human creative outcome                      | `ACCEPTED`                                                             |
| Reviewer and date                           | Antigravity agent & Owner direction, 2026-10-27                        |
| Blocking reason or owner follow-up          | Ceremony time, dress color and father/godparents stay owner follow-ups |

---

## Photograph Inventory

Source label: `source:watercolor-session` (opaque). Custom high-resolution botanical watercolor
artwork created specifically for this invitation, honoring the client's explicit request for no
photographs.

| source filename             | dims     | format | orientation | weight | quality          | role      | duplicate   | processing                             | derivative                            |
| --------------------------- | -------- | ------ | ----------- | ------ | ---------------- | --------- | ----------- | -------------------------------------- | ------------------------------------- |
| watercolor-cover-source.jpg | 768×1376 | JPEG   | portrait    | 420 KB | production-ready | hero      | no          | Lanczos 2× upscale to 1536×2736, WebP  | hero-watercolor.webp 1536×2736 348 KB |
| watercolor-cover-source.jpg | 768×1376 | JPEG   | portrait    | 420 KB | production-ready | og-share  | intentional | Crop 1200×630 for social cards, WebP   | og-share.webp 1200×630 18 KB          |
| watercolor-cover-source.jpg | 768×1376 | JPEG   | portrait    | 420 KB | production-ready | thank-you | intentional | Detail crop of oak tree keepsake, WebP | oak-tree.webp 1080×783 73 KB          |

### Uniqueness table (required before READY_*)

| role      | source                      | derivative           | intentional multi-role?              |
| --------- | --------------------------- | -------------------- | ------------------------------------ |
| hero      | watercolor-cover-source.jpg | hero-watercolor.webp | yes — full cover artwork             |
| og-share  | watercolor-cover-source.jpg | og-share.webp        | yes — social preview card crop       |
| thank-you | watercolor-cover-source.jpg | oak-tree.webp        | yes — oak tree keepsake closing crop |

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
