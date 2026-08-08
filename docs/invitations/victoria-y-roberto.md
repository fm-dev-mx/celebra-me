# Canonical Invitation Preparation State — `victoria-y-roberto`

> Schema owner: `docs/core/invitation-preparation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Workflow: `.agent/workflows/invitation-preparation.md`

---

## Identity

| Parameter              | Value                     |
| ---------------------- | ------------------------- |
| **Slug**               | `victoria-y-roberto`      |
| **Host Login Alias**   | `victoria_armenta`        |
| **Event Type**         | `boda`                    |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS` |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

Must equal `evaluatePreparationReadiness` for the facts/assets/design recorded below. Helper outcome
(2026-08-07): structural decisions resolved; only documented non-blocking placeholders remain.
Assigned production photographs are inventoried as `production-ready` (authorized source inspected).

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

Canonical route (creation contract): `/boda/victoria-y-roberto` — slug must not include `eventType`.

---

## Sources

| Source                        | Reference                   | Notes                                                                            |
| ----------------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export` (opaque) | Evidence only — never photo SoT; no chat-title dumps; audio not transcribed      |
| High-res photos / assets root | `source:hr-photos` (opaque) | Owner-authorized authoritative session asset source; real path session-only      |
| Owner session (Goal 1)        | `source:owner-session`      | Base demo, RSVP/access, gifts, quote, section scope, itinerary plan, photo roles |

---

## Fact Register

| field                 | value                                                                                                   | classification | source            | notes                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------- | -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| slug                  | victoria-y-roberto                                                                                      | verified       | owner + creation  | Couple given names; no eventType prefix; orthography verified from WA text                                 |
| hostLoginAlias        | victoria_armenta                                                                                        | verified       | wa-export + owner | `{primer_nombre}_{primer_apellido}` from partner A; Roberto surname unresolved — not invented              |
| celebrantName         | Victoria                                                                                                | verified       | wa-export         | Guest-facing partner A; contact/family evidence also supports surname Armenta (see notes)                  |
| celebrantSurname      | Armenta                                                                                                 | verified       | wa-export         | Contact identity + father Victor Armenta; not required to invent Roberto surname                           |
| secondaryName         | Roberto                                                                                                 | verified       | wa-export         | Guest-facing partner B first name only                                                                     |
| secondarySurname      | —                                                                                                       | missing        | wa-export         | Not provided; do not invent                                                                                |
| displayCoupleNames    | Victoria & Roberto                                                                                      | verified       | wa-export + owner | Guest-facing lockup                                                                                        |
| eventDate             | 2026-10-30                                                                                              | verified       | wa-export + owner | WA: “30 DE OCTUBRE”; year 2026 explicit owner decision for this preparation                                |
| timeZone              | America/Mazatlan                                                                                        | inferred       | geography         | Los Mochis, Sinaloa (Pacific / Northwest MX); not client-stated                                            |
| ceremonyTime          | 19:00                                                                                                   | verified       | wa-export         | “CEREMONIA HORA 7:00 PM”                                                                                   |
| receptionTime         | 21:00                                                                                                   | verified       | wa-export         | “RECEPCION 9:00 PM”                                                                                        |
| dinnerTime            | [[PENDIENTE:DINNER_TIME]]                                                                               | missing        | owner plan        | Planned itinerary item “Cena”; time not client-confirmed                                                   |
| toastTime             | [[PENDIENTE:TOAST_TIME]]                                                                                | missing        | owner plan        | Planned itinerary item “Brindis”; time not client-confirmed                                                |
| closingTime           | [[PENDIENTE:CLOSING_TIME]]                                                                              | missing        | owner plan        | Planned itinerary item “Cierre de celebración”; time not client-confirmed                                  |
| primaryVenueName      | Parroquia Santo Niño                                                                                    | verified       | wa-export         | Ceremony venue                                                                                             |
| primaryVenueAddress   | Lic. Benito Juárez S/N, Mochicahui, 81257 Los Mochis, Sin.                                              | verified       | wa-export         | Ceremony address                                                                                           |
| ceremonyMapUrl        | [[PENDIENTE:CEREMONY_MAP_URL]]                                                                          | missing        | —                 | Navigation URL not verified; do not fabricate                                                              |
| receptionVenueName    | Eventos Platinum LM                                                                                     | verified       | wa-export         | Reception venue                                                                                            |
| receptionVenueAddress | Carretera Mochis - Topo Km8                                                                             | verified       | wa-export         | Reception address as written                                                                               |
| receptionMapUrl       | [[PENDIENTE:RECEPTION_MAP_URL]]                                                                         | missing        | —                 | Navigation URL not verified; do not fabricate                                                              |
| distinctVenues        | true                                                                                                    | verified       | wa-export         | Ceremony and reception are distinct                                                                        |
| brideParents          | Madre: Argelia Valdez; Padre: Victor Armenta                                                            | verified       | wa-export         | Spelling preserved without inventing accents                                                               |
| groomParents          | Madre: Socorro Palomares; Padre: Nicolas Luviano                                                        | verified       | wa-export         | WA wrote “Socorro palomares”; capitalize only; no accent invented on Nicolas                               |
| godparents            | Eric Montes; Rosario Soto                                                                               | verified       | wa-export         | Record as Padrinos only — do not infer “padrinos de velación” or other ceremonial role                     |
| clientColors          | terracota                                                                                               | verified       | wa-export         | Sole client-requested color                                                                                |
| dressCode             | formal                                                                                                  | verified       | wa-export         | “FORMAL”                                                                                                   |
| photosRequested       | true                                                                                                    | verified       | wa-export         | Client: “Fotos … SIII”                                                                                     |
| sourceAssetPath       | source:hr-photos                                                                                        | verified       | owner             | Opaque label; authorized folder is session-only                                                            |
| baseDemoId            | demo-boda-jewelry-box-wedding                                                                           | verified       | owner             | Owner decision (client reacted positively to demo; did not explicitly select)                              |
| themePreset           | jewelry-box-wedding                                                                                     | verified       | owner / catalog   | Corresponding preset for baseDemoId                                                                        |
| sectionOrder          | hero, quote, countdown, location, itinerary, family, gallery, gifts, personalizedAccess, rsvp, thankYou | verified       | owner             | Full functional wedding set adapted to Victoria & Roberto; interludes planned separately (see Sections)    |
| interludes            | 2 (roles: interlude01, interlude02)                                                                     | verified       | owner             | Count + photograph roles accepted; exact `afterSection` placement not owner-decided (Goal 2 art direction) |
| rsvpConfirmationMode  | api                                                                                                     | verified       | owner             | Canonical product mechanism                                                                                |
| rsvpAccessMode        | hybrid                                                                                                  | verified       | owner             | Personalized invitation access + guest/family identity + pass allowance via product mechanisms             |
| giftsMode             | Lluvia de sobres                                                                                        | verified       | owner             | Do not inherit Liverpool / Amazon / registry URLs from demo                                                |
| quoteReference        | Eclesiastés 4:9–12                                                                                      | verified       | owner             | Biblical reference resolved; exact guest-facing wording may refine in implementation; not Rut 1:16         |
| familyPhoto           | none                                                                                                    | verified       | owner             | Do not plan a photograph for the `family` section                                                          |
| musicUrl              | —                                                                                                       | not_applicable | owner scope       | Music not in planned section set                                                                           |
| adultsOnly            | —                                                                                                       | not_applicable | —                 | Do not inherit demo adults-only restriction                                                                |
| audioEvidence         | multiple WA audio attachments                                                                           | ambiguous      | wa-export         | Unavailable/unintelligible for preparation; contents not reconstructed from surrounding messages           |

Rules:

- `verified` requires explicit client/source evidence or recorded owner resolution.
- `inferred` must include its basis and must never be phrased as a client statement.
- Absence of information never implies consent or preference.
- Roberto’s legal surname remains `missing` — unresolved identity, not invented for technical IDs.

---

## Event Completeness

Contract maturity for this event type: `partial` (`getEventCompletenessContract('boda')`)

| requirement | fields                                                                                                                                                | status     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| required    | slug, celebrantName, secondaryName, eventDate, baseDemoId, sourceAssetPath, sectionOrder, primaryVenueName, primaryVenueAddress, rsvpConfirmationMode | satisfied  |
| conditional | receptionVenueName, receptionVenueAddress (`distinctVenues=true`)                                                                                     | satisfied  |
| recommended | (boda partial gaps — family/gifts/maps/times live in Fact Register / sections)                                                                        | documented |
| optional    | —                                                                                                                                                     | —          |

### Missing blockers

- None for the partial `boda` contract (`evaluateEventCompleteness` → `sufficientToPrepare: true`).

### Non-blocking gaps

- Ceremony / reception map URLs (placeholders)
- Dinner / toast / closing itinerary times (placeholders)
- Roberto legal surname (not required by current boda completeness matrix)
- Exact guest-facing quote wording (reference resolved; copy in Goal 2)
- Supporting palette neutrals/gold/cream (agent recommendation only)

### Contract maturity gaps (from helper)

- Primary start time is not a universal boda prep-level `eventTime` field; ceremony/reception times
  stay in the Fact Register.
- Family/godparent/dress/colors/gifts remain Fact Register / sections / owner decisions — not
  completeness matrix fields.
- Gift and music practices are not yet standardized for preparation completeness.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes` (`evaluateEventCompleteness('boda', facts)`).

