# Canonical Invitation Preparation State — `destenid-sofia`

> Schema owner: `docs/core/invitation-preparation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Skill: `.agent/skills/invitation-preparation/SKILL.md`

---

## Identity

| Parameter              | Value                     |
| ---------------------- | ------------------------- |
| **Slug**               | `destenid-sofia`          |
| **Host Login Alias**   | `destenid_sofia`          |
| **Event Type**         | `xv`                      |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS` |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

Helper outcome: structural decisions are resolved; the start time is an owner-authorized provisional
value, bank-transfer data and music are pending, and every photograph is WhatsApp-class.
Implementation may proceed; Production release stays blocked until the pending client data is
replaced.

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document.

Canonical route: `/xv/destenid-sofia` — slug must not include `eventType`. The slug uses the two
given names by explicit owner decision (no surname supplied or requested for public display).

---

## Sources

| Source                        | Reference              | Notes                                                             |
| ----------------------------- | ---------------------- | ----------------------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export`     | Evidence only — never photo SoT; voice notes confirmed irrelevant |
| High-res photos / assets root | `source:hr-photos`     | WeTransfer delivery of WhatsApp-class JPEGs; opaque label only    |
| Owner session                 | `source:owner-session` | Slug, provisional time, gift handling, photo selection, palette   |

---

## Fact Register

| field                | value                                                                                             | classification | source            | notes                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------- | -------------- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| slug                 | destenid-sofia                                                                                    | verified       | owner             | Owner decision; two given names, no eventType prefix                                                    |
| hostLoginAlias       | destenid_sofia                                                                                    | verified       | owner             | No surname supplied                                                                                     |
| celebrantName        | Destenid Sofía                                                                                    | verified       | wa-export + owner | Client wrote "Destenid"; owner supplied "Sofia". Accent on "Sofía" to be confirmed during client review |
| eventLabel           | XV años de Destenid Sofía                                                                         | verified       | wa-export         |                                                                                                         |
| eventDate            | 2026-11-13                                                                                        | verified       | wa-export         | Friday 13 November 2026                                                                                 |
| eventTime            | 19:00                                                                                             | inferred       | owner             | Owner-authorized provisional value; the client has not stated a time. Must be confirmed before release  |
| timeZone             | America/Mexico_City                                                                               | inferred       | geography         | Cuautitlán Izcalli, Estado de México; not client-stated                                                 |
| baseDemoId           | demo-xv-editorial-magazine                                                                        | verified       | wa-export         | Client selected the valentina-hernandez invitation as the reference style                               |
| sourceAssetPath      | source:hr-photos                                                                                  | verified       | owner             | Opaque label only                                                                                       |
| sectionOrder         | quote, family, countdown, itinerary, location, gallery, gifts, personalizedAccess, rsvp, thankYou | inferred       | owner             | Mirrors the reference invitation; family carries the prayer instead of parents                          |
| primaryVenueName     | Jardín Quinta Paraíso                                                                             | verified       | wa-export         | Reception only                                                                                          |
| primaryVenueAddress  | Calle Rosa Violeta 8, C.P. 54765, Cuautitlán Izcalli, Estado de México                            | verified       | wa-export         | Client wrote "54765 calle Rosa Violeta 8"; 54765 read as postal code                                    |
| distinctVenues       | false                                                                                             | verified       | wa-export         | Client stated there is no Mass                                                                          |
| ceremonyMapUrl       | —                                                                                                 | not_applicable | wa-export         | No ceremony; reception uses a Maps search URL                                                           |
| fatherName           | —                                                                                                 | not_applicable | wa-export         | Client explicitly does not want parents' names                                                          |
| motherName           | —                                                                                                 | not_applicable | wa-export         | Client explicitly does not want parents' names                                                          |
| godparents           | —                                                                                                 | not_applicable | wa-export         | Client explicitly does not want godparents                                                              |
| dressCode            | —                                                                                                 | missing        | —                 | Not supplied; omitted rather than invented                                                              |
| gifts                | lluvia de sobres; transferencia                                                                   | verified       | wa-export         | Bank details pending from the client                                                                    |
| musicUrl             | —                                                                                                 | missing        | wa-export         | RBD track from a YouTube link, starting at 0:39; a direct audio file is required                        |
| clientColors         | beige, dorado, negro                                                                              | verified       | wa-export         | Dress is beige with gold; celebrant requested black as well                                             |
| rsvpConfirmationMode | both                                                                                              | inferred       | owner             | Client asked for named passes; mirrors the reference invitation                                         |
| rsvpGuestCap         | 4                                                                                                 | inferred       | owner             | Per-guest passes are assigned in the dashboard                                                          |
| rsvpWhatsappPhone    | client WhatsApp (definition only)                                                                 | verified       | wa-export         | Number is recorded in the managed definition, not in this document                                      |
| specialMessages      | opening phrase, two thank-you phrases, prayer                                                     | verified       | wa-export         | Quote, gallery subtitle, thank-you message, and family (prayer) section                                 |
| instagramHandle      | @desteny_ts                                                                                       | verified       | wa-export         | Handle spelling differs from the given name; kept literal                                               |

Rules:

- `verified` requires explicit client/source evidence.
- `inferred` must include its basis and must never be phrased as a client statement.
- Absence of information never implies consent or preference.

---

## Event Completeness

Contract maturity for this event type: `evidence-backed` (`xv`).

- **requirement:** required
  - **fields:** slug, celebrantName, eventLabel, eventDate, eventTime, timeZone, baseDemoId,
    sourceAssetPath, sectionOrder, primaryVenueName, primaryVenueAddress, rsvpConfirmationMode,
    rsvpGuestCap
  - **status:** resolved (eventTime provisional)
- **requirement:** conditional
  - **fields:** receptionVenueName, receptionVenueAddress
  - **status:** skipped (single venue)
- **requirement:** conditional
  - **fields:** rsvpWhatsappPhone
  - **status:** resolved
- **requirement:** recommended
  - **fields:** fatherName, motherName, godparents, ceremonyMapUrl
  - **status:** not_applicable
- **requirement:** optional
  - **fields:** dressCode, musicUrl
  - **status:** missing (non-blocking)

### Missing blockers

- None for implementation.

### Non-blocking gaps

- Start time is provisional (blocks Production release, not implementation).
- Bank-transfer details pending.
- Music audio file pending.
- Dress code not supplied.

Deterministic question: **Is the available information sufficient to prepare this invitation?**  
Answer: `yes` (`evaluateEventCompleteness`).

---

## Placeholders

| token                      | missing datum | blocking | reason                                             | replacement requirement                                   |
| -------------------------- | ------------- | -------- | -------------------------------------------------- | --------------------------------------------------------- |
| `[[PENDIENTE:EVENT_TIME]]` | EVENT_TIME    | no       | Client has not stated the start time               | Replace provisional 19:00 in timing, itinerary, and venue |
| `[[PENDIENTE:GIFTS_BANK]]` | GIFTS_BANK    | no       | Client will send bank data later                   | Add a `bank` gift item with bank, holder, and CLABE       |
| `[[PENDIENTE:MUSIC_URL]]`  | MUSIC_URL     | no       | Needs a direct audio file trimmed to start at 0:39 | Host the trimmed audio and add `music` to the definition  |

Tokens are not written into the published payload: the provisional time is a real value, and the
bank item and music block are omitted until their data exists.

---

## Owner Decisions

| id           | category              | issue                                 | evidence                      | options                                  | recommendation                                   |
| ------------ | --------------------- | ------------------------------------- | ----------------------------- | ---------------------------------------- | ------------------------------------------------ |
| EVENT-TIME   | missing-client-facts  | Start time not supplied               | Only date and venue were sent | ask client / keep provisional            | Resolved: provisional 19:00, confirm pre-release |
| GIFTS-BANK   | missing-client-facts  | Bank data pending                     | Client will send later        | add later / envelopes only               | Resolved: envelopes now, bank item later         |
| PHOTO-SOURCE | photograph-acceptance | Photos are WhatsApp-class (1066×1600) | WeTransfer delivery           | request originals / accept as provided   | Request photographer originals if available      |
| MUSIC-AUDIO  | missing-client-facts  | Only a YouTube link with a 0:39 start | Client message                | owner trims and hosts audio / omit music | Owner supplies a trimmed, hosted audio file      |

---

## Agent Recommendations

| topic   | recommendation                                         | basis                                             | status                    |
| ------- | ------------------------------------------------------ | ------------------------------------------------- | ------------------------- |
| demo    | demo-xv-editorial-magazine                             | client picked the valentina-hernandez reference   | accepted by owner session |
| palette | warm black surfaces, beige paper, antique gold accents | dress colors plus the celebrant's black request   | accepted by owner session |
| photos  | prefer frames where the ball gown is not fully shown   | client asked that the dress not be fully revealed | accepted by owner session |

---

## Sections

| bucket                 | section keys                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------- |
| requested              | quote, family (prayer), gallery, gifts, personalizedAccess, rsvp, thankYou            |
| inferred / recommended | countdown, itinerary, location, one interlude (after location)                        |
| omitted                | parents, godparents, ceremony venue, dress code, music (until audio exists), photo QR |
| unresolved             | start time, bank data, music                                                          |

---

## Design Direction

| decision                          | value                                                              | classification      |
| --------------------------------- | ------------------------------------------------------------------ | ------------------- |
| Client-selected demo              | demo-xv-editorial-magazine (via the valentina-hernandez reference) | verified            |
| Recommended demo alternatives     | none                                                               | recommendation only |
| Selected variant / visual profile | visualProfileId `destenid-sofia`; theme `editorial-magazine`       | verified            |
| Client color requirements         | beige, gold, black                                                 | verified            |
| Recommended palette               | black / beige / antique gold token remap                           | verified            |
| Unresolved visual decisions       | none                                                               | —                   |

The token-only remap rendered noticeably plainer than the client's reference, whose look lives in
its own profile SCSS. By owner decision (2026-09-29) the valentina-hernandez section overrides were
ported into `destenid-sofia.scss`, rescoped and recolored to `--ds-*` tokens. This is a documented
local exception to the token-remap-only guidance.

---

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING`

