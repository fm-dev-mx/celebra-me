# Canonical Invitation Preparation State — `allison-scarlett`

## Identity

| Parameter              | Value                                                  |
| ---------------------- | ------------------------------------------------------ |
| **Slug**               | `allison-scarlett`                                     |
| **Host Login Alias**   | `allison_scarlett` (working alias; no account created) |
| **Event Type**         | `xv`                                                   |
| **Preparation Status** | `NOT_READY`                                            |

**Preparation Readiness (prepReadiness):** `NOT_READY`

The owner authorized creation with temporary data and requested no further questions. This does not
establish the missing real venue address or promote provisional photographs. A managed definition,
local source assets and invitation profile now implement the explicitly requested local draft. No
account or persisted invitation has been created. Preparation remains NOT_READY for real-data
completeness; temporary values are not verified client facts.

## Sources

| Source               | Reference                                                                                                                                               | Use                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Client conversation  | source:wa-export                                                                                                                                        | Event facts and three client photographs                                    |
| Visual reference     | source:reference-captures                                                                                                                               | Five screenshots; inspiration only                                          |
| Owner decisions      | source:owner-session                                                                                                                                    | Cinderella reinterpretation, temporary data, conservative photo improvement |
| Public venue listing | [BuscoSalon](https://buscosalon.com.mx/ciudad-de-mexico/ciudad-de-mexico/salon-jardin-luigi/)                                                           | Francisco I. Madero 4; unconfirmed candidate                                |
| Public venue listing | [Waze](https://www.waze.com/es/live-map/directions/salon-jardin-luigi-venustiano-carranza-4-gustavo-a.-madero?to=place.w.170983619.1709574051.10130597) | Venustiano Carranza 4; contradictory street                                 |

No higher-resolution source is available according to the owner. Do not request it again. Do not
persist raw chat exports, source-directory paths, or business screenshots as invitation assets.

## Fact Register

| field                | value                                                                              | classification | source          | notes                                                                         |
| -------------------- | ---------------------------------------------------------------------------------- | -------------- | --------------- | ----------------------------------------------------------------------------- |
| slug                 | allison-scarlett                                                                   | inferred       | owner-session   | Working identity based on supplied spelling; no inferred surnames             |
| celebrantName        | Allison Scarlett                                                                   | verified       | wa-export       | Preserve double t                                                             |
| eventLabel           | Mis XV Años                                                                        | verified       | wa-export       | XV event                                                                      |
| eventDate            | 2026-11-27                                                                         | verified       | wa-export       | Friday                                                                        |
| eventTime            | 18:00                                                                              | verified       | wa-export       | Religious ceremony                                                            |
| receptionTime        | 19:00                                                                              | inferred       | wa-export       | Client wrote 7:00; p.m. is a temporary interpretation                         |
| timeZone             | America/Mexico_City                                                                | inferred       | public-listings | Conditional on candidate venue being correct                                  |
| baseDemoId           | demo-xv-celestial-blue                                                             | inferred       | owner-session   | Technical base of accepted working plan, not a client-selected demo           |
| sourceAssetPath      | source:wa-export                                                                   | verified       | owner-session   | Only available photographs; provisional quality                               |
| sectionOrder         | family, personalizedAccess, countdown, location, gallery, gifts, rsvp, thankYou    | inferred       | owner-session   | Working design; opening and hero precede these sections                       |
| primaryVenueName     | Salón Jardín Luigi                                                                 | verified       | wa-export       | Both ceremony and reception                                                   |
| primaryVenueAddress  | [[PENDIENTE:VENUE_ADDRESS]]                                                        | ambiguous      | public-listings | Francisco I. Madero 4 versus Venustiano Carranza 4; original pin not verified |
| distinctVenues       | false                                                                              | verified       | wa-export       | Two event moments at the same venue                                           |
| ceremonyMapUrl       | https://maps.app.goo.gl/N4W3Dz8kQi6b3bPy6?g_st=aw                                  | verified       | wa-export       | Supplied link verified as evidence only; destination unverified               |
| fatherName           | Edgar Juarez                                                                       | verified       | wa-export       | Preserve supplied spelling                                                    |
| motherName           | Erika Mejia                                                                        | verified       | wa-export       | Preserve supplied spelling                                                    |
| godparents           | Geovanny Castillo; Sherly Velazquez                                                | verified       | wa-export       | Capitalization normalized only                                                |
| dressCode            | Azul y plata reservados para la quinceañera                                        | verified       | wa-export       | Do not add formal or sport-elegant requirement                                |
| gifts                | Hello Kitty; maquillaje; bolsas; productos de cuidado de la piel; lluvia de sobres | verified       | wa-export       | No registry or bank details                                                   |
| rsvpConfirmationMode | api                                                                                | verified       | wa-export       | Existing invitation-based confirmation accepted                               |
| rsvpGuestCap         | 2                                                                                  | inferred       | owner-session   | Synthetic working example only; not actual event capacity or assigned passes  |
| rsvpWhatsappPhone    | —                                                                                  | not_applicable | wa-export       | No public WhatsApp confirmation flow                                          |
| musicUrl             | —                                                                                  | not_applicable | owner-session   | Omit until a track is selected; reference audio is not a selection            |

## Event Completeness

XV contract maturity: `evidence-backed`. Available information is not sufficient to release the
invitation under the current preparation contract: the required venue address remains ambiguous.
Temporary defaults are explicitly recorded and do not resolve real-world uncertainty. Reception
time, event zone, working guest cap, and commercial contact data need resolution before release.

## Placeholders

| token                         | missing datum   | blocking | reason                       | replacement requirement                                              |
| ----------------------------- | --------------- | -------- | ---------------------------- | -------------------------------------------------------------------- |
| [[PENDIENTE:VENUE_ADDRESS]]   | VENUE_ADDRESS   | yes      | Contradictory public streets | Establish the address corresponding to the client's venue pin        |
| [[PENDIENTE:CLIENT_WHATSAPP]] | CLIENT_WHATSAPP | no       | Not included in export       | Supply verified commercial contact before managed account operations |

Temporary preview-only values: guest name `Invitado de prueba`, two passes, email
`allison-preview@example.invalid`. No outbound messages or account creation. For layout planning,
address text may read `Dirección de ejemplo — pendiente de confirmar`; this must never be treated as
a navigable address or verified fact.

## Owner Decisions

- Creation and conservative photograph improvement requested; no further intake questions requested.
- Shared QR album deferred explicitly. No provider, destination, upload flow, or fake functional QR.
- No release, Git mutation, persistent database mutation, or shared-state operation authorized.
- Human acceptance of image derivatives and final visual composition remains pending.

## Agent Recommendations

Use the existing celestial-blue skin and supported section variants; do not clone another client's
data or create a shared renderer to implement this invitation. Keep the working alias independent of
the eventual account operation. Retain the two listed address candidates without choosing one as
verified. No assumptions about private client contacts or surnames.

## Sections

Satin envelope and ceremonial photographic hero, then family, personalized access, countdown,
location with ceremony/reception and clothing restriction, two-image gallery, gifts, RSVP, and a
carriage closing. No itinerary, registry, music, or album section until resolved. Countdown uses the
ceremony instant. With the provisional Mexico City zone, ceremony would be `2026-11-28T00:00:00Z`
and reception `2026-11-28T01:00:00Z`; both display November 27 locally. Never change the visible
date to November 28 through UTC formatting.

## Design Direction

Palace ballroom in ice blue, deep blue, and silver. Allison is the focal point. Use a satin-blue
envelope, AS monogram, and one crystal detail; sparse carriage/slipper motifs with consistent
treatment. No continuous busy floral borders, scattered characters, text outlines, or heavy sparkle
layers. Keep script to the name, serif headings, and readable body text. Use the independent
`ceremonial-portrait` hero with a complete rectangular photograph. Keep text away from face and
dress. Gallery preserves the two remaining photographs without repetition. Opening and transitions
are brief; reduced motion exposes content without animation delay.

## Photograph Inventory

All source files are JPEG, 1476 × 1600 pixels, portrait orientation. Hashes differ and visual review
confirms three distinct poses. No beauty reshaping or generative reconstruction is allowed.

| source filename                        | bytes  | quality              | observed content                     | role           |
| -------------------------------------- | ------ | -------------------- | ------------------------------------ | -------------- |
| 00000023-PHOTO-2026-09-08-13-42-08.jpg | 263428 | provisional-whatsapp | Seated, facing camera, dress visible | Hero           |
| 00000021-PHOTO-2026-09-08-13-42-08.jpg | 210762 | provisional-whatsapp | Side portrait with bouquet           | Gallery first  |
| 00000022-PHOTO-2026-09-08-13-42-08.jpg | 219346 | provisional-whatsapp | Back of dress and face in profile    | Gallery second |

### Photo uniqueness table

| role           | source   | proposed derivative | intentional reuse                |
| -------------- | -------- | ------------------- | -------------------------------- |
| hero desktop   | photo 23 | hero.webp           | Same optimized binary as mobile  |
| hero mobile    | photo 23 | hero.webp           | Same optimized binary as desktop |
| gallery first  | photo 21 | gallery-01.webp     | No                               |
| gallery second | photo 22 | gallery-02.webp     | No                               |

The three original JPEGs remain byte-for-byte identical to the ZIP sources (SHA-256 checked).
Delivery copies use WebP quality 84 at the original 1476 × 1600 dimensions: hero 209428 bytes,
gallery first 155412 bytes, gallery second 162582 bytes. This is compression only: no generative
photo editing, exposure change, background replacement, crop, enlargement or anatomical alteration.
Business images 55, 56 and 57 are excluded. Source quality remains provisional; compression does not
promote preparation readiness. Human comparison of originals and derivatives remains pending. Role
ceilings remain mobile hero 350 KB, desktop hero 500 KB and gallery 180 KB.

## Implementation Constraints

The owner repeatedly and explicitly authorized local draft creation with temporary data after the
preparation limitation was explained. This task uses that bounded authorization for local authoring
only; preparation helpers and publication safeguards are unchanged. Do not classify dummy facts as
real or publish them. The draft uses the canonical managed definition and registry,
`lifecycle: in_progress`, typed semantic asset keys and section-owned variants. Profile SCSS owns
palette and rhythm only. No new API, database schema, RSVP implementation, or third-party dependency
is planned. Persistent Local, Preview, Storage and Production operations remain separately gated.

## Creative Direction & Acceptance

Human creative outcome: `PENDING`. The local route `/xv/allison-scarlett` renders using an isolated
read-only fixture transport; no persistent database is involved. Opening was exercised, all three
photographs loaded, and the November 27 display date was checked. Screenshots and horizontal
overflow checks were collected at 390, 414 and 1440 pixels wide. Personalized RSVP submission was
intentionally not exercised: this transport rejects mutations and has no guest accounts. Required
review: 390 × 844, 414 × 896 and 1440 × 900; full names and venue text without clipping, face-safe
crops, body-text contrast at least 4.5:1 and large-text contrast at least 3:1, keyboard access,
reduced motion and no content hidden when motion fails. Validate opening, venue links, local-date
consistency, countdown and personalized RSVP only in an authorized test environment. Automated
success does not grant human acceptance or clear temporary-data release blockers.

## Preparation Readiness History

| date       | readiness | helper basis                                                                    | notes                                                              |
| ---------- | --------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 2026-09-10 | NOT_READY | Ambiguous required venue address; blocking placeholder; provisional photographs | Canonical preparation record created; no production implementation |

## Cinderella Redesign Evidence

The [art direction board](allison-scarlett/art-direction.webp) established the satin envelope,
crystal seal, ceremonial hero and transition to family before implementation. The generated
ornaments use a consistent silver-and-crystal illustration treatment; all invitation text is live
HTML.

| Asset key                  | File                   | Bytes  | Role                                |
| -------------------------- | ---------------------- | ------ | ----------------------------------- |
| seal                       | seal-delivery.webp     | 73104  | Crystal medallion; live AS monogram |
| carriage / closingCarriage | carriage-delivery.webp | 137220 | Hero and closing; one shared binary |
| slipper                    | slipper-delivery.webp  | 56084  | Secondary hero ornament             |
| ambience                   | palace-ambience.webp   | 61696  | Subtle palace and satin curtains    |
| shared filigree            | silver-filigree.webp   | 51254  | Typed shared silver crest           |

Artwork was created with imagegen, then resized/compressed for delivery. The common direction was
polished silver, faceted clear crystal, powder-blue reflections and consistent soft lighting;
carriage, seal, slipper and filigree have transparent surroundings, while the palace provides depth.
No compressed reference screenshots were extracted. No ornament uses high fetch priority.

Geometry belongs to `satin-filigree`, `ceremonial-portrait`, `ceremonial-family`, `clock-face`,
`paired-portraits` and `ceremonial-closing`; the Allison profile owns palette and rhythm. Existing
`framed-portrait` behavior is unchanged. `formal-pass` reuses the guest contract. The local
development harness alone enables the synthetic two-seat admission example. The hero was rendered
with another preset, no Allison profile and no photograph.

| Criterion              | Reference                         | Previous draft           | Implemented result                                                  |
| ---------------------- | --------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| Cinderella recognition | Carriage, slipper, palace, jewels | Primarily blue palette   | Crystal carriage, slipper, palace and AS seal                       |
| Materials              | Ornamental but compressed         | Pale card surfaces       | Satin envelope, silver borders, crystal and blue paper              |
| Photography            | Different client's example        | Arched editorial framing | Complete seated hero and two distinct full gallery images           |
| Typography             | Outlined and crowded              | Oversized serif name     | Pinyon name, Cormorant headings, Instrument instructions            |
| Continuity             | Dense repeated borders            | Generic separated blocks | Blue family paper, admission card, clock dial and deep-blue closing |

Local evidence lives in `.agent/tmp/allison-review/` (ephemeral, not published):
`final-{390,414,1440}-{closed,hero,full}.png`, `portable-no-photo.png`, `reduced-motion.png`,
`no-javascript.png`, capture and validation logs. Captures wait for fonts, images and section
reveal. Keyboard opening, replay, immediate reduced-motion access and the no-JavaScript fallback
were exercised. The three requested viewport sizes had no horizontal overflow. All three photographs
loaded with their source proportions. November 27 and the ceremony countdown instant were checked.
Computed-color checks supplement visual review; they do not certify every gradient pixel or replace
human accessibility assessment. Decorative separators are excluded from text-contrast requirements.

The fixture accepts reads only. No RSVP submission, persistent write, album integration or
deployment was performed. Automated checks do not constitute aesthetic approval: final human
acceptance remains `PENDING`, and the provisional venue details and QR album remain unresolved.

Final local checks: `pnpm run type-check` passed (Astro: 1739 files, zero diagnostics;
TypeScript passed). `pnpm run validate:changed` passed 177 related suites / 2267 tests and
25 local-render regression tests. Focused Stylelint passed after the last control-size adjustment.
Visible buttons and links were measured at 390 and 1440 pixels: no target below 44 × 44 pixels.
The computed-color scan found no failing normal/large text; its only flagged item was an
aria-hidden decorative separator. Full CI, production performance and live RSVP were not run.


## Approved Direction — Refinement Pass

The owner approved the Cinderella art direction and authorized refinement, not redesign.
The seated portrait, three original photographs, envelope, crystal assets, typography, palette,
content order and RSVP behavior remain. This pass removes the outer hero card, groups the name/date
more closely, gives the full portrait more usable width, and reuses the palace ambience at low opacity.
Gallery portraits alternate alignment with unboxed captions. Venue and gift surfaces lose redundant
card borders/shadows. The venue label uses existing canonical `label` data; unresolved address tokens
render as readable pending text without a copy action. The countdown date is no longer duplicated.

Cadence: hero → family uses a shallow asymmetric arch; location → gallery uses an atmospheric bridge;
RSVP → closing uses the second shallow arch. Other boundaries remain neutral. No media or controls
are covered by decorative intersections. Profile tokens own surfaces; semantic variants own geometry.
`hero.ambience` is an optional typed asset and does not select a renderer or require Allison's profile.

Client reconciliation: names, November 27, ceremony at 18:00, shared venue, reserved blue/silver,
gift preferences and cash envelopes remain. Reception at 19:00, city and address remain provisional.
No itinerary section or registry is added. The client accepted in-invitation RSVP after asking about
telephone confirmation. The shared QR album remains a client requirement deferred by the owner;
it is not considered removed or delivered. Host operations and live RSVP remain unverified locally.

The previous direction is owner-approved. Human acceptance of this refinement remains pending.
Visual evidence: `.agent/tmp/allison-review/refined-{390,414,1440}-{closed,hero,full}.png`.
The review now uses the existing development-only `/test/variant` full-page harness, including an
explicit synthetic pass. The normal unpublished route has no persisted invitation; no database was
modified to make it available. This harness does not authorize publication or real confirmations.

Refinement validation: `pnpm run type-check` passed with zero Astro/TypeScript diagnostics.
`pnpm run validate:changed` passed 2390 related tests and 25 corpus tests. `pnpm test` passed
6322 tests, with one suite/test skipped by its existing configuration. Full `pnpm run ci` initially
stopped at the family-partial inventory omission; that inventory was corrected and the full unit
suite rerun successfully. CI static checks/build passed; the complete CI browser matrix was not run.
Focused style/contract checks were repeated after the closing clearance and preview-text contrast fixes.
Browser inspection covers both portable presets without a photograph, reduced-motion opening,
readable pending address, absence of its copy action, and preserved ceremony/reception labels.
The computed contrast sampler cannot resolve the admission-card gradient; that surface requires
visual assessment rather than treating the underlying dark fallback as its rendered color.

Final reduced-motion browser check exposed an existing SSR/hydration mismatch in the attendance
fieldset's initial opacity. A reduced-motion-only CSS visibility override now keeps that field visible
without changing submission or guest logic; the browser measured opacity 1 after the fix. Hydration
attribute warnings in the existing animation implementation remain a technical follow-up.
The closing arch now has 6.5rem of static clearance, keeping the form outside its decorative zone.
Focused Stylelint and style-boundary tests passed after these final presentation changes.