---

## Placeholders

Use only grep-able tokens: `[[PENDIENTE:FIELD_ID]]`.

| token                             | missing datum   | blocking | reason                                            | replacement requirement                                      |
| --------------------------------- | --------------- | -------- | ------------------------------------------------- | ------------------------------------------------------------ |
| `[[PENDIENTE:CEREMONY_MAP_URL]]`  | ceremonyMapUrl  | no       | Venue known; navigation URL not verified          | Owner-verified Google Maps (or equivalent) URL for ceremony  |
| `[[PENDIENTE:RECEPTION_MAP_URL]]` | receptionMapUrl | no       | Venue known; navigation URL not verified          | Owner-verified Google Maps (or equivalent) URL for reception |
| `[[PENDIENTE:DINNER_TIME]]`       | dinnerTime      | no       | “Cena” planned; time not client-confirmed         | Owner manual time after review before final publication      |
| `[[PENDIENTE:TOAST_TIME]]`        | toastTime       | no       | “Brindis” planned; time not client-confirmed      | Owner manual time after review before final publication      |
| `[[PENDIENTE:CLOSING_TIME]]`      | closingTime     | no       | “Cierre de celebración” planned; time unconfirmed | Owner manual time after review before final publication      |

`READY_WITH_PLACEHOLDERS` may contain only documented **non-blocking** placeholders. No blocking
placeholders remain.

