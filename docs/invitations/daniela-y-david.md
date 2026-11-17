# Canonical Invitation Preparation State — `daniela-y-david`

> Schema owner: `docs/core/invitation-creation-contract.md` Executable evaluation:
> `src/lib/invitation-preparation/` (**prepReadiness SSOT**) Skill:
> `.agent/skills/invitation-preparation/SKILL.md`

---

## Identity

| Parameter              | Value                     |
| ---------------------- | ------------------------- |
| **Slug**               | `daniela-y-david`         |
| **Host Login Alias**   | `daniela_yanez`           |
| **Event Type**         | `boda`                    |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS` |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

---

## Sources

| Source                        | Reference                           | Notes                                                     |
| ----------------------------- | ----------------------------------- | --------------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export` (opaque label)   | Intake from the bride, 2026-11-13                         |
| High-res photos / assets root | `source:hr-photos` (opaque)         | Five photographer originals (1333×2000; one is 1500×2000) |
| Visual references             | `source:client-references` (opaque) | Two paper invitations: olive pocket-fold, white card      |
| Owner decisions               | `source:owner-session` (2026-11-13) | D1–D5 from the task brief                                 |

---

## Fact Register

| field                 | value                                                   | classification | source        | notes                                                         |
| --------------------- | ------------------------------------------------------- | -------------- | ------------- | ------------------------------------------------------------- |
| slug                  | daniela-y-david                                         | verified       | owner-session | Route `/boda/daniela-y-david`                                 |
| hostLoginAlias        | daniela_yanez                                           | inferred       | wa-export     | Bride's first surname taken from her father's name            |
| celebrantName         | Daniela                                                 | verified       | wa-export     | Bride; contracting client                                     |
| secondaryName         | David                                                   | verified       | wa-export     | Groom                                                         |
| eventDate             | 2027-01-23                                              | verified       | wa-export     | Saturday                                                      |
| timeZone              | America/Mazatlan                                        | inferred       | wa-export     | Both venues are in Mazatlán, Sinaloa                          |
| ceremonyTime          | 16:00                                                   | verified       | wa-export     | Religious ceremony                                            |
| receptionTime         | 20:00                                                   | verified       | wa-export     | Four hours after the ceremony; both times are shown           |
| primaryVenueName      | Parroquia de Nuestra Señora de Fátima                   | verified       | wa-export     |                                                               |
| primaryVenueAddress   | Calle Parada y callejón Corona, Col. Montuosa, Mazatlán | verified       | wa-export     |                                                               |
| primaryVenueMapsUrl   | maps:parroquia                                          | inferred       | owner-session | Resolved by map search; the owner confirms the pin            |
| distinctVenues        | true                                                    | verified       | wa-export     | Church and garden                                             |
| receptionVenueName    | Belcanto Jardín                                         | verified       | wa-export     |                                                               |
| receptionVenueAddress | Av. Libramiento 3, Col. Valles del Ejido, Mazatlán      | verified       | wa-export     |                                                               |
| receptionVenueMapsUrl | maps:jardin                                             | inferred       | owner-session | Resolved by map search; the owner confirms the pin            |
| brideParents          | Lourdes Marcela Ramirez Torreblanca; Juan Manuel Yáñez  | verified       | wa-export     | Father: Juan Manuel Yáñez Rendon, deceased; shown with «†»    |
| groomParents          | Maria Felicitas Rendon Gutierrez                        | verified       | wa-export     | Only the mother, by explicit client request; no father slot   |
| godparents            | Gabriel Ramirez Torreblanca; Monica Barraza Wong        | verified       | wa-export     | One pair; no velación, lazo or arras blocks                   |
| nameAccents           | [[PENDIENTE:NAME_ACCENTS]]                              | pending        | wa-export     | Client typed the names without accents; shown as typed        |
| deceasedWording       | [[PENDIENTE:DECEASED_WORDING]]                          | pending        | wa-export     | Client wrote «(finado)»; default «†» until she confirms       |
| clientColors          | Verde olivo, beige, blanco                              | verified       | wa-export     | Gold is unconfirmed («dorado no sé»): hairlines only          |
| dressCode             | Formal                                                  | verified       | wa-export     |                                                               |
| passRules             | [[PENDIENTE:PASS_RULES]]                                | pending        | wa-export     | Seats per pass and children policy not stated; copy silent    |
| photoSetConstraint    | Five photographs; design for five                       | verified       | owner-session | The owner told the client that few photos are fine            |
| sourceAssetPath       | source:hr-photos                                        | verified       | owner-session | Opaque label only                                             |
| themePreset           | jewelry-box-wedding                                     | verified       | owner-session | Olive, beige and white set by the slug profile                |
| sectionOrder          | family, location, countdown, gallery, gifts, rsvp       | inferred       | owner-session | Built and accepted block by block                             |
| rsvpConfirmationMode  | api                                                     | inferred       | owner-session | Platform default; per-guest passes set by the host            |
| rsvpAccessMode        | hybrid                                                  | inferred       | owner-session | Personal links and open link                                  |
| rsvpDeadline          | [[PENDIENTE:RSVP_DEADLINE]]                             | pending        | owner-session | Proposal: Saturday 9 January 2027; else the copy has no date  |
| musicUrl              | Client song (YouTube reference)                         | verified       | wa-export     | «Photograph», instrumental; hosted at 64 kbps on media domain |
| giftsMode             | Liverpool gift registry 60063833; lluvia de sobres      | verified       | wa-export     |                                                               |
| itinerary             | —                                                       | not_applicable | wa-export     | Not requested; the two venue times cover the day              |

