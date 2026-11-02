# Canonical Invitation Preparation State — `naomi-huerta`

> Schema owner: `docs/core/invitation-creation-contract.md` Executable evaluation:
> `src/lib/invitation-preparation/` (**prepReadiness SSOT**) Skill:
> `.agent/skills/invitation-preparation/SKILL.md`

---

## Identity

| Parameter              | Value                             |
| ---------------------- | --------------------------------- |
| **Slug**               | `naomi-huerta` (owner choice, D1) |
| **Host Login Alias**   | `naomi_xv` (provisional)          |
| **Event Type**         | `xv`                              |
| **Preparation Status** | `READY_FOR_IMPLEMENTATION`        |

**Preparation Readiness (prepReadiness):** `READY_FOR_IMPLEMENTATION`

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

---

## Sources

| Source                        | Reference                           | Notes                                                   |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export` (opaque label)   | Intake from the client, 2026-10-28/11-01, voice notes   |
| High-res photos / assets root | `source:client-photos` (opaque)     | Seven photographs from the client's session; final (D3) |
| Owner decisions               | `source:owner-session` (2026-11-01) | D1–D5 resolved                                          |

---

## Fact Register

| field                 | value                                                                                        | classification | source        | notes                                                        |
| --------------------- | -------------------------------------------------------------------------------------------- | -------------- | ------------- | ------------------------------------------------------------ |
| slug                  | naomi-huerta                                                                                 | verified       | owner-session | Owner choice (D1)                                            |
| celebrantName         | Naomi                                                                                        | verified       | wa-export     | Full name Naomi Alina Huerta Chávez; hero shows «Naomi» (D1) |
| eventLabel            | Mis XV Años                                                                                  | inferred       | wa-export     | XV event; client gave no title                               |
| eventDate             | 2026-12-18                                                                                   | verified       | wa-export     | Friday                                                       |
| eventTime             | 18:30                                                                                        | verified       | wa-export     | Religious ceremony                                           |
| receptionTime         | 21:00                                                                                        | verified       | wa-export     | Reception                                                    |
| timeZone              | America/Mexico_City                                                                          | inferred       | wa-export     | Guadalajara metropolitan area, Jalisco                       |
| sourceAssetPath       | source:client-photos                                                                         | verified       | owner-session | Opaque label only (D3)                                       |
| sectionOrder          | quote, plate, countdown, plate, location, family, itinerary, gallery, gifts, pass, rsvp, end | inferred       | owner-session | Scene structure of the storybook album                       |
| primaryVenueName      | Parroquia del Espíritu Santo                                                                 | verified       | wa-export     |                                                              |
| primaryVenueAddress   | C. Miguel Ramos Arizpe 385, Magaña, Guadalajara, Jal.                                        | inferred       | wa-export     | Resolved from the client's map pin                           |
| distinctVenues        | true                                                                                         | verified       | wa-export     | Church and event hall                                        |
| receptionVenueName    | La Mattea Eventos                                                                            | verified       | wa-export     |                                                              |
| receptionVenueAddress | C. Juan de Dios Robledo 1800-A, Balcones del Rosario, Tonalá, Jal.                           | verified       | wa-export     |                                                              |
| ceremonyMapUrl        | Google Maps pins for both venues (maps.app.goo.gl)                                           | verified       | wa-export     | Both pins resolved to the named venues, 2026-11-01           |
| fatherName            | José Humberto Huerta Navarro                                                                 | verified       | wa-export     |                                                              |
| motherName            | Martha Leticia Chávez García                                                                 | verified       | wa-export     |                                                              |
| familyLabel           | Mis padres                                                                                   | inferred       | owner-session | Both parents named by the client                             |
| godparents            | Christina y Anthony Macías                                                                   | ambiguous      | wa-export     | Client wrote «Macias»; role not stated, shown as «Padrinos»  |
| dressCode             | De gala                                                                                      | verified       | wa-export     |                                                              |
| reservedColor         | Rosa — Reservado para la quinceañera                                                         | inferred       | owner-session | Agent draft, pending client approval (D4)                    |
| adultsOnly            | —                                                                                            | missing        | wa-export     | Not stated; omitted until the client confirms (D4)           |
| clientColors          | Rosa y plateado                                                                              | verified       | wa-export     |                                                              |
| dressColor            | Rosa pálido con brillo, corona plateada                                                      | verified       | wa-export     | From the photographs                                         |
| rsvpConfirmationMode  | api                                                                                          | verified       | wa-export     | Personal, non-transferable pass per guest; host panel        |
| rsvpGuestCap          | 2                                                                                            | inferred       | owner-session | Fallback only; per-guest passes govern seats                 |
| rsvpWhatsappPhone     | —                                                                                            | not_applicable | owner-session | No WhatsApp confirmation flow                                |
| rsvpDeadline          | 2026-12-04 (viernes 4 de diciembre)                                                          | inferred       | owner-session | 14 days before (D4)                                          |
| gifts                 | Lluvia de sobres                                                                             | inferred       | owner-session | Agent draft, pending client approval (D4)                    |
| itinerary             | Misa 18:30, Recepción 21:00, Vals 21:30, Cena 22:30, Baile 23:30, Cierre 02:00               | inferred       | owner-session | Agent draft, pending client approval (D4)                    |
| musicUrl              | Client song (YouTube reference)                                                              | verified       | wa-export     | Audio file not hosted yet; music omitted in the draft        |
| checkInQr             | —                                                                                            | not_applicable | wa-export     | Promo package without QR check-in                            |
| specialMessages       | Copy proposed by agent                                                                       | inferred       | owner-session | Pending client approval (D4)                                 |

---

## Event Completeness

XV contract maturity: `evidence-backed`. Required and conditional fields are verified or validly
inferred. The seven client photographs are inventoried and declared final by the owner (D3).

### Missing blockers

- None in the fact register.

### Non-blocking gaps

- Music: the client named the song by link only; the file is encoded to 64 kbps and hosted on the
  media domain in a later round.
- Adults-only rule and gifts: unknown; gifts drafted, adults-only omitted until the client answers.
- Godparents' role and the accent in «Macías».
- Program, RSVP deadline and all guest-facing copy are agent drafts for client approval.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

---

## Placeholders

No placeholder tokens are used; optional content is omitted until supplied.

---

## Owner Decisions

| id  | category              | issue        | evidence  | options                                    | outcome (2026-11-01)                                     |
| --- | --------------------- | ------------ | --------- | ------------------------------------------ | -------------------------------------------------------- |
| D1  | missing-client-facts  | Display name | wa-export | «Naomi» / folder spelling                  | «Naomi», slug `naomi-huerta`                             |
| D2  | demo-design-decisions | Base preset  | wa-export | New storybook pink preset / enchanted-rose | New `storybook-blush` preset, dusty rose and silver      |
| D3  | photograph-acceptance | Photographs  | wa-export | Wait for high-res / use the seven received | The seven received are final                             |
| D4  | missing-client-facts  | Missing copy | wa-export | Agent drafts / ask the client              | Agent drafts; gifts and children flagged for client      |
| D5  | missing-client-facts  | Voice notes  | wa-export | Transcribe locally                         | Transcribed; pass copy states personal, non-transferable |

Release scope: fast mode up to develop + Preview; Production waits for client approval and the first
payment.

---

## Agent Recommendations

| topic  | recommendation                                                                 | basis            | status  |
| ------ | ------------------------------------------------------------------------------ | ---------------- | ------- |
| preset | `storybook-blush`: clone of `storybook-emerald` in dusty rose, plum and silver | D2               | applied |
| motifs | Fine-line silver butterflies, two or three per screen at most                  | storybook family | draft   |
| photos | Vertical rose-window portrait as the cover; castle shots for plates and album  | seven photos     | applied |
| pass   | «Pase personal e intransferible» on the reply card                             | voice notes (D5) | applied |

---

## Sections

| bucket                 | section keys                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| requested              | location (two venues), family (parents + godparents), dress code «De gala», personal passes     |
| inferred / recommended | envelope, hero, quote, countdown, itinerary, gallery, gifts, personalizedAccess, rsvp, thankYou |
| client-provided        | music: link only (omitted until the file is hosted)                                             |
| omitted                | adults-only rule (unknown), check-in QR (not in the package)                                    |
| unresolved             | —                                                                                               |

Guest-facing copy (agent draft, D4; pending client approval). Voice: Naomi in the first person,
"usted" register, warm and formal.

- Envelope: «Abra su invitación».
- Quote: «Hay cuentos que se esperan toda la vida.» · «El mío comienza el 18 de diciembre, y quiero
  que usted esté ahí.»
- Family: «Mis padres» · José Humberto Huerta Navarro · Martha Leticia Chávez García · «Mis
  padrinos» · Christina y Anthony Macías.
- Countdown: «Faltan N días para mi gran noche».
- Location: «Dónde y cuándo» · «Primero daremos gracias en misa y después celebraremos juntos.»
- Indications: «Vestimenta» · «De gala» · «Rosa — Reservado para la quinceañera».
- Program: «Así será mi noche» · Misa 18:30 · Recepción 21:00 · Vals 21:30 · Cena 22:30 · Baile
  23:30 · Cierre 02:00.
- Gallery: «Antes de mi gran noche».
- Gifts: «Lluvia de sobres» · «Su presencia es mi mejor regalo. Si desea tener un detalle conmigo,
  habrá lluvia de sobres.»
- Pass: «Su lugar ya está apartado» · «Pase personal e intransferible».
- RSVP: «¿Me acompaña?» · «Le agradeceré confirmar antes del viernes 4 de diciembre.»
- Closing: «Gracias por ser parte de mis quince años. Le espero el 18 de diciembre.» · «Naomi».

---

## Design Direction

| decision                          | value                                                          | classification            |
| --------------------------------- | -------------------------------------------------------------- | ------------------------- |
| Selected theme preset             | `storybook-blush` (new preset cloned from `storybook-emerald`) | verified (owner decision) |
| Recommended preset alternatives   | `enchanted-rose` recoloured                                    | recommendation only       |
| Selected variant / visual profile | preset `storybook-blush`; butterfly ornaments                  | verified (owner D2)       |
| Client color requirements         | Rosa y plateado                                                | verified                  |
| Recommended palette               | Blush paper, rose mist, plum night, pale silver leaf           | recommendation only       |
| Unresolved visual decisions       | Whole-invitation review at the client's first round            | pending                   |

References: `storybook-emerald` (scene cadence and album), `enchanted-rose` (romantic display), and
the client's castle session (stone arches, rose window, pale pink gown, silver crown).

---

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING` (draft for the owner and the client, round 0)

