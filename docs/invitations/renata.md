# Canonical Invitation Preparation State — `renata`

> Schema owner: `docs/core/invitation-preparation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Workflow: `.agent/workflows/invitation-preparation.md`

---

## Identity

| Parameter              | Value       |
| ---------------------- | ----------- |
| **Slug**               | `renata`    |
| **Host Login Alias**   | `renata`    |
| **Event Type**         | `xv`        |
| **Preparation Status** | `NOT_READY` |

**Preparation Readiness (prepReadiness):** `NOT_READY`

Helper outcome: required RSVP configuration (`rsvpConfirmationMode`, `rsvpGuestCap`) remains
`missing`. Goal 2 authorized Local authoring and visual refinement only. Do not call
`assertImplementationAllowed`. Do not publish Preview or Production.

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document.

Canonical route: `/xv/renata` — slug must not include `eventType`. Public display name is **Renata**
only; do not require or infer a surname.

---

## Sources

| Source                        | Reference              | Notes                                                                 |
| ----------------------------- | ---------------------- | --------------------------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export`     | Evidence only — never photo SoT; audio `00000079` not transcribed     |
| High-res photos / assets root | `source:hr-photos`     | Opaque label; authorized session folder is not persisted here         |
| Owner session (Goal 1–2)      | `source:owner-session` | Theme, demo, variants, section hypothesis, TZ `America/Mazatlan` lock |

---

## Fact Register

| field                 | value                                                                                      | classification | source            | notes                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------ | -------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| slug                  | renata                                                                                     | verified       | wa-export + owner | Given name only; no eventType prefix                                                        |
| hostLoginAlias        | renata                                                                                     | verified       | owner             | No surname supplied; preferred `{nombre}_{apellido}` cannot be formed without inventing one |
| celebrantName         | Renata                                                                                     | verified       | wa-export         | Do not infer a surname from the parents                                                     |
| eventLabel            | XV años de Renata                                                                          | verified       | owner             |                                                                                             |
| eventDate             | 2026-09-05                                                                                 | verified       | wa-export         | Saturday 5 September 2026                                                                   |
| eventTime             | 19:00                                                                                      | verified       | wa-export         | Reception / primary countdown instant                                                       |
| ceremonyTime          | 17:00                                                                                      | verified       | wa-export         | Misa                                                                                        |
| timeZone              | America/Mazatlan                                                                           | inferred       | geography         | IANA zone covering Sinaloa / Culiacán; not client-stated                                    |
| baseDemoId            | demo-xv-editorial                                                                          | verified       | owner             | Goal 2 lock; client did not pick a demo                                                     |
| sourceAssetPath       | source:hr-photos                                                                           | verified       | owner             | Opaque label only                                                                           |
| sectionOrder          | family, countdown, location, itinerary, gallery, gifts, personalizedAccess, rsvp, thankYou | inferred       | owner             | Starting hypothesis; quote and music omitted                                                |
| primaryVenueName      | Parroquia Santa Inés                                                                       | inferred       | maps-title        | Name taken from the Maps page title of the client link; address is verified                 |
| primaryVenueAddress   | Blvd. Pedro Infante 2550, Los Alamos, 80100 Culiacán, Sinaloa                              | verified       | wa-export         | Ceremony                                                                                    |
| receptionVenueName    | InHouse Select Hacienda Tres Ríos                                                          | verified       | wa-export         | Salón la cabaña del abuelo                                                                  |
| receptionVenueAddress | Blvd. José Limon 910 norte, Desarrollo Urbano Tres Ríos, 80020 Culiacán Rosales, Sinaloa   | verified       | wa-export         |                                                                                             |
| distinctVenues        | true                                                                                       | verified       | wa-export         | Misa and reception are distinct                                                             |
| ceremonyMapUrl        | https://maps.app.goo.gl/jkS3UvSKdTzcZxu9A                                                  | verified       | wa-export         | Client Maps link                                                                            |
| receptionMapUrl       | https://maps.app.goo.gl/oEA3Y3DhgMEGn6Lc7                                                  | verified       | wa-export         | Client Maps link                                                                            |
| fatherName            | Ramón Arturo Sainz Quevedo                                                                 | verified       | wa-export         | Listed first                                                                                |
| motherName            | Dulce Patricia Echevarria Espinoza                                                         | verified       | wa-export         |                                                                                             |
| godparents            | Saul Chaidez García; Yuliana Argelia González Beltrán                                      | verified       | wa-export         |                                                                                             |
| dressCode             | FORMAL; no vestir color rosa                                                               | verified       | wa-export         | Clothing restriction; not an automatic UI-pink ban                                          |
| gifts                 | lluvia de sobres / efectivo                                                                | verified       | wa-export         |                                                                                             |
| musicUrl              | —                                                                                          | not_applicable | wa-export         | No music supplied; section omitted                                                          |
| clientColors          | cream, blush, olive, coral, silver                                                         | verified       | owner-session     | Floral/stationery brief; session yellow stays in photography only                           |
| rsvpConfirmationMode  | —                                                                                          | missing        | —                 | Do not invent                                                                               |
| rsvpGuestCap          | —                                                                                          | missing        | —                 | Do not invent                                                                               |
| rsvpWhatsappPhone     | —                                                                                          | not_applicable | —                 | WhatsApp destination not invented while confirmation mode is unresolved                     |

