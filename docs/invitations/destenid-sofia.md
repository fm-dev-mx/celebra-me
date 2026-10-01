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

Helper outcome: structural decisions are resolved and the client supplied the event program (start
time 19:00). Bank-transfer data needs a CLABE (see GIFTS-BANK), music is pending, and every
photograph is WhatsApp-class. Implementation may proceed; Production release stays blocked until the
pending client data is replaced.

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

| field                | value                                                                                             | classification | source            | notes                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------- | -------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| slug                 | destenid-sofia                                                                                    | verified       | owner             | Owner decision; two given names, no eventType prefix                                                   |
| hostLoginAlias       | destenid_sofia                                                                                    | verified       | owner             | No surname supplied                                                                                    |
| celebrantName        | Destenid Sofía                                                                                    | verified       | wa-export + owner | Client wrote "Destenid"; account holder name confirms "Destenid Sofía". Accent kept; confirm in review |
| eventLabel           | XV años de Destenid Sofía                                                                         | verified       | wa-export         |                                                                                                        |
| eventDate            | 2026-11-13                                                                                        | verified       | wa-export         | Friday 13 November 2026                                                                                |
| eventTime            | 19:00                                                                                             | verified       | owner (client)    | Client program relayed by the owner: Recepción 7 pm                                                    |
| itinerary            | 19:00 Recepción; 20:00 Presentación; 20:30 Cena; 22:00 Vals; 02:00 Cierre                         | verified       | owner (client)    | Client wrote "Cierre 2,pm"; read as 2:00 a.m. after the 10 p.m. waltz — confirm in client review       |
| timeZone             | America/Mexico_City                                                                               | inferred       | geography         | Cuautitlán Izcalli, Estado de México; not client-stated                                                |
| baseDemoId           | demo-xv-editorial-magazine                                                                        | verified       | wa-export         | Client selected the valentina-hernandez invitation as the reference style                              |
| sourceAssetPath      | source:hr-photos                                                                                  | verified       | owner             | Opaque label only                                                                                      |
| sectionOrder         | quote, family, countdown, itinerary, location, gallery, gifts, personalizedAccess, rsvp, thankYou | inferred       | owner             | Mirrors the reference invitation; family carries the prayer instead of parents                         |
| primaryVenueName     | Jardín Quinta Paraíso                                                                             | verified       | wa-export         | Reception only                                                                                         |
| primaryVenueAddress  | Calle Rosa Violeta 8, C.P. 54765, Cuautitlán Izcalli, Estado de México                            | verified       | wa-export         | Client wrote "54765 calle Rosa Violeta 8"; 54765 read as postal code                                   |
| distinctVenues       | false                                                                                             | verified       | wa-export         | Client stated there is no Mass                                                                         |
| ceremonyMapUrl       | —                                                                                                 | not_applicable | wa-export         | No ceremony; reception uses a Maps search URL                                                          |
| fatherName           | —                                                                                                 | not_applicable | wa-export         | Client explicitly does not want parents' names                                                         |
| motherName           | —                                                                                                 | not_applicable | wa-export         | Client explicitly does not want parents' names                                                         |
| godparents           | —                                                                                                 | not_applicable | wa-export         | Client explicitly does not want godparents                                                             |
| dressCode            | —                                                                                                 | missing        | —                 | Not supplied; omitted rather than invented                                                             |
| gifts                | lluvia de sobres; transferencia                                                                   | verified       | wa-export         | Envelopes published; transfer held until a CLABE is supplied (see GIFTS-BANK)                          |
| musicUrl             | —                                                                                                 | missing        | wa-export         | RBD track from a YouTube link, starting at 0:39; a direct audio file is required                       |
| clientColors         | beige, dorado, negro                                                                              | verified       | wa-export         | Dress is beige with gold; celebrant requested black as well                                            |
| rsvpConfirmationMode | both                                                                                              | inferred       | owner             | Client asked for named passes; mirrors the reference invitation                                        |
| rsvpGuestCap         | 4                                                                                                 | inferred       | owner             | Per-guest passes are assigned in the dashboard                                                         |
| rsvpWhatsappPhone    | client WhatsApp (definition only)                                                                 | verified       | wa-export         | Number is recorded in the managed definition, not in this document                                     |
| specialMessages      | opening phrase, two thank-you phrases, prayer                                                     | verified       | wa-export         | Quote, gallery subtitle, thank-you message, and family (prayer) section                                |
| instagramHandle      | @desteny_ts                                                                                       | verified       | wa-export         | Handle spelling differs from the given name; kept literal                                              |

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
  - **status:** resolved
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

