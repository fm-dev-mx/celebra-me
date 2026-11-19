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

| field                 | value                                                                                                           | classification | source        | notes                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | -------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| slug                  | camila-beltran                                                                                                  | verified       | owner-session | Route `/xv/camila-beltran`                                                                                              |
| celebrantName         | Camila                                                                                                          | verified       | wa-export     | Full name Camila Beltrán; seal initial «C»                                                                              |
| eventLabel            | Mis XV Años                                                                                                     | inferred       | wa-export     | XV event; client gave no title                                                                                          |
| eventDate             | 2026-12-11                                                                                                      | verified       | wa-export     | Friday; the reference prints another weekday, never copied                                                              |
| eventTime             | 19:00                                                                                                           | verified       | wa-export     | «Ceremonia de XV años», non-Catholic service                                                                            |
| receptionTime         | 20:00                                                                                                           | verified       | wa-export     | Reception                                                                                                               |
| timeZone              | America/Mazatlan                                                                                                | inferred       | wa-export     | Venue is in Los Mochis, Sinaloa                                                                                         |
| sourceAssetPath       | source:hr-photos                                                                                                | verified       | owner-session | Opaque label only                                                                                                       |
| sectionOrder          | quote, family, countdown, location, itinerary, dressCode, memories, gallery, personalizedAccess, rsvp, thankYou | verified       | owner-session | Local composition; the reference order includes guest photo upload                                                      |
| primaryVenueName      | Salón Áurea                                                                                                     | verified       | wa-export     | Accent pending confirmation (client typed it without)                                                                   |
| primaryVenueAddress   | Carretera Los Mochis - Topolobampo Km 5, Col. Morelos, Los Mochis, Sin.                                         | verified       | wa-export     |                                                                                                                         |
| receptionVenueName    | Salón Áurea                                                                                                     | verified       | wa-export     | Reception only; ceremony venue remains unconfirmed                                                                      |
| receptionVenueAddress | Carretera Los Mochis - Topolobampo Km 5, Col. Morelos, Los Mochis, Sinaloa                                      | verified       | wa-export     | Confirmed reception address                                                                                             |
| distinctVenues        | [[PENDIENTE:CEREMONY_PLACE]]                                                                                    | pending        | owner-session | Salón Áurea is confirmed for reception only                                                                             |
| ceremonyMapUrl        | [[PENDIENTE:CEREMONY_PLACE]]                                                                                    | pending        | owner-session | Ceremony venue and exact map pin remain unconfirmed                                                                     |
| officiant             | Rev. Enrique Ruelas Carrillo                                                                                    | verified       | wa-export     | Never «misa», «parroquia» or «ceremonia religiosa»                                                                      |
| motherName            | Anahy Soto Acosta                                                                                               | verified       | wa-export     | Listed first by the client; order kept                                                                                  |
| fatherName            | Rosario Beltrán Rabago                                                                                          | verified       | wa-export     | Accent pending: [[PENDIENTE:NAME_ACCENTS]]                                                                              |
| familyLabel           | Con el amor de mis padres                                                                                       | inferred       | owner-session | Agent draft                                                                                                             |
| godparents            | [[PENDIENTE:PADRINOS]]                                                                                          | pending        | wa-export     | The client will send them; block hidden until then                                                                      |
| dressCode             | [[PENDIENTE:DRESS_LEVEL]]                                                                                       | pending        | wa-export     | Only the reserved colour was given                                                                                      |
| reservedColor         | Rose gold — reservado para la quinceañera                                                                       | verified       | wa-export     | Client's own note                                                                                                       |
| clientColors          | Rose gold, beige, dorado, blanco                                                                                | verified       | wa-export     |                                                                                                                         |
| dressColor            | Rose gold                                                                                                       | verified       | wa-export     |                                                                                                                         |
| rsvpConfirmationMode  | api                                                                                                             | inferred       | owner-session | See [[PENDIENTE:PASS_RULES]]                                                                                            |
| rsvpGuestCap          | 2                                                                                                               | inferred       | owner-session | Technical fallback only                                                                                                 |
| rsvpWhatsappPhone     | —                                                                                                               | not_applicable | owner-session | No WhatsApp confirmation flow                                                                                           |
| rsvpDeadline          | 2026-11-25                                                                                                      | verified       | owner-session | Client confirmed; displayed in RSVP copy, not an automatic API cutoff                                                   |
| gifts                 | Lluvia de sobres, regalo sorpresa; baúl en la recepción                                                         | verified       | owner-session | Owner request; shown after the dress code, before memories                                                              |
| itinerary             | [[PENDIENTE:ITINERARY]]                                                                                         | pending        | wa-export     | 19:00 and 20:00 confirmed; later times proposed by the owner-authorized draft; estimate labels removed at owner request |
| musicUrl              | Christina Perri — A Thousand Years                                                                              | verified       | owner-session | 64 kbps MP3 on Production and Preview R2; sha `ac280437…`; family changed the song on 2026-11-18                        |
| checkInQr             | —                                                                                                               | not_applicable | wa-export     | Not requested                                                                                                           |
| memoriesQr            | camila-beltran                                                                                                  | verified       | owner-session | Client-managed; uploads 2026-11-16 through 2026-12-26. Local active; hosted activation pending.                         |
| specialMessages       | [[PENDIENTE:CELEBRANT_MESSAGE]]                                                                                 | pending        | owner-session | Quote and closing are agent drafts                                                                                      |

