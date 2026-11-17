# Canonical Invitation Preparation State — `camila-beltran`

> Schema owner: `docs/core/invitation-creation-contract.md` Executable evaluation:
> `src/lib/invitation-preparation/` (**prepReadiness SSOT**) Skill:
> `.agent/skills/invitation-preparation/SKILL.md`

---

## Identity

| Parameter              | Value                     |
| ---------------------- | ------------------------- |
| **Slug**               | `camila-beltran`          |
| **Host Login Alias**   | `camila_beltran`          |
| **Event Type**         | `xv`                      |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS` |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

---

## Sources

| Source                        | Reference                          | Notes                                              |
| ----------------------------- | ---------------------------------- | -------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export` (opaque label)  | Intake from the client (the mother), 2026-11-13    |
| High-res photos / assets root | `source:hr-photos` (opaque label)  | Four studio originals, portrait, 2772–3601 px wide |
| Visual reference              | `source:client-reference` (opaque) | Sample page the client chose; order and feel only  |
| Owner decisions               | `source:owner-session`             | Scope, price and delivery date from the task brief |

---

## Fact Register

| field                | value                                                                      | classification | source        | notes                                                        |
| -------------------- | -------------------------------------------------------------------------- | -------------- | ------------- | ------------------------------------------------------------ |
| slug                 | camila-beltran                                                             | verified       | owner-session | Route `/xv/camila-beltran`                                   |
| celebrantName        | Camila                                                                     | verified       | wa-export     | Full name Camila Beltrán; seal initial «C»                   |
| eventLabel           | Mis XV Años                                                                | inferred       | wa-export     | XV event; client gave no title                               |
| eventDate            | 2026-12-11                                                                 | verified       | wa-export     | Friday; the reference prints another weekday, never copied   |
| eventTime            | 19:00                                                                      | verified       | wa-export     | «Ceremonia de XV años», non-Catholic service                 |
| receptionTime        | 20:00                                                                      | verified       | wa-export     | Reception                                                    |
| timeZone             | America/Mazatlan                                                           | inferred       | wa-export     | Venue is in Los Mochis, Sinaloa                              |
| sourceAssetPath      | source:hr-photos                                                           | verified       | owner-session | Opaque label only                                            |
| sectionOrder         | quote, family, countdown, location, gallery, personalizedAccess, rsvp, end | inferred       | owner-session | Follows the reference order; dress code sits with location   |
| primaryVenueName     | Salón Áurea                                                                | verified       | wa-export     | Accent pending confirmation (client typed it without)        |
| primaryVenueAddress  | Carretera Los Mochis - Topolobampo Km 5, Col. Morelos, Los Mochis, Sin.    | verified       | wa-export     |                                                              |
| distinctVenues       | false                                                                      | inferred       | wa-export     | Only one venue given; see [[PENDIENTE:CEREMONY_PLACE]]       |
| ceremonyMapUrl       | Map search for the venue                                                   | inferred       | owner-session | The client sent no pin; the owner confirms the pin           |
| officiant            | Rev. Enrique Ruelas Carrillo                                               | verified       | wa-export     | Never «misa», «parroquia» or «ceremonia religiosa»           |
| motherName           | Anahy Soto Acosta                                                          | verified       | wa-export     | Listed first by the client; order kept                       |
| fatherName           | Rosario Beltrán Rabago                                                     | verified       | wa-export     | Accent pending: [[PENDIENTE:NAME_ACCENTS]]                   |
| familyLabel          | Con el amor de mis padres                                                  | inferred       | owner-session | Agent draft                                                  |
| godparents           | [[PENDIENTE:PADRINOS]]                                                     | pending        | wa-export     | The client will send them; block hidden until then           |
| dressCode            | [[PENDIENTE:DRESS_LEVEL]]                                                  | pending        | wa-export     | Only the reserved colour was given                           |
| reservedColor        | Rose gold — reservado para la quinceañera                                  | verified       | wa-export     | Client's own note                                            |
| clientColors         | Rose gold, beige, dorado, blanco                                           | verified       | wa-export     |                                                              |
| dressColor           | Rose gold                                                                  | verified       | wa-export     |                                                              |
| rsvpConfirmationMode | api                                                                        | inferred       | owner-session | See [[PENDIENTE:PASS_RULES]]                                 |
| rsvpGuestCap         | 2                                                                          | inferred       | owner-session | Technical fallback only                                      |
| rsvpWhatsappPhone    | —                                                                          | not_applicable | owner-session | No WhatsApp confirmation flow                                |
| rsvpDeadline         | [[PENDIENTE:RSVP_DEADLINE]]                                                | pending        | owner-session | Proposal 2026-12-04; until confirmed the copy states no date |
| gifts                | [[PENDIENTE:GIFTS]]                                                        | pending        | wa-export     | Not mentioned; section hidden                                |
| itinerary            | [[PENDIENTE:ITINERARY]]                                                    | pending        | wa-export     | Only the two times are known; section hidden                 |
| musicUrl             | [[PENDIENTE:SONG_LINK]]                                                    | pending        | wa-export     | Song title given («No crezcas más»), no link; music omitted  |
| checkInQr            | —                                                                          | not_applicable | wa-export     | Not requested                                                |
| memoriesQr           | —                                                                          | not_applicable | owner-session | The reference's photo upload is out of scope                 |
| specialMessages      | [[PENDIENTE:CELEBRANT_MESSAGE]]                                            | pending        | owner-session | Quote and closing are agent drafts                           |