- Bank-transfer item needs an 18-digit CLABE; the client sent a debit card number.
- Music audio file pending.
- Dress code not supplied.

Deterministic question: **Is the available information sufficient to prepare this invitation?**  
Answer: `yes` (`evaluateEventCompleteness`).

---

## Placeholders

| token                      | missing datum | blocking | reason                                              | replacement requirement                                  |
| -------------------------- | ------------- | -------- | --------------------------------------------------- | -------------------------------------------------------- |
| `[[PENDIENTE:GIFTS_BANK]]` | GIFTS_BANK    | no       | Card number received; the bank item renders a CLABE | Add a `bank` gift item with bank, holder, and CLABE      |
| `[[PENDIENTE:MUSIC_URL]]`  | MUSIC_URL     | no       | Needs a direct audio file trimmed to start at 0:39  | Host the trimmed audio and add `music` to the definition |

Tokens are not written into the published payload: the bank item and music block are omitted until
their data exists.

---

## Owner Decisions

| id           | category              | issue                                 | evidence                  | options                                  | recommendation                                |
| ------------ | --------------------- | ------------------------------------- | ------------------------- | ---------------------------------------- | --------------------------------------------- |
| EVENT-TIME   | missing-client-facts  | Start time not supplied               | Client program via owner  | ask client / keep provisional            | Resolved: 19:00 confirmed with full program   |
| GIFTS-BANK   | missing-client-facts  | Card number, not CLABE                | BBVA debit card via owner | ask for CLABE / label as card (shared)   | Ask the client for the account CLABE          |
| PHOTO-SOURCE | photograph-acceptance | Photos are WhatsApp-class (1066×1600) | WeTransfer delivery       | request originals / accept as provided   | Request originals; WeTransfer folder has none |
| DESKTOP-HERO | client-choice         | Desktop cover hid WA0029              | Client picked WA0029      | WA0029 / WA0034 / full-bleed             | Resolved: WA0029 leads the desktop cover      |
| PROGRAM      | missing-client-facts  | Single-item program                   | Client program via owner  | drop program / keep / request program    | Resolved: five-item client program            |
| MUSIC-AUDIO  | missing-client-facts  | Only a YouTube link with a 0:39 start | Client message            | owner trims and hosts audio / omit music | Owner supplies a trimmed, hosted audio file   |

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
| unresolved             | bank CLABE, music                                                                     |

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

| field                                       | value                                        |
| ------------------------------------------- | -------------------------------------------- |
| Mechanical render/capture result            | pass — Local v4 rendered every section       |
| Whole-invitation responsive inspection      | 390×844 and 1440×900 captured (agent review) |
| Section boundaries and narrative continuity | pending                                      |
| Human creative outcome                      | `PENDING`                                    |
| Reviewer and date                           | —                                            |
| Blocking reason or owner follow-up          | Bank CLABE, music, photo originals           |

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
| WA0035          | 1066×1600 | jpeg   | portrait    | WA     | unusable             | none             | near WA0034   | replaced by WA0069   | —                      |
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
| WA0069          | 1066×1600 | jpeg   | portrait    | WA     | provisional-whatsapp | thankYouPortrait | no            | ingested as provided | thank-you-portrait.jpg |
| WA0073          | 1066×1600 | jpeg   | portrait    | WA     | unusable             | none             | repeated pose | not ingested         | —                      |

### Uniqueness table (required before READY_*)

| role             | source        | derivative             | intentional multi-role?    |
| ---------------- | ------------- | ---------------------- | -------------------------- |
| hero             | WA0029        | hero.jpg               | yes (cover + desktop card) |
| portrait         | WA0034        | portrait.jpg           | yes (cover + ogImage)      |
| prayerPortrait   | WA0043        | prayer-portrait.jpg    | no                         |
| interlude01      | WA0053        | interlude-01.jpg       | no                         |
| thankYouPortrait | WA0069        | thank-you-portrait.jpg | no                         |
| gallery01–10     | see inventory | gallery-01…10.jpg      | no                         |

The client chose WA0029 as the main photograph. Ball-gown frames are limited to window and close
crops so the full dress is not revealed.

---

## Implementation Constraints

- Helper prepReadiness is `READY_WITH_PLACEHOLDERS`; implementation is allowed.
- Lane A inheritance resets: preset image desaturation disabled; red accent remapped to gold;
  reference section overrides ported (local exception, see Design Direction).
