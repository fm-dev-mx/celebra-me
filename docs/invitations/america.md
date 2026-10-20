# Canonical Invitation Preparation State — `america`

> Schema owner: `docs/core/invitation-preparation-contract.md` Executable evaluation:
> `src/lib/invitation-preparation/` (**prepReadiness SSOT**) Skill:
> `.agent/skills/invitation-preparation/SKILL.md`

---

## Identity

| Parameter              | Value                                                   |
| ---------------------- | ------------------------------------------------------- |
| **Slug**               | `america` (owner choice)                                |
| **Host Login Alias**   | `america_solis` (no account created during preparation) |
| **Event Type**         | `xv`                                                    |
| **Preparation Status** | `READY_FOR_IMPLEMENTATION`                              |

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
| Owner decisions               | `source:owner-session` (2026-10-09) | D1–D7 resolved; new preset proven by this invitation       |

---

## Fact Register

| field                 | value                                                                        | classification | source        | notes                                                    |
| --------------------- | ---------------------------------------------------------------------------- | -------------- | ------------- | -------------------------------------------------------- |
| slug                  | america                                                                      | verified       | owner-session | Owner choice (D1)                                        |
| celebrantName         | América Abigail Solís Mendoza                                                | verified       | wa-export     | Accents by owner decision (D6); client wrote none        |
| eventLabel            | Mis XV Años                                                                  | inferred       | wa-export     | XV event; client gave no title                           |
| eventDate             | 2026-11-21                                                                   | verified       | wa-export     | Saturday; year from the "21-NOV-2026" prop in DSC08921   |
| eventTime             | 18:00                                                                        | verified       | wa-export     | Misa                                                     |
| receptionTime         | 20:00                                                                        | verified       | wa-export     | Recepción                                                |
| timeZone              | America/Mazatlan                                                             | inferred       | wa-export     | Los Mochis, Sinaloa (UTC−7, no DST)                      |
| eventCity             | Los Mochis, Sinaloa                                                          | inferred       | web-check     | Parish and Mochis–Topolobampo highway; client to confirm |
| sourceAssetPath       | source:hr-photos                                                             | verified       | owner-session | Opaque label only                                        |
| sectionOrder          | quote, family, countdown, location, program, gallery, gifts, pass, rsvp, end | verified       | owner-session | program = itinerary; see Sections                        |
| primaryVenueName      | Parroquia Cristo Rey                                                         | verified       | wa-export     | Client wrote "Cristo Rey"; "Parroquia" prefix inferred   |
| primaryVenueAddress   | San Francisco esquina con Oaxaca, colonia Estrella                           | verified       | wa-export     | City inferred (Los Mochis)                               |
| distinctVenues        | true                                                                         | verified       | wa-export     | Church and garden                                        |
| receptionVenueName    | Jardín Los Mangos                                                            | verified       | wa-export     | Not indexed online                                       |
| receptionVenueAddress | Carretera Mochis-Topo, entronque carretera al 9 de Diciembre                 | verified       | wa-export     | Map link is an address search until the client pins it   |
| ceremonyMapUrl        | Google Maps search by address                                                | inferred       | owner-session | Generated search links; replace with client pins         |
| fatherName            | Cruz Abiel Solís Araux                                                       | verified       | wa-export     | Accent by owner decision (D6)                            |
| motherName            | Jenniffer Abigail Mendoza Orduño                                             | verified       | wa-export     | "Jenniffer" kept as written                              |
| godparents            | Wilton Galdámez, Brianda Galdámez                                            | verified       | wa-export     | Accent by owner decision (D6)                            |
| dressCode             | Formal                                                                       | verified       | wa-export     |                                                          |
| reservedColor         | Lila reservado para la quinceañera                                           | verified       | wa-export     |                                                          |
| adultsOnly            | No niños                                                                     | verified       | wa-export     | Client kept it after the owner asked                     |
| clientColors          | Lila, dorado; temática Rapunzel                                              | verified       | wa-export     | Original motifs only, no characters (D5)                 |
| dressColor            | Lila                                                                         | verified       | wa-export     | The gown is not in the photo set                         |
| rsvpConfirmationMode  | api                                                                          | verified       | owner-session | Personalized passes with fixed seats (D4)                |
| rsvpGuestCap          | 2                                                                            | inferred       | owner-session | Fallback only; per-guest passes govern seats             |
| rsvpWhatsappPhone     | —                                                                            | not_applicable | owner-session | No WhatsApp confirmation flow                            |
| rsvpDeadline          | 2026-11-06 (viernes 6 de noviembre)                                          | inferred       | owner-session | 15 days before the event (D9); in RSVP copy and reminder |
| gifts                 | Lluvia de sobres                                                             | inferred       | owner-session | Owner decision D10; client to confirm                    |
| musicUrl              | «Veo en ti la luz» (Chayanne y Danna Paola), looped cut                      | confirmed      | client        | Client pick (2026-10-20); cut before the spoken lines    |
| itinerary             | Misa 18:00, Recepción 20:00, Vals 21:30, Cena 22:30, Cierre 01:00            | inferred       | owner-session | Most common XV program (D8); owner adjusts later         |
| memories              | QR de recuerdos (add-on)                                                     | verified       | owner-session | D12; needs a memory space first, see Owner Decisions     |
| specialMessages       | Copy proposed by agent                                                       | inferred       | owner-session | Pending client approval                                  |
| clientReferences      | mia-pintor, naydelin-paredes                                                 | verified       | owner-session | The two samples the client approved (D3)                 |