- **concern:** Typography roles — preset roles; name in rose script, «MIS XV AÑOS» spaced capitals
  in silver ink. **status:** draft
- **concern:** Surface hierarchy — blush paper and rose mist alternate by section; the countdown is
  the one plum night band; night closing. **status:** draft
- **concern:** Photographic treatment — cover in an arch with a silver hairline; no filters; one
  role per photograph. **status:** draft
- **concern:** Envelope reveal — `storybook-butterflies` letter in plum night with a silver wax
  ring. **status:** draft

---

## Photograph Inventory

Source label: `source:client-photos` (opaque). Seven photographs from the client's castle session,
delivered over WhatsApp (1600×1066 or 1066×1600, about 150–250 KB). The owner declared them final
(D3); no high-resolution originals exist. Risk: a full-width desktop cover may look soft.

| source | quality            | dims      | orientation | role                        | processing                         | derivative                        |
| ------ | ------------------ | --------- | ----------- | --------------------------- | ---------------------------------- | --------------------------------- |
| 01     | `production-ready` | 1280×853  | landscape   | interlude (veil)            | 4:5 crop on the subject, WebP      | `interlude-veil.webp` 682×853     |
| 02     | `production-ready` | 1280×853  | landscape   | gallery 2 (back, bow)       | 4:5 crop on the subject, WebP      | `gallery-02.webp` 682×853         |
| 03     | `production-ready` | 1600×1066 | landscape   | gallery 1 (bouquet)         | 4:5 crop on the subject, WebP      | `gallery-01.webp` 853×1066        |
| 04     | `production-ready` | 1600×1066 | landscape   | gallery 3 (bouquet, close)  | tighter 4:5 crop, WebP             | `gallery-03.webp` 608×760         |
| 05     | `production-ready` | 1600×1066 | landscape   | interlude (golden door)     | 4:5 crop on the subject, WebP      | `interlude-door.webp` 853×1066    |
| 06     | `production-ready` | 1066×1600 | portrait    | hero                        | full frame, WebP                   | `hero.webp` 1066×1600             |
| 07     | `production-ready` | 1600×1066 | landscape   | thank-you portrait; OG card | 4:5 crop; 1200×630 bottom crop q66 | `thank-you.webp`, `og-share.webp` |