Rules:

- `verified` requires explicit client/source evidence.
- `inferred` must include its basis and must never be phrased as a client statement.
- Absence of information never implies consent or preference.

---

## Event Completeness

Contract maturity for this event type: `evidence-backed` (`xv`).

| requirement | fields                                                                                                                                            | status               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| required    | slug, celebrantName, eventLabel, eventDate, eventTime, timeZone, baseDemoId, sourceAssetPath, sectionOrder, primaryVenueName, primaryVenueAddress | resolved             |
| required    | rsvpConfirmationMode, rsvpGuestCap                                                                                                                | **blocking missing** |
| conditional | receptionVenueName, receptionVenueAddress                                                                                                         | resolved             |
| recommended | fatherName, motherName, godparents, ceremonyMapUrl                                                                                                | resolved             |
| optional    | dressCode, gifts                                                                                                                                  | resolved             |
| optional    | musicUrl                                                                                                                                          | not_applicable       |
| optional    | clientColors                                                                                                                                      | resolved             |

### Missing blockers

- `rsvpConfirmationMode`
- `rsvpGuestCap`

### Non-blocking gaps

- Quote omitted
- Music omitted
- Untranscribed voice note
- Parish name remains inferred until human confirmation

Deterministic question: **Is the available information sufficient to prepare this invitation?**  
Answer: `no` (`evaluateEventCompleteness` blocking RSVP gaps).

---

## Placeholders

| token | missing datum | blocking | reason | replacement requirement |
| ----- | ------------- | -------- | ------ | ----------------------- |

No `[[PENDIENTE:]]` tokens. RSVP gaps are recorded as missing facts, not placeholders.

---

## Owner Decisions

| id          | category             | issue                                  | evidence                        | options                            | recommendation                            |
| ----------- | -------------------- | -------------------------------------- | ------------------------------- | ---------------------------------- | ----------------------------------------- |
| RSVP-MODE   | missing-client-facts | Confirmation mode unknown              | No client answer                | api / whatsapp / both              | Do not invent; keep Local RSVP as a shell |
| RSVP-CAP    | missing-client-facts | Guest cap unknown                      | No client answer                | numeric cap                        | Do not invent                             |
| PARISH-NAME | ambiguous-data       | Ceremony name inferred from Maps title | Client sent address + Maps link | keep inferred / confirm Santa Inés | Keep inferred until human confirm         |

---

## Agent Recommendations

| topic   | recommendation                                         | basis                                                | status                    |
| ------- | ------------------------------------------------------ | ---------------------------------------------------- | ------------------------- |
| demo    | demo-xv-editorial                                      | photograph-forward editorial; Goal 2 lock            | accepted by owner session |
| palette | cream/blush/olive/coral/silver; ink for photo chapters | client floral brief; no gold; yellow stays in photos | accepted for Goal 2B      |
| hero    | 1000511838 as production hero                          | only worn-sunglasses frame is WhatsApp-class         | accepted                  |

---

## Sections

| bucket                 | section keys                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| requested              | family, countdown, location, itinerary, gallery, gifts, personalizedAccess, rsvp, thankYou |
| inferred / recommended | one interlude after location                                                               |
| omitted                | quote, music                                                                               |
| unresolved             | RSVP operational fields                                                                    |

---

## Design Direction