---

## Event Completeness

XV contract maturity: `evidence-backed`. Required fields are verified or validly inferred. Optional
content the client has not supplied stays hidden; nothing is invented.

### Missing blockers

- None in the fact register.

### Non-blocking gaps

- Ceremony place: only one venue was given, so one venue card shows both times.
- Padrinos, gifts and itinerary: hidden until the client sends them; each can be switched on without
  rework.
- Dress level, RSVP deadline, pass rules, song link and name accents: asked to the client in one
  message.
- Map pin: an address search until the owner confirms the pin.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

---

## Placeholders

| token                           | field           | guest-facing effect                                  |
| ------------------------------- | --------------- | ---------------------------------------------------- |
| [[PENDIENTE:CEREMONY_PLACE]]    | distinctVenues  | One venue card with both times                       |
| [[PENDIENTE:PADRINOS]]          | godparents      | Padrinos block omitted                               |
| [[PENDIENTE:DRESS_LEVEL]]       | dressCode       | Only the reserved-colour note is shown               |
| [[PENDIENTE:NAME_ACCENTS]]      | fatherName      | Names shown as the client typed them, venue accented |
| [[PENDIENTE:RSVP_DEADLINE]]     | rsvpDeadline    | RSVP copy states no date                             |
| [[PENDIENTE:PASS_RULES]]        | rsvpGuestCap    | Per-guest links set by the host; fallback cap of 2   |
| [[PENDIENTE:GIFTS]]             | gifts           | Gifts section omitted                                |
| [[PENDIENTE:ITINERARY]]         | itinerary       | Itinerary section omitted                            |
| [[PENDIENTE:SONG_LINK]]         | musicUrl        | No music                                             |
| [[PENDIENTE:CELEBRANT_MESSAGE]] | specialMessages | Agent-drafted quote and closing are shown            |

Tokens live in this document only; no token is rendered to guests. All are non-blocking.

---

## Owner Decisions

