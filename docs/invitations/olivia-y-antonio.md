# Canonical Invitation Preparation State — `olivia-y-antonio`

> Schema owner: `docs/core/invitation-preparation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Skill: `.agent/skills/invitation-preparation/SKILL.md`  
> Scope: preparation only. Implementation, managed application and publication are not yet
> authorized.

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
| dressCode             | Formal                                                         | verified       | source:wa-export            | White and red reserved (not allowed for guests)   |
| childPolicy           | none shown                                                     | not_applicable | owner-session               | No line about children; passes control attendance |
| gifts                 | Lluvia de sobres                                               | verified       | owner-session               | Envelopes only; no registry                       |
| musicUrl              | YouTube link supplied                                          | verified       | source:wa-export            | Needs a direct audio source before implementation |
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

- Music audio source (see Placeholders). Every other gap was closed by the owner on 2026-10-15.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes` (from `evaluateEventCompleteness`).

## Placeholders

| token                       | missing datum | blocking | reason            | replacement requirement                      |
| --------------------------- | ------------- | -------- | ----------------- | -------------------------------------------- |
| `[[PENDIENTE:MUSIC_AUDIO]]` | MUSIC_AUDIO   | no       | YouTube link only | Direct audio file hosted like prior weddings |

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
| unresolved             | music (audio source pending)                                    |

Planned order: quote, countdown, family, location, itinerary, gallery, gifts, personalizedAccess,
rsvp, thankYou. The dress code lives in the itinerary/location details per preset practice.

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

**Human creative outcome:** `PENDING`

| concern                                                  | decision / evidence | status  |
| -------------------------------------------------------- | ------------------- | ------- |
| Typography roles (display, heading, body, metadata)      | Preset defaults     | pending |
| Vertical rhythm and density                              |                     | pending |
| Surface hierarchy (open flow vs cards/containers)        |                     | pending |
| Photographic treatment (role, crop, focal point, filter) | See inventory       | pending |
| Section-intersection intent and narrative cadence        |                     | pending |
| Local exceptions to the selected preset                  | Palette only        | pending |

### Creative acceptance record

| field                                       | value     |
| ------------------------------------------- | --------- |
| Mechanical render/capture result            | pending   |
| Whole-invitation responsive inspection      | pending   |
| Section boundaries and narrative continuity | pending   |
| Human creative outcome                      | `PENDING` |
| Reviewer and date                           |           |
| Blocking reason or owner follow-up          |           |

## Photograph Inventory

Source label: `source:wa-export` (opaque). Fifteen HD photos of one engagement session: garden with
lake and dock, stone house, bamboo, beach at golden hour and sunset, and four save-the-date shots
with a newspaper prop. JPEG, 2496–4160 px long edge, EXIF and ICC stripped by WhatsApp. One extra
image is the palette screenshot (reference only).

