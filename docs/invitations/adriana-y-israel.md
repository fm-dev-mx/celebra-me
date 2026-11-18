# Canonical Invitation Preparation State — `adriana-y-israel`

> Schema owner: `docs/core/invitation-creation-contract.md` Executable evaluation:
> `src/lib/invitation-preparation/` (**prepReadiness SSOT**) Skill:
> `.agent/skills/invitation-preparation/SKILL.md`

---

## Identity

| Parameter              | Value                     |
| ---------------------- | ------------------------- |
| **Slug**               | `adriana-y-israel`        |
| **Host Login Alias**   | `adriana_rivas`           |
| **Event Type**         | `boda`                    |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS` |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

---

## Sources

| Source                        | Reference                           | Notes                                                 |
| ----------------------------- | ----------------------------------- | ----------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export` (opaque label)   | Intake from the bride, November 2026                  |
| High-res photos / assets root | `source:hr-photos` (opaque)         | Seven originals by file transfer, received 2026-11-18 |
| Visual references             | `source:client-references` (opaque) | Phrase card and indigo color references from the chat |
| Owner decisions               | `source:owner-session` (2026-11-18) | Task brief T1523; open questions listed below         |

---

## Fact Register

| field                 | value                                                      | classification | source        | notes                                                            |
| --------------------- | ---------------------------------------------------------- | -------------- | ------------- | ---------------------------------------------------------------- |
| slug                  | adriana-y-israel                                           | verified       | owner-session | Route `/boda/adriana-y-israel`                                   |
| hostLoginAlias        | adriana_rivas                                              | inferred       | wa-export     | Bride's first surname taken from her father's name               |
| celebrantName         | Adriana                                                    | verified       | wa-export     | Bride; contracting client                                        |
| secondaryName         | Israel                                                     | verified       | wa-export     | Groom                                                            |
| eventDate             | 2027-07-10                                                 | verified       | wa-export     | Saturday                                                         |
| timeZone              | America/Mexico_City                                        | inferred       | wa-export     | Both venues are in Oaxaca                                        |
| ceremonyTime          | [[PENDIENTE:CEREMONY_TIME]]                                | pending        | wa-export     | Not set yet at the parish; no hour and no calendar link shown    |
| receptionTime         | 20:00                                                      | verified       | wa-export     | Event timing follows the reception                               |
| primaryVenueName      | Parroquia Corazón Eucarístico de Jesús                     | verified       | wa-export     |                                                                  |
| primaryVenueAddress   | Calle Claveles 102, col. Las Flores                        | verified       | wa-export     | City inferred as Oaxaca de Juárez                                |
| primaryVenueMapsUrl   | maps:parroquia                                             | inferred       | owner-session | Map search link; the owner confirms the pin                      |
| distinctVenues        | true                                                       | verified       | wa-export     | Parish and banquet hall                                          |
| receptionVenueName    | Salón Santa Mónica                                         | verified       | wa-export     |                                                                  |
| receptionVenueAddress | Punta Diamante 108, San Francisco Tutla                    | verified       | wa-export     |                                                                  |
| receptionVenueMapsUrl | maps:salon                                                 | inferred       | owner-session | Map search link; the owner confirms the pin                      |
| brideParents          | Eduardo Rivas Márquez; Clemencia Hernández Ramírez         | verified       | wa-export     |                                                                  |
| groomParents          | Luis Hernández Santiago; Virgina Irma Martínez Santiago    | verified       | wa-export     | Mother deceased; shown with «†». Spelling «Virgina» as typed     |
| godparents            | Ramiro Vallejo Ríos; Jesseni de Vallejo                    | verified       | wa-export     | Padrinos type (velación, anillos…) not stated                    |
| nameSpelling          | [[PENDIENTE:NAME_SPELLING]]                                | pending        | wa-export     | «Virgina» and «Ríos» shown as written until confirmed            |
| clientColors          | Azul índigo                                                | verified       | wa-export     | Gold appears only as hairlines                                   |
| dressCode             | A su gusto                                                 | verified       | wa-export     | Client wording rewritten in «usted»; approval pending            |
| passRules             | [[PENDIENTE:PASS_RULES]]                                   | pending        | wa-export     | Children policy not stated; copy silent                          |
| sourceAssetPath       | source:hr-photos                                           | verified       | wa-export     | Opaque label; seven originals, all used                          |
| themePreset           | jewelry-box-wedding                                        | inferred       | owner-session | Same base as the latest weddings; indigo set by the slug profile |
| sectionOrder          | quote, family, countdown, location, gallery, gifts, rsvp…  | inferred       | owner-session | Countdown required by the boda contract; gallery of five selfies |
| rsvpConfirmationMode  | api                                                        | inferred       | owner-session | Platform default                                                 |
| rsvpAccessMode        | personalized-only                                          | inferred       | owner-session | Personal links per guest                                         |
| rsvpDeadline          | [[PENDIENTE:RSVP_DEADLINE]]                                | pending        | owner-session | Copy states no date                                              |
| musicUrl              | [[PENDIENTE:MUSIC]]                                        | pending        | wa-export     | YouTube reference sent; no audio file encoded yet                |
| giftsMode             | Lluvia de sobres                                           | verified       | wa-export     |                                                                  |
| thankYouText          | Qué suerte tenerlos en este día. Hay momentos que… siempre | verified       | wa-export     | From the phrase card; «teneros» corrected to «tenerlos»          |
| itinerary             | —                                                          | not_applicable | wa-export     | Not requested                                                    |