---

## Event Completeness

XV contract maturity: `evidence-backed`. Required fields are verified or validly inferred. Optional
content the client has not supplied stays hidden; nothing is invented.

### Missing blockers

- Owner decision (2026-11-17): the invitation ships with the data on file; the client requests
  changes after reviewing it. The song MP3 is already on Production R2 (`media.celebra-me.com`).
- Local photo space is active and has an event owner. Both local upload services must be running
  with their ignored local configuration and the application origin allowed. Guest uploads work
  locally; hosted activation and access with the client's owner account remain delivery checks.

### Non-blocking gaps

- Reception: Salón Áurea at 20:00. Ceremony at 19:00 with Rev. Enrique Ruelas Carrillo is stated
  separately, without assigning an unconfirmed venue.
- Padrinos remain hidden until the client supplies them. Gifts are shown at the owner's request:
  envelope shower, surprise gift and a note about the reception trunk.
- The owner requested an estimated itinerary: ceremony at 19:00 and reception at 20:00 are
  confirmed; entrance at 20:30, dinner at 21:00, waltz at 21:30 and dancing at 22:00 are proposed
  times. Estimate labels are omitted at the owner’s request.
- RSVP deadline: 25 November 2026. The client captures the guest list and assigns pass counts in the
  host dashboard; no list import is required from the owner.
- Dress level, song version and copy acceptance remain pending.
- Map pin: an address search until the owner confirms the pin.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

---

## Placeholders

| token                           | field           | guest-facing effect                                                |
| ------------------------------- | --------------- | ------------------------------------------------------------------ |
| [[PENDIENTE:CEREMONY_PLACE]]    | distinctVenues  | Reception card only; ceremony time and officiant stated separately |
| [[PENDIENTE:PADRINOS]]          | godparents      | Padrinos block omitted                                             |
| [[PENDIENTE:DRESS_LEVEL]]       | dressCode       | Only the reserved-colour note is shown                             |
| [[PENDIENTE:NAME_ACCENTS]]      | fatherName      | Names shown as the client typed them, venue accented               |
| [[PENDIENTE:PASS_RULES]]        | rsvpGuestCap    | Per-guest links set by the host; fallback cap of 2                 |
| [[PENDIENTE:ITINERARY]]         | itinerary       | Estimated programme shown; final client schedule pending           |
| [[PENDIENTE:SONG_LINK]]         | musicUrl        | No music                                                           |
| [[PENDIENTE:CELEBRANT_MESSAGE]] | specialMessages | Agent-drafted quote and closing are shown                          |

Tokens live in this document only; no token is rendered to guests. Their temporary omission does not
constitute client approval of final delivery.

---

## Owner Decisions

| id  | category              | issue          | evidence         | options                               | outcome                                                                                                         |
| --- | --------------------- | -------------- | ---------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| D1  | demo-design-decisions | Look           | client-reference | Storybook preset / flat stationery    | Flat stationery in the order of the reference                                                                   |
| D2  | missing-client-facts  | Missing blocks | wa-export        | Placeholders / hide until data exists | Hide padrinos and gifts; owner subsequently requested a proposed itinerary without guest-facing estimate labels |
| D3  | photograph-acceptance | Crops          | hr-photos        | Derive now / owner approves first     | Owner approves every crop before assets exist                                                                   |
| D4  | other-blocking        | Photo upload   | owner-session    | Include / omit                        | Include the existing Memories flow; client administers it; receive from 16 November through 26 December 2026    |

Current scope: local implementation and validation only. Preview follows local acceptance;
Production remains an owner operation.

Current review round preserves the envelope, cover, introductory phrase, photo interludes and
date/calendar/countdown unchanged. Only the family ornament centering, rectangular location card
with centered headings, and itinerary are awaiting visual acceptance.

