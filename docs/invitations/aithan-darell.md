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
music track is hosted ("Life Is a Highway"). All published photographs are messaging-app JPEGs,
which the owner accepted as the definitive set; the original motif assets are production-ready, but
the `provisional-whatsapp` photographs still cap readiness below `READY_FOR_IMPLEMENTATION`.
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

- **field:** slug
  - **value:** aithan-darell
  - **classification:** verified
  - **source:** owner
  - **notes:** Owner decision; two given names, no eventType prefix
- **field:** hostLoginAlias
  - **value:** aithan_ruiz
  - **classification:** verified
  - **source:** owner
  - **notes:** Contract form; owner may remap to `aithan_darell`
- **field:** celebrantName
  - **value:** Aithan Darell Ruiz Salgado
  - **classification:** verified
  - **source:** wa-export
  - **notes:** Written twice ("aithan darell Ruiz Salgado", then "Aithan Darell"); display name
    "Aithan Darell"
- **field:** eventLabel
  - **value:** Mis 3 años
  - **classification:** verified
  - **source:** wa-export
  - **notes:** Client copy: "Aithan Darell / Mis 3 años"
- **field:** eventDate
  - **value:** 2026-10-24
  - **classification:** verified
  - **source:** wa-export
  - **notes:** "24 de octubre", stated twice; Saturday 24 October 2026
- **field:** eventTime
  - **value:** 17:30
  - **classification:** verified
  - **source:** wa-export
  - **notes:** First "4:30", corrected to "Hora 5:30"; 5:30 p. m. confirmed by the client
    (2026-10-07)
- **field:** timeZone
  - **value:** America/Mexico_City
  - **classification:** inferred
  - **source:** geography
  - **notes:** Atizapán de Zaragoza, Estado de México; not client-stated
- **field:** baseDemoId
  - **value:** demo-cumple-editorial-magazine
  - **classification:** verified
  - **source:** owner
  - **notes:** Owner-selected catalog entry (new); no children's demo existed
- **field:** sourceAssetPath
  - **value:** source:client-photos
  - **classification:** verified
  - **source:** owner
  - **notes:** Repo asset dir `src/assets/invitations/aithan-darell`; originals from the chat
- **field:** sectionOrder
  - **value:** quote, countdown, location, gallery, personalizedAccess, rsvp, thankYou
  - **classification:** inferred
  - **source:** owner
  - **notes:** Family, itinerary, and gifts omitted: no data supplied (asked in the client message)
- **field:** primaryVenueName
  - **value:** Jardín de Teresita
  - **classification:** verified
  - **source:** wa-export
  - **notes:**
- **field:** primaryVenueAddress
  - **value:** Avenida Juárez 49, Atizapán centro
  - **classification:** verified
  - **source:** wa-export
  - **notes:** Municipality and state (Atizapán de Zaragoza, Estado de México) inferred from the
    client's Maps link
- **field:** venueMapsUrl
  - **value:** https://maps.app.goo.gl/ebbpWEFK68LhuDm28
  - **classification:** verified
  - **source:** wa-export
  - **notes:** Client link (2026-10-07); pin at Av. Juárez 49, Atizapán Centro (19.5589908,
    -99.2451091), replaces the Street View link without a pin
- **field:** themeDescription
  - **value:** Cars: carreras, McQueen, Mate, Mack, todos los personajes
  - **classification:** verified
  - **source:** wa-export
  - **notes:** Client wrote "mcqueen, mate Mac todos los personas"; read as "todos los personajes";
    distributed organically across sections, now also as character cutouts (McQueen, Mack, Mate, Doc
    Hudson, Sally, Ramone) and the Cars emblem
- **field:** clientColors
  - **value:** rojo, negro, blanco
  - **classification:** verified
  - **source:** wa-export
  - **notes:** First "rojo y negro", later "roja y negra y blanca"
- **field:** heroPhoto
  - **value:** ride-on car photograph
  - **classification:** verified
  - **source:** wa-export
  - **notes:** "La imagen sería la que tiene el carro"; published once (hero card/panel) plus the
    off-page OG image
- **field:** rsvpConfirmationMode
  - **value:** api
  - **classification:** inferred
  - **source:** owner
  - **notes:** Owner offered dashboard guest control and passes; client agreed ("Ok super")
- **field:** rsvpGuestCap
  - **value:** 4
  - **classification:** inferred
  - **source:** owner
  - **notes:** Owner default, never discussed; passes are assigned per guest in the dashboard (asked
    in the message)
