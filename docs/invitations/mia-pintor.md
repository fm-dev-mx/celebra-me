# Canonical Invitation Preparation State — `mia-pintor`

> Schema owner: `docs/core/invitation-preparation-contract.md` Executable evaluation:
> `src/lib/invitation-preparation/` (**prepReadiness SSOT**) Skill:
> `.agent/skills/invitation-preparation/SKILL.md`

---

## Identity

| Parameter              | Value                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| **Slug**               | `mia-pintor`                                                        |
| **Host Login Alias**   | `mia_pintor` (working alias; no account created during preparation) |
| **Event Type**         | `xv`                                                                |
| **Preparation Status** | `READY_FOR_IMPLEMENTATION`                                          |

**Preparation Readiness (prepReadiness):** `READY_FOR_IMPLEMENTATION`

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

---

## Sources

| Source                        | Reference                           | Notes                                                                   |
| ----------------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export` (opaque label)   | Event facts, colors, restrictions, main-photo selection                 |
| High-res photos / assets root | `source:hr-photos` (opaque label)   | Photographer delivery, 16 JPEG files, received 2026-10-03               |
| Visual reference              | `source:client-reference` (opaque)  | Third-party invitation shared by the client; structure/inspiration only |
| Owner decisions               | `source:owner-session` (2026-10-06) | Slug, marine variant scope, personalized RSVP, proceed without pending  |

---

## Fact Register

| field                 | value                                                                                             | classification | source        | notes                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------- | -------------- | ------------- | -------------------------------------------------------------------- |
| slug                  | mia-pintor                                                                                        | inferred       | owner-session | Surname taken from the photo-delivery label; confirm with client     |
| celebrantName         | Mía                                                                                               | verified       | wa-export     | Client wrote "Mía" with accent; no surname shown in the invitation   |
| eventLabel            | Mis XV Años                                                                                       | verified       | wa-export     | XV event                                                             |
| eventDate             | 2026-12-06                                                                                        | verified       | wa-export     | Sunday; also handwritten "06/12/26" on the main photograph           |
| eventTime             | 17:00                                                                                             | verified       | wa-export     | Religious ceremony                                                   |
| receptionTime         | 18:30                                                                                             | verified       | wa-export     | Reception at Salón Sole Mio (corrected from initial 19:00 estimate)  |
| timeZone              | America/Monterrey                                                                                 | inferred       | wa-export     | Tampico / Cd. Madero, Tamaulipas                                     |
| baseDemoId            | demo-xv-celestial-blue                                                                            | inferred       | owner-session | Technical base (preset provenance); client asked for blue            |
| sourceAssetPath       | source:hr-photos                                                                                  | verified       | owner-session | Opaque label only                                                    |
| sectionOrder          | quote, family, countdown, location, itinerary, gallery, gifts, personalizedAccess, rsvp, thankYou | verified       | wa-export     | Opening and hero precede these sections; timeline-paper itinerary    |
| primaryVenueName      | Parroquia Nuestra Señora de Lourdes                                                               | verified       | wa-export     | Religious ceremony                                                   |
| primaryVenueAddress   | Ébano 401, Petrolera, Tampico, Tamps.                                                             | verified       | wa-export     |                                                                      |
| distinctVenues        | true                                                                                              | verified       | wa-export     | Ceremony and reception are different venues                          |
| receptionVenueName    | Sole Mio Salón de Eventos                                                                         | verified       | wa-export     |                                                                      |
| receptionVenueAddress | Fco. I. Madero 171, Emilio Carranza, Cd. Madero, Tamps.                                           | verified       | wa-export     | Client wrote "Fco l madero"; normalized to "Fco. I. Madero"          |
| ceremonyMapUrl        | Google Maps search by address                                                                     | inferred       | owner-session | Generated search links; verify destination before release            |
| fatherName            | —                                                                                                 | not_applicable | wa-export     | Client: invitation is from her family, no parents' names             |
| motherName            | —                                                                                                 | not_applicable | wa-export     | Same as above                                                        |
| godparents            | —                                                                                                 | not_applicable | wa-export     | Client: godparents are not listed locally                            |
| dressCode             | Caballeros: traje. Damas: vestido de noche.                                                       | verified       | wa-export     |                                                                      |
| reservedColor         | Azul cielo reservado para la quinceañera                                                          | verified       | wa-export     |                                                                      |
| adultsOnly            | No niños                                                                                          | verified       | wa-export     |                                                                      |
| gifts                 | Lluvia de sobres                                                                                  | verified       | wa-export     | No registry or bank details                                          |
| clientColors          | Azul cielo muy tenue, plata, motivos marinos                                                      | verified       | wa-export     |                                                                      |
| rsvpConfirmationMode  | api                                                                                               | verified       | owner-session | Personalized passes per guest                                        |
| rsvpGuestCap          | 2                                                                                                 | inferred       | owner-session | Fallback only; per-guest passes govern attendee counts               |
| rsvpWhatsappPhone     | —                                                                                                 | not_applicable | owner-session | No WhatsApp confirmation flow                                        |
| rsvpDeadline          | —                                                                                                 | missing        | wa-export     | Optional; omit until client provides it                              |
| musicUrl              | Dancing Queen — ABBA (Cloudinary hosted)                                                          | verified       | wa-export     | Client selected track; autoPlay: true (starts with the envelope tap) |
| itinerary             | Official Salón Sole Mio schedule                                                                  | verified       | wa-export     | 7 milestones; timeline-paper variant                                 |
| specialMessages       | Copy proposed by agent                                                                            | inferred       | owner-session | Pending client approval                                              |

---

## Event Completeness

XV contract maturity: `evidence-backed`. All required fields are verified or validly inferred;
conditional reception venue fields are verified. Optional gaps (music, RSVP deadline, itinerary) are
non-blocking and are omitted from the payload rather than represented by placeholder tokens.

### Missing blockers

- None.

### Non-blocking gaps

- RSVP deadline (optional; omitted from payload until client provides it).
- Guest list and pass counts (loaded in the dashboard after release).
- Photographs without the photographer watermark (optional).

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

---

## Placeholders

No placeholder tokens are used; optional content is omitted until supplied.

---

## Owner Decisions

| id  | category              | issue                         | evidence  | options                                    | recommendation / outcome               |
| --- | --------------------- | ----------------------------- | --------- | ------------------------------------------ | -------------------------------------- |
| D1  | missing-client-facts  | Celebrant surname for slug    | hr-photos | Ask client / use delivery label            | Owner chose `mia-pintor`               |
| D2  | demo-design-decisions | Marine motifs scope           | wa-export | Palette only / icons / full marine variant | Owner chose full marine reveal variant |
| D3  | missing-client-facts  | RSVP mode and pending content | wa-export | Personalized API / WhatsApp / wait         | Owner chose personalized API, proceed  |

---

## Agent Recommendations

| topic   | recommendation                                                                  | basis                        | status                  |
| ------- | ------------------------------------------------------------------------------- | ---------------------------- | ----------------------- |
| demo    | `celestial-blue` preset + new reusable `seaside-lineart` envelope variant       | catalog + client reference   | approved (D2)           |
| palette | Very pale sky blue surfaces, silver line work and borders                       | client colors + photographs  | pending creative review |
| copy    | Family-hosted wording, "usted" register, tagline "Bajo el cielo, frente al mar" | client restrictions          | pending client approval |
| hero    | `bleed-portrait`: the complete mirror photograph to the edges                   | handwritten date + watermark | pending creative review |

---

## Sections

| bucket                 | section keys                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| requested              | location (two venues + indications), itinerary (timeline-paper), gifts, rsvp, gallery, music (Dancing Queen) |
| inferred / recommended | quote, family (no parents/godparents), countdown, personalizedAccess, thankYou                               |
| omitted                | —                                                                                                            |
| unresolved             | —                                                                                                            |

---

## Design Direction

| decision                          | value                                                                    | classification      |
| --------------------------------- | ------------------------------------------------------------------------ | ------------------- |
| Owner-selected base demo          | demo-xv-celestial-blue                                                   | verified            |
| Recommended demo alternatives     | —                                                                        | recommendation only |
| Selected variant / visual profile | envelope `seaside-lineart` + seal `shell`; profile `mia-pintor` (tokens) | verified (owner D2) |
| Client color requirements         | Azul cielo muy tenue, plata, motivos marinos                             | verified            |
| Recommended palette               | Pale sky-blue paper, silver ink, deep blue-graphite text                 | recommendation only |
| Unresolved visual decisions       | —                                                                        | —                   |

The client's reference opens with an envelope revealing an illustrated card (script name, "MIS XV
AÑOS", date) and a floating music control. The marine direction translates that structure into
silver line art (waves, scallop shell, starfish, coral) on pale sky blue. The variant is generic,
proven first on the unlisted demo `demo-xv-seaside`, and carries no client identity.

---

## Creative Direction & Acceptance

**Visual idea:** a shoreline letter: sky paper, silver ink and a single marine line at each
threshold, from the envelope to the closing. The client reference contributes composition
relationships only (illustrated card, script name, framed photographs, "Dónde y cuándo", dress code
as its own block); its gold palette and New York motifs are not carried over.

**Human creative outcome:** `PENDING`

- **concern:** Typography roles (display, heading, body, metadata)
  - **decision / evidence:** Pinyon only for the name (envelope, card, hero) and the closing
    signature; Cormorant italic for section headings; EB Garamond for text, small-caps labels and
    old-style numerals; Instrument Sans only inside form fields
  - **status:** applied
- **concern:** Vertical rhythm and density
  - **decision / evidence:** Countdown as one written fact (`written-days`); gallery of six as a
    mirrored contact sheet; venues as a printed program; dress code as a details card; gifts as a
    two-line note
  - **status:** applied
- **concern:** Surface hierarchy (open flow vs cards/containers)
  - **decision / evidence:** Continuous sky paper; printed pieces only where stationery has them:
    envelope card (deckle), details card (deckle) and reply card (pass + RSVP joined); no shadowed
    component cards
  - **status:** applied
- **concern:** Photographic treatment (role, crop, focal point, filter)
  - **decision / evidence:** Hero mirror photograph to the edges, uncropped on phones; hut interlude
    full-bleed; meadow interlude in a passe-partout; hut removed from the gallery (it repeated the
    interlude and cropped the face); per-item focal points in the mosaic; closing photograph as a
    white-bordered print; DAYEZ mark visible
  - **status:** applied
- **concern:** Section-intersection intent and narrative cadence
  - **decision / evidence:** Envelope → hero → quote → family → hut (shore chapter closes) →
    countdown → framed meadow → venues → dress code → gallery → gifts → pass → RSVP → closing
  - **status:** applied
- **concern:** Marine language
  - **decision / evidence:** One hand-drawn shoreline at four thresholds (quote, family close,
    location close, closing with a resting shell); the envelope keeps only the pearl wax shell seal
    and the card one shell over the shoreline; no marine icons elsewhere
  - **status:** applied
- **concern:** Local exceptions to the selected preset
  - **decision / evidence:** Tokens only in `mia-pintor.scss`; structure through registered variants
    (`bleed-portrait`, `written-days`, `program-sheet`, `mirrored-mosaic`, `reply-card`) and options
    (ornament set, framed interlude, enclosure indications, calendar links)
  - **status:** none

### Reference translation

- **reference point:** Envelope opens to an illustrated card
  - **classification:** already covered
  - **outcome:** `seaside-lineart` envelope kept as the entry; microcopy enlarged
- **reference point:** Entry card with "Ingresar"
  - **classification:** omitted (owner decision)
  - **outcome:** The envelope is the single gate
- **reference point:** Floating music button
  - **classification:** needs client data
  - **outcome:** Player exists; track pending
- **reference point:** "Dónde & Cuándo" with map and calendar
  - **classification:** Lane B + Lane A
  - **outcome:** `program-sheet`: italic heading, line-drawn church and hall, written times, "Ver
    mapa · Agendar · Copiar dirección" text links
- **reference point:** Dress code as its own section
  - **classification:** Lane B + Lane A
  - **outcome:** Enclosure details card "Código de vestimenta" without icons; sky swatch on the
    reserved note
- **reference point:** Gifts and confirmation
  - **classification:** Lane A + Lane B
  - **outcome:** Gifts as a `legend-only` note; pass and RSVP as one `reply-card`
- **reference point:** Recommended lodging
  - **classification:** needs client data
  - **outcome:** Not added

### Creative acceptance record

- **field:** Mechanical render/capture result
  - **value:** pass — Local v11; all-sections at 390×844, 430×932 and 1440×900, reveal-only at
    390×844 and 1440×900 (2026-10-07)
- **field:** Contrast
  - **value:** Guest-facing text uses the 6.6:1 muted ink or full ink; the RSVP demo footer now uses
    the muted ink (preview mode only). Full DOM sweep pending for v11
- **field:** Whole-invitation responsive inspection
  - **value:** Reviewed by agent at 390 and 1440 px; human review pending
- **field:** Section boundaries and narrative continuity
  - **value:** pending human review
- **field:** Human creative outcome
  - **value:** `PENDING`
- **field:** Reviewer and date
  - **value:**
- **field:** Blocking reason or owner follow-up
  - **value:** Itinerary, music track, guest passes and RSVP deadline pending from client; copy
    proposals (including written times and "Celebración solo para adultos") need approval; recipient
    line on the envelope needs approval

## Photograph Inventory

Source label: `source:hr-photos` (opaque). JPEG, sRGB, photographer watermark at the bottom-right of
each image. All SHA-256 hashes differ. WhatsApp copies of the main photograph are evidence only.

| source filename | dims      | format | orientation | weight | quality          | role                 | duplicate  | processing | derivative               |
| --------------- | --------- | ------ | ----------- | ------ | ---------------- | -------------------- | ---------- | ---------- | ------------------------ |
| image00001.jpeg | 1600×1066 | JPEG   | landscape   | 342 KB | production-ready | interlude (framed)   | no         | WebP       | gallery-01.webp          |
| image00002.jpeg | 1066×1600 | JPEG   | portrait    | 257 KB | production-ready | gallery              | no         | WebP       | gallery-02.webp          |
| image00003.jpeg | 1066×1600 | JPEG   | portrait    | 324 KB | production-ready | gallery              | no         | WebP       | gallery-03.webp          |
| image00004.jpeg | 1600×1066 | JPEG   | landscape   | 339 KB | production-ready | sharing og           | near 00013 | WebP       | og-share.webp            |
| image00005.jpeg | 1066×1600 | JPEG   | portrait    | 234 KB | production-ready | gallery              | no         | WebP       | gallery-04.webp          |
| image00006.jpeg | 1066×1600 | JPEG   | portrait    | 413 KB | production-ready | family feature       | no         | WebP       | family-sand-fifteen.webp |
| image00007.jpeg | 1066×1600 | JPEG   | portrait    | 271 KB | production-ready | gallery              | no         | WebP       | gallery-05.webp          |
| image00008.jpeg | 1066×1600 | JPEG   | portrait    | 182 KB | production-ready | gallery              | near 00009 | WebP       | gallery-06.webp          |
| image00009.jpeg | 1066×1600 | JPEG   | portrait    | 193 KB | production-ready | excluded             | near 00008 | —          | —                        |
| image00010.jpeg | 1066×1600 | JPEG   | portrait    | 207 KB | production-ready | excluded             | near 00012 | —          | — (repeated hut motif)   |
| image00011.jpeg | 1066×1600 | JPEG   | portrait    | 186 KB | production-ready | excluded             | near 00010 | —          | —                        |
| image00012.jpeg | 1600×1066 | JPEG   | landscape   | 184 KB | production-ready | interlude (bleed)    | no         | WebP       | gallery-09.webp          |
| image00013.jpeg | 1600×1066 | JPEG   | landscape   | 339 KB | production-ready | excluded             | near 00004 | —          | —                        |
| image00014.jpeg | 1066×1600 | JPEG   | portrait    | 289 KB | production-ready | thank-you            | no         | WebP       | thank-you-balloons.webp  |
| image00015.jpeg | 1066×1600 | JPEG   | portrait    | 223 KB | production-ready | hero (client choice) | no         | WebP       | hero-save-the-date.webp  |
| image00016.jpeg | 1066×1600 | JPEG   | portrait    | 245 KB | production-ready | gallery              | no         | WebP       | gallery-10.webp          |

Sources are 1600 px on the long edge: sufficient for the framed portrait hero and gallery, below the
hero-desktop 2560 px ladder start. Do not upscale; confirm role budgets with
`pnpm invitation:media:verify -- --target preview --slug mia-pintor`.

### Uniqueness table (required before READY_*)

| role           | source                                                             | derivative                       | intentional multi-role? |
| -------------- | ------------------------------------------------------------------ | -------------------------------- | ----------------------- |
| hero           | image00015.jpeg                                                    | hero-save-the-date.webp          | no                      |
| family feature | image00006.jpeg                                                    | family-sand-fifteen.webp         | no                      |
| thank-you      | image00014.jpeg                                                    | thank-you-balloons.webp          | no                      |
| sharing og     | image00004.jpeg                                                    | og-share.webp                    | no                      |
| interludes     | 00012 (hut, after family), 00001 (meadow, framed, after countdown) | gallery-09.webp, gallery-01.webp | no                      |
| gallery (6)    | 00002, 00016, 00005, 00003, 00007, 00008                           | gallery-02, 10, 04, 03, 05, 06   | no                      |

---

## Implementation Constraints

- prepReadiness is helper-aligned before payload / profile work.
- New visual structure lives only in the reusable `seaside-lineart` envelope variant, `shell` seal
  and marine icons, proven on `demo-xv-seaside`; the `mia-pintor` profile declares custom properties
  only.
- Music configured with client track (Dancing Queen — ABBA). Itinerary configured from official
  venue schedule.
- Photographer watermark is preserved; never crop it mid-mark or remove it.

---

## Preparation Readiness History

| date       | readiness                  | helper basis                   | notes                                                                |
| ---------- | -------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| 2026-10-07 | `READY_FOR_IMPLEMENTATION` | `evaluatePreparationReadiness` | Initial preparation; optional content omitted, not faked             |
| 2026-10-07 | `READY_FOR_IMPLEMENTATION` | `evaluatePreparationReadiness` | Official salon schedule (18:30 reception) and audio track integrated |
