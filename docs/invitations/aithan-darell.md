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
only placeholder (music) is non-blocking. All published photographs are messaging-app JPEGs, which
the owner accepted as the definitive set; the original motif assets are production-ready, but the
`provisional-whatsapp` photographs still cap readiness below `READY_FOR_IMPLEMENTATION`.
Implementation may proceed.

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document.

Canonical route: `/cumple/aithan-darell` — slug must not include `eventType`. The slug uses the two
given names by explicit owner decision (the family presents the celebrant as "Aithan Darell"); the
host alias keeps the contract form `{primer_nombre}_{primer_apellido}`.

---

## Sources

| Source                  | Reference               | Notes                                                                                  |
| ----------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| WhatsApp / conversation | `source:wa-export`      | Evidence only; client facts, the four photographs, and the song request                |
| Photographs             | `source:client-photos`  | Four messaging-app JPEGs from the chat, accepted as definitive by the owner            |
| Owner session           | `source:owner-session`  | Slug, base demo, photo acceptance, section omissions, guest cap (2026-10-07)           |
| Owner design session    | `source:owner-design`   | Display face, Cars motifs, photo roles delegated to the agent (2026-10-07)             |
| Owner design review 3   | `source:owner-design-3` | Third iteration: approved photo plan B, type option 2, motif routes D1–D7 (2026-10-07) |

---

## Fact Register

| field                | value                                                                   | classification | source    | notes                                                                                                    |
| -------------------- | ----------------------------------------------------------------------- | -------------- | --------- | -------------------------------------------------------------------------------------------------------- |
| slug                 | aithan-darell                                                           | verified       | owner     | Owner decision; two given names, no eventType prefix                                                     |
| hostLoginAlias       | aithan_ruiz                                                             | verified       | owner     | Contract form; owner may remap to `aithan_darell`                                                        |
| celebrantName        | Aithan Darell Ruiz Salgado                                              | verified       | wa-export | Written twice ("aithan darell Ruiz Salgado", then "Aithan Darell"); display name "Aithan Darell"         |
| eventLabel           | Mis 3 años                                                              | verified       | wa-export | Client copy: "Aithan Darell / Mis 3 años"                                                                |
| eventDate            | 2026-10-24                                                              | verified       | wa-export | "24 de octubre", stated twice; Saturday 24 October 2026                                                  |
| eventTime            | 17:30                                                                   | verified       | wa-export | First "4:30", corrected to "Hora 5:30"; p. m. follows from the party context (re-confirmation requested) |
| timeZone             | America/Mexico_City                                                     | inferred       | geography | Atizapán de Zaragoza, Estado de México; not client-stated                                                |
| baseDemoId           | demo-cumple-editorial-magazine                                          | verified       | owner     | Owner-selected catalog entry (new); no children's demo existed                                           |
| sourceAssetPath      | source:client-photos                                                    | verified       | owner     | Repo asset dir `src/assets/invitations/aithan-darell`; originals from the chat                           |
| sectionOrder         | quote, countdown, location, gallery, personalizedAccess, rsvp, thankYou | inferred       | owner     | Family, itinerary, and gifts omitted: no data supplied (asked in the client message)                     |
| primaryVenueName     | Jardín de Teresita                                                      | verified       | wa-export |                                                                                                          |
| primaryVenueAddress  | Avenida Juárez 49, Atizapán centro                                      | verified       | wa-export | Municipality and state (Atizapán de Zaragoza, Estado de México) inferred from the client's Maps link     |
| venueMapsUrl         | client Maps short link                                                  | verified       | wa-export | Published as `googleMapsUrl` without the share tracking parameter                                        |
| themeDescription     | Cars: carreras, McQueen, Mate, Mack                                     | verified       | wa-export | Client wrote "mcqueen, mate Mac todos los personas"; read as "todos los personajes"                      |
| clientColors         | rojo, negro, blanco                                                     | verified       | wa-export | First "rojo y negro", later "roja y negra y blanca"                                                      |
| heroPhoto            | ride-on car photograph                                                  | verified       | wa-export | "La imagen sería la que tiene el carro"; published once (hero card/panel) plus the off-page OG image     |
| rsvpConfirmationMode | api                                                                     | inferred       | owner     | Owner offered dashboard guest control and passes; client agreed ("Ok super")                             |
| rsvpGuestCap         | 4                                                                       | inferred       | owner     | Owner default, never discussed; passes are assigned per guest in the dashboard (asked in the message)    |
| musicUrl             | —                                                                       | missing        | wa-export | Client asked for "Life Is a Highway" ("Life ls a highway canción"); a hosted audio file is required      |
| dressCode            | —                                                                       | missing        | wa-export | Asked in the data list, not answered; optional, omitted                                                  |
| gifts                | —                                                                       | missing        | wa-export | Never mentioned; optional, omitted (asked in the client message)                                         |
| itinerary            | —                                                                       | missing        | wa-export | Never mentioned; optional, omitted (asked in the client message)                                         |
| hostsNames           | —                                                                       | missing        | wa-export | Parents not named. The purchaser waits on "mi hermana", so she is likely the aunt (inferred)             |
| clientContact        | Alin Salgado                                                            | verified       | wa-export | Purchaser; contact details stay outside this document                                                    |