---

## Event Completeness

Boda contract maturity: `partial`. Required fields are verified or validly inferred. Content the
client has not confirmed stays hidden or silent; nothing is invented.

### Missing blockers

- None in the fact register.

### Non-blocking gaps

- Name accents: names are shown as the client typed them until she confirms the spelling.
- Deceased father: shown with «†» until the client confirms the wording.
- RSVP deadline and pass rules: the RSVP copy names no date and no seat or children policy.
- Map pins: both links come from a map search; the owner confirms them.
- Music: the client sent a YouTube link; the audio is encoded at 64 kbps and hosted on the media
  domain.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

---

## Placeholders

| token                          | field           | guest-facing effect                              |
| ------------------------------ | --------------- | ------------------------------------------------ |
| [[PENDIENTE:NAME_ACCENTS]]     | nameAccents     | Family names shown as typed by the client        |
| [[PENDIENTE:DECEASED_WORDING]] | deceasedWording | The bride's father is marked with «†»            |
| [[PENDIENTE:RSVP_DEADLINE]]    | rsvpDeadline    | RSVP copy states no date                         |
| [[PENDIENTE:PASS_RULES]]       | passRules       | No seat or children policy; never «solo adultos» |

Tokens live in this document only; no token is rendered to guests.

---

## Owner Decisions

| id  | category              | issue          | evidence          | options                                 | outcome (2026-11-13)                                   |
| --- | --------------------- | -------------- | ----------------- | --------------------------------------- | ------------------------------------------------------ |
| D1  | demo-design-decisions | First viewport | mock-up A / B     | A full-bleed photo / B stationery card  | A: full-bleed walking photo, serif caps names          |
| D2  | demo-design-decisions | Base preset    | client-references | New preset / `jewelry-box-wedding`      | `jewelry-box-wedding` recolored in the slug profile    |
| D3  | demo-design-decisions | Inner sections | client-references | Photo-led / light stationery cards      | Light cards with watercolor eucalyptus; olive envelope |
| D4  | photograph-acceptance | Photographs    | hr-photos         | Ask for more / design for the five      | Design for five; red-car photos small or cropped       |
| D5  | missing-client-facts  | Groom's family | wa-export         | Ask for a father / show only the mother | Only the mother; never ask for or show a father        |

Release scope: up to develop; Preview and Production wait for the owner's go.

---

## Agent Recommendations

| topic    | recommendation                                                            | basis             | status  |
| -------- | ------------------------------------------------------------------------- | ----------------- | ------- |
| preset   | `jewelry-box-wedding` with olive, beige and white set by the slug profile | D2                | applied |
| reveal   | Olive envelope with a modern reveal variant; never the base storybook one | D3                | applied |
| gold     | Gold only as hairlines (frame, rules); olive leads                        | «dorado no sé»    | applied |
| greenery | Real watercolor eucalyptus on the inner cards, not flat vector leaves     | client-references | applied |
| deadline | Propose Saturday 9 January 2027 as RSVP deadline                          | two weeks before  | pending |

---

## Sections

| bucket                 | section keys                                                                |
| ---------------------- | --------------------------------------------------------------------------- |
| requested              | location (two venues), family (parents + padrinos), dress code, gifts, RSVP |
| inferred / recommended | envelope, hero, countdown, gallery, thankYou                                |
| client-provided        | music: YouTube link; encoded to 64 kbps and hosted on the media domain      |
| omitted                | itinerary (not requested), quote (no client text)                           |
| unresolved             | —                                                                           |

Guest-facing copy is an agent draft in the "usted" register, pending client approval. Sections are
built and shown to the owner one block at a time.

---

## Design Direction

