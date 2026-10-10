# Canonical Invitation Preparation State — `america`

> Schema owner: `docs/core/invitation-preparation-contract.md` Executable evaluation:
> `src/lib/invitation-preparation/` (**prepReadiness SSOT**) Skill:
> `.agent/skills/invitation-preparation/SKILL.md`

---

## Identity

| Parameter              | Value                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| **Slug**               | `america` (owner choice; distinct from the existing `america-johana`) |
| **Host Login Alias**   | `america_solis` (no account created during preparation)               |
| **Event Type**         | `xv`                                                                  |
| **Preparation Status** | `READY_FOR_IMPLEMENTATION`                                            |

**Preparation Readiness (prepReadiness):** `READY_FOR_IMPLEMENTATION`

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

---

## Sources

| Source                        | Reference                           | Notes                                                      |
| ----------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export` (opaque label)   | Intake answers from the client (mother), 2026-10-08/09     |
| High-res photos / assets root | `source:hr-photos` (opaque label)   | Photographer delivery, 15 JPEG files, received 2026-10-09  |
| Public web check              | `source:web-check` (2026-10-09)     | Cristo Rey parish exists in Los Mochis; garden not indexed |
| Owner decisions               | `source:owner-session` (2026-10-09) | D1–D7 resolved; new preset proven by an unlisted demo      |

---

## Fact Register

| field                 | value                                                        | classification | source        | notes                                                    |
| --------------------- | ------------------------------------------------------------ | -------------- | ------------- | -------------------------------------------------------- |
| slug                  | america                                                      | verified       | owner-session | Owner choice (D1)                                        |
| celebrantName         | América Abigail Solís Mendoza                                | verified       | wa-export     | Accents by owner decision (D6); client wrote none        |
| eventLabel            | Mis XV Años                                                  | inferred       | wa-export     | XV event; client gave no title                           |
| eventDate             | 2026-11-21                                                   | verified       | wa-export     | Saturday; year from the "21-NOV-2026" prop in DSC08921   |
| eventTime             | 18:00                                                        | verified       | wa-export     | Misa                                                     |
| receptionTime         | 20:00                                                        | verified       | wa-export     | Recepción                                                |
| timeZone              | America/Mazatlan                                             | inferred       | wa-export     | Los Mochis, Sinaloa (UTC−7, no DST)                      |
| eventCity             | Los Mochis, Sinaloa                                          | inferred       | web-check     | Parish and Mochis–Topolobampo highway; client to confirm |
| baseDemoId            | demo-xv-storybook-lilac                                      | verified       | owner-session | New unlisted demo, second consumer of the preset (D2)    |
| sourceAssetPath       | source:hr-photos                                             | verified       | owner-session | Opaque label only                                        |
| sectionOrder          | quote, family, countdown, location, gallery, pass, rsvp, end | verified       | owner-session | pass = personalizedAccess, end = thankYou; see Sections  |
| primaryVenueName      | Parroquia Cristo Rey                                         | verified       | wa-export     | Client wrote "Cristo Rey"; "Parroquia" prefix inferred   |
| primaryVenueAddress   | San Francisco esquina con Oaxaca, colonia Estrella           | verified       | wa-export     | City inferred (Los Mochis)                               |
| distinctVenues        | true                                                         | verified       | wa-export     | Church and garden                                        |
| receptionVenueName    | Jardín Los Mangos                                            | verified       | wa-export     | Not indexed online                                       |
| receptionVenueAddress | Carretera Mochis-Topo, entronque carretera al 9 de Diciembre | verified       | wa-export     | Map link is an address search until the client pins it   |
| ceremonyMapUrl        | Google Maps search by address                                | inferred       | owner-session | Generated search links; replace with client pins         |
| fatherName            | Cruz Abiel Solís Araux                                       | verified       | wa-export     | Accent by owner decision (D6)                            |
| motherName            | Jenniffer Abigail Mendoza Orduño                             | verified       | wa-export     | "Jenniffer" kept as written                              |
| godparents            | Wilton Galdámez, Brianda Galdámez                            | verified       | wa-export     | Accent by owner decision (D6)                            |
| dressCode             | Formal                                                       | verified       | wa-export     |                                                          |
| reservedColor         | Lila reservado para la quinceañera                           | verified       | wa-export     |                                                          |
| adultsOnly            | No niños                                                     | verified       | wa-export     | Client kept it after the owner asked                     |
| clientColors          | Lila, dorado; temática Rapunzel                              | verified       | wa-export     | Original motifs only, no characters (D5)                 |
| dressColor            | Lila                                                         | verified       | wa-export     | The gown is not in the photo set                         |
| rsvpConfirmationMode  | api                                                          | verified       | owner-session | Personalized passes with fixed seats (D4)                |
| rsvpGuestCap          | 2                                                            | inferred       | owner-session | Fallback only; per-guest passes govern seats             |
| rsvpWhatsappPhone     | —                                                            | not_applicable | owner-session | No WhatsApp confirmation flow                            |
| rsvpDeadline          | —                                                            | missing        | wa-export     | Optional; omitted until supplied                         |
| gifts                 | —                                                            | missing        | wa-export     | Optional; section omitted until supplied                 |
| musicUrl              | —                                                            | missing        | wa-export     | Optional; player omitted until the client picks a song   |
| itinerary             | —                                                            | missing        | wa-export     | Optional; omitted until supplied                         |
| specialMessages       | Copy proposed by agent                                       | inferred       | owner-session | Pending client approval                                  |
| clientReferences      | mia-pintor, naydelin-paredes                                 | verified       | owner-session | The two samples the client approved (D3)                 |

---

## Event Completeness

XV contract maturity: `evidence-backed`. Required and conditional fields are verified or validly
inferred; optional gaps are omitted from the payload rather than represented by placeholders.

### Missing blockers

- None.

### Non-blocking gaps

- Map pins for both venues (address-search links until the client sends them).
- Song, gifts, RSVP deadline, itinerary (optional; omitted until supplied).
- City and time zone are inferred from the addresses; confirm with the client.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

---

## Placeholders

No placeholder tokens are used; optional content is omitted until supplied.

---

## Owner Decisions

| id  | category              | issue                       | evidence  | options                                 | outcome (2026-10-09)                         |
| --- | --------------------- | --------------------------- | --------- | --------------------------------------- | -------------------------------------------- |
| D1  | missing-client-facts  | Slug                        | wa-export | `america-solis` / `america`             | `america`                                    |
| D2  | demo-design-decisions | Base preset                 | catalog   | celestial-blue profile / new preset     | New preset `storybook-lilac` + unlisted demo |
| D3  | demo-design-decisions | Samples the client approved | wa-export | Owner reads the quoted replies          | mia-pintor, naydelin-paredes (references)    |
| D4  | missing-client-facts  | RSVP mode                   | wa-export | api passes / WhatsApp / both            | Personalized passes with fixed seats         |
| D5  | demo-design-decisions | Rapunzel motif source       | wa-export | Original / owner-supplied character art | Original motifs, no characters               |
| D6  | ambiguous-data        | Accents in display names    | wa-export | With accents / as written               | With accents                                 |
| D7  | demo-design-decisions | Proof for the new art       | catalog   | Unlisted demo / tests + this invitation | Tests + this invitation; demo carries preset |

The theme architecture allows a new preset only when two invitations or demos share it, so the owner
chose an unlisted demo (`demo-xv-storybook-lilac`, model photographs from existing demos) as the
second consumer. This supersedes, for this preset only, the 2026-10-08 "no new demos" note.

---

## Agent Recommendations

| topic     | recommendation                                                                        | basis                           | status                  |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------- | ----------------------- |
| concept   | "La noche de las linternas": storybook from the tower door at dusk to a lantern night | 18:00 misa after sunset, garden | approved (plan)         |
| preset    | `storybook-lilac`: lilac paper, violet night, leaf gold; Cinzel, Cormorant, Garamond  | no lilac preset exists          | approved (D2)           |
| motifs    | `storybook-lanterns` ornament set: lantern, tower, braid vine, sun, wildflower        | no fairy-tale set exists        | approved (D5)           |
| envelope  | `storybook-lanterns` reveal + `sunburst` wax seal with the «A» monogram               | no fairy-tale envelope or seal  | approved (D5)           |
| countdown | `written-days` counting nights: "Faltan N noches para ver las linternas"              | event happens at night          | pending creative review |
| type      | The Nautigal for the name only                                                        | long swashes read as a braid    | pending creative review |
| music     | Ask the client; "Veo en ti la luz" offered only as a suggestion                       | "Canción" left blank            | pending client answer   |

---

## Sections

| bucket                 | section keys                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| requested              | location (two venues), family (parents, godparents), dress code + reserved color + adults only |
| inferred / recommended | envelope, hero, quote, countdown, gallery, personalizedAccess, rsvp, thankYou, interludes      |
| omitted                | itinerary, gifts, music (until supplied)                                                       |
| unresolved             | —                                                                                              |

Guest-facing copy proposals ("usted" register, pending client approval):

- Envelope card: «Érase una vez… · América · Mis XV Años · sábado 21 de noviembre de 2026».
- Quote: «Durante quince años soñé con esta noche. Hoy se encienden las linternas y quiero que usted
  esté aquí para verlas conmigo.»
- Countdown: «Faltan N noches para ver las linternas».
- Indications: «Formal» · «El color lila está reservado para la quinceañera» · «Con mucho cariño,
  esta celebración es solo para adultos».
- Closing: «Gracias por ser parte de mi historia. Nos vemos bajo las linternas.»

Exact `sectionOrder`: quote, family, countdown, location, gallery, personalizedAccess, rsvp,
thankYou. Envelope and hero precede it; gifts and itinerary join only when the client supplies them.

---

## Design Direction

| decision                          | value                                                               | classification      |
| --------------------------------- | ------------------------------------------------------------------- | ------------------- |
| Owner-selected base demo          | demo-xv-storybook-lilac                                             | verified            |
| Recommended demo alternatives     | —                                                                   | recommendation only |
| Selected variant / visual profile | preset `storybook-lilac`; envelope + ornaments `storybook-lanterns` | verified (owner D2) |
| Client color requirements         | Lila, dorado; temática Rapunzel                                     | verified            |
| Recommended palette               | Lilac paper, violet night, leaf gold, cream, blush accent           | recommendation only |
| Unresolved visual decisions       | —                                                                   | —                   |

The two approved samples set the bar: Mía contributes the printed-letter structure (bleed portrait,
written countdown, program sheet, mirrored contact sheet, reply card); Naydelin contributes the gold
leaf and the dark finale. Neither palette is copied.

---

## Creative Direction & Acceptance

**Visual idea:** a storybook that leaves the tower. It opens at dusk on lilac paper at the iron and
stone door of DSC08756, and turns to a violet night with gold lanterns by the time guests reach the
venues, because the misa starts after sunset and the reception is a night garden. One gold braid
vine with small flowers ties the chapter thresholds.

**Human creative outcome:** `PENDING`

| concern                                                  | decision / evidence                                                         | status  |
| -------------------------------------------------------- | --------------------------------------------------------------------------- | ------- |
| Typography roles (display, heading, body, metadata)      | The Nautigal name/signature; Cinzel labels; Cormorant italic; EB Garamond   | applied |
| Vertical rhythm and density                              | One idea per chapter; countdown as one written line counting nights         | applied |
| Surface hierarchy (open flow vs cards/containers)        | Open paper and night grounds; printed pieces: envelope card, details, reply | applied |
| Photographic treatment (role, crop, focal point, filter) | Natural color, no filters; door bookend (hero 08756, closing 08763 oval)    | applied |
| Section-intersection intent and narrative cadence        | Arch into family; atmospheric blend from the door photo to dusk; rest flat  | applied |
| Local exceptions to the selected preset                  | Profile sets one token (`--storybook-field`)                                | none    |

Tonal band: **3-band** (lilac paper → dusk countdown → violet night). Cadence map, non-neutral
boundaries only (`composition.intersections` is the executable record):

```text
// quote                  → family    : climax  arch (the mist family band rises into the paper)
// interlude-after-family → countdown : bridge  atmospheric-blend (photo hands over to dusk)
// Neutral: hero→quote, family→interlude, countdown→framed print, print→location,
// location→gallery, gallery→pass, pass→rsvp, rsvp→thankYou (shared night ground).
```

### Creative acceptance record

| field                                       | value                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| Mechanical render/capture result            | pass — Local v1, all-sections at mobile-standard and desktop, 2026-10-09 |
| Whole-invitation responsive inspection      | Agent review at 390 and 1440 px (envelope, card, every section)          |
| Section boundaries and narrative continuity | pass (agent); human review pending                                       |
| Human creative outcome                      | `PENDING`                                                                |
| Reviewer and date                           |                                                                          |
| Blocking reason or owner follow-up          | Client copy approval, map pins, song, gifts                              |

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque). Sony ILCE-6400, edited 2026-10-07, sRGB JPEG with ICC
profile, no watermark. Four looks: pink satin (outdoor storefront and café), lilac ruffles (iron
door, courtyard), pink tulle with gloves (studio), yellow lace (studio).

| source filename | dims      | format | orientation | weight  | quality          | role                  | duplicate  | processing | derivative               |
| --------------- | --------- | ------ | ----------- | ------- | ---------------- | --------------------- | ---------- | ---------- | ------------------------ |
| DSC08756.jpg    | 3760×5640 | JPEG   | portrait    | 15.9 MB | production-ready | hero                  | near 08763 | WebP       | hero-tower-door.webp     |
| DSC08753.jpg    | 6000×4000 | JPEG   | landscape   | 15.2 MB | production-ready | interlude (bleed), og | no         | WebP       | interlude-door.webp      |
| DSC08921.jpg    | 4000×6000 | JPEG   | portrait    | 11.9 MB | production-ready | interlude (framed)    | no         | WebP       | interlude-pregon.webp    |
| DSC08763.jpg    | 3742×5613 | JPEG   | portrait    | 12.8 MB | production-ready | thank-you             | near 08756 | WebP       | thank-you-door.webp      |
| DSC08721.jpg    | 4000×6000 | JPEG   | portrait    | 12.9 MB | production-ready | gallery               | no         | WebP       | gallery-01.webp          |
| DSC08627.jpg    | 6000×4000 | JPEG   | landscape   | 13.5 MB | production-ready | gallery               | no         | WebP       | gallery-02.webp          |
| DSC08503.jpg    | 4000×6000 | JPEG   | portrait    | 9.6 MB  | production-ready | gallery               | near 08488 | WebP       | gallery-03.webp          |
| DSC08851.jpg    | 5232×4000 | JPEG   | landscape   | 10.3 MB | production-ready | gallery               | no         | WebP       | gallery-04.webp          |
| DSC08783.jpg    | 4000×6000 | JPEG   | portrait    | 11.5 MB | production-ready | gallery               | no         | WebP       | gallery-05.webp          |
| DSC08895.jpg    | 4000×6000 | JPEG   | portrait    | 12.3 MB | production-ready | gallery               | near 08914 | WebP       | gallery-06.webp          |
| DSC08488.jpg    | 4000×6000 | JPEG   | portrait    | 11.4 MB | production-ready | excluded              | near 08503 | —          | — (storefront lettering) |
| DSC08498.jpg    | 6000×4000 | JPEG   | landscape   | 13.3 MB | production-ready | excluded              | no         | —          | — (yellow signpost)      |
| DSC08523.jpg    | 4000×6000 | JPEG   | portrait    | 10.2 MB | production-ready | excluded              | near 08503 | —          | — (photographer shadow)  |
| DSC08583.jpg    | 4000×6000 | JPEG   | portrait    | 13.7 MB | production-ready | excluded              | no         | —          | — (litter, store sign)   |
| DSC08914.jpg    | 4356×4000 | JPEG   | landscape   | 9.3 MB  | production-ready | excluded (reserve)    | near 08895 | —          | —                        |

Sources are 3742–6000 px on the long edge, enough for the 2560 px hero ladder without upscaling.
Repository derivatives are encoded once from the originals within the role targets (hero 293 KB at
1280×1920, interludes and closing ≤ 238 KB, gallery ≤ 156 KB, og 113 KB at 1200×630); the managed
release re-encodes for delivery (Local hero 361 KB, within the 500 KB hero-desktop target).

### Uniqueness table (required before READY_*)

| role               | source                                   | derivative              | intentional multi-role?               |
| ------------------ | ---------------------------------------- | ----------------------- | ------------------------------------- |
| hero               | DSC08756.jpg                             | hero-tower-door.webp    | no                                    |
| interlude (bleed)  | DSC08753.jpg                             | interlude-door.webp     | yes: og-share.webp is a separate crop |
| interlude (framed) | DSC08921.jpg                             | interlude-pregon.webp   | no                                    |
| thank-you          | DSC08763.jpg                             | thank-you-door.webp     | no (same door as the hero: bookend)   |
| gallery (6)        | 08721, 08627, 08503, 08851, 08783, 08895 | gallery-01 … gallery-06 | no                                    |

---

## Implementation Constraints

- Lane A: definition `scripts/provision/invitations/america.ts` (`lifecycle: in_progress`,
  `managedIdentityProvenance: owner-approved`), token-only profile
  `src/styles/invitation-profiles/america.scss`, assets under `src/assets/invitations/america/`.
- Lane B (generic, no client identity): preset `storybook-lilac`, ornament set and reveal variant
  `storybook-lanterns`, seal icon `sunburst`, a countdown unit label for nights; proven by unit
  tests, the unlisted demo `demo-xv-storybook-lilac` and this invitation. No Disney characters,
  logos, lettering or lyrics.
- Adults-only and reserved color use the existing indication pattern (`Forbidden` icon, `reserved`
  swatch colored by a token).
- Lanterns animate only without `prefers-reduced-motion`; the resting frame is complete.

---

## Preparation Readiness History

| date       | readiness                  | helper basis                   | notes                                      |
| ---------- | -------------------------- | ------------------------------ | ------------------------------------------ |
| 2026-10-09 | `NOT_READY`                | `evaluatePreparationReadiness` | Initial preparation; owner decisions D1–D7 |
| 2026-10-09 | `READY_FOR_IMPLEMENTATION` | `evaluatePreparationReadiness` | D1–D7 resolved; optional content omitted   |