| source filename | dims      | format | orientation | weight | quality              | role             | duplicate    | processing        | derivative        |
| --------------- | --------- | ------ | ----------- | ------ | -------------------- | ---------------- | ------------ | ----------------- | ----------------- |
| chat-45         | 4160×2773 | jpeg   | landscape   | 1.6 MB | provisional-whatsapp | hero desktop, og | near chat-39 | WebP cover crop   | hero-desktop.webp |
| chat-39         | 2773×4160 | jpeg   | portrait    | 1.2 MB | provisional-whatsapp | hero mobile      | near chat-45 | WebP cover crop   | hero-mobile.webp  |
| chat-43         | 2773×4160 | jpeg   | portrait    | 1.4 MB | provisional-whatsapp | family featured  | no           | WebP              | family.webp       |
| chat-36         | 4160×2773 | jpeg   | landscape   | 0.6 MB | provisional-whatsapp | interlude 1      | no           | WebP              | interlude-01.webp |
| chat-46         | 4160×2773 | jpeg   | landscape   | 0.9 MB | provisional-whatsapp | interlude 2      | near chat-34 | WebP              | interlude-02.webp |
| chat-41         | 2773×4160 | jpeg   | portrait    | 0.6 MB | provisional-whatsapp | thank-you        | no           | WebP              | thank-you.webp    |
| chat-40         | 2773×4160 | jpeg   | portrait    | 0.4 MB | provisional-whatsapp | gallery          | no           | WebP 1600         | gallery-01.webp   |
| chat-37         | 2496×4160 | jpeg   | portrait    | 0.9 MB | provisional-whatsapp | gallery          | no           | WebP 1600         | gallery-02.webp   |
| chat-42         | 2773×4160 | jpeg   | portrait    | 0.4 MB | provisional-whatsapp | gallery          | near chat-38 | WebP 1600         | gallery-03.webp   |
| chat-35         | 4160×2773 | jpeg   | landscape   | 1.6 MB | provisional-whatsapp | gallery          | no           | WebP 1400 (dense) | gallery-04.webp   |
| chat-38         | 4160×2773 | jpeg   | landscape   | 0.6 MB | provisional-whatsapp | gallery          | near chat-42 | WebP 1600         | gallery-05.webp   |
| chat-32         | 2773×4160 | jpeg   | portrait    | 1.5 MB | provisional-whatsapp | gallery          | no           | WebP 1400 (dense) | gallery-06.webp   |
| chat-44         | 4160×2773 | jpeg   | landscape   | 0.6 MB | provisional-whatsapp | gallery          | no           | WebP 1600         | gallery-07.webp   |
| chat-34         | 4160×2773 | jpeg   | landscape   | 0.9 MB | provisional-whatsapp | gallery          | near chat-46 | WebP 1600         | gallery-08.webp   |
| chat-33         | 4160×2773 | jpeg   | landscape   | 0.6 MB | provisional-whatsapp | gallery          | near chat-34 | WebP 1600         | gallery-09.webp   |

Derivatives are encoded once from the chat files within the role targets: hero desktop 468 KB at
2048×1365, hero mobile 233 KB at 1080×1620, family 275 KB, interludes 123–190 KB, thank-you 96 KB,
og 138 KB at 1200×630, gallery 40–180 KB. Two foliage-dense gallery frames (chat-35, chat-32) are
capped at 1400 px to stay inside the gallery target without dropping below quality 68. The owner
accepted the chat files as the definitive set (2026-10-15); they stay `provisional-whatsapp` by
rule. If originals ever arrive, re-encode every derivative from them with the same names and roles.

### Uniqueness table (required before READY_*)

| role            | source                             | derivative              | intentional multi-role?               |
| --------------- | ---------------------------------- | ----------------------- | ------------------------------------- |
| hero desktop    | chat-45                            | hero-desktop.webp       | yes: og-share.webp is a separate crop |
| hero mobile     | chat-39                            | hero-mobile.webp        | no (same dock, different frame)       |
| family featured | chat-43                            | family.webp             | no                                    |
| interlude 1     | chat-36                            | interlude-01.webp       | no                                    |
| interlude 2     | chat-46                            | interlude-02.webp       | no                                    |
| thank-you       | chat-41                            | thank-you.webp          | no                                    |
| gallery (9)     | 40, 37, 42, 35, 38, 32, 44, 34, 33 | gallery-01 … gallery-09 | no                                    |

## Implementation Constraints

- prepReadiness is `READY_WITH_PLACEHOLDERS`: implementation may start only with the provisional
  photos and the placeholders above documented; no placeholder may reach a published page.
- Palette changes stay invitation-scoped; the shared `jewelry-box-wedding` preset and other
  invitations must not change.
- Music: include once a direct audio source exists; until then keep the music section off.
- Venue Facebook pages are not navigation links.
- No phone numbers, chat titles or client folder paths in tracked files.

## Preparation Readiness History

| date       | readiness                 | helper basis                   | notes                                                                      |
| ---------- | ------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| 2026-10-15 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | Completeness satisfied; chat photos provisional; 6 open items              |
| 2026-10-15 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | Owner answered 9 questions; only MUSIC_AUDIO open; photos stay provisional |
