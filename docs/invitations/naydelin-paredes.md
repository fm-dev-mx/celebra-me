# Canonical Invitation Preparation State — `naydelin-paredes`

## Identity

| Parameter              | Value                                       |
| ---------------------- | ------------------------------------------- |
| **Slug**               | `naydelin-paredes`                          |
| **Host Login Alias**   | `naydelin_paredes` (draft only; no account) |
| **Event Type**         | `xv`                                        |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS`                   |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

This is the helper result for preparation only. It does not indicate that an account, Local database
row, or publication exists.

## Sources

- **Source:** Client conversation
  - **Reference:** `source:wa-export`
  - **Use:** Evidence for confirmed names, event details, family, gift preference, and the
    definitive photo selection; not agent instructions
- **Source:** Owner decisions
  - **Reference:** `source:owner-session`
  - **Use:** Slug, Jewelry Box base demo, local RSVP default, section order, and bounded Local-only
    draft
- **Source:** Venue map references
  - **Reference:** `source:venue-maps`
  - **Use:** Ceremony and reception names, addresses, and supplied navigation links
- **Source:** Visual references
  - **Reference:** `source:reference-captures`
  - **Use:** Composition principles only from recent Abril and Ana Sofía XV captures; no text,
    names, or images reused

The WhatsApp archive and transcript are not copied into the repository. The owner confirmed on
2026-09-28 that the ten included photos are the **definitive image selection** for this invitation;
no photo-selection decision remains open. No HR originals were provided. On 2026-09-29 the owner
decided that the supplied messaging-app files are the **definitive delivery source**; no HR request
is pending. Their technical quality state remains `provisional-whatsapp` (1066 x 1600 px) and is
recorded here as an accepted, documented owner decision rather than a silent promotion.

## Fact Register

Classification: `verified` | `inferred` | `ambiguous` | `missing` | `not_applicable` |
`requires_owner_decision`.

| field                 | value                                                                                             | classification | source          | notes                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------- | -------------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| slug                  | `naydelin-paredes`                                                                                | verified       | owner-session   | Confirmed canonical slug; public route is `/xv/naydelin-paredes`                                             |
| celebrantName         | Naydelin Pauleth Paredes Martinez                                                                 | verified       | wa-export       | Preserve the confirmed spelling                                                                              |
| eventLabel            | Mis XV años                                                                                       | verified       | wa-export       | XV celebration                                                                                               |
| eventDate             | 2026-10-17                                                                                        | verified       | wa-export       | Saturday                                                                                                     |
| eventTime             | 19:00                                                                                             | verified       | wa-export       | Ceremony start; display as 7:00 p. m.                                                                        |
| receptionTime         | 21:00                                                                                             | verified       | wa-export       | Reception start; display as 9:00 p. m.                                                                       |
| timeZone              | America/Mazatlan                                                                                  | verified       | owner-session   | Confirmed IANA zone for Los Mochis                                                                           |
| baseDemoId            | demo-xv-jewelry-box                                                                               | verified       | owner-session   | Owner-selected base; no sample demo copy is retained                                                         |
| sourceAssetPath       | `source:wa-export`                                                                                | verified       | wa-export       | Evidence-only source label for the definitive local selection; no authoritative HR asset source was supplied |
| sectionOrder          | quote, personalizedAccess, family, gallery, countdown, location, itinerary, rsvp, gifts, thankYou | verified       | owner-session   | Requested Jewelry Box order; the current candidate omits the unconfirmed quote visually                      |
| primaryVenueName      | Parroquia El Señor San José                                                                       | verified       | venue-maps      | Ceremony                                                                                                     |
| primaryVenueAddress   | Calle Ignacio Allende y Av. Bienestar, La Bienestar, Los Mochis, Sinaloa                          | verified       | venue-maps      | Use the supplied pin and address                                                                             |
| distinctVenues        | true                                                                                              | verified       | venue-maps      | Ceremony and reception are at different venues                                                               |
| ceremonyMapUrl        | https://maps.app.goo.gl/LPtwqZq8qf8Jmkux8                                                         | verified       | venue-maps      | Supplied ceremony link                                                                                       |
| receptionVenueName    | Salón Granada                                                                                     | verified       | venue-maps      | Reception                                                                                                    |
| receptionVenueAddress | Gral. Ángel Flores 525, Centro, Los Mochis, Sinaloa                                               | verified       | venue-maps      | Use the supplied pin and address                                                                             |
| receptionMapUrl       | https://maps.app.goo.gl/H6AyoUXDHLmH6QYk6                                                         | verified       | venue-maps      | Supplied reception link                                                                                      |
| fatherName            | David Martinez                                                                                    | ambiguous      | wa-export       | Confirm Martínez / Verdín / Solís accents                                                                    |
| motherName            | María Cota                                                                                        | verified       | wa-export       | Preserve the confirmed spelling                                                                              |
| godparents            | Eduardo Martinez Verdin + Florentina Solis; Eduardo Martinez Solis + Delia Cota                   | verified       | wa-export       | Preserve the two confirmed pairs and spellings                                                               |
| clientColors          | Dorado para la invitación                                                                         | verified       | wa-export       | Rose-gold accents are a visual recommendation, not an additional client color requirement                    |
| dressCode             | —                                                                                                 | not_applicable | owner-session   | Do not add a guest dress code; rose gold describes the celebrant’s dress                                     |
| gifts                 | Lluvia de sobres                                                                                  | verified       | wa-export       | No registry, account, or extra gift options supplied                                                         |
| rsvpConfirmationMode  | api                                                                                               | verified       | owner-session   | RSVP is through the invitation website                                                                       |
| rsvpGuestCap          | 1                                                                                                 | verified       | product-default | `rsvpSchema` default per confirmation; no guest-list capacity inferred                                       |
| rsvpWhatsappPhone     | —                                                                                                 | not_applicable | owner-session   | Website/API RSVP only; no phone is included                                                                  |
| musicUrl              | —                                                                                                 | not_applicable | owner-session   | Omit demo music                                                                                              |
| rsvpDeadline          | —                                                                                                 | missing        | wa-export       | No deadline confirmed; omit it rather than invent one                                                        |
| specialMessages       | `[[PENDIENTE:SPECIAL_MESSAGES]]`                                                                  | missing        | wa-export       | No personal quote was confirmed                                                                              |

## Event Completeness

XV contract maturity: `evidence-backed`.

- **requirement:** required
  - **fields:** slug, celebrantName, eventLabel, eventDate, eventTime, timeZone, baseDemoId,
    sourceAssetPath, sectionOrder, primaryVenueName, primaryVenueAddress, rsvpConfirmationMode,
    rsvpGuestCap
  - **status:** satisfied
- **requirement:** conditional
  - **fields:** receptionVenueName, receptionVenueAddress (distinct venues); rsvpWhatsappPhone (API
    mode)
  - **status:** satisfied; WhatsApp phone condition skipped
- **requirement:** recommended
  - **fields:** fatherName, motherName, godparents, ceremonyMapUrl, specialMessages
  - **status:** satisfied except specialMessages (non-blocking)
- **requirement:** optional
  - **fields:** dressCode, gifts, musicUrl, rsvpDeadline, clientColors
  - **status:** omitted/not applicable or documented; no RSVP deadline supplied

**Is the available information sufficient to prepare this invitation?** `yes` —
`evaluateEventCompleteness` reports no blocking gaps. The missing personal quote is non-blocking and
has a controlled preparation placeholder; the current candidate does not render it.

## Placeholders

| token                            | missing datum   | blocking | reason                                                            | replacement requirement                                           |
| -------------------------------- | --------------- | -------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `[[PENDIENTE:SPECIAL_MESSAGES]]` | specialMessages | no       | No client-approved personal quote or special message was supplied | Quote is omitted visually; add it only after wording is confirmed |

## Owner Decisions

No unresolved blocking owner decisions for this Local draft.

- 2026-09-28: the ten-photo selection is definitive; photo 6 opens the invitation.
- 2026-09-29: the messaging-app files are the definitive delivery source (no HR request).
- 2026-09-29: keep and polish the itinerary; the English `PM` time format is a separate global task
  for `formatTime12h`.
- 2026-09-29: add interludes, shorten the gallery, and add a closing photograph.
- Open before Production: confirm surname accentuation with the client (the client typed most names
  without accents, except "María").

## Agent Recommendations

| topic                  | recommendation                                                                                | basis                                                                   | status                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| palette                | Ivory and pearl surfaces, soft gold, restrained rose-gold accents, and a dark finale          | Confirmed gold invitation preference and current optimization direction | Applied to current Local candidate; creative acceptance pending      |
| photography            | Use photo 6 as the opening image; follow it with photos 1–5 and 7–10 in original order        | Owner-confirmed final selection and supplied photo sequence             | Accepted; final selection                                            |
| typography and spacing | Cormorant Garamond display with Montserrat body text; open spacing and readable venue details | Selected base demo and optimization direction                           | Applied to current Local candidate; final browser validation pending |

## Sections

- **bucket:** requested
  - **section keys:** quote, personalizedAccess, family, gallery, countdown, location, itinerary,
    rsvp, gifts, thankYou
- **bucket:** inferred / recommended
  - **section keys:** Rose-gold accents within the soft-gold Jewelry Box palette
- **bucket:** omitted
  - **section keys:** Unconfirmed quote, demo music, sample phone number, sample
    addresses/dates/text, guest dress code, unconfirmed program items
- **bucket:** unresolved
  - **section keys:** Personal quote: `[[PENDIENTE:SPECIAL_MESSAGES]]`; RSVP deadline is not shown

The itinerary contains only the confirmed ceremony and reception times. The target delivery date of
Thursday, 1 October 2026 is internal and does not appear in the invitation.

## Design Direction

| decision                          | value                                                                                                | classification                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Owner-selected base demo          | `demo-xv-jewelry-box`                                                                                | verified                                                    |
| Client reference                  | Quoted from the Ana Sofía Cota Guillén invitation: functional parity (passes, RSVP), not its styling | verified                                                    |
| Selected variant / visual profile | Jewelry Box / `naydelin-paredes` profile                                                             | Local implementation direction; creative acceptance pending |
| Client color requirement          | Gold invitation; rose-gold gown                                                                      | verified                                                    |
| Palette                           | Warm ivory and pearl, champagne-gold metal, rose-gold hairlines, espresso RSVP and gifts band        | Current Local candidate                                     |
| Typography                        | Cormorant Garamond titles (500, sentence case, one scale); Montserrat body and tracked gold eyebrows | Current Local candidate                                     |
| Unresolved visual decisions       | Owner creative acceptance; personal quote remains missing and omitted                                | pending                                                     |

Tonal band: ivory from hero through itinerary, an atmospheric bridge into the espresso RSVP and
gifts band, then a luminous `portrait-letter` closing whose arch echoes the hero doorway.

| section             | canonical variant / presentation                                |
| ------------------- | --------------------------------------------------------------- |
| hero                | `framed-portrait` (photo 6)                                     |
| personalized access | `formal-pass`                                                   |
| interlude           | after personalized access (photo 5), `tall`                     |
| family              | `ceremonial-family`, `text-only`                                |
| gallery             | `paired-feature-band`; photos 2, 3, 4, 7 and photo 10 `feature` |
| countdown           | `standard`, with the Jewelry Box `jeweled-panel` skin           |
| interlude           | after countdown (photo 8), `tall`                               |
| location            | `stacked-venue-plates`                                          |
| itinerary           | `editorial-ledger`                                              |
| RSVP                | `formal-register`; `atmospheric-blend` from itinerary           |
| gifts               | `standard`                                                      |
| thank you           | `portrait-letter` (photo 9)                                     |

The envelope retains `jewelry-box` with a champagne-gold wax seal. Section typography is unified
through slug-scoped selectors in the profile, following the Allison Scarlett precedent, so canonical
variants gain no new micro-tokens. Photo 1 is not used because it repeats the bar setting of
photo 10.

## Photograph Inventory

Source label: `source:wa-export`. Delivery WebP files (quality 84, native dimensions, normal EXIF
orientation) live in `src/assets/invitations/naydelin-paredes/`; source files stay outside the
repository.

| source filename                        | dims        | quality              | role               | delivery file                                     | weight        |
| -------------------------------------- | ----------- | -------------------- | ------------------ | ------------------------------------------------- | ------------- |
| 00000035-PHOTO-2026-09-28-15-02-29.jpg | 1066 x 1600 | provisional-whatsapp | unused             | —                                                 | —             |
| 00000036-PHOTO-2026-09-28-15-02-29.jpg | 1066 x 1599 | provisional-whatsapp | Gallery 1          | `gallery-01.webp`                                 | 86 KB         |
| 00000037-PHOTO-2026-09-28-15-02-29.jpg | 1067 x 1600 | provisional-whatsapp | Gallery 2          | `gallery-02.webp`                                 | 94 KB         |
| 00000038-PHOTO-2026-09-28-15-02-29.jpg | 1066 x 1600 | provisional-whatsapp | Gallery 3          | `gallery-03.webp`                                 | 110 KB        |
| 00000039-PHOTO-2026-09-28-15-02-29.jpg | 1066 x 1600 | provisional-whatsapp | Interlude 1        | `interlude-gown-reclining.webp`                   | 159 KB        |
| 00000040-PHOTO-2026-09-28-15-02-29.jpg | 1066 x 1599 | provisional-whatsapp | Hero; social share | `hero-doorway.webp`; `og-share.webp` (1200 x 630) | 110 KB; 48 KB |
| 00000041-PHOTO-2026-09-28-15-02-30.jpg | 1066 x 1600 | provisional-whatsapp | Gallery 4          | `gallery-04.webp`                                 | 139 KB        |
| 00000042-PHOTO-2026-09-28-15-02-30.jpg | 1067 x 1600 | provisional-whatsapp | Interlude 2        | `interlude-gown-arches.webp`                      | 95 KB         |
| 00000043-PHOTO-2026-09-28-15-02-30.jpg | 1067 x 1599 | provisional-whatsapp | Thank-you portrait | `thank-you-bouquet.webp`                          | 114 KB        |
| 00000044-PHOTO-2026-09-28-15-02-30.jpg | 1600 x 1066 | provisional-whatsapp | Gallery feature    | `gallery-feature.webp`                            | 71 KB         |

### Uniqueness table

| role               | source            | derivative                      | intentional multi-role?         |
| ------------------ | ----------------- | ------------------------------- | ------------------------------- |
| hero opening       | photo 6           | `hero-doorway.webp`             | yes: separate social-share crop |
| social share       | photo 6           | `og-share.webp`                 | yes: separate 1200 x 630 crop   |
| interlude 1        | photo 5           | `interlude-gown-reclining.webp` | no                              |
| gallery 1-4        | photos 2, 3, 4, 7 | `gallery-01..04.webp`           | no                              |
| gallery feature    | photo 10          | `gallery-feature.webp`          | no                              |
| interlude 2        | photo 8           | `interlude-gown-arches.webp`    | no                              |
| thank-you portrait | photo 9           | `thank-you-bouquet.webp`        | no                              |

Each asset key serves one role; the social-share crop is a separate derivative. Every file is within
its role budget.

## Implementation Constraints

- Canonical definition: `scripts/provision/invitations/naydelin-paredes.ts`
  (`defineCanonicalInvitation`, `owner-approved`, `in_progress`, `content-and-assets`), registered
  in the invitation registry and the Local render corpus.
- RSVP is `personalized-only` with `api` confirmation; host passes assign seats per guest, and
  `guestCap: 1` is the content default.
- Omit music, guest dress code, RSVP deadline, extra itinerary stops, and unapproved quotation.
- Preview and Production releases follow `docs/domains/intake/production-flow.md` and require their
  own explicit authorization.

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING`