| decision                          | value                                                                         | classification      |
| --------------------------------- | ----------------------------------------------------------------------------- | ------------------- |
| Owner-selected base demo          | demo-xv-editorial                                                             | verified            |
| Recommended demo alternatives     | editorial-magazine rejected (grayscale); premiere-floral rejected (rose+gold) | recommendation only |
| Selected variant / visual profile | visualProfileId `renata`; theme `editorial`                                   | verified            |
| Client color requirements         | no gold; floral cream/blush/olive/coral/silver                                | verified            |
| Recommended palette               | dark photo chapters + light floral editorial surfaces                         | verified            |
| Unresolved visual decisions       | none material beyond RSVP                                                     | —                   |

Demo remains the gold base template. Real invite identity lives in Lane A. Real `_assetSlug` is
`renata` and must stay distinct from `demo-xv-editorial`.

---

## Creative Direction & Acceptance

| concern                                                  | decision / evidence                                                                                   | status                         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------ |
| Typography roles (display, heading, body, metadata)      | Editorial display retained; cream type on photos; ink type on light surfaces                          | accepted after 390/1440 review |
| Vertical rhythm and density                              | Preset padding reduced; itinerary uses editorial-program; PA/RSVP use formal-pass / formal-register   | accepted after 390/1440 review |
| Surface hierarchy (open flow vs cards/containers)        | Open flow; Location/Gifts/itinerary paper chrome neutralized; PA/RSVP use the portable formal chapter | accepted after 390/1440 review |
| Photographic treatment (role, crop, focal point, filter) | Color preserved; hero filter none; unique roles; thank-you is full-bleed not circular                 | accepted after 390/1440 review |
| Section-intersection intent and narrative cadence        | family blend from hero; overlap after location; remaining seams neutral                               | accepted after 390/1440 review |
| Local exceptions to the selected preset                  | Gold remap, hero cascade reset, card/paper flatten, thank-you editorial circle reset                  | documented                     |

### Creative acceptance record

| field                                       | value                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Mechanical render/capture result            | Local `/xv/renata` rendered; `tests/e2e/renata-audit.spec.ts` passed at 390×844 and 1440×900 |
| Whole-invitation responsive inspection      | 390×844 and 1440×900 completed                                                               |
| Section boundaries and narrative continuity | Hypothesis order retained; one interlude after location                                      |
| Human creative outcome                      | `ACCEPTED_LOCAL` — publication still blocked by RSVP                                         |
| Reviewer and date                           | Goal 2B palette correction, 2026-08-14                                                       |
| Blocking reason or owner follow-up          | RSVP mode/cap; parish name inferred                                                          |

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque)  
WhatsApp-compressed files are `provisional-whatsapp` or `unusable` and were not ingested.

| source filename     | dims      | format | orientation | weight | quality          | role            | duplicate                    | processing                           | derivative                 |
| ------------------- | --------- | ------ | ----------- | ------ | ---------------- | --------------- | ---------------------------- | ------------------------------------ | -------------------------- |
| 1000511838          | 3900×5861 | jpeg   | portrait    | HR     | production-ready | hero            | no                           | downscale 2560 long edge, no upscale | hero-source.jpg            |
| _DSC5939            | 4024×6048 | jpeg   | portrait    | HR     | production-ready | gallery-feature | no                           | downscale 2560 long edge, no upscale | gallery-feature-source.jpg |
| 1000511828          | 4024×6048 | jpeg   | portrait    | HR     | production-ready | gallery         | no                           | downscale 2560 long edge, no upscale | gallery-01-source.jpg      |
| _DSC5847            | 3995×6004 | jpeg   | portrait    | HR     | production-ready | gallery         | no                           | downscale 2560 long edge, no upscale | gallery-02-source.jpg      |
| 1000511822          | 4024×6048 | jpeg   | portrait    | HR     | production-ready | gallery         | no                           | downscale 2560 long edge, no upscale | gallery-03-source.jpg      |
| _DSC5759            | 3734×5611 | jpeg   | portrait    | HR     | production-ready | gallery         | no                           | downscale 2560 long edge, no upscale | gallery-04-source.jpg      |
| _DSC5878            | 5390×3586 | jpeg   | landscape   | HR     | production-ready | interlude       | no                           | downscale 2560 long edge, no upscale | interlude-source.jpg       |
| _DSC5914            | 6002×3993 | jpeg   | landscape   | HR     | production-ready | interlude-02    | no                           | downscale 2560 long edge, no upscale | interlude-02-source.jpg    |
| 1000511840          | 4024×6048 | jpeg   | portrait    | HR     | production-ready | thankYou        | no                           | downscale 2560 long edge, no upscale | thank-you-source.jpg       |
| _DSC5820            | 5298×3526 | jpeg   | landscape   | HR     | unused           | none            | unused HR reserve            | not ingested                         | —                          |
| _DSC5907            | 5476×3643 | jpeg   | landscape   | HR     | unused           | none            | unused HR reserve            | not ingested                         | —                          |
| IMG-20260424-WA0194 | 1006×1512 | jpeg   | portrait    | WA     | unusable         | none            | worn-sunglasses concept only | not ingested                         | —                          |
| 1001086433          | 1070×1600 | jpeg   | portrait    | WA     | unusable         | none            | near-dup yellow              | not ingested                         | —                          |
| 1000511882          | 1080×2400 | jpeg   | portrait    | weak   | unusable         | none            | insufficient for desktop     | not ingested                         | —                          |

