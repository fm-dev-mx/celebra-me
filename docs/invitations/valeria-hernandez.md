# Canonical Invitation Preparation State — `valeria-hernandez`

> Schema owner: `docs/core/invitation-creation-contract.md` Executable evaluation:
> `src/lib/invitation-preparation/` (**prepReadiness SSOT**) Skill:
> `.agent/skills/invitation-preparation/SKILL.md`

---

## Identity

| Parameter              | Value                                  |
| ---------------------- | -------------------------------------- |
| **Slug**               | `valeria-hernandez` (owner choice, D1) |
| **Host Login Alias**   | `valeria_hernandez`                    |
| **Event Type**         | `xv`                                   |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS`              |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

---

## Sources

| Source                        | Reference                           | Notes                                                      |
| ----------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export` (opaque label)   | Intake from the client (the mother), 2026-11-08/09         |
| High-res photos / assets root | `source:client-photos` (opaque)     | Ten WhatsApp photographs: four current, six from childhood |
| Visual references             | `source:client-references` (opaque) | Cherry disco mood (wine ground, disco balls, stars, bow)   |
| Owner decisions               | `source:owner-session` (2026-11-10) | D1–D5 from the task brief                                  |

---

## Fact Register

| field                 | value                                                                      | classification | source        | notes                                                              |
| --------------------- | -------------------------------------------------------------------------- | -------------- | ------------- | ------------------------------------------------------------------ |
| slug                  | valeria-hernandez                                                          | verified       | owner-session | Owner choice (D1)                                                  |
| celebrantName         | Valeria                                                                    | verified       | wa-export     | Full name Valeria Hernández Flores                                 |
| eventLabel            | Mis XV Años                                                                | inferred       | wa-export     | XV event; client gave no title                                     |
| eventDate             | 2027-01-09                                                                 | verified       | wa-export     | Saturday                                                           |
| eventTime             | 17:45                                                                      | verified       | wa-export     | Religious ceremony («ceremonia 5:45»)                              |
| receptionTime         | 19:30                                                                      | verified       | wa-export     | Reception («evento 7:30»)                                          |
| timeZone              | America/Mexico_City                                                        | inferred       | wa-export     | Both addresses are in the city of Puebla                           |
| sourceAssetPath       | source:client-photos                                                       | verified       | owner-session | Opaque label only                                                  |
| sectionOrder          | quote, countdown, location, family, gallery, personalizedAccess, rsvp, end | inferred       | owner-session | Itinerary and menu join when the client sends them                 |
| primaryVenueName      | Parroquia de la Divina Providencia                                         | verified       | wa-export     |                                                                    |
| primaryVenueAddress   | 14 Oriente 4215, Col. El Porvenir, Puebla, Pue.                            | verified       | wa-export     | City inferred; a Puebla directory lists the parish at Av. 14 4215  |
| distinctVenues        | true                                                                       | verified       | wa-export     | Church and event hall                                              |
| receptionVenueName    | Salón Las Barricas                                                         | verified       | wa-export     | No public listing found; map link is an address search             |
| receptionVenueAddress | Cto. Juan Pablo II 2455, Col. La Hacienda, Puebla, Pue.                    | verified       | wa-export     | City inferred from the colonia                                     |
| ceremonyMapUrl        | Google Maps address searches for both venues                               | inferred       | owner-session | The client sent no pins; confirm pins with the client              |
| fatherName            | Alfredo Hernández Gómez                                                    | verified       | wa-export     |                                                                    |
| motherName            | Laura Flores Galindo                                                       | verified       | wa-export     | Contracting client                                                 |
| familyLabel           | Mis padres                                                                 | inferred       | owner-session | Both parents named by the client                                   |
| godparents            | Rolando Flores Espinoza y Cristina Canela Gómez                            | ambiguous      | wa-export     | Role not stated; shown as «Mis padrinos» (owner brief)             |
| dressCode             | Cherry disco                                                               | verified       | wa-export     | «De acuerdo a la temática cherry disco» plus a collage             |
| reservedColor         | Vino — Reservado para la quinceañera                                       | inferred       | owner-session | Dress color; agent draft, pending client approval                  |
| adultsOnly            | —                                                                          | not_applicable | wa-export     | Not stated; per-guest passes govern seats                          |
| clientColors          | Rojo cereza                                                                | verified       | wa-export     |                                                                    |
| dressColor            | Vino                                                                       | verified       | wa-export     |                                                                    |
| rsvpConfirmationMode  | api                                                                        | verified       | wa-export     | Guest name and number of passes per invitation                     |
| rsvpGuestCap          | 2                                                                          | inferred       | owner-session | Technical fallback only; the host sets each guest's passes         |
| rsvpWhatsappPhone     | —                                                                          | not_applicable | owner-session | No WhatsApp confirmation flow                                      |
| rsvpDeadline          | [[PENDIENTE:RSVP_DEADLINE]]                                                | pending        | owner-session | Not supplied; the RSVP copy states no date                         |
| gifts                 | —                                                                          | not_applicable | wa-export     | Not requested                                                      |
| itinerary             | [[PENDIENTE:ITINERARY]]                                                    | pending        | wa-export     | The client asked whether it is included; section hidden until sent |
| menu                  | [[PENDIENTE:MENU]]                                                         | pending        | wa-export     | The client wants a menu; section hidden until sent                 |
| musicUrl              | Client song (YouTube reference)                                            | verified       | wa-export     | Hosted at 64 kbps on the media domain (Someone to Love, piano)     |
| checkInQr             | —                                                                          | not_applicable | wa-export     | No check-in QR                                                     |
| memoriesQr            | Photo QR add-on                                                            | verified       | wa-export     | «También quiero el Qr»; needs a memory space first                 |
| specialMessages       | [[PENDIENTE:CELEBRANT_MESSAGE]]                                            | pending        | owner-session | The quote and closing are agent drafts until Valeria sends hers    |

