# Canonical Invitation Preparation State — `olivia-y-antonio`

> Schema owner: `docs/core/invitation-creation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Skill: `.agent/skills/invitation-preparation/SKILL.md`  
> Scope: publication authorized by the owner on 2026-10-20 (tracking board decision d076).

## Identity

| Parameter              | Value                     |
| ---------------------- | ------------------------- |
| **Slug**               | `olivia-y-antonio`        |
| **Host Login Alias**   | `olivia_martinez`         |
| **Event Type**         | `boda`                    |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS` |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

Must equal `evaluatePreparationReadiness` for the facts/assets/design recorded below.
Provisional-only assets cannot be `READY_FOR_IMPLEMENTATION`.

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

## Sources

| Source                        | Reference                     | Notes                                                                    |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| WhatsApp / conversation       | `source:wa-export`            | Received 2026-10-14; evidence only, raw export and media not committed   |
| High-res photos / assets root | `source:wa-export` (photos)   | 15 HD photos sent through the chat; EXIF/ICC stripped by WhatsApp        |
| Client palette reference      | `source:wa-palette-reference` | Social-media screenshot with five swatches; reference only, not an asset |
| Save-the-date print           | `source:wa-export` (photos)   | Newspaper prop in four photos reads "18.DICIEMBRE.2026"                  |
| Owner session                 | `owner-session`               | Plan approved 2026-10-15: slug, preset, sections, RSVP mode              |

## Fact Register

Classification is one of: `verified` | `inferred` | `ambiguous` | `missing` | `not_applicable` |
`requires_owner_decision`.

| field                 | value                                                          | classification | source                      | notes                                             |
| --------------------- | -------------------------------------------------------------- | -------------- | --------------------------- | ------------------------------------------------- |
| slug                  | olivia-y-antonio                                               | verified       | owner-session               | Follows `<nombre>-y-<nombre>` wedding practice    |
| celebrantName         | Olivia Martínez                                                | verified       | source:wa-export            | Second surname not supplied                       |
| secondaryName         | Antonio Vázquez                                                | verified       | source:wa-export            | Second surname not supplied                       |
| eventDate             | 2026-12-18                                                     | verified       | owner-session               | Friday; save-the-date print, owner confirmed      |
| eventTime             | 19:00                                                          | verified       | source:wa-export            | Religious ceremony start                          |
| timeZone              | America/Mazatlan                                               | inferred       | venue city                  | Los Mochis, Sinaloa; reconfirm before publication |
| sourceAssetPath       | src/assets/invitations/olivia-y-antonio                        | verified       | source:wa-export            | Repository derivatives of the chat photos         |
| sectionOrder          | see Sections                                                   | verified       | owner-session               | Approved with the plan on 2026-10-15              |
| primaryVenueName      | Parroquia del Santo Niño de la Salud                           | verified       | source:wa-export            | Religious ceremony                                |
| primaryVenueAddress   | Lic. Benito Juárez S/N, 81257 Los Mochis, Sinaloa              | verified       | source:wa-export            | Matches the Google Maps listing                   |
| ceremonyMapUrl        | Google Maps place link (see notes)                             | verified       | owner-session               | Pin found by agent, owner approved                |
| receptionVenueName    | Liarah Salón de Eventos                                        | verified       | source:wa-export            | Reception 21:00                                   |
| receptionVenueAddress | Carretera Topolobampo-Choix 4731, Los Mochis, Sinaloa          | verified       | owner-session               | Client wording kept; Maps lists another street    |
| receptionMapUrl       | Google Maps place link (see notes)                             | verified       | owner-session               | Pin found by agent, owner approved                |
| distinctVenues        | true                                                           | verified       | source:wa-export            | Ceremony and reception at different venues        |
| receptionTime         | 21:00                                                          | verified       | source:wa-export            | Reception start                                   |
| rsvpConfirmationMode  | api                                                            | verified       | owner-session               | Canonical RSVP API                                |
| rsvpAccessMode        | personalized-only                                              | verified       | owner-session               | Passes assigned from the host dashboard           |
| rsvpDeadline          | 2026-11-18                                                     | verified       | owner-session               | Thirty days before the event                      |
| brideParents          | Irma Miranda; Guadalupe Martínez                               | verified       | source:wa-export            |                                                   |
| groomParents          | Josefa Flores                                                  | verified       | owner-session               | Only this name; owner confirmed                   |
| godparentsVelacion    | Flor Martínez y Manuel Valenzuela; Karla Osobampo y Alfredo M. | verified       | source:wa-export            | Bride side first, groom side second               |
| godparentsLazo        | Marisela Lerma; Guadalupe Martínez                             | verified       | owner-session               | Shown as supplied, also listed as a bride parent  |
| godparentsArras       | Liliana Domínguez; Yuliana Domínguez                           | verified       | source:wa-export            |                                                   |
| godparentsBiblia      | Lizbeth Miranda; Raúl López                                    | verified       | source:wa-export            | Biblia y rosario                                  |
| dressCode             | Formal                                                         | verified       | source:wa-export            | White, red and navy/dark blue reserved            |
| childPolicy           | none shown                                                     | not_applicable | owner-session               | No line about children; passes control attendance |
| gifts                 | Lluvia de sobres; BBVA card transfer                           | verified       | source:wa-export            | Card for transfers; envelopes at the reception    |
| musicUrl              | Alex Warren — Ordinary (hosted on R2)                          | verified       | owner-session               | Direct MP3 on the production media bucket         |
| clientColors          | azul marino, azul pizarra, azul cielo, champagne, marfil       | verified       | source:wa-palette-reference | Client asked for advice; owner confirmed the fit  |