---

## Owner Decisions

Resolved in this preparation task (do not re-ask):

| id  | category              | issue                        | evidence                      | options                                              | recommendation                                          | status       |
| --- | --------------------- | ---------------------------- | ----------------------------- | ---------------------------------------------------- | ------------------------------------------------------- | ------------ |
| OD1 | demo-design-decisions | Base demo / theme preset     | WA positive reaction; catalog | `demo-boda-jewelry-box-wedding`                      | Accept owner selection                                  | **accepted** |
| OD2 | demo-design-decisions | Section scope + 2 interludes | Owner Goal 1                  | Full wedding functional set; 2 interlude photo roles | sectionOrder + interlude count/roles (not afterSection) | **accepted** |
| OD3 | missing-client-facts  | RSVP / access                | Product mechanisms            | `api` + `hybrid` + personalized access               | Use canonical product path                              | **accepted** |
| OD4 | missing-client-facts  | Gifts                        | Owner Goal 1                  | Lluvia de sobres only                                | Include; no demo registries                             | **accepted** |
| OD5 | missing-client-facts  | Quote                        | Owner Goal 1                  | Eclesiastés 4:9–12                                   | Include; not Rut 1:16                                   | **accepted** |
| OD6 | photograph-acceptance | Authoritative photo source   | Owner Goal 1                  | `source:hr-photos` folder                            | Inventory + role map from that source                   | **accepted** |
| OD7 | photograph-acceptance | Family section photo         | Owner Goal 1                  | none                                                 | Text-only family                                        | **accepted** |
| OD8 | demo-design-decisions | Event date year              | WA day/month + owner          | 2026-10-30                                           | Freeze                                                  | **accepted** |