- **field:** musicUrl
  - **value:**
    https://res.cloudinary.com/dusxvauvj/video/upload/v1791406894/Rascal_Flatts_-_Life_Is_a_Highway_swt74a.mp3
  - **classification:** verified
  - **source:** owner
  - **notes:** "Life Is a Highway" (Rascal Flatts); hosted Cloudinary track supplied by owner
    (2026-10-07)
- **field:** dressCode
  - **value:** Todas las personas en color rojo, negro y/o blanco
  - **classification:** verified
  - **source:** owner
  - **notes:** Client instruction relayed by the owner (2026-10-07); published as the third location
    pit board («Código de vestimenta»)
- **field:** gifts
  - **value:** —
  - **classification:** missing
  - **source:** wa-export
  - **notes:** Never mentioned; optional, omitted (asked in the client message)
- **field:** itinerary
  - **value:** —
  - **classification:** missing
  - **source:** wa-export
  - **notes:** Never mentioned; optional, omitted (asked in the client message)
- **field:** hostsNames
  - **value:** —
  - **classification:** missing
  - **source:** wa-export
  - **notes:** Parents not named. The purchaser waits on "mi hermana", so she is likely the aunt
    (inferred)
- **field:** clientContact
  - **value:** Alin Salgado
  - **classification:** verified
  - **source:** wa-export
  - **notes:** Purchaser; contact details stay outside this document

Rules:

- `verified` requires explicit client/source evidence.
- `inferred` must include its basis and must never be phrased as a client statement.
- Absence of information never implies consent or preference.

---

## Requirements Review — second pass (2026-10-07)

Every published fact was re-read against the full chat and the Local payload.

- **fact:** Name and spelling
  - **source:** chat: "aithan darell Ruiz Salgado", "Aithan Darell"
  - **payload:** "Aithan Darell" (hero, cover, closing)
  - **status:** confirmed
- **fact:** Age / label
  - **source:** chat: "Cumple 3", "Mis 3 años"
  - **payload:** "Mis 3 años"; edition, hero watermark, cover badge and trophy read "3 años"
  - **status:** confirmed
- **fact:** Date
  - **source:** chat: "24 de octubre" (twice)
  - **payload:** 2026-10-24
  - **status:** confirmed
- **fact:** Time
  - **source:** chat: "4:30", then "Hora 5:30"
  - **payload:** 5:30 p. m.
  - **status:** confirmed by the client (2026-10-07)
- **fact:** Venue
  - **source:** chat: "Jardín de Teresita"
  - **payload:** Jardín de Teresita
  - **status:** confirmed
- **fact:** Address / map
  - **source:** chat: "avenida Juárez 49 Atizapán centro"; new pin
  - **payload:** "Avenida Juárez 49, Atizapán centro" · "Atizapán";
    `maps.app.goo.gl/ebbpWEFK68LhuDm28`
  - **status:** confirmed; text literal, inferred municipality/state not printed; definitive pinned
    link (2026-10-07)
- **fact:** Theme and characters
  - **source:** chat: Cars, carreras, McQueen, Mate, Mack
  - **payload:** race vocabulary and organic character distribution across sections, plus one
    character cutout per surface: McQueen (collector cover, front view, and hero, side view), Sally
    and Ramone (inner page), Doc Hudson (countdown), Mack (location, under «La ruta de Mack»), Mate
    (back cover); the Cars emblem above the hero name
  - **status:** confirmed; character artwork and emblem supplied by the owner (2026-10-07); the
    owner asked for McQueen on both the reveal and the hero, so both McQueen files are used
- **fact:** Colors
  - **source:** chat: rojo, negro, blanco
  - **payload:** red / asphalt / paper, yellow accent only
  - **status:** confirmed; yellow is an agent accent
- **fact:** Main photograph
  - **source:** chat: "la que tiene el carro"
  - **payload:** hero card/panel and OG only
  - **status:** confirmed; no other page role
- **fact:** Song
  - **source:** chat: "Life ls a highway canción"
  - **payload:** "Life Is a Highway" (hosted Cloudinary mp3)
  - **status:** confirmed (track hosted; start second defaults to 0)
- **fact:** Parents / hosts
  - **source:** not supplied
  - **payload:** family section omitted
  - **status:** missing
- **fact:** Purchaser relationship
  - **source:** "mi hermana" (inferred aunt)
  - **payload:** not published
  - **status:** assumption