| id  | category              | issue          | evidence         | options                               | outcome                                       |
| --- | --------------------- | -------------- | ---------------- | ------------------------------------- | --------------------------------------------- |
| D1  | demo-design-decisions | Look           | client-reference | Storybook preset / flat stationery    | Flat stationery in the order of the reference |
| D2  | missing-client-facts  | Missing blocks | wa-export        | Placeholders / hide until data exists | Hide padrinos, gifts and itinerary            |
| D3  | photograph-acceptance | Crops          | hr-photos        | Derive now / owner approves first     | Owner approves every crop before assets exist |
| D4  | other-blocking        | Photo upload   | client-reference | Build / leave out                     | Left out; the owner tells the client          |

Release scope: up to develop; Production is the owner's decision.

---

## Agent Recommendations

| topic   | recommendation                                                      | basis            | status                |
| ------- | ------------------------------------------------------------------- | ---------------- | --------------------- |
| preset  | `jewelry-box` retinted in the slug profile; no illustrated ornament | client-reference | applied               |
| palette | Beige ground, white cards, rose gold script, gold rules and buttons | client colours   | applied               |
| voice   | Camila in the first person, plural forms («los espero»)             | client-reference | applied               |
| venue   | One card, two times                                                 | single venue     | applied               |
| rsvp    | Deadline Friday 4 December 2026                                     | event date       | pending client answer |

---

## Sections

| bucket                 | section keys                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| requested              | envelope, hero, quote, family, countdown, location, gallery, rsvp   |
| inferred / recommended | interlude photo band, dress-code note, personalizedAccess, thankYou |
| omitted                | itinerary, gifts, padrinos (pending data), music (pending link)     |
| unresolved             | —                                                                   |

---

## Design Direction

| decision                          | value                                                                | classification          |
| --------------------------------- | -------------------------------------------------------------------- | ----------------------- |
| Selected theme preset             | `jewelry-box`                                                        | inferred (agent choice) |
| Recommended preset alternatives   | `enchanted-rose` retinted                                            | recommendation only     |
| Selected variant / visual profile | profile `camila-beltran`: flat stationery, wax seal with initial «C» | verified                |
| Client color requirements         | Rose gold, beige, dorado, blanco                                     | verified                |
| Recommended palette               | Beige paper, white cards, rose gold script, gold rules and buttons   | recommendation only     |
| Unresolved visual decisions       | First viewport (envelope and hero) at 390×844                        | requires_owner_decision |

References: the sample page the client chose (flat envelope with a gold wax seal, full-bleed photo
cover, cream sections with script headings and thin gold rules), the four studio photographs, and
the client's four colours. Own components and art only; nothing is copied from the reference.

---

## Creative Direction & Acceptance

**Human creative outcome:** `ACCEPTED`

The owner accepted every section one at a time and approved publishing the invitation to Preview on
2026-11-16. The gallery keeps its current photographs until the AI photographs are approved;
swapping them is a content update, not a new acceptance round.

- **concern:** Typography roles — script for the name and headings, spaced small capitals in gold
  for eyebrows, serif body. **status:** accepted
- **concern:** Surface hierarchy — beige paper ground, white rounded cards, thin gold rules with a
  centre dot. **status:** accepted
- **concern:** Photographic treatment — full-bleed cover, head-and-shoulders bands, no filters.
  **status:** accepted
- **concern:** Cadence — one section at a time in the reference order, each accepted by the owner at
  360×640 and 390×844. **status:** accepted for every section except the gallery, which waits for
  the AI photographs

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque). Studio originals, portrait, cropped to WebP after the
owner approved each crop.

| source | quality            | dims      | orientation | role                        | processing   | derivative |
| ------ | ------------------ | --------- | ----------- | --------------------------- | ------------ | ---------- |
| 1      | `production-ready` | 3601×4863 | portrait    | hero                        | crop to WebP | done       |
| 2      | `production-ready` | 2772×4160 | portrait    | interlude band; gallery     | crop to WebP | done       |
| 3      | `production-ready` | 3375×4645 | portrait    | gallery                     | crop to WebP | done       |
| 4      | `production-ready` | 3566×5121 | portrait    | thank-you; gallery; OG card | crop to WebP | done       |