Rules:

- `verified` requires explicit client/source evidence.
- `inferred` must include its basis and must never be phrased as a client statement.
- Absence of information never implies consent or preference.

---

## Requirements Review — second pass (2026-10-07)

Every published fact was re-read against the full chat and the Local payload.

| fact                   | source                                              | payload                                           | status                                                       |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| Name and spelling      | chat: "aithan darell Ruiz Salgado", "Aithan Darell" | "Aithan Darell" (hero, cover, closing)            | confirmed                                                    |
| Age / label            | chat: "Cumple 3", "Mis 3 años"                      | "Mis 3 años", edition "3"                         | confirmed                                                    |
| Date                   | chat: "24 de octubre" (twice)                       | 2026-10-24                                        | confirmed                                                    |
| Time                   | chat: "4:30", then "Hora 5:30"                      | 5:30 p. m.                                        | confirmed by correction; p. m. re-confirmed                  |
| Venue                  | chat: "Jardín de Teresita"                          | Jardín de Teresita                                | confirmed                                                    |
| Address                | chat: "avenida Juárez 49 Atizapán centro"           | "Avenida Juárez 49, Atizapán centro" · "Atizapán" | confirmed; inferred municipality/state removed (iteration 3) |
| Theme and characters   | chat: Cars, carreras, McQueen, Mate, Mack           | race vocabulary; no character artwork added       | confirmed (only the client photos show it)                   |
| Colors                 | chat: rojo, negro, blanco                           | red / asphalt / paper, yellow accent only         | confirmed; yellow is an agent accent                         |
| Main photograph        | chat: "la que tiene el carro"                       | hero card/panel and OG only                       | confirmed; no other page role                                |
| Song                   | chat: "Life ls a highway canción"                   | music omitted until hosted                        | missing (file and start second)                              |
| Parents / hosts        | not supplied                                        | family section omitted                            | missing                                                      |
| Purchaser relationship | "mi hermana" (inferred aunt)                        | not published                                     | assumption                                                   |
| Dress code             | asked, not answered                                 | omitted                                           | missing                                                      |
| Gifts                  | never mentioned                                     | omitted                                           | missing                                                      |
| Passes per guest       | never discussed                                     | 4 (dashboard-adjustable)                          | assumption                                                   |
| Itinerary              | never mentioned                                     | omitted                                           | missing                                                      |

Client message draft (single message, "usted" register):

> Hola, Alin, buen día. Ya estamos afinando la invitación de Aithan Darell y quiero confirmar unos
> detalles para dejarla perfecta:
>
> 1. ¿La fiesta empieza a las 5:30 p. m.?
> 2. ¿Desean que aparezcan los nombres de los papás de Aithan? Si es así, ¿cómo los escribo?
> 3. ¿Les gustaría incluir el itinerario de la fiesta (por ejemplo, llegada, pastel y piñata)? Si
>    sí, compártame los horarios.
> 4. ¿Habrá mesa de regalos o alguna sugerencia de regalo que quieran mencionar?
> 5. ¿Hay algún código de vestimenta para los invitados?
> 6. ¿Cuántos lugares desea asignar por invitación? Por ahora dejé 4 y se puede ajustar en su panel.
> 7. Para la canción "Life Is a Highway", ¿desde qué parte le gustaría que empiece?
>
> Con eso la dejo lista. ¡Muchas gracias!

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

- Music audio file and start second pending (owner hosts the requested track).
- Parents' names, itinerary, gifts and dress code were never supplied; asked in one client message.