---

## Event Completeness

XV contract maturity: `evidence-backed`. Required and conditional fields are verified or validly
inferred; optional gaps are omitted from the payload rather than represented by placeholders.

### Missing blockers

- None.

### Non-blocking gaps

- Map pins for both venues (address-search links until the client sends them).
- Song (pending, D11). Program hours, the envelope shower and the RSVP deadline are owner
  placeholders (D8–D10) until the client confirms them.
- Memories section (D12) waits for its memory space; see Owner Decisions.
- City and time zone are inferred from the addresses; confirm with the client.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

---

## Placeholders

No placeholder tokens are used; optional content is omitted until supplied.

---

## Owner Decisions

| id  | category              | issue                       | evidence  | options                                 | outcome (2026-10-09)                       |
| --- | --------------------- | --------------------------- | --------- | --------------------------------------- | ------------------------------------------ |
| D1  | missing-client-facts  | Slug                        | wa-export | `america-solis` / `america`             | `america`                                  |
| D2  | demo-design-decisions | Base preset                 | catalog   | celestial-blue profile / new preset     | New preset `storybook-lilac`; no base demo |
| D3  | demo-design-decisions | Samples the client approved | wa-export | Owner reads the quoted replies          | mia-pintor, naydelin-paredes (references)  |
| D4  | missing-client-facts  | RSVP mode                   | wa-export | api passes / WhatsApp / both            | Personalized passes with fixed seats       |
| D5  | demo-design-decisions | Rapunzel motif source       | wa-export | Original / owner-supplied character art | Original motifs, no characters             |
| D6  | ambiguous-data        | Accents in display names    | wa-export | With accents / as written               | With accents                               |
| D7  | demo-design-decisions | Proof for the new art       | catalog   | Unlisted demo / tests + this invitation | Tests + this invitation                    |
| D8  | missing-client-facts  | Program                     | catalog   | Omit / most common XV program           | Most common program; owner adjusts later   |
| D9  | missing-client-facts  | RSVP deadline               | owner     | Omit / fixed date                       | 15 days before: 2026-11-06                 |
| D10 | missing-client-facts  | Gifts                       | owner     | Omit / envelope shower / registry       | Envelope shower (legend-only note)         |
| D11 | missing-client-facts  | Song                        | wa-export | Suggest / wait for the client           | Pending                                    |
| D12 | missing-client-facts  | Memories QR add-on          | owner     | Without / with memories                 | With memories (after its memory space)     |