- **fact:** Dress code
  - **source:** owner relay: "todas las personas en color rojo, negro y/o blanco"
  - **payload:** pit board 03 «Código de vestimenta»: "Todas las personas en color rojo, negro y/o
    blanco."
  - **status:** confirmed (2026-10-07)
- **fact:** Gifts
  - **source:** never mentioned
  - **payload:** omitted
  - **status:** missing
- **fact:** Passes per guest
  - **source:** never discussed
  - **payload:** 4 (dashboard-adjustable)
  - **status:** assumption
- **fact:** Itinerary
  - **source:** never mentioned
  - **payload:** omitted
  - **status:** missing

Client message draft (single message, "usted" register):

> Hola, Alin, buen día. Ya estamos afinando la invitación de Aithan Darell y quiero confirmar unos
> detalles para dejarla perfecta:
>
> 1. ¿Desean que aparezcan los nombres de los papás de Aithan? Si es así, ¿cómo los escribo?
> 2. ¿Les gustaría incluir el itinerario de la fiesta (por ejemplo, llegada, pastel y piñata)? Si
>    sí, compártame los horarios.
> 3. ¿Habrá mesa de regalos o alguna sugerencia de regalo que quieran mencionar?
> 4. ¿Cuántos lugares desea asignar por invitación? Por ahora dejé 4 y se puede ajustar en su panel.
> 5. Para la canción "Life Is a Highway", ¿desde qué parte le gustaría que empiece?
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
  - **fields:** dressCode
  - **status:** resolved (client dress code, pit board 03)
- **requirement:** optional
  - **fields:** gifts
  - **status:** missing (non-blocking, omitted)
- **requirement:** optional
  - **fields:** musicUrl, clientColors
  - **status:** resolved (hosted mp3 supplied; clientColors verified)

### Missing blockers

- None for implementation.

### Non-blocking gaps

- Parents' names, itinerary and gifts were never supplied; asked in one client message.
- Music start second is optional (defaults to 0:00).

Deterministic question: **Is the available information sufficient to prepare this invitation?**  
Answer: `yes` (`evaluateEventCompleteness`).

---

## Placeholders

No placeholders remain. The music track is hosted and published (`https://res.cloudinary.com/...`).

---

## Owner Decisions

- **id:** PHOTO-ACCEPTANCE
  - **category:** photograph-acceptance
  - **issue:** Only messaging-app JPEGs (518–768 px wide)
  - **evidence:** Four chat photographs
  - **options:** request originals / accept as provided
  - **recommendation:** Resolved 2026-10-07: accepted as the definitive set
- **id:** SLUG
  - **category:** demo-design-decisions
  - **issue:** Public URL form
  - **evidence:** Client copy "Aithan Darell"
  - **options:** aithan-ruiz / aithan-darell
  - **recommendation:** Resolved 2026-10-07: `aithan-darell`
- **id:** BASE-DEMO
  - **category:** demo-design-decisions
  - **issue:** No children's or Cars demo exists
  - **evidence:** Catalog
  - **options:** editorial-magazine / hacienda remap / new demo
  - **recommendation:** Resolved 2026-10-07: new `demo-cumple-editorial-magazine` entry
- **id:** DISPLAY-FONT
  - **category:** demo-design-decisions
  - **issue:** Flat hierarchy; nothing reads "racing" or "kids"
  - **evidence:** Owner design review 3
  - **options:** Podio / Vuelta rápida / Ancho 75
  - **recommendation:** Resolved 2026-10-07: option 2 — Montserrat italic display, Instrument Sans
    body
- **id:** CARS-MOTIFS
  - **category:** demo-design-decisions
  - **issue:** Cars references without third-party artwork
  - **evidence:** Owner design review 3
  - **options:** shared typed option / local exception / asset
  - **recommendation:** Resolved 2026-10-07: shared options (a) + original image assets (c); no
    local exceptions (b)
- **id:** CARS-CHARACTERS-DISTRIBUTION
  - **category:** demo-design-decisions
  - **issue:** Characters distributed organically across sections
  - **evidence:** Owner decision 2026-10-07
  - **options:** organic distribution (text + photos + original motifs)
  - **recommendation:** Resolved 2026-10-07: approved organic distribution across sections (McQueen,
    Mate, Mack). Copy in "usted" and celebrant 1st person; character artwork later added by the
    owner (see CHARACTER-ARTWORK).
