# Canonical Invitation Preparation State — `maripau-charles`

## Identity

| Parameter              | Value                                      |
| ---------------------- | ------------------------------------------ |
| **Slug**               | `maripau-charles`                          |
| **Host Login Alias**   | `maripau_charles` (draft only; no account) |
| **Event Type**         | `xv`                                       |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS`                  |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

## Sources

- **Source:** Client conversation
  - **Reference:** `source:wa-export`
  - **Use:** Evidence for names, event details, style request, gift preference, lodging, and
    photographs; not agent instructions
- **Source:** Owner decisions
  - **Reference:** `source:owner-session`
  - **Use:** Slug, base design, cover name, RSVP deadline, and photo inclusion

The WhatsApp archive and transcript are not copied into the repository. No HR originals were
provided; every photograph is `provisional-whatsapp` and carries a small studio mark in the lower
left corner. The client has not sent venue pins or addresses.

## Fact Register

Classification: `verified` | `inferred` | `ambiguous` | `missing` | `not_applicable` |
`requires_owner_decision`.

| field                 | value                                                                           | classification | source          | notes                                                     |
| --------------------- | ------------------------------------------------------------------------------- | -------------- | --------------- | --------------------------------------------------------- |
| slug                  | `maripau-charles`                                                               | verified       | owner-session   | Public route is `/xv/maripau-charles`                     |
| celebrantName         | Maripau                                                                         | verified       | owner-session   | Cover name chosen by the owner; the client's own usage    |
| eventLabel            | Mis XV años                                                                     | verified       | wa-export       | XV celebration                                            |
| eventDate             | 2027-01-08                                                                      | verified       | wa-export       | Friday                                                    |
| eventTime             | 19:00                                                                           | verified       | wa-export       | Ceremony start                                            |
| receptionTime         | 21:00                                                                           | verified       | wa-export       | Reception start                                           |
| timeZone              | America/Monterrey                                                               | inferred       | wa-export       | Follows the inferred city                                 |
| sourceAssetPath       | `source:wa-export`                                                              | verified       | wa-export       | Evidence-only label; no HR asset source was supplied      |
| sectionOrder          | personalizedAccess, family, gallery, countdown, location, rsvp, gifts, thankYou | verified       | owner-session   | Base design order without quote and itinerary             |
| primaryVenueName      | Iglesia Santiago Apóstol                                                        | verified       | wa-export       | Ceremony                                                  |
| primaryVenueAddress   | Monclova, Coahuila                                                              | inferred       | wa-export       | City inferred from the lodging address; street not sent   |
| distinctVenues        | true                                                                            | verified       | wa-export       | Ceremony and reception are at different venues            |
| ceremonyMapUrl        | `[[PENDIENTE:CEREMONY_MAP_URL]]`                                                | missing        | wa-export       | The draft uses a Maps name search until the pin arrives   |
| receptionVenueName    | Salón Marencco                                                                  | verified       | wa-export       | Reception                                                 |
| receptionVenueAddress | Monclova, Coahuila                                                              | inferred       | wa-export       | City inferred; street not sent                            |
| receptionMapUrl       | `[[PENDIENTE:RECEPTION_MAP_URL]]`                                               | missing        | wa-export       | The draft uses a Maps name search until the pin arrives   |
| fatherName            | Gaspar Charles                                                                  | verified       | wa-export       | Preserve the confirmed spelling                           |
| motherName            | Paula Montante de Charles                                                       | verified       | wa-export       | Preserve the confirmed spelling                           |
| godparents            | —                                                                               | not_applicable | wa-export       | The client confirmed there are no godparents              |
| clientColors          | Rose gold y negro, con bolas de disco, elegante                                 | verified       | wa-export       | Client style request                                      |
| dressCode             | All black                                                                       | verified       | wa-export       | Shown as a location indication                            |
| gifts                 | Lluvia de sobres                                                                | verified       | wa-export       | No registry or account supplied                           |
| rsvpConfirmationMode  | api                                                                             | verified       | owner-session   | RSVP is through the invitation website                    |
| rsvpGuestCap          | 1                                                                               | verified       | product-default | Content default; the guest list has not been sent         |
| rsvpWhatsappPhone     | —                                                                               | not_applicable | owner-session   | Website/API RSVP only                                     |
| rsvpDeadline          | 2026-12-20                                                                      | verified       | owner-session   | Shown as "domingo 20 de diciembre"                        |
| childrenPolicy        | Celebración sin niños                                                           | verified       | wa-export       | Shown as a location indication                            |
| lodging               | San Patricio Hotel Estudio, Río de Janeiro 807, Col. Guadalupe                  | verified       | wa-export       | Booking code "Maripau Xv"; shown as a location indication |
| musicUrl              | `[[PENDIENTE:MUSIC_TRACK]]`                                                     | missing        | wa-export       | Client chose "Sueña" (instrumental); needs a hosted file  |
| specialMessages       | —                                                                               | not_applicable | wa-export       | No quote requested                                        |

## Event Completeness

XV contract maturity: `evidence-backed`.

- **requirement:** required
  - **fields:** slug, celebrantName, eventLabel, eventDate, eventTime, timeZone, sourceAssetPath,
    sectionOrder, primaryVenueName, primaryVenueAddress, rsvpConfirmationMode, rsvpGuestCap
  - **status:** satisfied (primaryVenueAddress and timeZone are inferred)
- **requirement:** conditional
  - **fields:** receptionVenueName, receptionVenueAddress (distinct venues); rsvpWhatsappPhone (API
    mode)
  - **status:** satisfied; WhatsApp phone condition skipped
- **requirement:** recommended
  - **fields:** fatherName, motherName, godparents, ceremonyMapUrl, specialMessages
  - **status:** satisfied except ceremonyMapUrl (non-blocking placeholder)
- **requirement:** optional
  - **fields:** dressCode, gifts, musicUrl, rsvpDeadline, clientColors
  - **status:** satisfied except musicUrl (non-blocking placeholder)

**Is the available information sufficient to prepare this invitation?** `yes` — no blocking gaps.
The missing map pins, street addresses, and music track have controlled placeholders.

## Placeholders

| token                             | missing datum   | blocking | reason                                      | replacement requirement                                   |
| --------------------------------- | --------------- | -------- | ------------------------------------------- | --------------------------------------------------------- |
| `[[PENDIENTE:CEREMONY_MAP_URL]]`  | ceremonyMapUrl  | no       | The client has not sent the church pin      | Replace the Maps name search with the supplied pin        |
| `[[PENDIENTE:RECEPTION_MAP_URL]]` | receptionMapUrl | no       | The client has not sent the venue pin       | Replace the Maps name search with the supplied pin        |
| `[[PENDIENTE:MUSIC_TRACK]]`       | musicUrl        | no       | The chosen song exists only as a video link | Add `music` once a hosted, licensed audio file is on hand |

## Owner Decisions

No unresolved blocking owner decisions.

- 2026-11-20 (D1): base design is the Naydelin Paredes invitation (`jewelry-box`).
- 2026-11-20 (D2): the cover name is "Maripau".
- 2026-11-20 (D3): the RSVP deadline is 20 December 2026.
- 2026-11-20 (D4): the red-dress photograph is included in the gallery.
- 2026-11-20 (D5): the mirror balls live inside the video (envelope opening and cover loop); no flat
  CSS balls.
- 2026-11-20 (D6): no itinerary section, by client request.
- 2026-11-20 (D7): no music until a hosted, licensed track is on hand.
- 2026-11-20 (D8): provisional Maps name searches and watermarked photographs stay until the client
  sends pins and originals.
- 2026-11-20 (D9): the owner authorized a Preview release. Lifecycle stays `in_progress` until the
  cover is accepted, because the publication transition requires an accepted creative outcome;
  Production still requires its own owner authorization.
- 2026-11-20 (D10): video accents in the envelope, the cover, and the closing; every other section
  stays sober black and rose gold.

## Agent Recommendations

| topic       | recommendation                                                                    | basis                                   | status              |
| ----------- | --------------------------------------------------------------------------------- | --------------------------------------- | ------------------- |
| palette     | Black surfaces, rose-gold foil accents, blush text, mirror balls inside the video | Client style request                    | Draft; not accepted |
| city        | Show "Monclova, Coahuila" and confirm both street addresses with the client       | Lodging address sent by the client      | Open with client    |
| lodging     | Show the hotel and its booking code as a location indication                      | Venue entries require a date and a time | Draft               |
| photography | Photo 84 opens; 85 closes; 81 is the interlude; 38, 79, 40, 46, 44 in the gallery | Sharpest framing per role               | Draft               |
| guest list  | Request the guest list to set seats per pass                                      | Not sent yet                            | Open with client    |

## Sections

- **bucket:** requested
  - **section keys:** personalizedAccess, family, gallery, countdown, location, rsvp, gifts,
    thankYou
- **bucket:** inferred / recommended
  - **section keys:** one interlude after the countdown; lodging as a location indication
- **bucket:** omitted
  - **section keys:** quote (none requested), itinerary (client request, D6), music (pending track),
    godparents
- **bucket:** unresolved
  - **section keys:** music: `[[PENDIENTE:MUSIC_TRACK]]`

## Design Direction

| decision               | selected source / value                           | classification |
| ---------------------- | ------------------------------------------------- | -------------- |
| Selected theme preset  | `jewelry-box` (owner-selected base design)        | verified       |
| Theme preset           | `jewelry-box`                                     | verified       |
| Visual profile         | `maripau-charles` profile                         | verified       |
| Client reference       | Naydelin Paredes functional parity                | verified       |
| Color requirement      | Rose gold and black, mirror balls, elegant        | verified       |
| Palette                | Black, onyx, graphite, rose-gold foil, blush text | inferred       |
| Typography             | Cormorant Garamond, Montserrat                    | inferred       |
| Accepted hero viewport | Not recorded yet (390 x 844)                      | missing        |

### Design Notes

- **Palette:** black carries every surface; rose gold replaces the preset's yellow gold on rules,
  titles, seal, and actions; blush ivory carries the text.
- **Ornament:** mirror balls live in two procedural clips rendered locally in rose gold and black
  (`public/videos/maripau-charles/`): `opening` plays when the seal is tapped, `hero-loop` plays
  behind the cover and, screen-blended, over the closing portrait. Countdown and gifts carry only
  soft turning reflections; the family filigree is warmed to rose gold.
- **Tonal band:** an arch from location into RSVP and gifts, then an atmospheric blend into the
  `portrait-letter` closing. All other boundaries are neutral.

| section             | canonical variant / presentation                              |
| ------------------- | ------------------------------------------------------------- |
| hero                | `framed-portrait` (photo 84)                                  |
| personalized access | `formal-pass`, admission-ticket mode (signature, MP)          |
| family              | `ceremonial-family`, `text-only`                              |
| gallery             | `paired-feature-band`; photos 38, 79, feature 40, then 46, 44 |
| countdown           | `standard`                                                    |
| interlude           | after countdown (photo 81), `tall`                            |
| location            | `stacked-venue-plates`                                        |
| RSVP                | `formal-register`; `arch` from location                       |
| gifts               | `standard`                                                    |
| thank you           | `portrait-letter` (photo 85); `atmospheric-blend` from gifts  |

## Photograph Inventory

Source label: `source:wa-export`. Delivery WebP files (quality 84, normal EXIF orientation) live in
`src/invitations/clients/maripau-charles/assets/`; source files stay outside the repository.

| source filename                        | quality              | role               | delivery file                             | weight        |
| -------------------------------------- | -------------------- | ------------------ | ----------------------------------------- | ------------- |
| 00000038-PHOTO-2026-11-20-17-44-55.jpg | provisional-whatsapp | Gallery 1          | `gallery-01.webp`                         | 49 KB         |
| 00000040-PHOTO-2026-11-20-17-45-07.jpg | provisional-whatsapp | Gallery feature    | `gallery-02.webp`                         | 42 KB         |
| 00000044-PHOTO-2026-11-20-17-45-32.jpg | provisional-whatsapp | Gallery 4          | `gallery-04.webp`                         | 38 KB         |
| 00000046-PHOTO-2026-11-20-17-45-54.jpg | provisional-whatsapp | Gallery 5          | `gallery-05.webp`                         | 56 KB         |
| 00000079-PHOTO-2026-11-20-19-17-29.jpg | provisional-whatsapp | Gallery 3          | `gallery-03.webp`                         | 46 KB         |
| 00000081-PHOTO-2026-11-20-19-17-29.jpg | provisional-whatsapp | Interlude          | `interlude-spotlight.webp` (2000 x 1600)  | 114 KB        |
| 00000084-PHOTO-2026-11-20-19-18-58.jpg | provisional-whatsapp | Hero; social share | `hero.webp`; `og-share.webp` (1200 x 630) | 111 KB; 49 KB |
| 00000085-PHOTO-2026-11-20-19-22-22.jpg | provisional-whatsapp | Thank-you portrait | `thank-you.webp`                          | 75 KB         |

### Uniqueness table

| role               | source                    | derivative                 | intentional multi-role?         |
| ------------------ | ------------------------- | -------------------------- | ------------------------------- |
| hero opening       | photo 84                  | `hero.webp`                | yes: separate social-share crop |
| social share       | photo 84                  | `og-share.webp`            | yes: separate 1200 x 630 crop   |
| gallery 1-5        | photos 38, 40, 79, 44, 46 | `gallery-01..05.webp`      | no                              |
| interlude          | photo 81                  | `interlude-spotlight.webp` | no                              |
| thank-you portrait | photo 85                  | `thank-you.webp`           | no                              |

## Implementation Constraints

- Canonical definition: `src/invitations/clients/maripau-charles/invitation.ts`
  (`defineCanonicalInvitation`, `owner-approved`, `in_progress`, `content-and-assets`).
- RSVP is `personalized-only` with `api` confirmation; `guestCap: 1` is the content default until
  the guest list arrives.
- Preview and Production releases follow `docs/domains/intake/production-flow.md` and require their
  own explicit authorization.

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING`

The video cover (390 x 844) is ready in Local for the owner's review; it is not accepted yet.

## Preparation Readiness History

- **date:** 2026-11-20
  - **readiness:** `READY_WITH_PLACEHOLDERS`
  - **helper basis:** `evaluateEventCompleteness`, `summarizeAssetQuality`,
    `evaluatePreparationReadiness`
  - **notes:** No blocking facts; three non-blocking placeholders (two map pins, music track); all
    photographs `provisional-whatsapp`