| concern                                                  | decision / evidence                                       | status     |
| -------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| Typography roles (display, heading, body, metadata)      | Preset editorial-magazine roles retained                  | pending    |
| Vertical rhythm and density                              | Preset rhythm retained                                    | pending    |
| Surface hierarchy (open flow vs cards/containers)        | Beige paper surfaces with black quote and RSVP chapters   | pending    |
| Photographic treatment (role, crop, focal point, filter) | Full color (preset desaturation disabled); unique roles   | pending    |
| Section-intersection intent and narrative cadence        | Reference dividers ported; one interlude after location   | pending    |
| Local exceptions to the selected preset                  | Ported reference section overrides (see Design Direction) | documented |

### Creative acceptance record

| field                                       | value                                         |
| ------------------------------------------- | --------------------------------------------- |
| Mechanical render/capture result            | pass — Local v4 rendered every section        |
| Whole-invitation responsive inspection      | 390×844 and 1440×900 captured (agent review)  |
| Section boundaries and narrative continuity | pending                                       |
| Human creative outcome                      | `PENDING`                                     |
| Reviewer and date                           | —                                             |
| Blocking reason or owner follow-up          | Start time, bank data, music, photo originals |

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque)  
All 22 received files are WhatsApp-class JPEGs. 15 were selected; 7 near-duplicates were not
ingested.