- **id:** PHOTO-ROLES
  - **category:** demo-design-decisions
  - **issue:** Photographs repeated across cover, hero, back cover
  - **evidence:** Owner design review 3
  - **options:** plan A / B / C
  - **recommendation:** Resolved 2026-10-07: plan B — every photograph in one role
- **id:** COVER-PHOTO
  - **category:** demo-design-decisions
  - **issue:** Collector masthead illegible over car scene
  - **evidence:** Owner design review 3
  - **options:** race-suit cover / original motif cover
  - **recommendation:** Resolved 2026-10-07: original motif cover (D1)
- **id:** MOTIF-ASSETS
  - **category:** demo-design-decisions
  - **issue:** Hero canvas repeated the car (blurred)
  - **evidence:** Owner design review 3 (D1)
  - **options:** original image assets / blurred photo
  - **recommendation:** Resolved 2026-10-07: heroCanvas, coverGrid, thankYouTrophy (original
    artwork)
- **id:** OG-IMAGE
  - **category:** demo-design-decisions
  - **issue:** Share preview role
  - **evidence:** Owner design review 3 (D7)
  - **options:** car photograph / own OG card
  - **recommendation:** Resolved 2026-10-07: car photograph, declared as an off-page role
- **id:** START-LIGHTS
  - **category:** demo-design-decisions
  - **issue:** Countdown start-light motif
  - **evidence:** Owner design review 3 (D6)
  - **options:** shared countdown option / postpone
  - **recommendation:** Postponed 2026-10-07
- **id:** SELFIE-COVER
  - **category:** demo-design-decisions
  - **issue:** chat-052 unused; owner asked to consider the cover
  - **evidence:** Owner request 2026-10-07
  - **options:** full cover / roundel colour / roundel duotone / unused
  - **recommendation:** Agent applied roundel colour in Local; full-bleed rejected (dark ink
    masthead, 518 px) — pending owner review
- **id:** BRAND-MENTIONS
  - **category:** demo-design-decisions
  - **issue:** "Celebra-me" printed six times in the content
  - **evidence:** Owner request 2026-10-07
  - **options:** keep / masthead only
  - **recommendation:** Applied: cover masthead only (plus site header logo); folios and hero credit
    drop it
- **id:** GUEST-CAP
  - **category:** missing-client-facts
  - **issue:** Passes per guest not discussed
  - **evidence:** Client asked how passes work
  - **options:** 4 / other
  - **recommendation:** Default 4; adjustable in the dashboard; asked in the client message
- **id:** HOSTS-NAMES
  - **category:** missing-client-facts
  - **issue:** Parents not named
  - **evidence:** Purchaser is likely the aunt
  - **options:** ask client / omit family section
  - **recommendation:** Omit; add `family` if the client supplies names
- **id:** DRESS-CODE
  - **category:** missing-client-facts
  - **issue:** Not answered in the chat
  - **evidence:** Owner relay 2026-10-07
  - **options:** ask client / omit
  - **recommendation:** Resolved 2026-10-07: "Todas las personas en color rojo, negro y/o blanco"
    (location pit board 03)
- **id:** CHARACTER-ARTWORK
  - **category:** demo-design-decisions
  - **issue:** The client asked for the Cars characters; only text mentions existed
  - **evidence:** Owner request 2026-10-07; owner-supplied files `mcqueen.jpg`, `mate.jpg`,
    `mack.webp`
  - **options:** original artwork / client images / owner-supplied official artwork / text only
  - **recommendation:** Resolved 2026-10-07: owner-supplied artwork, background removed, one cutout
    per section through the typed `ornament` fields. Third-party character artwork: usage rights are
    the owner's decision and responsibility
- **id:** GIFTS
  - **category:** missing-client-facts
  - **issue:** Not requested
  - **evidence:** —
  - **options:** ask client / omit
  - **recommendation:** Omit; asked in the client message
- **id:** MUSIC-FILE
  - **category:** missing-client-facts
  - **issue:** Song named, no file
  - **evidence:** "Life ls a highway canción"
  - **options:** owner hosts audio / omit music
  - **recommendation:** Resolved 2026-10-07: owner supplied hosted Cloudinary track for "Life Is a
    Highway" (Rascal Flatts)

---

## Agent Recommendations