Deterministic question: **Is the available information sufficient to prepare this invitation?**  
Answer: `yes` (`evaluateEventCompleteness`).

---

## Placeholders

| token                     | missing datum | blocking | reason                                           | replacement requirement                                                         |
| ------------------------- | ------------- | -------- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `[[PENDIENTE:MUSIC_URL]]` | MUSIC_URL     | no       | Song named by the client, no audio file supplied | Fill `MUSIC_URL` (and `MUSIC_START_SECONDS` for a full track) in the definition |

Tokens are not written into the published payload: the music block is built only when `MUSIC_URL` is
filled.

---

## Owner Decisions

| id               | category              | issue                                               | evidence                     | options                                                | recommendation                                                                                                |
| ---------------- | --------------------- | --------------------------------------------------- | ---------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| PHOTO-ACCEPTANCE | photograph-acceptance | Only messaging-app JPEGs (518–768 px wide)          | Four chat photographs        | request originals / accept as provided                 | Resolved 2026-10-07: accepted as the definitive set                                                           |
| SLUG             | demo-design-decisions | Public URL form                                     | Client copy "Aithan Darell"  | aithan-ruiz / aithan-darell                            | Resolved 2026-10-07: `aithan-darell`                                                                          |
| BASE-DEMO        | demo-design-decisions | No children's or Cars demo exists                   | Catalog                      | editorial-magazine / hacienda remap / new demo         | Resolved 2026-10-07: new `demo-cumple-editorial-magazine` entry                                               |
| DISPLAY-FONT     | demo-design-decisions | Flat hierarchy; nothing reads "racing" or "kids"    | Owner design review 3        | Podio / Vuelta rápida / Ancho 75                       | Resolved 2026-10-07: option 2 — Montserrat italic display, Instrument Sans body                               |
| CARS-MOTIFS      | demo-design-decisions | Cars references without third-party artwork         | Owner design review 3        | shared typed option / local exception / asset          | Resolved 2026-10-07: shared options (a) + original image assets (c); no local exceptions (b)                  |
| PHOTO-ROLES      | demo-design-decisions | Photographs repeated across cover, hero, back cover | Owner design review 3        | plan A / B / C                                         | Resolved 2026-10-07: plan B — every photograph in one role                                                    |
| COVER-PHOTO      | demo-design-decisions | Collector masthead illegible over car scene         | Owner design review 3        | race-suit cover / original motif cover                 | Resolved 2026-10-07: original motif cover (D1)                                                                |
| MOTIF-ASSETS     | demo-design-decisions | Hero canvas repeated the car (blurred)              | Owner design review 3 (D1)   | original image assets / blurred photo                  | Resolved 2026-10-07: heroCanvas, coverGrid, thankYouTrophy (original artwork)                                 |
| OG-IMAGE         | demo-design-decisions | Share preview role                                  | Owner design review 3 (D7)   | car photograph / own OG card                           | Resolved 2026-10-07: car photograph, declared as an off-page role                                             |
| START-LIGHTS     | demo-design-decisions | Countdown start-light motif                         | Owner design review 3 (D6)   | shared countdown option / postpone                     | Postponed 2026-10-07                                                                                          |
| SELFIE-COVER     | demo-design-decisions | chat-052 unused; owner asked to consider the cover  | Owner request 2026-10-07     | full cover / roundel colour / roundel duotone / unused | Agent applied roundel colour in Local; full-bleed rejected (dark ink masthead, 518 px) — pending owner review |
| BRAND-MENTIONS   | demo-design-decisions | "Celebra-me" printed six times in the content       | Owner request 2026-10-07     | keep / masthead only                                   | Applied: cover masthead only (plus site header logo); folios and hero credit drop it                          |
| GUEST-CAP        | missing-client-facts  | Passes per guest not discussed                      | Client asked how passes work | 4 / other                                              | Default 4; adjustable in the dashboard; asked in the client message                                           |
| HOSTS-NAMES      | missing-client-facts  | Parents not named                                   | Purchaser is likely the aunt | ask client / omit family section                       | Omit; add `family` if the client supplies names                                                               |
| DRESS-CODE       | missing-client-facts  | Not answered                                        | Owner data list              | ask client / omit                                      | Omit; asked again in the client message                                                                       |
| GIFTS            | missing-client-facts  | Not requested                                       | —                            | ask client / omit                                      | Omit; asked in the client message                                                                             |
| MUSIC-FILE       | missing-client-facts  | Song named, no file                                 | "Life ls a highway canción"  | owner hosts audio / omit music                         | Owner hosts the audio; fill `MUSIC_URL` and `MUSIC_START_SECONDS`                                             |