Notes:

- Full godparent row for velación: bride side Flor Martínez y Manuel Valenzuela; groom side Karla
  Osobampo y Alfredo Martínez.
- The event date appears only in the save-the-date print; the chat text says "diciembre". The owner
  confirmed Friday 18 December 2026 on 2026-10-15.
- Public Facebook pages were supplied for both venues instead of map pins; they are not used as
  navigation links. The owner chose agent-found Google Maps pins instead of asking the client.
- Ceremony pin:
  `https://www.google.com/maps/place/Parroquia+del+Santo+Ni%C3%B1o+de+la+Salud/@25.7804807,-108.9757035,17z/data=!4m6!3m5!1s0x86ba2f40212114a9:0x399dcabc76e64840!8m2!3d25.7804807!4d-108.9757035`
- Reception pin:
  `https://www.google.com/maps/place/Liarah+Sal%C3%B3n+de+Eventos/@25.733151,-109.0161631,17z/data=!4m6!3m5!1s0x86ba2576fa86f683:0x887cfeffa331e57c!8m2!3d25.733151!4d-109.0161631`
- The Maps listing for Liarah reads "Blvd. Gral. Macario Gaxiola 13, Residencial Las Misiones, 81294
  Los Mochis" (the road out to Topolobampo). The owner kept the client's wording as visible text and
  the Maps pin for navigation.
- Guadalupe Martínez appears as a bride parent and as a lazo godparent; the owner chose to show both
  as supplied without asking the client.

## Event Completeness

Contract maturity for `boda`: `partial` (from `getEventCompletenessContract`).

| requirement | fields                                                                                              | status    |
| ----------- | --------------------------------------------------------------------------------------------------- | --------- |
| required    | slug, both names, eventDate, sourceAssetPath, sectionOrder, primary venue name + address, rsvp mode | satisfied |
| conditional | receptionVenueName, receptionVenueAddress                                                           | satisfied |
| recommended | —                                                                                                   | —         |
| optional    | —                                                                                                   | —         |

### Missing blockers

- None for the `boda` completeness contract.

### Non-blocking gaps