| topic       | recommendation                                                                                                  | basis                                                                                 | status                    |
| ----------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------- |
| demo        | editorial-magazine preset told as a race-day magazine ("Gran Premio")                                           | client colors red/black/white; no kids demo                                           | accepted by owner session |
| palette     | asphalt / paper / racing red, "Piston" yellow only on dark surfaces                                             | client colors; contrast ≥ 4.5:1 for body copy                                         | accepted by owner design  |
| variants    | avoid press-pass, editorial-pass, and editorial-catalog (XV labels in markup)                                   | component literals                                                                    | accepted by owner session |
| display     | Montserrat italic via the opt-in `Montserrat Italic Display` face (no shared token)                             | profile cannot set `font-style`; +40 KB latin                                         | applied (iteration 3)     |
| gallery     | `paired-portraits` + `arrangement: 'overlap'`; prints capped at native width                                    | 739–768 px sources                                                                    | applied (iteration 3)     |
| location    | `standard` + `indicationsStyle: 'numbered-board'`; venue ticket on asphalt (tokens)                             | split-map needs coordinates; plates need 2 venues                                     | applied (iteration 3)     |
| characters  | typed `ornament` cutouts: Doc Hudson countdown, Mack location, Mate back cover                                  | client request; contained boxes, no profile layout                                    | applied (Local v10/v13)   |
| age         | "3 años" wherever the figure stood alone (rail, inside mark, hero watermark, assets)                            | owner request 2026-10-07; the suit caption keeps the race number «Nº 3»               | applied (Local v11)       |
| reveal      | McQueen on the cover face and under the hero details, Sally + Ramone on the inner page, Cars emblem in the hero | owner decision 2026-10-07 (McQueen on reveal and hero); typed envelope/hero ornaments | applied (Local v13)       |
| dates       | back cover "Sábado 24 de octubre de 2026"; scoreboard footer drops its "Sábado 24"                              | legibility; the scoreboard already prints the full date                               | applied (Local v11)       |
| footer      | race livery through shared `--footer-editorial-*` tokens (asphalt, red rule, paper)                             | contrast: CTA 3.9:1 red → 17:1 paper; brand credit kept                               | applied (Local v11)       |
| hero-mobile | no prepared mobile derivative: the 704 px source is smaller than any derivative                                 | delivery already serves the native width                                              | applied                   |

---

## Sections

| bucket                 | section keys                                                                    |
| ---------------------- | ------------------------------------------------------------------------------- |
| requested              | hero (car photo), gallery, rsvp with passes, music, Cars characters, dress code |
| inferred / recommended | quote, countdown, location, personalizedAccess, thankYou                        |
| omitted                | family, itinerary, gifts, interludes (no photograph supports one)               |
| unresolved             | family, itinerary and gifts if the client answers                               |

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
- `location.ornament` and `thankYou.ornament` (new, optional) plus the existing
  `countdown.ornament`: a transparent cutout in a fixed, contained box (`object-fit: contain`) after
  the location intro, below the back-cover signature and between the countdown date and footer.
  Location and thank-you rules use `:where()` and `--location-ornament-*` / `--thank-you-ornament-*`
  tokens; the countdown rule lives in `magazine-folio` (`--countdown-ornament-*`). Content without
  an ornament renders nothing new.
- `src/styles/fonts/_montserrat-italic-display.scss`: opt-in face, only downloaded by profiles that
  `@use` it.
- `envelope.coverEditionLabel` (new, optional): label printed before `coverEdition` on the collector
  rail; `NÚM.` when omitted, `''` prints the edition alone. Here `coverEdition: '3 años'` prints
  "VOL. 1 · 3 AÑOS · OCTUBRE 2026" and the inside-cover mark "3 años".
- `--hero-watermark-size` (editorial-cover) and `--ec-inside-mark-size` (collector inside cover):
  sizing tokens for multi-word marks, defaults equal to the previous literals; the marks no longer
  wrap.
- `--footer-editorial-*` tokens on the editorial footer skin (ground, rule, padding, gaps, brand
  credit colour/logo filter, contact button rest/hover, replay link); every default equals the
  previous literal.
- `envelope.coverOrnament` and `envelope.spreadOrnaments` (new, optional, collector only): cutouts
  on the printed face and the first inner page in token-anchored contained boxes
  (`--ec-face-ornament-*`, `--ec-page-ornament-{1,2}-*`). The editorial-cover hero now renders the
  existing `hero.ornament` as an emblem above the title (`--hero-ornament-*`) and
  `hero.accentOrnament` as a cutout below the details (`--hero-accent-ornament-*`). Lazy cutouts
  (location, back cover) declare `width`/`height`. `--hero-content-padding-block-start` (phone rule,
  default equal to the previous literal) keeps the portrait clear of the folio rail now that the
  emblem makes the stacked hero fill the screen; `--hero-section-height: auto` below 992 px lets the
  hero grow past one screen so the portrait keeps its 4:5 frame (default `100svh`).
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
  alignment on desktop (variant geometry).