---

## Agent Recommendations

| topic       | recommendation                                                                      | basis                                             | status                    |
| ----------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------- |
| demo        | editorial-magazine preset told as a race-day magazine ("Gran Premio")               | client colors red/black/white; no kids demo       | accepted by owner session |
| palette     | asphalt / paper / racing red, "Piston" yellow only on dark surfaces                 | client colors; contrast ≥ 4.5:1 for body copy     | accepted by owner design  |
| variants    | avoid press-pass, editorial-pass, and editorial-catalog (XV labels in markup)       | component literals                                | accepted by owner session |
| display     | Montserrat italic via the opt-in `Montserrat Italic Display` face (no shared token) | profile cannot set `font-style`; +40 KB latin     | applied (iteration 3)     |
| gallery     | `paired-portraits` + `arrangement: 'overlap'`; prints capped at native width        | 739–768 px sources                                | applied (iteration 3)     |
| location    | `standard` + `indicationsStyle: 'numbered-board'`; venue ticket on asphalt (tokens) | split-map needs coordinates; plates need 2 venues | applied (iteration 3)     |
| hero-mobile | no prepared mobile derivative: the 704 px source is smaller than any derivative     | delivery already serves the native width          | applied                   |

---

## Sections

| bucket                 | section keys                                                             |
| ---------------------- | ------------------------------------------------------------------------ |
| requested              | hero (car photo), gallery, rsvp with passes, music (pending)             |
| inferred / recommended | quote, countdown, location, personalizedAccess, thankYou                 |
| omitted                | family, itinerary, gifts, interludes (no photograph supports one), music |
| unresolved             | music file; family, itinerary and gifts if the client answers            |

---

## Design Direction