### Unresolved owner pack

None blocking. Non-blocking placeholder values (maps + itinerary times) are for owner manual review
before final publication — not a new decision pack.

Optional future (non-blocking for prep): Roberto legal surname if ever needed for host/legal copy.

---

## Agent Recommendations

Keep strictly separate from Fact Register and Owner Decisions.

| topic               | recommendation                                                                                          | basis                                      | status               |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------- |
| supporting palette  | Neutral cream / soft ink / restrained gold accents around client terracota                              | jewelry-box-wedding + photography          | recommendation only  |
| gallery treatment   | One-item gallery as intentional editorial feature (`variant`/`layoutRole` feature); not multi-grid fill | Schema allows 1 item; jewelry-box `single` | recommendation only  |
| interlude placement | Provisional pacing: after `countdown` and after `gallery`; finalize `afterSection` in Goal 2            | Narrative flow / jewelry-box practice      | Goal 2 art direction |
| hero crop           | Face-safe upper-body crop on `00000041`; prefer portrait derivatives                                    | Composition of selected hero               | recommendation only  |
| thankYou source     | Use `00000042` despite lower native resolution; careful crop; do not upscale beyond native              | Only remaining unique composition          | recommendation only  |

---

## Sections

| bucket                | section keys                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| requested (accepted)  | hero, quote, countdown, location, itinerary, family, gallery, gifts, personalizedAccess, rsvp, thankYou         |
| interludes (accepted) | count: 2; photograph roles `interlude01` + `interlude02` (exact `afterSection` → Goal 2 art direction)          |
| omitted               | music; multi-image gallery fill; demo-only content (Sofía/Alejandro, Puebla, adults-only, Liverpool, demo RSVP) |
| unresolved            | —                                                                                                               |

### Canonical `sectionOrder`

1. `hero`
2. `quote`
3. `countdown`
4. `location`
5. `itinerary`
6. `family`
7. `gallery`
8. `gifts`
9. `personalizedAccess`
10. `rsvp`
11. `thankYou`

Interludes remain in live `interludes[]` (jewelry-box demo pattern), not duplicated inside
`sectionOrder`. Exact `afterSection` anchors are Agent Recommendations / Goal 2 art direction, not
an accepted owner placement decision.

### Itinerary preparation

| item                  | time                         | classification         |
| --------------------- | ---------------------------- | ---------------------- |
| Ceremonia religiosa   | 19:00                        | verified               |
| Recepción             | 21:00                        | verified               |
| Cena                  | `[[PENDIENTE:DINNER_TIME]]`  | planned / missing time |
| Brindis               | `[[PENDIENTE:TOAST_TIME]]`   | planned / missing time |
| Cierre de celebración | `[[PENDIENTE:CLOSING_TIME]]` | planned / missing time |

### Semantic roles (copy constraints for Goal 2)

| section            | narrative purpose                                   |
| ------------------ | --------------------------------------------------- |
| quote              | biblical opening / partnership (Eclesiastés 4:9–12) |
| location           | confirmed logistics (dual venue)                    |
| itinerary          | sequence of the celebration                         |
| family             | parents and padrinos (no photograph)                |
| gifts              | lluvia de sobres                                    |
| personalizedAccess | personalized access / pass context                  |
| rsvp               | confirmation action                                 |
| thankYou           | closing message                                     |

Confirmed copy requirements for this invitation: guest-facing Spanish; one coherent narrative across
sections; avoid repeated phrases and redundant ideas; no demo copy reuse; do not present inferred
facts as client-confirmed; keep placeholders until manually corrected.