No derivative is upscaled. All derivatives are within the image delivery budgets.

### Uniqueness table (required before READY_*)

| role           | source | derivative            | intentional multi-role?          |
| -------------- | ------ | --------------------- | -------------------------------- |
| hero           | 06     | `hero.webp`           | no                               |
| interlude door | 05     | `interlude-door.webp` | no                               |
| interlude veil | 01     | `interlude-veil.webp` | no                               |
| gallery 1      | 03     | `gallery-01.webp`     | no                               |
| gallery 2      | 02     | `gallery-02.webp`     | no                               |
| gallery 3      | 04     | `gallery-03.webp`     | no                               |
| thank-you      | 07     | `thank-you.webp`      | yes — same source as the OG card |
| OG share       | 07     | `og-share.webp`       | yes — different crop and format  |

---

## Implementation Constraints

- Lane A: client folder `src/invitations/clients/naomi-huerta/` (definition `invitation.ts`,
  token-only `profile.scss`, `assets/`).
- Lane B (generic, no client identity): preset `storybook-blush`.
- Reserved colour uses the existing indication pattern (`reserved` swatch coloured by a token).
- Butterflies animate only without `prefers-reduced-motion`; the resting frame is complete.

---

## Preparation Readiness History

| date       | readiness                  | helper basis                   | notes                                      |
| ---------- | -------------------------- | ------------------------------ | ------------------------------------------ |
| 2026-11-01 | `READY_FOR_IMPLEMENTATION` | `evaluatePreparationReadiness` | D1–D5; seven client photographs final (D3) |