---

## Event Completeness

Boda contract maturity: `partial`. Required fields are verified or validly inferred. Content the
client has not confirmed stays hidden or silent; nothing is invented.

### Missing blockers

- None in the fact register.

### Non-blocking gaps

- Ceremony time: the ceremony entry shows no hour and no calendar link.
- Photographs: received; cover, quote, gallery and share card use the couple's originals.
- Name spelling, RSVP deadline, children policy and music are pending.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

---

## Placeholders

| token                       | field        | guest-facing effect                              |
| --------------------------- | ------------ | ------------------------------------------------ |
| [[PENDIENTE:CEREMONY_TIME]] | ceremonyTime | Ceremony entry without hour or calendar link     |
| [[PENDIENTE:NAME_SPELLING]] | nameSpelling | Family names shown as written by the client      |
| [[PENDIENTE:RSVP_DEADLINE]] | rsvpDeadline | RSVP copy states no date                         |
| [[PENDIENTE:PASS_RULES]]    | passRules    | No seat or children policy; never «solo adultos» |
| [[PENDIENTE:MUSIC]]         | musicUrl     | No music player                                  |

Tokens live in this document only; no token is rendered to guests.

---

## Owner Decisions

| id  | category              | issue            | evidence      | options                             | outcome (2026-11-18) |
| --- | --------------------- | ---------------- | ------------- | ----------------------------------- | -------------------- |
| D1  | photograph-acceptance | Photographs      | hr-photos     | Upload the originals / keep the art | originals uploaded   |
| D2  | missing-client-facts  | Ceremony time    | wa-export     | Ask the client / leave without hour | pending              |
| D3  | missing-client-facts  | RSVP deadline    | owner-session | Propose a date / no date            | pending              |
| D4  | missing-client-facts  | Children policy  | wa-export     | Ask the client / copy silent        | pending              |
| D5  | demo-design-decisions | Omitted sections | owner-session | Add a gallery / keep it without one | gallery added        |

Release scope: published to Preview; Production follows in the owner's daily window.

---

## Agent Recommendations

| topic  | recommendation                                            | basis         | status  |
| ------ | --------------------------------------------------------- | ------------- | ------- |
| preset | `jewelry-box-wedding` with indigo set by the slug profile | latest bodas  | applied |
| reveal | Indigo pocket-fold envelope; never the base storybook one | house rule    | applied |
| gold   | Gold only as hairlines and seals; indigo leads            | client colors | applied |
| photos | Replace the provisional art with the couple's photographs | D1            | applied |

---

## Sections

| bucket                 | section keys                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| requested              | location (two venues), family (parents + padrinos), gifts, thankYou |
| inferred / recommended | envelope, hero, quote, countdown, dress code, RSVP                  |
| client-provided        | thank-you phrase card                                               |
| client-provided photos | hero, quote, gallery (five selfies), share card                     |
| omitted                | itinerary (not requested)                                           |
| unresolved             | music                                                               |