### Age, dates and footer (Local v11)

- «3 años» replaces every standalone «3»: collector rail (`coverEdition: '3 años'` with
  `coverEditionLabel: ''`, so no "NÚM."), inside-cover watermark, hero watermark
  (`coverMark: '3 años'`, sized by `--hero-watermark-size`), the cover badge (regenerated
  `cover-grid.jpg`) and the trophy cup (regenerated `thankyou-trophy.jpg`). The suit caption keeps
  «Nº 3»: it is the race number on the suit, not the age.
- Back-cover date «Sábado 24 de octubre de 2026» instead of «24 · X · 2026». The scoreboard already
  prints «SÁBADO 24 DE OCTUBRE DE 2026», so its footer line drops the duplicated «Sábado 24» and
  keeps only the start time. The remaining «sábado 24» mentions (location heading, venue line, pass
  note, RSVP messages) each sit in a different section.
- Footer in the race livery (profile tokens only): asphalt ground under a 4 px red rule with a 2 px
  yellow pinstripe, paper brand credit («Powered by» + Celebra-me logo inverted to paper, the
  mandatory site credit), paper contact button that fills red on hover, paper replay link with a
  yellow hover. Contrast: contact label 3.9:1 (red on asphalt) → 17:1; «Powered by» and the replay
  link 8.6:1.

### Creative acceptance record

- **field:** Mechanical render/capture result
  - **value:** pass — Local v8 renders every section; full-page and per-section captures at
    mobile-standard and desktop (2026-10-07)
- **field:** Whole-invitation responsive inspection
  - **value:** 390×844 and 1440×900 captured and compared with xv/destenid-sofia (agent review,
    iteration 3)
- **field:** Section boundaries and narrative continuity
  - **value:** pending human review
- **field:** Human creative outcome
  - **value:** `PENDING`
- **field:** Reviewer and date
  - **value:** —
- **field:** Blocking reason or owner follow-up
  - **value:** Human review of iteration 3, the v8 refinement and the character cutouts; client
    answers (parents, itinerary, gifts, passes)

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

| source filename     | dims      | format | orientation | weight  | quality              | role                         | duplicate | processing                                                                                               | derivative          |
| ------------------- | --------- | ------ | ----------- | ------- | -------------------- | ---------------------------- | --------- | -------------------------------------------------------------------------------------------------------- | ------------------- |
| hero-canvas.jpg     | 1920×1280 | jpeg   | landscape   | 0.4 MB  | production-ready     | heroCanvas (hero background) | no        | asphalt, side lines, checker bands                                                                       | hero-canvas.jpg     |
| cover-grid.jpg      | 1080×1920 | jpeg   | portrait    | 0.2 MB  | provisional-whatsapp | coverGrid (collector cover)  | no        | paper bands for the masthead, track, roundel with chat-052 and a "3 AÑOS" badge (regenerated 2026-10-07) | cover-grid.jpg      |
| thankyou-trophy.jpg | 1200×1600 | jpeg   | portrait    | 0.15 MB | production-ready     | thankYouTrophy (back cover)  | no        | trophy with "3 AÑOS" and "Gran Premio 2026" plate (regenerated 2026-10-07)                               | thankyou-trophy.jpg |

### Character cutouts

Cars characters requested by the client; artwork supplied by the owner (2026-10-07). White
backgrounds were removed (edge flood fill, white un-matte and a light-fringe pass; Mate also lost
the standee floor shadow and the enclosed white gaps), each file was trimmed and, where a side was
under the 480 px intake minimum, enlarged once with Lanczos. Sources are lossless WebP with alpha;
publication re-encodes them to WebP (alpha kept).