- Client copy is literal except two documented normalizations: the prayer's line break after
  "refugio de mis sueños" became ". Te doy", and the stray closing quote after the thank-you phrase
  was dropped. Owner-authored copy (tagline, location intro, envelope gift text) is in the "usted"
  register and approved by the owner.
- The reveal is a magazine object: `envelope.backdropImage` (WA0034) is the cover photograph, shown
  as a 2:3 cover on a dark table with a spine-hinged page turn (profile SCSS only). This required a
  shared, backward-compatible change: `EditorialCoverReveal` accepts an optional `coverImage`, wired
  from `envelope.backdropImage` in the public and dashboard preview pages. Documented local
  exception.
- Collector edition (`envelope.coverExperience: 'collector'`, opt-in shared feature): the cover is a
  printed magazine the guest turns by dragging the corner or pulling the gold bookmark ribbon.
  Inside cover = "En este número" contents built from the real section titles; first page = WA0029,
  which flies into the hero photograph. Cover copy never repeats the hero: brand, issue rail, cover
  star (italic, centred), teasers, seal, and "Edición exclusiva para: …" live only on the cover;
  date, time, venue, and tagline only in the hero (hero credits hidden). Guarded by
  `tests/e2e/editorial-cover-collector.spec.ts` and
  `tests/e2e/destenid-cover-hero-distinct.spec.ts`.
- Collector choreography (final pass): printed matter never animates on its own — only the magazine,
  page, ribbon, and light move. Arrival (table light, fall with separate shadow and settle, one
  gloss and one gold sweep, ribbon pendulum, hint), a single coordinated idle cue every 7 s, spring
  physics for drag and release, peel curve with page settle, spread camera move overlapping the
  turn, live hold with contents glint, arced photo flight, and hand-off only after the hero entrance
  finishes. Timings live in `TIMELINE`
  (`src/components/invitation/editorial-cover/collector-reveal.ts`). Cover copy: rail "VOL. 1 · NÚM.
  XV · NOVIEMBRE 2026", seal "Número ✦ de colección", ISSN from the event date, cover lines with
  kicker and deck from real section data, hint "Jale el listón o pase la página."
- Client copy corrections (light, meaning unchanged): opening phrase uses a typographic ellipsis
  ("inolvidables… hoy"); gallery phrase punctuates the interjection ("¡Lit! Mi fiesta…"). Thank-you
  phrase and prayer unchanged (already correct; mixed English is intentional).
- Music: "Rebelde · RBD" from the client-supplied Cloudinary MP3 (full 4:00 track), starting at 0:39
  and looping back to 0:39 via the opt-in `music.startAt` (shared, backward compatible).
- Instagram: the "Recuerdos" indication links `@desteny_ts` (https-only links are now allowed by
  `sanitizeIndicationHtml`, forced to `target=_blank rel=noopener noreferrer`); the profile adds a
  gold Instagram glyph.
- Gifts: section title "Un detalle para mí" (owner-approved, warmer than the client's working name
  "lluvia de sobres o transferencia"); the transfer item reads "Transferencia bancaria" and the
  profile renders its data as a subtle simulated card (ink, guilloché, gold chip, generic — no bank
  branding) with a visible "Copiar" pill; labels stay for screen readers. The BBVA card item (holder
  "Destenid Sofía Magaña Almaraz", `accountKind: 'card'`, shown in groups of four) is added only
  when the owner fills `GIFT_TRANSFER_CARD` in the definition — the number is not typed by tooling.
  A CLABE is safer to publish than a card number if the client can supply one.
- Hero typography: Bodoni Moda optical-size and true-italic cuts; ivory capitals with a gold italic
  "Sofía" signature; Bodoni italic tagline; the theme's gold gradient glint is disabled.
- Hero composition: the theme's clipped 3 % "XV" watermark (read as "\ \" because Bodoni's hairlines
  vanish) is hidden; desktop draws a composed gold-outline "XV" (text optical size) in the panel's
  upper corner, with a gold seam, an inner frame below the navigation, and the copy anchored low.
  Photo parallax via scroll-driven animation (starts at zero offset, so the collector hand-off still
  lands exactly), a gold scroll cue, and a title that hugs the name so "Sofía" signs under it. No
  entrance zoom: it would break the photo hand-off.
- Program (local exception to the editorial-program grid): gold timeline that draws on entry, round
  icon nodes (double ring for the presentation and the waltz), the hour as the headline, italic
  moment captions, `decimal-leading-zero` folios, subtitle "Cinco momentos, una sola noche."