Derivatives in `assets/`: `hero.webp`, `interlude-portrait.webp`, `interlude-dress.webp`,
`gallery-01.webp`…`gallery-04.webp`, `thank-you.webp`, `og-share.webp`.

AI-generated photographs: the owner asked for four new gallery photographs generated from the studio
session, so the gallery stops repeating the hero and interlude poses. Until they arrive the gallery
uses studio crops. Every AI photograph needs the owner's review and the celebrant's mother's
approval before it is published; that approval is recorded here.

| AI photograph      | ratio | status                         | mother's approval |
| ------------------ | ----- | ------------------------------ | ----------------- |
| g1-sonrisa-ramo    | 3:2   | pending generation             | pending           |
| g2-detalle-tiara   | 3:4   | pending generation (no person) | not needed        |
| g3-sobre-el-hombro | 3:4   | pending generation             | pending           |
| g4-champan-risa    | 3:2   | pending generation             | pending           |

### Uniqueness table (required before READY_*)

| role      | source | derivative                | intentional multi-role?                              |
| --------- | ------ | ------------------------- | ---------------------------------------------------- |
| hero      | 1      | `hero.webp`               | yes — also a gallery crop until the AI photos arrive |
| interlude | 2      | `interlude-portrait.webp` | yes — different crop from the gallery                |
| thank-you | 4      | `thank-you.webp`          | yes — different crop from the OG card                |

---

## Implementation Constraints

- Client folder `src/invitations/clients/camila-beltran/` (definition `invitation.ts`, token-only
  `profile.scss`, slug-scoped `composition.scss`, `assets/`).
- No new preset and no storybook art; the envelope uses the `storybook-lanterns` reveal, never the
  base `storybook-blush` reveal.
- Music omitted until the client sends the link.
- Every date string is typed from the fact register.

### Shared changes made for this invitation

- Countdown: an optional calendar month with a marked day (`presentationOptions.calendar.mark`).
- Dress code: the shared dress-code section (`DressCode.astro`, `_dress-code.scss`).
- Location: a grouped venue printed the raw `HH:mm` time; it now prints the formatted time.
- Location map: an illustrated placeholder until the pin is confirmed (no embed, no CSP change).

### Slug-scoped refinements (profile and composition)

- Location: the lede hides at `max-height: 860px`; the container has a viewport `min-height`.
- Gallery: a four-photo mosaic that fits one screen.
- Countdown: compacted on short screens.
- RSVP: the lantern span no longer overflows; the steps panel uses an auto column; a compact rule at
  360×640.
- RSVP access: `accessMode: 'personalized-only'`; `personalizedAccess` is in `sectionOrder`, so the
  pass card shows only on a guest link. The pass card is styled with `--pa-*` tokens and the locked
  preview card is styled too.
- «Pase solo para adultos» comes from the guest's data, not from the definition.
- Thank-you: centering tokens; the round entry starts hidden with no inset clip and fades in; the
  shell zoom runs only with `prefers-reduced-motion: no-preference`.
- Desktop padding tokens for the pass card and the thank-you (`--pa-padding-block-lg`,
  `--thank-you-keepsake-padding-block-lg`) so each fits one 1440×900 screen.
- «Con cariño» (`closingPhrase`) renders in the page footer.
- The local seed guest's share text carries no link; `/i/<code>` redirects to
  `/camila-beltran?invite=<id>`.

### Client pendings

Ceremony venue, padrinos, song link, RSVP deadline, number of passes, dress formality, gifts and
programme, the «Rábago» accent, the map pin. The guests' photo QR is not included.

---

## Preparation Readiness History

| date       | readiness                 | helper basis                   | notes                                         |
| ---------- | ------------------------- | ------------------------------ | --------------------------------------------- |
| 2026-11-13 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | Ten non-blocking placeholders; four originals |
| 2026-11-14 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | Derivatives done; gallery waits for AI photos |