---

## Design Direction

| decision                          | value                                                                                         | classification |
| --------------------------------- | --------------------------------------------------------------------------------------------- | -------------- |
| Owner-selected base demo          | `demo-boda-jewelry-box-wedding` (WA positive reaction only; not an explicit client selection) | verified       |
| Recommended demo alternatives     | —                                                                                             | not_applicable |
| Selected variant / visual profile | `jewelry-box-wedding` / `victoria-y-roberto`                                                  | verified       |
| Client color requirements         | terracota                                                                                     | verified       |
| Recommended palette               | terracota + restrained neutrals/gold (Lane A)                                                 | recommendation |
| Unresolved visual decisions       | —                                                                                             | —              |

Direction:

- Adapt rather than clone the demo.
- Use real photography as a primary identity differentiator.
- Maintain elegant wedding / editorial character.
- Do not invent additional client-requested colors.

Content-profile invariants (implementation):

- `templateId` and `theme.preset` match the jewelry-box wedding demo SKU/preset
  (`boda-jewelry-box-wedding` / `jewelry-box-wedding`).
- Client `_assetSlug` must stay `victoria-y-roberto` and must never point at the demo asset
  directory (`demo-boda-jewelry-box-wedding`).
- `isDemo` must be `false` on the real invitation.

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque)  
Originals must be preserved. Authorized root inspected in session (5 JPEGs). Files are
byte-identical to the WhatsApp export attachments of the same names; quality labels below reflect
**visual/dimension inspection** of the authorized source (not automatic demotion solely by WA
origin). Owner authorized this folder as the final invitation photograph source.

| source filename                        | dims      | format | orientation | weight   | quality          | role        | duplicate   | processing                               | derivative                               |
| -------------------------------------- | --------- | ------ | ----------- | -------- | ---------------- | ----------- | ----------- | ---------------------------------------- | ---------------------------------------- |
| 00000041-PHOTO-2026-08-01-13-35-44.jpg | 2773×4160 | jpeg   | portrait    | 726.2 KB | production-ready | hero        | no (unique) | normalize WebP; face-safe crop           | `hero-desktop.webp` / `hero-mobile.webp` |
| 00000042-PHOTO-2026-08-01-13-35-44.jpg | 2163×3244 | jpeg   | portrait    | 340.0 KB | production-ready | thankYou    | no (unique) | normalize WebP; careful crop; no upscale | `thank-you.webp`                         |
| 00000043-PHOTO-2026-08-01-13-35-44.jpg | 4160×2773 | jpeg   | landscape   | 753.7 KB | production-ready | interlude01 | no (unique) | normalize WebP editorial                 | `interlude01.webp`                       |
| 00000044-PHOTO-2026-08-01-13-35-44.jpg | 2773×4160 | jpeg   | portrait    | 951.4 KB | production-ready | gallery01   | no (unique) | normalize WebP gallery target            | `gallery-01.webp`                        |
| 00000045-PHOTO-2026-08-01-13-35-44.jpg | 4160×2773 | jpeg   | landscape   | 533.7 KB | production-ready | interlude02 | no (unique) | normalize WebP editorial                 | `interlude02.webp`                       |

### Inventory summary