| source filename              | dims     | format | orientation | weight | quality              | role                        | duplicate | processing                                                                    | published |
| ---------------------------- | -------- | ------ | ----------- | ------ | -------------------- | --------------------------- | --------- | ----------------------------------------------------------------------------- | --------- |
| character-mcqueen.webp       | 824×488  | webp   | landscape   | 333 KB | owner-supplied       | hero.accentOrnament         | no        | from 736×423 JPEG: background removed, trimmed, ×1.22                         | 61 KB     |
| character-mack.webp          | 601×488  | webp   | landscape   | 177 KB | owner-supplied (low) | location.ornament           | no        | from 360×290 WebP (already transparent): trimmed, ×1.62                       | 46 KB     |
| character-mate.webp          | 727×488  | webp   | landscape   | 296 KB | owner-supplied       | thankYou.ornament           | no        | from 736×786 JPEG: background, floor shadow and gaps removed                  | 71 KB     |
| character-doc-hudson.webp    | 987×480  | webp   | landscape   | 276 KB | owner-supplied       | countdown.ornament          | no        | from 645×304 WebP: floor shadow removed, trimmed, ×1.68                       | see note  |
| character-mcqueen-front.webp | 696×480  | webp   | landscape   | 220 KB | owner-supplied (low) | envelope.coverOrnament      | no        | from 360×360 WebP (cropped on its left): floor shadow removed, trimmed, ×1.94 | see note  |
| character-sally.webp         | 892×480  | webp   | landscape   | 223 KB | owner-supplied (low) | envelope.spreadOrnaments[0] | no        | from 450×233 WebP: floor shadow removed, trimmed, ×2.25                       | see note  |
| character-ramone.webp        | 1079×765 | webp   | landscape   | 455 KB | owner-supplied       | envelope.spreadOrnaments[1] | no        | from 1362×820 WebP: floor shadow removed, trimmed, native                     | see note  |
| logo-cars.webp               | 754×480  | webp   | landscape   | 173 KB | owner-supplied       | hero.ornament               | no        | from 669×458 JPEG: white ground flood-filled, edge un-matted, ×1.24           | see note  |

Second batch (2026-10-07, owner-approved placement): the semi-transparent floor shadows were dropped
(semi-transparent pixels farther than 3 px from any opaque pixel). Published weights are listed in
the Local release receipt (v12); every file re-encodes under the `standard-section` budget. Sally is
a ×2.25 enlargement of a 450 px source and reads soft on dense screens. The front-view McQueen
(`Lightning_McQueen.webp`, 358×247 usable, cut off on its left in the source) is placed flush with
the cover's left edge so the cut reads as the car entering the page. Third-party artwork and the
franchise emblem: usage rights are the owner's decision and responsibility.

Mack's source is small (360 px); it is displayed at most 18rem wide and 9rem tall, but a larger
source would sharpen it on high-density screens.

### Uniqueness table (required before READY_*)