Program (D8, 2026-10-10): the moments and hours most common across the seven XV definitions then in
`scripts/provision/invitations/` with a 20:00 reception (mia-pintor and naydelin-paredes among them,
by offset): vals about 1 h 30 after the reception, dinner an hour after the vals and closing at
01:00. Brindis, pastel and baile sorpresa appear in fewer than half and are left out.

Memories (D12): the release gate reads the memory space named by `memories.publicSlug` before any
write, and blocks when the space is missing or belongs to another event. A space needs the event,
and the event is created by the first publication, so the block joins in a later release: (1)
publish without memories, (2) create the space in `/dashboard/admin/recuerdos` (public slug, window,
retention, quota), (3) add `memories` (variant `card`, the space's `publicSlug`) to `america.ts`
between `rsvp` and `thankYou`, (4) release again. Local follows the same order: its event exists,
but it has no space yet.

The owner first chose an unlisted demo as the preset's second consumer, then retired it on
2026-10-13 when invitations stopped depending on demos. America has no base demo: this invitation is
the only consumer of `storybook-lilac`, and unit tests cover the generic preset parts.

---

## Agent Recommendations

| topic     | recommendation                                                                        | basis                              | status                  |
| --------- | ------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------- |
| concept   | "La noche de las linternas": storybook from the tower door at dusk to a lantern night | 18:00 misa after sunset, garden    | approved (plan)         |
| preset    | `storybook-lilac`: lilac paper, violet night, leaf gold; Cinzel, Cormorant, Garamond  | no lilac preset exists             | approved (D2)           |
| motifs    | `storybook-lanterns` ornament set: lantern, tower, braid vine, sun, wildflower        | no fairy-tale set exists           | approved (D5)           |
| envelope  | `storybook-lanterns` reveal + `sunburst` wax seal with the «A» monogram               | no fairy-tale envelope or seal     | approved (D5)           |
| countdown | `written-days` counting nights: "Faltan N noches para ver las linternas"              | event happens at night             | pending creative review |
| type      | The Nautigal for the name only                                                        | long swashes read as a braid       | pending creative review |
| music     | Client chose "Veo en ti la luz"                                                       | Looped cut, autoplay with envelope | resolved (2026-10-20)   |

---

## Sections

| bucket                 | section keys                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| requested              | location (two venues), family (parents, godparents), dress code + reserved color + adults only |
| inferred / recommended | envelope, hero, quote, countdown, gallery, personalizedAccess, rsvp, thankYou, interludes      |
| client-provided        | music: «Veo en ti la luz», looped cut (2026-10-20)                                             |
| owner placeholders     | itinerary (D8), gifts: envelope shower (D10)                                                   |
| unresolved             | memories (D12): joins after its memory space exists                                            |

Guest-facing copy (owner-approved 2026-10-10, pending client approval). Voice: América in the first
person, warm and playful, "usted" register. Lanterns stay visual only: the copy does not promise
lanterns at the venue until the client confirms them. Details come from the photographs (the dated
newspaper, four looks, heart-shaped glasses).

- Envelope card: «Tengo una noticia que darle».
- Quote: «Quince años, un vestido lila y una lista de personas que no pueden faltar. Usted está en
  ella.»
- Family: «Mi gente favorita» · «Mis papás» · «Mis padrinos» · «Con la bendición de Dios y de la
  mano de ellos, le invito a celebrar mis quince años.»
- Countdown: «Faltan N noches (sí, las estoy contando)».
- Location: «Apunte la fecha» · «Primero la misa, después la fiesta en el jardín.»
- Indications: «Formal» · «El lila es mi color esa noche; ¿me ayuda a que siga siendo solo mío?» ·
  «Esta vez la fiesta es solo para adultos. Gracias por entenderlo.»
- Program: «Así será mi noche» · Misa «Primero, dar gracias en la Parroquia Cristo Rey.» · Recepción
  «Le espero en el Jardín Los Mangos.» · Vals «Mi vals de quince años. Prometo no llorar… mucho.» ·
  Cena «A la mesa, que la noche todavía es larga.» · Cierre «La última canción la bailamos juntos.»
- Gallery: «Mis cuatro looks» · «Rosa, lila, amarillo… y unos lentes de corazón.»
- Gifts: «Regalos» · «Su presencia es mi mejor regalo. Si desea tener un detalle conmigo, habrá
  lluvia de sobres en la recepción.»
- Pass: «Su lugar ya está apartado» · «Lo guardé con su nombre, así que nadie más lo puede ocupar.»
- RSVP: «¿Me acompaña?» · «Avíseme antes del viernes 6 de noviembre, que quiero tener todo listo
  para recibirle.» · confirmed «¡Qué emoción, {nombre}!» · declined «Le voy a extrañar, {nombre}.»
- Closing: «Gracias por llegar hasta el final. Lo demás se lo cuento el 21 de noviembre… en
  persona.»
- Share: own invitation and reminder text; the reminder is status-neutral because a custom reminder
  is sent verbatim to every guest, and it carries the RSVP deadline.

Exact `sectionOrder`: quote, family, countdown, location, itinerary, gallery, gifts,
personalizedAccess, rsvp, thankYou. Envelope and hero precede it; memories joins between rsvp and
thankYou once its memory space exists (D12). The canonical RSVP block has no deadline field, so the
date lives in the RSVP copy and the reminder.

---

## Design Direction

| decision                          | value                                                                 | classification      |
| --------------------------------- | --------------------------------------------------------------------- | ------------------- |
| Selected theme preset             | `storybook-lilac` (new preset; no base demo)                          | verified            |
| Recommended preset alternatives   | —                                                                     | recommendation only |
| Selected variant / visual profile | preset `storybook-lilac`; envelope `storybook-lanterns`, no ornaments | verified (owner D2) |
| Client color requirements         | Lila, dorado; temática Rapunzel                                       | verified            |
| Recommended palette               | Lilac paper, violet night, leaf gold, cream, blush accent             | recommendation only |
| Unresolved visual decisions       | —                                                                     | —                   |

The two approved samples set the bar: Mía contributes the printed-letter structure (bleed portrait,
written countdown, program sheet, mirrored contact sheet, reply card); Naydelin contributes the gold
leaf and the dark finale. Neither palette is copied.

---

## Creative Direction & Acceptance

**Visual idea:** an editorial photo album (owner-approved revision "Álbum editorial", 2026-10-14,
replacing the 2026-10-12 storybook scene art). Two day grounds (lilac paper and lilac mist) carry
the photographs as prints; the countdown is the only night band. The photographs share one baked
lilac grade, the cards are flat cream with a single hairline, and the envelope letter is a plain 5:7
sheet that leaves before the night fades.

**Human creative outcome:** `ACCEPTED`

| concern                                                  | decision / evidence                                                             | status  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- | ------- |
| Typography roles (display, heading, body, metadata)      | The Nautigal name/signature; Cormorant display; EB Garamond labels and body     | applied |
| Vertical rhythm and density                              | One idea per chapter; program as a timetable (hour column, no rail)             | applied |
| Surface hierarchy (open flow vs cards/containers)        | Flat grounds; printed pieces: envelope letter, framed prints, details, reply    | applied |
| Photographic treatment (role, crop, focal point, filter) | One baked lilac grade; bare patio print, matted pregón print; seated door close | applied |
| Section-intersection intent and narrative cadence        | Three joins: diagonal into the night, a print over its edge, a closing arch     | applied |
| Local exceptions to the selected preset                  | Profile flattens grounds, scopes the night band to the countdown, drops art     | applied |

Tonal band: **2-band + 1 night band** (lilac paper and lilac mist; the countdown alone is violet
night). Cadence map, non-neutral boundaries only (`composition.intersections` is the executable
record):

```text
// interlude-after-family    → countdown                 : climax  overlap (night cuts in on a diagonal, deep on the left)
// countdown                 → interlude-after-countdown : bridge  overlap (the framed pregón print hangs over the night edge)
// rsvp                      → thankYou                  : climax  arch (asymmetric paper arch rises into the mist)
// Neutral: hero→quote, quote→family, family→interlude, framed print→location, location→itinerary,
// itinerary→gallery, gallery→gifts, gifts→pass, pass→rsvp (ground changes only).
```

On phones the cover photograph fills the width and gives up the stone above the door on short
screens, so the larger name stays on the first screen. Accepted gaps against the mock (no token
exists, or the change would touch shared code): the hero keeps its own split instead of 7/12;
section labels stay words instead of roman numerals; the patio print has no caption; the closing
photo keeps the keepsake width on mobile instead of the full width (that width is not a token);
titles keep plain italics instead of partial italic accents, and the gallery title keeps its bold
weight; the closing signature keeps the base size; the pregón print does not tilt; the letter date
keeps the shared `21 · NOV · 2026` format; the place lede keeps the inherited sans face and the
gifts title keeps its tracked capitals (no tokens); and the letter shows «Para …» only on a
personalized link.

### Creative acceptance record

| field                                       | value                                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Mechanical render/capture result            | pass — Local v1, all-sections at mobile-standard and desktop, 2026-10-09                             |
| Whole-invitation responsive inspection      | Agent review at 390 and 1440 px (envelope, card, every section)                                      |
| Section boundaries and narrative continuity | pass (agent); human review accepted 2026-10-12                                                       |
| Human creative outcome                      | `ACCEPTED`                                                                                           |
| Reviewer and date                           | Francisco Mendoza (owner), 2026-10-12, whole invitation on Local 4324                                |
| Blocking reason or owner follow-up          | None blocking; client copy, map pins, song and gifts stay owner follow-ups                           |
| Álbum editorial revision (2026-10-14)       | Local captures at 375/390/1440 against the mock; Preview acceptance below                            |
| Preview acceptance (revision)               | `ACCEPTED` — Preview v2; Francisco Mendoza (owner), 2026-10-15, after the cover date fit (beeed5dcc) |
| Review scope (owner, 2026-10-14)            | Reviewed in Preview; Local must end identical (Local applied as v4 on 2026-10-14)                    |

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque). Sony ILCE-6400, edited 2026-10-07, sRGB JPEG with ICC
profile, no watermark. Four looks: pink satin (outdoor storefront and café), lilac ruffles (iron
door, courtyard), pink tulle with gloves (studio), yellow lace (studio).