Guest-facing copy is an agent draft in the "usted" register, pending client approval.

---

## Design Direction

| decision                          | value                                                          | classification      |
| --------------------------------- | -------------------------------------------------------------- | ------------------- |
| Selected theme preset             | `jewelry-box-wedding`                                          | inferred            |
| Recommended preset alternatives   | None verified for `boda`                                       | recommendation only |
| Selected variant / visual profile | profile `adriana-y-israel`: indigo, mist, ivory; gold hairline | inferred            |
| Client color requirements         | Azul índigo                                                    | verified            |
| Recommended palette               | Indigo leads; mist ground; ivory cards; gold hairlines only    | recommendation only |
| Hero photo and focal crop         | Portrait under the tree; faces above the veil, focal 50% 30%   | applied             |
| Unresolved visual decisions       | Owner review of the Preview                                    | pending             |

References:

1. Client phrase card — take the thank-you text.
2. Latest weddings (`daniela-y-martin`, `olivia-y-antonio`) — take the section variants.

---

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING` (Paco, the owner, reviews the Preview)

- **concern:** Surface hierarchy — indigo cover and envelope; inner sections on light cards.
  **status:** draft
- **concern:** Photographic treatment — the couple's originals, cropped per role, never upscaled.
  **status:** draft

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque). Seven originals from the couple, numbered #1–#7 in the
order of the transfer. Each derivative is cropped for its role and encoded as WebP.

| source | quality            | dims      | orientation | role      | processing     | derivative        |
| ------ | ------------------ | --------- | ----------- | --------- | -------------- | ----------------- |
| #6     | `production-ready` | 3672×4896 | portrait    | hero      | crop 2:3, WebP | `hero.webp`       |
| #2     | `production-ready` | 4284×5712 | portrait    | quote     | crop 2:3, WebP | `quote.webp`      |
| #4     | `production-ready` | 3672×4896 | portrait    | gallery 1 | crop 4:5, WebP | `gallery-01.webp` |
| #5     | `production-ready` | 3672×4896 | portrait    | gallery 2 | crop 4:5, WebP | `gallery-02.webp` |
| #3     | `production-ready` | 3024×4032 | portrait    | gallery 3 | crop 4:5, WebP | `gallery-03.webp` |
| #7     | `production-ready` | 3024×4032 | portrait    | gallery 4 | crop 4:5, WebP | `gallery-04.webp` |
| #1     | `production-ready` | 3024×4032 | portrait    | gallery 5 | crop 4:5, WebP | `gallery-05.webp` |
| #6     | `production-ready` | 3672×4896 | portrait    | OG card   | crop 1.9:1     | `og-share.webp`   |

No derivative is upscaled.

### Uniqueness table (required before READY_*)

| role     | source             | derivative        | intentional multi-role?                      |
| -------- | ------------------ | ----------------- | -------------------------------------------- |
| hero     | #6                 | `hero.webp`       | yes — the share card repeats the cover photo |
| quote    | #2                 | `quote.webp`      | no                                           |
| gallery  | #4, #5, #3, #7, #1 | `gallery-0N.webp` | no                                           |
| OG share | #6                 | `og-share.webp`   | yes — same portrait as the cover             |

-------- | --------- | --------------- | ----------------------- | | hero | art:hero | `hero.webp` |
no | | quote | art:quote | `quote.webp` | no | | OG share | art:og | `og-share.webp` | no |

---

## Implementation Constraints

- Lane A: client folder `src/invitations/clients/adriana-y-israel/` (definition `invitation.ts`,
  token-only `profile.scss`, slug-scoped `composition.scss`, `assets/`).
- No new preset: the palette is re-declared in the slug profile over `jewelry-box-wedding`.
- Modern `revealVariant` only; the base storybook envelope is not used.
- Sections with pending data stay hidden or silent.

---

## Preparation Readiness History

| date       | readiness                 | helper basis                   | notes                                         |
| ---------- | ------------------------- | ------------------------------ | --------------------------------------------- |
| 2026-11-18 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | Five placeholders; provisional art for photos |
| 2026-11-18 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | Photos in; five placeholders remain           |