| role                  | source           | derivative                   | intentional multi-role?                            |
| --------------------- | ---------------- | ---------------------------- | -------------------------------------------------- |
| heroPortrait          | chat-054         | hero.jpg                     | yes, off-page only (OG share preview; D7)          |
| gallery01             | chat-053         | gallery-01.jpg               | no                                                 |
| gallery02             | chat-055         | gallery-02.jpg               | no                                                 |
| heroCanvas            | motif            | hero-canvas.jpg              | yes (hero background and the collector inner page) |
| coverGrid             | motif + chat-052 | cover-grid.jpg               | no (chat-052's only role)                          |
| thankYouTrophy        | motif            | thankyou-trophy.jpg          | no                                                 |
| characterMcQueen      | owner artwork    | character-mcqueen.webp       | no                                                 |
| characterMack         | owner artwork    | character-mack.webp          | no                                                 |
| characterMate         | owner artwork    | character-mate.webp          | no                                                 |
| characterDocHudson    | owner artwork    | character-doc-hudson.webp    | no                                                 |
| characterSally        | owner artwork    | character-sally.webp         | no                                                 |
| characterRamone       | owner artwork    | character-ramone.webp        | no                                                 |
| logoCars              | owner artwork    | logo-cars.webp               | no                                                 |
| characterMcQueenFront | owner artwork    | character-mcqueen-front.webp | no                                                 |

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
- Envelope: `revealVariant: editorial-cover`, `coverExperience: collector`, `coverEdition: '3 años'`
  with `coverEditionLabel: ''` (rail "3 AÑOS" without "NÚM.", inside mark "3 años"; omitted, the
  edition falls back to XV), and `backdropImage` → `coverGrid`. Cover lines, card label/tagline and
  document label are not printed by the collector face and are no longer published.
- Hero folio marks: `hero.presentation.coverMark` ("3 años") and `coverPage` ("POLE POSITION");
  `designCredit: false`.
- Characters: one owner-supplied cutout per surface (`envelope.coverOrnament` McQueen front view,
  `hero.accentOrnament` McQueen side view, `envelope.spreadOrnaments` Sally and Ramone,
  `countdown.ornament` Doc Hudson, `location.ornament` Mack, `thankYou.ornament` Mate) and the Cars
  emblem as `hero.ornament`; the profile only sizes and anchors them through tokens.
- Copy is owner-authored in the "usted" register, in the celebrant's first person; one race term per
  section (Gran Premio, pole position, motores, salida, circuito/banderazo, pits, tribuna,
  inscripción, meta/trofeo). No client facts were invented; the inferred municipality and state are
  not printed. Client phrases used literally: "Mis 3 años", venue, address.
- Music: published with hosted track (`https://res.cloudinary.com/...`); `MUSIC_START_SECONDS` adds
  `startAt` if needed.
- The shorter folios ("GRAN PREMIO · INSCRIPCIÓN") fit on one line at 390 px, which also removes the
  earlier overlap with the RSVP demo notice.

---

## Preparation Readiness History

- **date:** 2026-10-07
  - **readiness:** `READY_WITH_PLACEHOLDERS`
  - **helper basis:** `evaluatePreparationReadiness` + `summarizeAssetQuality`
  - **notes:** Initial preparation; provisional photos accepted as definitive
- **date:** 2026-10-07
  - **readiness:** `READY_WITH_PLACEHOLDERS`
  - **helper basis:** `evaluatePreparationReadiness` + `summarizeAssetQuality`
  - **notes:** Second requirements review; design refinement; chat-052 dropped (Local v4)
- **date:** 2026-10-07
  - **readiness:** `READY_WITH_PLACEHOLDERS`
  - **helper basis:** `evaluatePreparationReadiness` + `summarizeAssetQuality`
  - **notes:** Iteration 3: one role per photograph, motif assets, Montserrat italic, copy review
    (Local v6)
- **date:** 2026-10-07
  - **readiness:** `READY_WITH_PLACEHOLDERS`
  - **helper basis:** `evaluatePreparationReadiness` + `summarizeAssetQuality`
  - **notes:** chat-052 inside the cover roundel; brand named once (cover masthead)
- **date:** 2026-10-07
  - **readiness:** `READY_WITH_PLACEHOLDERS`
  - **helper basis:** `evaluatePreparationReadiness` + `summarizeAssetQuality`
  - **notes:** Per-section finish refinement, profile tokens only (Local v8); creative outcome
    `PENDING`
- **date:** 2026-10-07
  - **readiness:** `READY_WITH_PLACEHOLDERS`
  - **helper basis:** `evaluatePreparationReadiness` + `summarizeAssetQuality`
  - **notes:** Final client corrections applied: confirmed 5:30 p. m., pinned Maps link, Cars
    characters distribution, personalized pass note with date/time/venue, RSVP "usted" response
    messages, and hosted music track (Local v8)
- **date:** 2026-10-07
  - **readiness:** `READY_WITH_PLACEHOLDERS`
  - **helper basis:** `evaluatePreparationReadiness` + `summarizeAssetQuality`
  - **notes:** Cars character cutouts (McQueen, Mack, Mate) through typed `ornament` fields and the
    client dress code as pit board 03 (Local v10)
- **date:** 2026-10-07
  - **readiness:** `READY_WITH_PLACEHOLDERS`
  - **helper basis:** `evaluatePreparationReadiness` + `summarizeAssetQuality`
  - **notes:** «3 años» on every standalone figure (rail, marks, regenerated cover badge and
    trophy), legible back-cover date, scoreboard footer without the duplicated day, footer in the
    race livery through shared tokens (Local v11)
- **date:** 2026-10-07
  - **readiness:** `READY_WITH_PLACEHOLDERS`
  - **helper basis:** `evaluatePreparationReadiness` + `summarizeAssetQuality`
  - **notes:** Owner-approved character placement: Doc Hudson on the collector cover, Sally and
    Ramone on the inner page, Cars emblem above the hero name; typed envelope/hero ornaments with
    portability tests (Local v12; Doc Hudson placement superseded in v13)
- **date:** 2026-10-07
  - **readiness:** `READY_WITH_PLACEHOLDERS`
  - **helper basis:** `evaluatePreparationReadiness` + `summarizeAssetQuality`
  - **notes:** Owner decision: McQueen on the reveal (cover face, front view) and in the hero
    (`hero.accentOrnament`, side view); Doc Hudson moves to the scoreboard (Local v13)