- Face safety: no copy may overlap the celebrant on the cover or the hero. Below `lg` the hero is a
  photo-over-panel spread (side by side on landscape phones).
  `tests/e2e/destenid-face-safety.spec.ts` maps each photograph's forbidden zone to viewport pixels
  and checks every visible text block on ten viewports (320×568 to 1920×1080, plus 844×390).
- The editorial cover formats `hero.date` in UTC, so `hero.date` uses a wall-clock `Z` instant
  (`heroDate`) while `eventTiming` keeps the real Mexico City instant (same workaround as renata).
- `Gifts.astro` prints each gift title twice in `editorial-catalog`; the cash item sets `iconName`
  so the visible heading is an icon. Shared fix tracked separately.
- Structural selections: hero `editorial-cover`; family `standard` without parents or godparents
  (prayer in `labels.sectionMessage`, `prayerPortrait` photo); countdown `magazine-folio`; itinerary
  `editorial-program` (one reception item); location `standard` with one reception venue; gallery
  `magazine-spread` with mobile rail; gifts `editorial-catalog` (cash only); RSVP
  `editorial-press-pass` with personalized access `editorial-pass`; thank-you
  `editorial-back-cover`; envelope `editorial-cover`.
- Closing sections (profile SCSS only): the prayer is a two-column magazine page on desktop (4:5
  plate zoomed on the celebrant, gold offset rule, "— Con fe" caption, gold Bodoni initial); the
  program has a running head ("La noche" / "pág. 04"), a sticky title with an outline "05" on
  desktop, italic folios, dotted leaders and a "Momento estelar" kicker on the presentation and the
  waltz; the thank-you is a back cover (photo and quote side by side, gold signature written in on
  reveal, barcode colophon); the footer is a colophon ("D·S" monogram, edition line). The template's
  `.thank-you-editorial__ambient` layer is taken out of the grid, which fixed the diagonal desktop
  layout. WA0069 replaced WA0035 in the thank-you so the window scene is not shown three times.
  Face-safety spec also checks both plates.
- Copy review (owner-requested): hero tagline "Quince años, una sola vez." (the label already reads
  "Mis XV"); family title "En tus manos" (it repeated the prayer's opening); location lede "Será un
  honor celebrar con usted." and heading "Viernes, 13 de noviembre"; gallery title "Mis looks"
  (subtitle already says "icónicos"); gifts subtitle "Si desea hacerme un obsequio, le comparto dos
  opciones." (the thank-you already says the presence is the best gift), cash item "Lluvia de
  sobres" / "Podrá entregarlo el día de la fiesta."; RSVP subcopy without a third "confirme su
  asistencia" and a single "Acceso privado" kicker at every size; section folios match the cover
  index (oración pág. 04, programa pág. 07); running heads use "SECCIÓN / MIS XV". Two light fixes
  to the prayer: "el futuro que hoy te confío" and "Te pido que me bendigas" (repeated "pongo en tus
  manos" and "nueva etapa"). Known shared gap: the program prints "7:00 PM" while hero and venue use
  "7:00 p. m." (shared time formatter).
- Hero, cinematic pass (profile SCSS only): one colour grade (`--ds-hero-grade`) on the hero
  photograph, the magazine's first-page photo and the hand-off clone (so colour never shifts); film
  grain; a 9 s push-in from scale 1 (never jumps after the hand-off; anchored at the top on desktop
  to keep crown headroom under the folio) plus one warm light sweep; name set to the full measure in
  Bodoni with "Sofía" as a gold Pinyon Script signature crossing the capitals; details as a spaced
  date label plus "7:00 p. m. · Jardín Quinta Paraíso" in Bodoni (the "en" connector hidden);
  entrance choreography (name rises from a mask, signature writes itself, then deck and details)
  that outranks the theme's `editorialCoverHeroReveal` and waits behind the collector hand-off;
  photo 63svh with a long dissolve on phones, 58/42 spread with a giant outline "XV" behind the name
  on desktop; music prompt in ink and gold. Face-safety spec now clips each forbidden zone to the
  photograph's visible frame (a scaled photo overflows it).
- Lane B: none.
- Music omit / include: omitted until a trimmed, hosted audio file exists.
- Other: no photo QR (paid add-on not purchased).

---

## Preparation Readiness History

| date       | readiness                 | helper basis                                           | notes                                    |
| ---------- | ------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| 2026-09-29 | `READY_WITH_PLACEHOLDERS` | non-blocking placeholders; provisional-whatsapp assets | Local implementation; Production blocked |