| decision                          | value                                                       | classification      |
| --------------------------------- | ----------------------------------------------------------- | ------------------- |
| Client-selected demo              | none (no children's demo to choose from)                    | not_applicable      |
| Owner-selected base demo          | demo-cumple-editorial-magazine                              | verified            |
| Reference invitation              | xv/destenid-sofia (structure and techniques only)           | verified            |
| Recommended demo alternatives     | luxury-hacienda remap (rejected by owner)                   | recommendation only |
| Selected variant / visual profile | visualProfileId `aithan-darell`; theme `editorial-magazine` | verified            |
| Client color requirements         | red, black, white                                           | verified            |
| Recommended palette               | asphalt #111, paper #f7f5f0, red #d71e28, yellow #ffc529    | verified            |
| Unresolved visual decisions       | none open; human creative acceptance pending                | pending             |

Techniques taken from the reference, all through data and tokens (no layout in the profile):
collector cover with its own image (`envelope.backdropImage`) and the hero canvas handed to the hero
by the inner page; contents index built from the real sections; typed intersections; race-vocabulary
folios; editorial back cover with an image; music block ready for `startAt`. The reference's section
look that lives in its frozen profile (dark indication cards, ported dividers) was not copied; the
pit boards come from a shared typed option instead.

Shared changes (minimal, backward compatible, defaults identical):

- `src/lib/invitation/cover-contents.ts`: the location entry takes the first visible venue name as
  its cover-line deck. Only the first two entries print decks; destenid-sofia's first two are family
  and itinerary, so its output is unchanged. Preset folios resolve from `--editorial-folio-*` with
  unchanged fallbacks.
- `location.presentationOptions.indicationsStyle` (`list` default | `numbered-board`): typed in the
  content, intake draft and editor schemas; rendered as `data-indications-style`; styles isolated in
  `src/styles/invitation/_location-indications.scss` behind `--location-board-*` tokens.
- Ordinal spacing fix ("01Inscripción"): `:where(.event-location__indication-title)` lays the
  ordinal and title out with a gap. Zero specificity, so the frozen profiles that lay the spans out
  themselves (destenid-sofia, valentina-hernandez, melissa-y-luis-osmar) keep their rendering.
- `gallery.variantOptions.arrangement` (`stacked` default | `overlap`, paired-portraits only):
  schema rejects it on other variants; `data-arrangement` only renders on paired-portraits; prints
  are capped at `--gallery-item-native-width`.
- `pattern-band` intersection family (`SECTION_INTERSECTION_FAMILIES`), documented in
  `docs/domains/theme/section-intersections.md`; height reserved as static padding.
- `--hero-portrait-panel-max-width` on the editorial-cover desktop portrait panel (default `100%`).
- `hero.presentation.designCredit` (default shown): `false` drops the editorial-cover "DISEÑO /
  CELEBRA ME" credit line. Brand policy here: "Celebra-me" is named once, on the collector cover
  masthead (the site header logo stays); folios carry only "GRAN PREMIO · <sección>".
- `src/styles/fonts/_montserrat-italic-display.scss`: opt-in face, only downloaded by profiles that
  `@use` it.
- Tests: `tests/unit/presentation-option-portability.test.ts` (no-profile portability, defaults and
  incompatibility for the three options).

## Typography

| role              | face                                                    | notes                                         |
| ----------------- | ------------------------------------------------------- | --------------------------------------------- |
| display (name)    | Montserrat italic (`Montserrat Italic Display`)         | `--font-display`; round forms, sense of speed |
| section titles    | Montserrat italic through the preset display selectors  | weight follows each section variant           |
| figures           | Montserrat italic (countdown, pit-board ordinals, pass) | tabular figures on the pit boards             |
| eyebrow / labels  | Instrument Sans, upper case, tracked                    | `--font-label` unchanged                      |
| body              | Instrument Sans                                         | unchanged                                     |
| closing signature | display face                                            | `--font-calligraphy: var(--font-display)`     |

Load impact: one extra latin (+ latin-ext) italic woff2 (~40 KB), only for this profile. No new
dependency.

---

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING`

- **concern:** Typography roles (display, heading, body, metadata)
  - **decision / evidence:** Montserrat italic display/titles/figures; Instrument Sans labels and
    body (see Typography)
  - **status:** pending
- **concern:** Vertical rhythm and density
  - **decision / evidence:** Motif cover → hero → red quote → asphalt scoreboard → lane band → paper
    circuit and pit boards → pits gallery → asphalt registration → checkered band → trophy back
    cover
  - **status:** pending
- **concern:** Surface hierarchy (open flow vs cards/containers)
  - **decision / evidence:** Paper reading surfaces; asphalt venue ticket and pit boards; asphalt
    chapters for countdown, pass band and RSVP; white ticket card
  - **status:** pending
- **concern:** Photographic treatment (role, crop, focal point, filter)
  - **decision / evidence:** Each photograph once: car in the hero card/panel (capped at 704 px),
    suit and jacket as overlapping prints with a light print finish; motifs elsewhere
  - **status:** pending
- **concern:** Section-intersection intent and narrative cadence
  - **decision / evidence:** hero→quote blend; countdown→location lane band; gallery→pass overlap;
    rsvp→back cover checkered band
  - **status:** pending
- **concern:** Local exceptions to the selected preset
  - **decision / evidence:** Token remap only (incl. section-scoped tokens); no layout overrides; no
    local exceptions
  - **status:** documented
- **concern:** Per-section finish refinement (Local v8)
  - **decision / evidence:** Profile tokens plus approved shared tokens; measured contrast fixes
    (see Finish refinement)
  - **status:** pending

### Finish refinement (Local v8)

Profile-token pass with no redesign (2026-10-07):

- Palette: the cover seal, masthead sheen and accents move from gold to race red, and the «Abrir»
  ribbon turns yellow. The location card title, pit-board heading, flourish, map grid and
  next-section button lose the base coffee/gold. The pass rules are asphalt instead of pink.
- Type: location labels use Instrument Sans 700 at 0.72rem with 0.24em tracking. The countdown date
  becomes a label. The quote signature uses the label face in solid white. The RSVP title is on the
  shared title scale.
- Rhythm: the quote line height is 1.15 with no empty em above the line. The pass overlaps the
  gallery by 3rem, so the second caption shows on desktop.
- Contrast, measured: hero desktop folio 1.3→6:1, cover index 2.8→6.3:1, quote signature 3.7→5.1:1,
  nav label 2.6→17:1, RSVP radio focus 1.1→12:1, gallery focus 3.0→6.3:1.
- Shared tokens (owner-approved 2026-10-07; each defaults to the previous literal, so other
  invitations compute the same values): countdown label colour/opacity and footer style, folio alpha
  and lift, hero canvas/watermark opacity, name fills and surname weight, calligraphy accent
  font/colour, quote author weight and kicker display, location eyebrow colour and lede family,
  paired-portraits title weight/size/line height/tracking/top margin, back-cover signature weight
  and image hover filter/transform.
- Second pass: labels on the countdown 2.3→9.2:1, folios 3.2→6.3:1, location eyebrow 3.2→7.3:1; hero
  checkered strips at full strength; gallery title on the section scale with its folio visible;
  quote kicker removed; RSVP hairlines in paper instead of olive; closing signature 600.
- Not addressed: «Pits» eyebrow (no token), venue card vs pit-board widths and the back-cover trophy
  alignment on desktop (variant geometry), repeated «sábado 24» (approved copy), gold marks inside
  `cover-grid.jpg` (asset).

### Creative acceptance record

| field                                       | value                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Mechanical render/capture result            | pass — Local v8 renders every section; full-page and per-section captures at mobile-standard and desktop (2026-10-07)   |
| Whole-invitation responsive inspection      | 390×844 and 1440×900 captured and compared with xv/destenid-sofia (agent review, iteration 3)                           |
| Section boundaries and narrative continuity | pending human review                                                                                                    |
| Human creative outcome                      | `PENDING`                                                                                                               |
| Reviewer and date                           | —                                                                                                                       |
| Blocking reason or owner follow-up          | Music file; human review of iteration 3 and the v8 refinement; client answers (time, parents, itinerary, gifts, passes) |

---

## Photograph Inventory

Source label: `source:client-photos` (opaque)  
All files are messaging-app JPEGs; the owner accepted them as the definitive set, so no originals
are expected. Quality labels stay truthful. Publication encodes each JPEG once to WebP at its native
width; no role requests a larger size, and no prepared derivative is needed.

| source filename | dims     | format | orientation | weight | quality              | role                           | duplicate | processing                                                                          | derivative     |
| --------------- | -------- | ------ | ----------- | ------ | -------------------- | ------------------------------ | --------- | ----------------------------------------------------------------------------------- | -------------- |
| chat-054        | 704×1421 | jpeg   | portrait    | 171 KB | provisional-whatsapp | heroPortrait (+ OG)            | no        | ingested as provided; desktop panel capped at 704 px; focal 50% 50%                 | hero.jpg       |
| chat-053        | 768×1364 | jpeg   | portrait    | 128 KB | provisional-whatsapp | gallery01                      | no        | ingested as provided; overlapping print, focal 52% 58%, print finish                | gallery-01.jpg |
| chat-055        | 739×1600 | jpeg   | portrait    | 166 KB | provisional-whatsapp | gallery02                      | no        | letterbox and phone bar removed: rows 302–1297 kept (739×996); focal 50% 40%        | gallery-02.jpg |
| chat-052        | 518×1120 | jpeg   | portrait    | 29 KB  | provisional-whatsapp | coverGrid roundel (composited) | no        | brightened (×1.45) face crop inside the race roundel, fine halftone; ~1:1 at 390 px | cover-grid.jpg |

The earlier gallery-02 derivative kept rows 302–1584 and still carried a black band and the phone
home bar; it was re-cropped from the chat original. Gallery prints are at most 22rem wide and never
exceed their native width.

### Original motif assets

Original artwork authored for this invitation (asphalt, checkered flag, race number "3", trophy); no
third-party artwork, logos or typefaces. Rendered from HTML/SVG with Montserrat (OFL) and stored as
JPEG sources; publication re-encodes them to WebP.

| source filename     | dims      | format | orientation | weight | quality              | role                         | duplicate | processing                                                                 | derivative          |
| ------------------- | --------- | ------ | ----------- | ------ | -------------------- | ---------------------------- | --------- | -------------------------------------------------------------------------- | ------------------- |
| hero-canvas.jpg     | 1920×1280 | jpeg   | landscape   | 0.4 MB | production-ready     | heroCanvas (hero background) | no        | asphalt, side lines, checker bands                                         | hero-canvas.jpg     |
| cover-grid.jpg      | 1080×1920 | jpeg   | portrait    | 0.3 MB | provisional-whatsapp | coverGrid (collector cover)  | no        | paper bands for the masthead, track, roundel with chat-052 and a "3" badge | cover-grid.jpg      |
| thankyou-trophy.jpg | 1200×1600 | jpeg   | portrait    | 0.3 MB | production-ready     | thankYouTrophy (back cover)  | no        | trophy with "3" and "Gran Premio 2026" plate                               | thankyou-trophy.jpg |

### Uniqueness table (required before READY_*)

| role           | source           | derivative          | intentional multi-role?                            |
| -------------- | ---------------- | ------------------- | -------------------------------------------------- |
| heroPortrait   | chat-054         | hero.jpg            | yes, off-page only (OG share preview; D7)          |
| gallery01      | chat-053         | gallery-01.jpg      | no                                                 |
| gallery02      | chat-055         | gallery-02.jpg      | no                                                 |
| heroCanvas     | motif            | hero-canvas.jpg     | yes (hero background and the collector inner page) |
| coverGrid      | motif + chat-052 | cover-grid.jpg      | no (chat-052's only role)                          |
| thankYouTrophy | motif            | thankyou-trophy.jpg | no                                                 |

The client chose chat-054 (the ride-on car) as the main photograph; it is the only photograph in the
hero (mobile card, desktop panel) and the share image. No photograph appears twice on the page.
Reverting the cover to a photograph means pointing `envelope.backdropImage` at a photo key, which
reintroduces a repetition.

---

## Implementation Constraints

- Helper prepReadiness is `READY_WITH_PLACEHOLDERS`; implementation is allowed.
- Profile `aithan-darell.scss` is token-only (`tests/unit/invitation-profile-boundary.test.ts`):
  palette remap, display face, folio labels, and section-scoped tokens for the hero, quote,
  countdown, formal RSVP/pass and back cover where those sections declare their own tokens.
- Variants: hero `editorial-cover`, countdown `magazine-folio`, location `standard` with
  `presentationOptions.indicationsStyle: 'numbered-board'`, gallery `paired-portraits` with
  `variantOptions.arrangement: 'overlap'`, rsvp `formal-register`, personalizedAccess `formal-pass`,
  thankYou `editorial-back-cover`. The editorial press-pass, editorial-pass, and editorial-catalog
  variants print an XV edition label in their markup and are not used here.
- Intersections: quote ← hero `atmospheric-blend`; location ← countdown `pattern-band` (lane);
  personalized-access ← gallery `overlap`; thankYou ← rsvp `pattern-band` (checker).
- Envelope: `revealVariant: editorial-cover`, `coverExperience: collector`, `coverEdition: '3'`
  (prints "NÚM. 3" and the inner "3" mark; omitted, it falls back to XV), and `backdropImage` →
  `coverGrid`. Cover lines, card label/tagline and document label are not printed by the collector
  face and are no longer published.
- Hero folio marks: `hero.presentation.coverMark` ("3") and `coverPage` ("POLE POSITION");
  `designCredit: false`.
- Copy is owner-authored in the "usted" register, in the celebrant's first person; one race term per
  section (Gran Premio, pole position, motores, salida, circuito/banderazo, pits, tribuna,
  inscripción, meta/trofeo). No client facts were invented; the inferred municipality and state are
  not printed. Client phrases used literally: "Mis 3 años", venue, address.
- Music: built only when `MUSIC_URL` is filled; `MUSIC_START_SECONDS` adds `startAt`.
- The shorter folios ("GRAN PREMIO · INSCRIPCIÓN") fit on one line at 390 px, which also removes the
  earlier overlap with the RSVP demo notice.

---

## Preparation Readiness History

| date       | readiness                 | helper basis                                             | notes                                                                                         |
| ---------- | ------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 2026-10-07 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` + `summarizeAssetQuality` | Initial preparation; provisional photos accepted as definitive                                |
| 2026-10-07 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` + `summarizeAssetQuality` | Second requirements review; design refinement; chat-052 dropped (Local v4)                    |
| 2026-10-07 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` + `summarizeAssetQuality` | Iteration 3: one role per photograph, motif assets, Montserrat italic, copy review (Local v6) |
| 2026-10-07 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` + `summarizeAssetQuality` | chat-052 inside the cover roundel; brand named once (cover masthead)                          |
| 2026-10-07 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` + `summarizeAssetQuality` | Per-section finish refinement, profile tokens only (Local v8); creative outcome `PENDING`     |