| source filename | dims      | format | orientation | weight | quality              | role             | duplicate     | processing           | derivative             |
| --------------- | --------- | ------ | ----------- | ------ | -------------------- | ---------------- | ------------- | -------------------- | ---------------------- |
| WA0029          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | hero             | no            | ingested as provided | hero.jpg               |
| WA0034          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | portrait         | no            | ingested as provided | portrait.jpg           |
| WA0043          | 1046×1569 | jpeg   | portrait    | WA     | provisional-whatsapp | prayerPortrait   | no            | ingested as provided | prayer-portrait.jpg    |
| WA0053          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | interlude01      | no            | ingested as provided | interlude-01.jpg       |
| WA0035          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | thankYouPortrait | near WA0034   | ingested as provided | thank-you-portrait.jpg |
| WA0045          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | gallery01        | no            | ingested as provided | gallery-01.jpg         |
| WA0051          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | gallery02        | no            | ingested as provided | gallery-02.jpg         |
| WA0052          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | gallery03        | no            | ingested as provided | gallery-03.jpg         |
| WA0060          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | gallery04        | no            | ingested as provided | gallery-04.jpg         |
| WA0063          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | gallery05        | no            | ingested as provided | gallery-05.jpg         |
| WA0046          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | gallery06        | no            | ingested as provided | gallery-06.jpg         |
| WA0054          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | gallery07        | no            | ingested as provided | gallery-07.jpg         |
| WA0055          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | gallery08        | no            | ingested as provided | gallery-08.jpg         |
| WA0050          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | gallery09        | no            | ingested as provided | gallery-09.jpg         |
| WA0061          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | gallery10        | no            | ingested as provided | gallery-10.jpg         |
| WA0044          | 1066×1600 | jpeg   | portrait    | WA     | unusable             | none             | near WA0029   | not ingested         | —                      |
| WA0057          | 1066×1600 | jpeg   | portrait    | WA     | unusable             | none             | near WA0046   | not ingested         | —                      |
| WA0062          | 1066×1600 | jpeg   | portrait    | WA     | unusable             | none             | near WA0060   | not ingested         | —                      |
| WA0064          | 1066×1600 | jpeg   | portrait    | WA     | unusable             | none             | repeated pose | not ingested         | —                      |
| WA0066          | 1066×1600 | jpeg   | portrait    | WA     | unusable             | none             | repeated pose | not ingested         | —                      |
| WA0069          | 1066×1600 | jpeg   | portrait    | WA     | unusable             | none             | repeated pose | not ingested         | —                      |
| WA0073          | 1066×1600 | jpeg   | portrait    | WA     | unusable             | none             | repeated pose | not ingested         | —                      |