| metric                           | value                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| Total source files               | 5                                                                                         |
| Unique photographic compositions | 5                                                                                         |
| Exact byte duplicates            | 0                                                                                         |
| Near-duplicate compositions      | 0 (distinct poses/settings; #42 and #45 share location/outfit but different compositions) |
| Unassigned / spare               | 0                                                                                         |
| Family photograph                | none (explicit)                                                                           |

### Composition notes (role rationale)

| file | composition synopsis                                             | selected role |
| ---- | ---------------------------------------------------------------- | ------------- |
| 41   | Color intimate couple portrait; clear faces; outdoor soft bokeh  | hero          |
| 43   | B&W romantic dip/kiss on wooden bridge; landscape                | interlude01   |
| 44   | B&W lift/embrace by water; strong editorial single feature       | gallery01     |
| 45   | Color forehead-to-forehead at glass architecture; landscape      | interlude02   |
| 42   | Color architectural frame; woman sharp / man soft FG; lower dims | thankYou      |

### Uniqueness table (required before READY_*)

| role        | source                                 | derivative                           | intentional multi-role? |
| ----------- | -------------------------------------- | ------------------------------------ | ----------------------- |
| hero        | 00000041-PHOTO-2026-08-01-13-35-44.jpg | hero-desktop.webp / hero-mobile.webp | no                      |
| interlude01 | 00000043-PHOTO-2026-08-01-13-35-44.jpg | interlude01.webp                     | no                      |
| gallery01   | 00000044-PHOTO-2026-08-01-13-35-44.jpg | gallery-01.webp                      | no                      |
| interlude02 | 00000045-PHOTO-2026-08-01-13-35-44.jpg | interlude02.webp                     | no                      |
| thankYou    | 00000042-PHOTO-2026-08-01-13-35-44.jpg | thank-you.webp                       | no                      |
| family      | —                                      | —                                    | n/a (no photo)          |

### Gallery capability note (preparation only)

- Live `gallery.schema` accepts an `items[]` array with no minimum multi-image requirement.
- Layout strategy includes a `single` variant; jewelry-box layout roles support a feature item.
- **Recommendation:** treat the one-item gallery as an intentional editorial feature, not a
  conventional multi-image gallery.
- No component/style changes in Goal 1. If Goal 2 styling needs Lane A polish for a single frame,
  that is implementation scope — schema itself does not block a one-item gallery.

### Optimization plan (guidance targets)

| Role               |     Target | Plan                                                             |
| ------------------ | ---------: | ---------------------------------------------------------------- |
| Hero desktop       | 250–500 KB | Derivative from 41; do not recompress solely for process theater |
| Hero mobile        | 180–350 KB | Portrait crop; face-safe                                         |
| Editorial featured | 150–300 KB | Interludes 43 / 45                                               |
| Gallery            |  80–180 KB | Single item from 44                                              |
| Standard section   | 100–220 KB | thankYou from 42; respect native 2163px width (no upscale)       |

Double-encode note: when publishing managed WebPs, prefer direct delivery without a second encode
that upscales past native width.

---

## Implementation Constraints

- prepReadiness is `READY_WITH_PLACEHOLDERS` (helper-aligned) — payload / invitation-specific SCSS
  may begin only under a Goal 2 (or equivalent) implementation authorization.
- Keep all `[[PENDIENTE:*]]` tokens until owner replaces them; do not fabricate map URLs or
  itinerary times.
- Dual-venue location: ceremony first (Parroquia Santo Niño), reception second (Eventos Platinum
  LM); `distinctVenues=true`.
- Family: parents + padrinos; `family` presentation without photograph (`text-only` / no featured
  image).
- Gallery: exactly one photographic item (editorial feature).
- Gifts: lluvia de sobres only — no Liverpool/Amazon/demo registries.
- Quote: Eclesiastés 4:9–12 (not Rut 1:16).
- RSVP: `confirmationMode: api`, `accessMode: hybrid`; do not invent guest records or pass counts in
  preparation/implementation data seeds.
- Do not copy demo-specific names, Puebla copy, adults-only, demo itinerary activities, demo family,
  or demo WhatsApp templates.
- Lane A inheritance resets (list when implementing): any jewelry-box demo-specific absolute
  positioning, demo asset focal points, and demo indication chips that conflict with Victoria &
  Roberto facts.
- Lane B: none required for prep; only if a reusable theme fix benefits both real and demo.
- Music omitted.
- envReadiness remains owned by invitation-release status — out of scope here.

---

## Preparation Readiness History

| date       | readiness                 | helper basis                   | notes                                                                  |
| ---------- | ------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| 2026-08-07 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | Goal 1 canonical prep; 5 unique HR roles; non-blocking map/time tokens |