### Uniqueness table

| role            | source     | derivative                 | intentional multi-role? |
| --------------- | ---------- | -------------------------- | ----------------------- |
| hero            | 1000511838 | hero-source.jpg            | no                      |
| gallery-feature | _DSC5939   | gallery-feature-source.jpg | no                      |
| gallery-01      | 1000511828 | gallery-01-source.jpg      | no                      |
| gallery-02      | _DSC5847   | gallery-02-source.jpg      | no                      |
| gallery-03      | 1000511822 | gallery-03-source.jpg      | no                      |
| gallery-04      | _DSC5759   | gallery-04-source.jpg      | no                      |
| interlude       | _DSC5878   | interlude-source.jpg       | no                      |
| interlude-02    | _DSC5914   | interlude-02-source.jpg    | no                      |
| thankYou        | 1000511840 | thank-you-source.jpg       | no                      |

Hero desktop and hero mobile share `hero-source.jpg` with different focals. Closing image is not the
hero. Feature frame is `_DSC5939`, not file-order first.

---

## Implementation Constraints

- Helper prepReadiness is `NOT_READY` while RSVP mode/cap are missing. Goal 2 Local authoring is an
  explicit current-task exception; `assertImplementationAllowed` must not be called.
- Lane A inheritance resets: `--hero-image-filter`, gold/metallic tokens, hero cascade
  (grid/mix-blend/absolute details), gifts card chrome. Olive is the action accent outside Event
  Location; `--color-text-emphasis` stays ink and is not aliased to `--color-action-accent`. Event
  Location consumes `stacked-venue-plates` with section-scoped type/palette so the chapter matches
  the shared plate presentation. Yellow is not a UI color on surrounding sections. Cream/blush are
  light surfaces; silver is line/detail; coral is rare (wax highlight).
- Structural selections: itinerary `editorial-program`; gallery `paired-feature-band` without a
  feature `aspectRatio` override and item order `gallery-01`, `gallery-02`, `gallery-feature`,
  `gallery-03`, `gallery-04`; location `stacked-venue-plates` with `presentation: 'simple'`,
  `presentationOptions.showNavigationButtons: false`, and `showFlourishes: false`; keep `ceremony` +
  `reception` (no `venues[]`); personalized access `formal-pass`; RSVP `formal-register`
  (presentation only — do not persist `accessMode`, `confirmationMode`, or `guestCap`); family
  `asymmetric-groups` + `text-only`; envelope `variant: 'premiere-floral'` with
  `sealIcon: 'monogram'`, `envelopeName: 'Renata'`, `cardLabel: 'MIS XV'`,
  `cardTagline: '05 · 09 · 2026'`, and `microcopy: 'Abra su invitación'`. Do not set
  `documentLabel`, `teaserDetails`, or `closedPalette`. Reveal appearance is owned by the premiere-floral envelope variant, not the
  Renata profile. Interlude crop is owned by provision `focalPoint` / `focalPointDesktop`.
- Lane B: none. Demo stays the gold editorial template.
- Music omit / include: omitted (`not_applicable`).
- Other: no `renata` key in `LEGACY_INTERSECTION_PROFILES`. No shared renderer/variant branches.
- Parish name stays classified `inferred` unless a human upgrades it.

---

## Preparation Readiness History

| date       | readiness | helper basis                    | notes                                           |
| ---------- | --------- | ------------------------------- | ----------------------------------------------- |
| 2026-08-14 | NOT_READY | RSVP mode and guest cap missing | Local authoring authorized; publication blocked |