### Uniqueness table (required before READY_*)

| role             | source        | derivative             | intentional multi-role?   |
| ---------------- | ------------- | ---------------------- | ------------------------- |
| hero             | WA0029        | hero.jpg               | no                        |
| portrait         | WA0034        | portrait.jpg           | yes (hero card + ogImage) |
| prayerPortrait   | WA0043        | prayer-portrait.jpg    | no                        |
| interlude01      | WA0053        | interlude-01.jpg       | no                        |
| thankYouPortrait | WA0035        | thank-you-portrait.jpg | no                        |
| gallery01–10     | see inventory | gallery-01…10.jpg      | no                        |

The client chose WA0029 as the main photograph. Ball-gown frames are limited to window and close
crops so the full dress is not revealed.

---

## Implementation Constraints

- Helper prepReadiness is `READY_WITH_PLACEHOLDERS`; implementation is allowed.
- Lane A inheritance resets: preset image desaturation disabled; red accent remapped to gold;
  reference section overrides ported (local exception, see Design Direction).
- The editorial cover formats `hero.date` in UTC, so `hero.date` uses a wall-clock `Z` instant
  (`heroDate`) while `eventTiming` keeps the real Mexico City instant (same workaround as renata).
- `Gifts.astro` hardcodes another celebrant's monogram and the "Mesa de cortesía" title for
  `editorial-catalog`; the monogram is swapped in the profile, the title is kept (matches the
  reference). Shared fix tracked separately.
- Structural selections: hero `editorial-cover`; family `standard` without parents or godparents
  (prayer in `labels.sectionMessage`, `prayerPortrait` photo); countdown `magazine-folio`; itinerary
  `editorial-program` (one reception item); location `standard` with one reception venue; gallery
  `magazine-spread` with mobile rail; gifts `editorial-catalog` (cash only); RSVP
  `editorial-press-pass` with personalized access `editorial-pass`; thank-you
  `editorial-back-cover`; envelope `editorial-cover`.
- Lane B: none.
- Music omit / include: omitted until a trimmed, hosted audio file exists.
- Other: no photo QR (paid add-on not purchased).

---

## Preparation Readiness History

| date       | readiness                 | helper basis                                           | notes                                    |
| ---------- | ------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| 2026-09-29 | `READY_WITH_PLACEHOLDERS` | non-blocking placeholders; provisional-whatsapp assets | Local implementation; Production blocked |