| source filename | dims      | format | orientation | weight  | quality          | role               | duplicate  | processing | derivative                 |
| --------------- | --------- | ------ | ----------- | ------- | ---------------- | ------------------ | ---------- | ---------- | -------------------------- |
| DSC08756.jpg    | 3760×5640 | JPEG   | portrait    | 15.9 MB | production-ready | hero               | near 08763 | WebP       | hero-tower-door.webp       |
| DSC08753.jpg    | 6000×4000 | JPEG   | landscape   | 15.2 MB | production-ready | thank-you, og      | no         | WebP       | thank-you-door-seated.webp |
| DSC08921.jpg    | 4000×6000 | JPEG   | portrait    | 11.9 MB | production-ready | interlude (framed) | no         | WebP       | interlude-pregon.webp      |
| DSC08763.jpg    | 3742×5613 | JPEG   | portrait    | 12.8 MB | production-ready | excluded (reserve) | near 08756 | —          | — (2026-10-14 revision)    |
| DSC08721.jpg    | 4000×6000 | JPEG   | portrait    | 12.9 MB | production-ready | interlude (framed) | no         | WebP       | gallery-01.webp            |
| DSC08627.jpg    | 6000×4000 | JPEG   | landscape   | 13.5 MB | production-ready | gallery            | no         | WebP       | gallery-02.webp            |
| DSC08503.jpg    | 4000×6000 | JPEG   | portrait    | 9.6 MB  | production-ready | gallery            | near 08488 | WebP       | gallery-03.webp            |
| DSC08851.jpg    | 5232×4000 | JPEG   | landscape   | 10.3 MB | production-ready | gallery            | no         | WebP       | gallery-04.webp            |
| DSC08783.jpg    | 4000×6000 | JPEG   | portrait    | 11.5 MB | production-ready | gallery            | no         | WebP       | gallery-05.webp            |
| DSC08895.jpg    | 4000×6000 | JPEG   | portrait    | 12.3 MB | production-ready | gallery            | near 08914 | WebP       | gallery-06.webp            |
| DSC08488.jpg    | 4000×6000 | JPEG   | portrait    | 11.4 MB | production-ready | excluded           | near 08503 | —          | — (storefront lettering)   |
| DSC08498.jpg    | 6000×4000 | JPEG   | landscape   | 13.3 MB | production-ready | excluded           | no         | —          | — (yellow signpost)        |
| DSC08523.jpg    | 4000×6000 | JPEG   | portrait    | 10.2 MB | production-ready | excluded           | near 08503 | —          | — (photographer shadow)    |
| DSC08583.jpg    | 4000×6000 | JPEG   | portrait    | 13.7 MB | production-ready | excluded           | no         | —          | — (litter, store sign)     |
| DSC08914.jpg    | 4356×4000 | JPEG   | landscape   | 9.3 MB  | production-ready | excluded (reserve) | near 08895 | —          | —                          |