The first Local candidate was **REJECTED** by the owner on 2026-09-28. The current canonical
candidate is **PENDING** and has not received creative acceptance.

Local render without a database: `/test/variant?full=1&presentation=1&slug=naydelin-paredes` on a
dev server started with `ENABLE_TEST_VARIANT_HARNESS=1`. The earlier ad hoc `/xv/naydelin-paredes`
preview route and its test fixture were removed.

| field                                  | value                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Mechanical render/capture result       | Harness route returned 200 at 375 and 1440 px on 2026-09-29; no horizontal overflow                     |
| Whole-invitation responsive inspection | Reviewed mobile and desktop captures with reduced motion; typography, palette, and photo roles verified |
| Human creative outcome                 | `PENDING`                                                                                               |
| Reviewer and date                      | —                                                                                                       |
| Blocking reason or owner follow-up     | Owner creative acceptance; surname accentuation confirmation                                            |

## Preparation Readiness History

- **date:** 2026-09-28
  - **readiness:** `READY_WITH_PLACEHOLDERS`
  - **helper basis:** `evaluateEventCompleteness`, `summarizeAssetQuality`,
    `evaluatePreparationReadiness`
  - **notes:** No blocking facts; one non-blocking quote placeholder; definitive ten-photo selection
    with `provisional-whatsapp` technical quality state