---

## Event Completeness

XV contract maturity: `evidence-backed`. Required fields are verified or validly inferred. Optional
content the client has not supplied stays hidden; nothing is invented.

### Missing blockers

- None in the fact register.

### Non-blocking gaps

- RSVP deadline, itinerary and menu: not supplied; the sections stay hidden and the RSVP copy names
  no date.
- Valeria's own message: the quote and closing are agent drafts.
- Music: the client sent a YouTube link; it is encoded at 64 kbps and hosted on the media domain.
- Photo QR: the invitation section needs an existing memory space owned by this event, created from
  the admin panel after the first publication; it joins in a later managed update.
- Map pins: both links are address searches; the reception hall has no public listing.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

---

## Placeholders

| token                           | field           | guest-facing effect                       |
| ------------------------------- | --------------- | ----------------------------------------- |
| [[PENDIENTE:RSVP_DEADLINE]]     | rsvpDeadline    | RSVP copy states no date                  |
| [[PENDIENTE:ITINERARY]]         | itinerary       | Itinerary section omitted                 |
| [[PENDIENTE:MENU]]              | menu            | Menu omitted                              |
| [[PENDIENTE:CELEBRANT_MESSAGE]] | specialMessages | Agent-drafted quote and closing are shown |

Tokens live in this document only; no token is rendered to guests.

---

## Owner Decisions

| id  | category              | issue        | evidence          | options                                       | outcome (2026-11-10)                                         |
| --- | --------------------- | ------------ | ----------------- | --------------------------------------------- | ------------------------------------------------------------ |
| D1  | missing-client-facts  | Display name | wa-export         | «Valeria» / full name                         | «Valeria», slug `valeria-hernandez`                          |
| D2  | demo-design-decisions | Base preset  | client-references | New preset / `storybook-blush` + slug profile | `storybook-blush` recolored in the slug profile; no preset   |
| D3  | photograph-acceptance | Photographs  | wa-export         | Wait for originals / use the ten received     | Use the ten received; ask for originals if the cover is weak |
| D4  | missing-client-facts  | Missing copy | wa-export         | Agent drafts / placeholders                   | Hide itinerary and menu; draft the quote; no RSVP date       |
| D5  | missing-client-facts  | Photo QR     | wa-export         | Section now / after the memory space exists   | After the memory space exists (admin step, owner)            |