Sources are 3742–6000 px on the long edge, enough for the 2560 px hero ladder without upscaling.
Repository derivatives are encoded once from the originals within the role targets (hero 293 KB at
1280×1920, interludes and closing ≤ 238 KB, gallery ≤ 156 KB, og 113 KB at 1200×630); the managed
release re-encodes for delivery (Local hero 361 KB, within the 500 KB hero-desktop target).

Álbum editorial revision (2026-10-14): the originals were not on the working machine, so the grade
was baked into the existing derivatives (saturation 0.86, a slight lift of the blacks, a soft-light
lilac wash; WebP q84, hero q78 at 312 KB). `thank-you-door-seated.webp` is a 1092×1365 (4:5) crop of
the former `interlude-door.webp`; `interlude-door.webp` and `thank-you-door.webp` were removed. The
scene art (`location-castle-lanterns.*`, `thank-you-tower.*`, `corner-floral-*.webp`,
`sun-corona.svg`) is no longer referenced; `sun-corona-mark.svg` stays as the seal art.

### Uniqueness table (required before READY_*)

| role               | source                            | derivative              | intentional multi-role?               |
| ------------------ | --------------------------------- | ----------------------- | ------------------------------------- |
| hero               | DSC08756.jpg                      | hero-tower-door.webp    | no                                    |
| interlude (framed) | DSC08721.jpg                      | gallery-01.webp         | no (left the gallery in the revision) |
| interlude (framed) | DSC08921.jpg                      | interlude-pregon.webp   | no                                    |
| thank-you          | DSC08753.jpg                      | thank-you-door-seated   | yes: og-share.webp is a separate crop |
| gallery (5)        | 08627, 08503, 08851, 08783, 08895 | gallery-02 … gallery-06 | no                                    |

---

## Implementation Constraints

- Lane A: definition `scripts/provision/invitations/america.ts` (`lifecycle: published`,
  `managedIdentityProvenance: persisted` since `52c22e47f`, 2026-10-12), token-only profile
  `src/styles/invitation-profiles/america.scss`, assets under `src/assets/invitations/america/`.
- Lane B (generic, no client identity): preset `storybook-lilac`, ornament set and reveal variant
  `storybook-lanterns`, seal icon `sunburst`, a countdown unit label for nights; proven by unit
  tests and this invitation. No Disney characters, logos, lettering or lyrics.
- Adults-only and reserved color use the existing indication pattern (`Forbidden` icon, `reserved`
  swatch colored by a token).
- Lanterns animate only without `prefers-reduced-motion`; the resting frame is complete.

---

## Preparation Readiness History

| date       | readiness                  | helper basis                   | notes                                      |
| ---------- | -------------------------- | ------------------------------ | ------------------------------------------ |
| 2026-10-09 | `NOT_READY`                | `evaluatePreparationReadiness` | Initial preparation; owner decisions D1–D7 |
| 2026-10-09 | `READY_FOR_IMPLEMENTATION` | `evaluatePreparationReadiness` | D1–D7 resolved; optional content omitted   |