---

## Agent Recommendations

| topic   | recommendation                                                      | basis            | status                |
| ------- | ------------------------------------------------------------------- | ---------------- | --------------------- |
| preset  | `jewelry-box` retinted in the slug profile; no illustrated ornament | client-reference | applied               |
| palette | Beige ground, white cards, rose gold script, gold rules and buttons | client colours   | applied               |
| voice   | Camila in the first person, plural forms («los espero»)             | client-reference | applied               |
| venue   | Reception venue only; ceremony venue remains unconfirmed            | owner-session    | applied locally       |
| rsvp    | Deadline 25 November 2026; client manages guests and passes         | owner-session    | applied to local copy |

---

## Sections

| bucket                 | section keys                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| requested              | envelope, hero, quote, family, countdown, location, itinerary, gifts, memories, gallery, rsvp |
| inferred / recommended | interlude photo band, dress-code note, personalizedAccess, thankYou                           |
| omitted                | padrinos (pending data), music (pending link)                                                 |
| unresolved             | —                                                                                             |

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
- Music: 64 kbps MP3 («A Thousand Years — Christina Perri», file supplied by the owner, trailing
  silence trimmed) on Preview and Production R2 at
  `https://media.celebra-me.com/invitations/xv/camila-beltran/music-ac280437e080b10dd2b6ec51ea694b3c96173c36b5a8584bca35efb7be4719d6.mp3`.
- Every date string is typed from the fact register.

### Shared changes made for this invitation

- Countdown: an optional calendar month with a marked day (`presentationOptions.calendar.mark`).
- Dress code: the shared dress-code section (`DressCode.astro`, `_dress-code.scss`). The illustrated
  stationery treatment uses original client-owned SVG artwork through the profile. The reserved
  rose-gold note is confirmed; no dress formality is inferred.
- Location: a grouped venue printed the raw `HH:mm` time; it now prints the formatted time.
- Location map: an illustrated placeholder until the pin is confirmed (no embed, no CSP change).
- Round 4 (2026-11-19):
  - Envelope on phones: the stored «already opened» flag now carries a timestamp and expires
    (`reveal-manager.ts`, the deferred-CSS promotion script, `EditorialCoverReveal.astro`); a bare
    legacy `'true'` no longer skips the envelope.
  - Colors on phones: `src/styles/invitation.scss` declares `color-scheme: only light` so forced
    dark mode stops darkening the palettes.
  - Countdown: each value flips a `data-tick` attribute when its digits change, so a profile can
    replay a change animation; nothing is styled by default.
  - New tool `src/styles/tools/_jewel-box-accents.scss` (mixin `rose-accents($ornament)`): the pink
    accents, the rose ornaments, the parents' «&» and the animated countdown and calendar for a
    jewelry-box invitation. Only camila-beltran includes it.

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
- Round 4 (2026-11-19, client feedback S1–S6, A1–A10):
  - More pink (S1/A2): pink section titles, a petal-to-blush parents panel and an original rose SVG
    (`assets/rose-ornament.svg`) under the family message, the countdown footer and the gifts note,
    and beside the location title.
  - Type scale (S3): titles `clamp(2.75rem, 12vw, 3.6rem)`, body 17px, three families at most.
  - Cover (A3/A4): rose-gold metallic name (clipped gradient with a solid fallback) and a bigger
    date pill.
  - Parents (A6): legible script names with a «&» between them.
  - Countdown and location (S2/A7): rounded segments with a tick animation, calendar days that fade
    in one by one, a heartbeat on the marked day, calendar links on the location.
  - Content (A8–A10): dress code reads only «Formal» and the reserved Rose Gold line; gifts keep
    only «Lluvia de sobres» with a line explaining it; the RSVP subcopy adds «Evento solo para
    adultos · No niños».
  - Motion respects `prefers-reduced-motion`.

### Client pendings

Ceremony venue and pin, padrinos, Production R2 copy of the song, dress formality, programme
acceptance and the «Rábago» accent remain pending. RSVP closes on 25 November; the client assigns
passes in the dashboard. The photo QR is included locally through 26 December. Automatic RSVP cutoff
still requires the deadline feature and its migration to be integrated into this checkout. A5 (round
4): a message after «Con el amor de mis padres» and the date; the client will send the text, so
nothing was written for it.

---

## Preparation Readiness History

| date       | readiness                 | helper basis                   | notes                                         |
| ---------- | ------------------------- | ------------------------------ | --------------------------------------------- |
| 2026-11-13 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | Ten non-blocking placeholders; four originals |
| 2026-11-14 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | Derivatives done; gallery waits for AI photos |