Release scope: up to develop + Preview; Production waits for the owner's package approval.

---

## Agent Recommendations

| topic  | recommendation                                                                    | basis             | status  |
| ------ | --------------------------------------------------------------------------------- | ----------------- | ------- |
| preset | `storybook-blush` with a cherry and wine palette set by the slug profile          | D2                | applied |
| motifs | Silver disco balls, small red stars and one bow, drawn in the slug composition    | client-references | applied |
| photos | Current portrait framed on the cover; childhood photos as an album «de niña a XV» | ten photos        | applied |
| pass   | «Pase personal e intransferible» on the reply card                                | per-guest passes  | applied |
| scenes | Mirror ball route over the two venues; the album darkens into the night           | client-references | applied |

---

## Sections

| bucket                 | section keys                                                                   |
| ---------------------- | ------------------------------------------------------------------------------ |
| requested              | location (two venues), family (parents + godparents), dress code, passes, RSVP |
| inferred / recommended | envelope, hero, quote, countdown, gallery, personalizedAccess, thankYou        |
| client-provided        | music: YouTube link; encoded to 64 kbps and hosted on the media domain         |
| omitted                | itinerary, menu (pending), gifts (not requested), memories (pending space)     |
| unresolved             | —                                                                              |

Guest-facing copy (agent draft, D4; pending client approval). Voice: Valeria in the first person,
"usted" register, warm and festive.

- Envelope: «Abra su invitación».
- Quote: «Quince años, una noche y una pista llena de luces.» · «Me haría muy feliz que usted
  estuviera ahí.»
- Family: «Mis padres» · Alfredo Hernández Gómez · Laura Flores Galindo · «Mis padrinos» · Rolando
  Flores Espinoza · Cristina Canela Gómez.
- Countdown: «Faltan … para mi noche disco».
- Location: «Dos lugares, una noche» · «A las 5:45 p. m. daré gracias en misa; a las 7:30 p. m. le
  espero en Las Barricas para celebrar.»
- Indications: «Cherry disco» · «Lentejuelas en negro, plata, dorado o vino» · «Vino — Reservado
  para la quinceañera».
- Gallery: «De niña a mis quince».
- Pass: «Pase personal e intransferible» · «Su lugar ya está apartado.» · «Confírmeme su llegada
  aquí abajo.»
- RSVP: «¿Me acompaña?» · «Le agradeceré confirmar su asistencia con tiempo.».
- Closing: «Gracias por ser parte de mis quince años. Le espero el 9 de enero.» · «Valeria».

---

## Design Direction

| decision                          | value                                                              | classification            |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------- |
| Selected theme preset             | `storybook-blush`                                                  | verified (owner decision) |
| Recommended preset alternatives   | `storybook-emerald` recolored                                      | recommendation only       |
| Selected variant / visual profile | profile `valeria-hernandez`: cherry and wine palette, disco motifs | verified (owner D2)       |
| Client color requirements         | Rojo cereza; vestido vino                                          | verified                  |
| Recommended palette               | Cherry cream paper, cherry red accents, wine night, silver         | recommendation only       |
| Unresolved visual decisions       | Whole-invitation review at the client's first round                | pending                   |

References: the client's cherry disco mood board (wine ground, silver disco balls, red stars, a bow)
and the dress-code collage (black, silver, gold and wine sequins). The invitation's «Ver
inspiración» image is an AI-generated replacement of that collage (black, silver and gold only; wine
is reserved for the celebrant); source PNG in creative-ops
`valeria-hernandez/dress-code-reference/`.