| decision                          | value                                                              | classification            |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------- |
| Selected theme preset             | `jewelry-box-wedding`                                              | verified (owner decision) |
| Recommended preset alternatives   | None verified for `boda`                                           | recommendation only       |
| Selected variant / visual profile | profile `daniela-y-david`: olive, beige, white; watercolor leaves  | verified (owner D2, D3)   |
| Client color requirements         | Verde olivo, beige, blanco                                         | verified                  |
| Recommended palette               | Olive leads; beige paper; white cards; gold hairlines only         | recommendation only       |
| Hero photo and focal crop         | Walking hand in hand on the palm path; couple centered, full-bleed | verified (owner D1)       |
| Name size on the first viewport   | Serif capitals; «DANIELA» fills about 70 % of the mobile width     | verified (owner D1)       |
| Accepted first viewport (390×844) | Mock-up A, accepted by the owner on 2026-11-13                     | verified (owner D1)       |
| Brief round 2 (2026-11-13)        | Veil retinted from near-black to true olive; gold as hairlines     | verified (owner brief)    |
| Unresolved visual decisions       | Each inner block is accepted by the owner before the next          | pending                   |

References:

1. Client reference, olive pocket-fold card with watercolor eucalyptus — take the olive envelope and
   the watercolor greenery.
2. Client reference, white card with a thin gold frame and corner greenery — take the light card,
   the hairline frame, serif capital names and the date written as «SÁB | 23 | ENE».
3. Mock-up A of the first viewport (owner-accepted) — take the full-bleed photograph under an olive
   veil with the names in serif capitals.

---

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING` (owner accepts block by block on Local; client review pending)

- **concern:** Typography roles — names in serif capitals with a script connector; date as «SÁB | 23
  | ENE». **status:** accepted (first viewport)
- **concern:** Surface hierarchy — photograph cover under an olive veil; every inner section is a
  light card with a thin frame. **status:** draft
- **concern:** Photographic treatment — no filters; red-car photographs stay small or cropped so red
  does not fight the olive; one role per photograph. **status:** draft
- **concern:** Motifs — watercolor eucalyptus, static; gold hairlines only. **status:** draft

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque). Five photographer originals. The owner told the client
that a small set is fine. The gallery shows four crops on one pinned screen: a main photograph, two
portraits and a wide strip of the hands. Every crop leaves out the car and the side mirror.

| source  | quality            | dims      | orientation | role                       | processing                                             | derivative                          |
| ------- | ------------------ | --------- | ----------- | -------------------------- | ------------------------------------------------------ | ----------------------------------- |
| SF_6570 | `production-ready` | 1333×2000 | portrait    | hero; OG card              | WebP; 1200×630 OG                                      | `hero.webp`, `og-share.webp`        |
| SF_6508 | `production-ready` | 1333×2000 | portrait    | gallery 1 (main)           | WebP; gallery crop 1200×1432                           | `gallery-01.webp`                   |
| SF_6502 | `production-ready` | 1333×2000 | portrait    | gallery 2; thank-you       | upper-body crop 1000×1240, WebP; 1200×1500 couple crop | `gallery-02.webp`, `thank-you.webp` |
| SF_6538 | `production-ready` | 1500×2000 | portrait    | gallery 3                  | crop above the mirror 1000×840                         | `gallery-03.webp`                   |
| SF_6584 | `production-ready` | 1333×2000 | portrait    | gallery 4 (hands and ring) | landscape detail 1200×861, WebP                        | `gallery-04.webp`                   |

No derivative is upscaled.

### Uniqueness table (required before READY_*)

| role      | source  | derivative        | intentional multi-role?                                              |
| --------- | ------- | ----------------- | -------------------------------------------------------------------- |
| hero      | SF_6570 | `hero.webp`       | yes — same source as OG card                                         |
| OG share  | SF_6570 | `og-share.webp`   | yes — different crop and format                                      |
| thank-you | SF_6502 | `thank-you.webp`  | yes — wider couple crop of the gallery 2 source, chosen by the owner |
| gallery 1 | SF_6508 | `gallery-01.webp` | yes — tighter crop of the forehead kiss                              |
| gallery 2 | SF_6502 | `gallery-02.webp` | yes — the thank-you uses a wider crop of it                          |
| gallery 3 | SF_6538 | `gallery-03.webp` | no                                                                   |
| gallery 4 | SF_6584 | `gallery-04.webp` | yes — the quote uses a portrait crop of it                           |

---

## Implementation Constraints

- Lane A: client folder `src/invitations/clients/daniela-y-david/` (definition `invitation.ts`,
  token-only `profile.scss`, slug-scoped `composition.scss`, `assets/`).
- No new preset: the palette is re-declared in the slug profile over `jewelry-box-wedding`.
- Modern `revealVariant` only; the base storybook envelope is not used.
- Sections with pending data stay hidden; the groom's family block has no father slot.
- Watercolor greenery is static; no keyframes in the slug files.

---

## Preparation Readiness History

| date       | readiness                 | helper basis                   | notes                                       |
| ---------- | ------------------------- | ------------------------------ | ------------------------------------------- |
| 2026-11-13 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | D1–D5; four placeholders; five HR originals |