- None. The owner closed the other gaps on 2026-10-15 and supplied the song file on 2026-10-20.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes` (from `evaluateEventCompleteness`).

## Placeholders

None. The song is a direct MP3 on the production R2 media bucket.

## Owner Decisions

Single round answered by the owner on 2026-10-15; no client round was needed.

| id  | category              | issue                               | evidence                       | options                               | outcome                           |
| --- | --------------------- | ----------------------------------- | ------------------------------ | ------------------------------------- | --------------------------------- |
| Q1  | missing-client-facts  | Confirm Friday 18 December 2026     | Date only on the save-the-date | confirm / correct                     | Confirmed                         |
| Q2  | missing-client-facts  | Google Maps pins for both venues    | Facebook pages only            | agent search / ask client             | Agent pins, approved              |
| Q3  | ambiguous-data        | Groom parents: only Josefa Flores   | Single name in the list        | as given / add a second name          | As given                          |
| Q4  | ambiguous-data        | Guadalupe Martínez: parent and lazo | Same name in two roles         | show as supplied / ask client         | Show as supplied                  |
| Q5  | missing-client-facts  | Gifts                               | Not mentioned                  | registry / envelopes / omit           | Lluvia de sobres                  |
| Q6  | missing-client-facts  | Adults-only event                   | Not mentioned                  | no line / adults only / ask client    | No line                           |
| Q7  | missing-client-facts  | RSVP deadline                       | Not mentioned                  | 2026-11-18 / 2026-12-01 / ask client  | 2026-11-18                        |
| Q8  | photograph-acceptance | Original photographer files         | Chat copies have stripped EXIF | request originals / accept chat files | Chat files accepted as definitive |
| Q9  | ambiguous-data        | Liarah address differs on Maps      | Client street vs Maps listing  | client text / Maps text / ask client  | Client text with the Maps pin     |

## Agent Recommendations

| topic         | recommendation                                                                | basis                                     | status                 |
| ------------- | ----------------------------------------------------------------------------- | ----------------------------------------- | ---------------------- |
| palette       | Navy as ink and anchors, dusty blues for bands, champagne for fine accents    | client swatches + photo whites and greens | pending owner decision |
| save-the-date | Use the newspaper photos as an editorial interlude, not as the hero           | they repeat the date in the client's prop | pending owner decision |
| venue images  | Omit venue photos or generate illustrative art; no venue photography supplied | demo has ceremony/reception image slots   | pending owner decision |

## Sections

| bucket                 | section keys                                                    |
| ---------------------- | --------------------------------------------------------------- |
| requested              | countdown, family, location, itinerary, gallery, rsvp, thankYou |
| inferred / recommended | quote, personalizedAccess, gifts (lluvia de sobres), music      |
| omitted                | —                                                               |
| unresolved             | —                                                               |

Planned order: quote, countdown, family, location, itinerary, gallery, gifts, personalizedAccess,
rsvp, thankYou. The dress code lives in the itinerary/location details per preset practice.

Current order: quote, countdown, family, location, gallery, gifts, personalizedAccess, rsvp,
thankYou. The itinerary held only the ceremony (19:00) and the reception (21:00), so it now lives in
the location route (`night-route`): one numbered stop per venue, led by its time. The location
indications carry the dress code and the personal-pass reminder.

Night round (2026-10-20): `night-envelope` reveal whose letter window flies onto the `night-arch`
cover; the shore interlude darkens to navy on scroll; venue cards offer «Agendar en el calendario»;
the RSVP register unfolds on scroll; Regalos carries a fine-line envelope mark; the gallery keeps
seven photographs (one dance instead of three). RSVP and chrome text follow the three type voices
and the 12 px floor.

Suite round (2026-10-20): Cinzel now loads for the labels (it fell back to a system serif); the
location is titled «Dónde celebraremos» with the date in the lede, each stop is titled by its venue
with the time as a champagne lead, «Cómo llegar» is the filled action, the calendar follows as a
link and the copy button reads «Copiar»; the personal pass is a navy ticket; the RSVP register sits
in a navy panel with 12 px labels; the footer continues the closing in deep navy. The locked RSVP
message now reads «a más tardar el miércoles 18 de noviembre», like the other deadline texts. The
RSVP notes field reads «Mensaje para Olivia y Antonio» with a placeholder for «los novios». On
scroll, only the RSVP card rises over the pinned pass (`stack` intersection with a clear surface):
the pass sinks back to 94 %, dims and fades out under the card, and the register column is the
card's width, so the card is centered over the pass on desktop. Without a personal link there is no
pass, so the RSVP follows the gifts in normal flow. The footer is held below the closing, like
America's: a pull raises a champagne crescent moon on its thread (the crescent the closing lacked),
and the footer opens on that moon with «Bajo la misma luna», «¿Nos acompaña el 18 de diciembre?»,
the reply button and «Antes del miércoles 18 de noviembre» while the guest has not answered; after a
yes it keeps «Su lugar bajo esta luna ya está apartado.». Without a personal link the reply stays
away. Under the reply the footer reads in three levels: «Con cariño» with the champagne «Volver a
ver la apertura» link, a short rule, and then the platform (brand, a plain «Contáctenos» link and
the rights) in a dim mist, so the reply's button is the only call to action.

## Design Direction

| decision                          | value                                                    | classification          |
| --------------------------------- | -------------------------------------------------------- | ----------------------- |
| Selected theme preset             | `jewelry-box-wedding` (client accepted its wedding demo) | verified                |
| Recommended preset alternatives   | —                                                        | not_applicable          |
| Selected variant / visual profile | Invitation-scoped blue palette over the preset           | requires_owner_decision |
| Client color requirements         | azul marino, azul pizarra, azul cielo, champagne, marfil | verified                |
| Recommended palette               | See Agent Recommendations                                | recommendation only     |
| Unresolved visual decisions       | Venue images, save-the-date interlude                    | requires_owner_decision |

## Creative Direction & Acceptance

**Visual idea:** "Noche azul de diciembre" (PR #361): navy titles in Playfair over ivory, Cinzel
labels in a deep champagne ink, a large days counter with a ring calendar, a paired gallery and a
full-bleed navy closing.

**Human creative outcome:** `ACCEPTED`

| concern                                                  | decision / evidence                                                         | status  |
| -------------------------------------------------------- | --------------------------------------------------------------------------- | ------- |
| Typography roles (display, heading, body, metadata)      | Playfair 500 navy titles; Cinzel labels in champagne ink (4.5:1 on ivory)   | applied |
| Vertical rhythm and density                              | Page at 390 px is 10,437 px tall with the night round (7-photo gallery)     | applied |
| Surface hierarchy (open flow vs cards/containers)        | Open ivory flow; compact time-led venue cards; formal RSVP register         | applied |
| Photographic treatment (role, crop, focal point, filter) | One role per photograph (see inventory); champagne hairline frame on photos | applied |
| Section-intersection intent and narrative cadence        | `composition.intersections` in the definition is the executable record      | applied |
| Local exceptions to the selected preset                  | Invitation profile retints the preset blue; godparents grouped by role      | applied |

### Creative acceptance record

| field                                       | value                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| Mechanical render/capture result            | pass — PR #361 captures at 390 and 1280 px, 2026-10-19                        |
| Whole-invitation responsive inspection      | Owner review of the published v0.34 design on an Android phone, 2026-10-20    |
| Section boundaries and narrative continuity | pass; night round (arch, night envelope, dusk shore) ships as a republication |
| Human creative outcome                      | `ACCEPTED`                                                                    |
| Reviewer and date                           | Francisco Mendoza (owner), 2026-10-20, tracking board decisions d075 and d076 |
| Blocking reason or owner follow-up          | None                                                                          |

## Photograph Inventory

Source label: `source:wa-export` (opaque). Fifteen HD photos of one engagement session: garden with
lake and dock, stone house, bamboo, beach at golden hour and sunset, and four save-the-date shots
with a newspaper prop. JPEG, 2496–4160 px long edge, EXIF and ICC stripped by WhatsApp. One extra
image is the palette screenshot (reference only).

| source filename | dims      | format | orientation | weight | quality              | role            | duplicate    | processing        | derivative        |
| --------------- | --------- | ------ | ----------- | ------ | -------------------- | --------------- | ------------ | ----------------- | ----------------- |
| chat-45         | 4160×2773 | jpeg   | landscape   | 1.6 MB | provisional-whatsapp | og              | near chat-39 | WebP cover crop   | og-share.webp     |
| chat-39         | 2773×4160 | jpeg   | portrait    | 1.2 MB | provisional-whatsapp | hero arch       | near chat-45 | WebP 2:3 crop     | hero-arch-*.webp  |
| chat-43         | 2773×4160 | jpeg   | portrait    | 1.4 MB | provisional-whatsapp | family featured | no           | WebP              | family.webp       |
| chat-36         | 4160×2773 | jpeg   | landscape   | 0.6 MB | provisional-whatsapp | interlude 1     | no           | WebP              | interlude-01.webp |
| chat-46         | 4160×2773 | jpeg   | landscape   | 0.9 MB | provisional-whatsapp | interlude 2     | near chat-34 | WebP              | interlude-02.webp |
| chat-41         | 2773×4160 | jpeg   | portrait    | 0.6 MB | provisional-whatsapp | thank-you       | no           | WebP              | thank-you.webp    |
| chat-40         | 2773×4160 | jpeg   | portrait    | 0.4 MB | provisional-whatsapp | gallery         | no           | WebP 1600         | gallery-01.webp   |
| chat-37         | 2496×4160 | jpeg   | portrait    | 0.9 MB | provisional-whatsapp | gallery         | no           | WebP 1600         | gallery-02.webp   |
| chat-42         | 2773×4160 | jpeg   | portrait    | 0.4 MB | provisional-whatsapp | gallery         | near chat-38 | WebP 1600         | gallery-03.webp   |
| chat-35         | 4160×2773 | jpeg   | landscape   | 1.6 MB | provisional-whatsapp | gallery         | no           | WebP 1400 (dense) | gallery-04.webp   |
| chat-38         | 4160×2773 | jpeg   | landscape   | 0.6 MB | provisional-whatsapp | gallery         | near chat-42 | WebP 1600         | gallery-05.webp   |
| chat-32         | 2773×4160 | jpeg   | portrait    | 1.5 MB | provisional-whatsapp | gallery         | no           | WebP 1400 (dense) | gallery-06.webp   |
| chat-44         | 4160×2773 | jpeg   | landscape   | 0.6 MB | provisional-whatsapp | gallery         | no           | WebP 1600         | gallery-07.webp   |
| chat-34         | 4160×2773 | jpeg   | landscape   | 0.9 MB | provisional-whatsapp | gallery         | near chat-46 | WebP 1600         | gallery-08.webp   |
| chat-33         | 4160×2773 | jpeg   | landscape   | 0.6 MB | provisional-whatsapp | gallery         | near chat-34 | WebP 1600         | gallery-09.webp   |

Derivatives are encoded once from the chat files within the role targets: the night-arch hero photo
in two widths of one 2:3 frame, 69 KB at 600×900 (phones) and 111 KB at 900×1350 (wide screens),
family 275 KB, interludes 123–190 KB, thank-you 96 KB, og 138 KB at 1200×630, gallery 40–180 KB. Two
foliage-dense gallery frames (chat-35, chat-32) are capped at 1400 px to stay inside the gallery
target without dropping below quality 68. The owner accepted the chat files as the definitive set
(2026-10-15); they stay `provisional-whatsapp` by rule. If originals ever arrive, re-encode every
derivative from them with the same names and roles.

### Uniqueness table (required before READY_*)

| role            | source                             | derivative                                    | intentional multi-role?         |
| --------------- | ---------------------------------- | --------------------------------------------- | ------------------------------- |
| hero arch       | chat-39                            | hero-arch-mobile.webp, hero-arch-desktop.webp | no (one frame, two widths)      |
| og              | chat-45                            | og-share.webp                                 | no (same dock, different frame) |
| family featured | chat-43                            | family.webp                                   | no                              |
| interlude 1     | chat-36                            | interlude-01.webp                             | no                              |
| interlude 2     | chat-46                            | interlude-02.webp                             | no                              |
| thank-you       | chat-41                            | thank-you.webp                                | no                              |
| gallery (9)     | 40, 37, 42, 35, 38, 32, 44, 34, 33 | gallery-01 … gallery-09                       | no                              |

## Implementation Constraints

- prepReadiness is `READY_WITH_PLACEHOLDERS`: implementation may start only with the provisional
  photos and the placeholders above documented; no placeholder may reach a published page.
- Palette changes stay invitation-scoped; the shared `jewelry-box-wedding` preset and other
  invitations must not change.
- Music: Alex Warren — Ordinary, served from the production R2 media bucket with autoplay.
- Venue Facebook pages are not navigation links.
- No phone numbers, chat titles or client folder paths in tracked files.

## Preparation Readiness History

| date       | readiness                 | helper basis                   | notes                                                                      |
| ---------- | ------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| 2026-10-15 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | Completeness satisfied; chat photos provisional; 6 open items              |
| 2026-10-15 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | Owner answered 9 questions; only MUSIC_AUDIO open; photos stay provisional |