---

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING` (owner review of the Local draft; client review pending)

- **concern:** Typography roles — preset roles; name in script, «MIS XV AÑOS» spaced capitals in
  silver. **status:** draft
- **concern:** Surface hierarchy — cherry cream paper for the opening chapters; from the countdown
  on, one wine night lit with silver. **status:** draft
- **concern:** Photographic treatment — framed portraits only (low resolution); no filters; one role
  per photograph. **status:** draft
- **concern:** Motifs — disco balls and stars are decorative, static under `prefers-reduced-motion`.
  **status:** draft

---

## Photograph Inventory

Source label: `source:client-photos` (opaque). Ten WhatsApp photographs (about 700–1600 px on the
long side). No high-resolution originals were delivered. Risk: every photo is shown framed, never
full-bleed, because none holds a sharp full-width desktop crop.

| source | quality                | dims      | orientation | role                  | processing                         | derivative                   |
| ------ | ---------------------- | --------- | ----------- | --------------------- | ---------------------------------- | ---------------------------- |
| 13     | `provisional-whatsapp` | 1601×1032 | landscape   | hero; OG card         | 4:5 crop on Valeria; 1200×630 crop | `hero.webp`, `og-share.webp` |
| 16     | `provisional-whatsapp` | 722×921   | portrait    | gallery 1 (now)       | WebP, no resize                    | `gallery-01.webp`            |
| 20     | `provisional-whatsapp` | 1337×1360 | square      | thank-you portrait    | 4:5 crop, WebP                     | `thank-you.webp`             |
| 22     | `provisional-whatsapp` | 1200×1600 | portrait    | gallery 2 (now)       | WebP                               | `gallery-02.webp`            |
| 15     | `provisional-whatsapp` | 716×940   | portrait    | gallery 3 (childhood) | WebP, no resize                    | `gallery-03.webp`            |
| 17     | `provisional-whatsapp` | 1043×1200 | portrait    | gallery 4 (childhood) | WebP                               | `gallery-04.webp`            |
| 18     | `provisional-whatsapp` | 713×935   | portrait    | gallery 5 (childhood) | WebP, no resize                    | `gallery-05.webp`            |
| 19     | `provisional-whatsapp` | 1600×1204 | landscape   | gallery 6 (childhood) | rotated 90° to portrait, WebP      | `gallery-06.webp`            |
| 21     | `provisional-whatsapp` | 720×1600  | portrait    | gallery 7 (childhood) | 4:5 crop, WebP                     | `gallery-07.webp`            |
| 23     | `provisional-whatsapp` | 696×920   | portrait    | gallery 8 (childhood) | WebP, no resize                    | `gallery-08.webp`            |

No derivative is upscaled.

### Uniqueness table (required before READY_*)

| role      | source | derivative        | intentional multi-role?          |
| --------- | ------ | ----------------- | -------------------------------- |
| hero      | 13     | `hero.webp`       | yes — same source as the OG card |
| OG share  | 13     | `og-share.webp`   | yes — different crop and format  |
| thank-you | 20     | `thank-you.webp`  | no                               |
| gallery 1 | 16     | `gallery-01.webp` | no                               |
| gallery 2 | 22     | `gallery-02.webp` | no                               |
| gallery 3 | 15     | `gallery-03.webp` | no                               |
| gallery 4 | 17     | `gallery-04.webp` | no                               |
| gallery 5 | 18     | `gallery-05.webp` | no                               |
| gallery 6 | 19     | `gallery-06.webp` | no                               |
| gallery 7 | 21     | `gallery-07.webp` | no                               |
| gallery 8 | 23     | `gallery-08.webp` | no                               |

---

## Implementation Constraints

- Lane A: client folder `src/invitations/clients/valeria-hernandez/` (definition `invitation.ts`,
  token-only `profile.scss`, slug-scoped `composition.scss`, `assets/`).
- No new preset: the palette is re-declared in the slug profile over `storybook-blush`.
- Reserved colour uses the existing indication pattern (`reserved` swatch coloured by a token).
- Disco motifs animate only without `prefers-reduced-motion`; the resting frame is complete.

---

## Preparation Readiness History

| date       | readiness                 | helper basis                   | notes                                          |
| ---------- | ------------------------- | ------------------------------ | ---------------------------------------------- |
| 2026-11-10 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | D1–D5; four placeholders; WhatsApp photographs |
