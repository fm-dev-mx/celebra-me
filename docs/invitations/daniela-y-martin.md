# Canonical Invitation Preparation State — `daniela-y-martin`

> Schema owner: `docs/core/invitation-preparation-contract.md` Executable evaluation:
> `src/lib/invitation-preparation/` (**prepReadiness SSOT**) Workflow:
> `.agent/workflows/invitation-preparation.md`

---

## Identity

| Parameter              | Value                      |
| ---------------------- | -------------------------- |
| **Slug**               | `daniela-y-martin`         |
| **Host Login Alias**   | `daniela_medina`           |
| **Event Type**         | `boda`                     |
| **Preparation Status** | `READY_FOR_IMPLEMENTATION` |

**Preparation Readiness (prepReadiness):** `READY_FOR_IMPLEMENTATION`

Must equal `evaluatePreparationReadiness`. Parents resolved (OD5 superseded). Display names use
second given names (Daniela / Martín) per client audio 2026-08-04. The canonical route has no
eventType prefix: `/boda/daniela-y-martin`. Assets remain production-ready HR (D2/D4) under the
two-photo freeze; atmospheric interludes use stock frames (not client portraits).

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

---

## Sources

| Source                        | Reference                   | Notes                                                                                         |
| ----------------------------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| WhatsApp / conversation       | `source:wa-export` (opaque) | Evidence only — never photo SoT; no chat-title dumps                                          |
| High-res photos / assets root | `source:hr-photos` (opaque) | Authoritative asset source; real path session-only; **2** HR JPEGs                            |
| Owner session (2026-07-31)    | `source:owner-session`      | Maps link↔venue; photo-set freeze to the 2 provided HR files                                  |
| Owner session (2026-08-04)    | `source:owner-session`      | Display names Daniela/Martín; parents; Amazon + lluvia de sobres; Preview target; slug rename |

---

## Fact Register

| field                 | value                                                                                                | classification | source            | notes                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------- | -------------- | ----------------- | ------------------------------------------------------------------------- |
| slug                  | daniela-y-martin                                                                                     | verified       | owner 2026-08-04  | Canonical route slug without an eventType prefix                          |
| hostLoginAlias        | daniela_medina                                                                                       | verified       | owner 2026-08-04  | `{primer_nombre}_{primer_apellido}` from partner A preferred display name |
| celebrantName         | Perla Daniela Medina Carrillo                                                                        | verified       | wa-export         | Legal full name                                                           |
| secondaryName         | Carlos Martín Ochoa Felipe                                                                           | verified       | wa-export         | Partner B legal full name                                                 |
| displayCelebrantName  | Daniela                                                                                              | verified       | wa-export + owner | Client audio: use second given name                                       |
| displaySecondaryName  | Martín                                                                                               | verified       | wa-export + owner | Client audio: use second given name                                       |
| hostContactName       | Daniela Medina                                                                                       | verified       | wa-export         | Organizer contact                                                         |
| eventDate             | 2026-11-28                                                                                           | verified       | wa-export         | “28 de noviembre 2026”                                                    |
| timeZone              | America/Mexico_City                                                                                  | inferred       | MX / Hidalgo      | Huejutla de Reyes, Hgo.                                                   |
| ceremonyTime          | 17:30                                                                                                | verified       | wa-export         | Ceremonia religiosa                                                       |
| receptionTime         | 19:30                                                                                                | verified       | wa-export         | Salón                                                                     |
| civilTime             | 20:15                                                                                                | verified       | wa-export         | Civil en recepción                                                        |
| primaryVenueName      | Catedral de Cristo Rey                                                                               | verified       | wa-export         | Ceremonia religiosa                                                       |
| primaryVenueAddress   | Sta. Irene, Centro, 43000 Huejutla de Reyes, Hgo.                                                    | verified       | wa-export         |                                                                           |
| primaryVenueMapsUrl   | maps:iglesia (opaque; session holds URL)                                                             | verified       | owner 2026-07-31  | Owner: **second** Maps link = iglesia                                     |
| receptionVenueName    | Salón El Pedregal                                                                                    | verified       | wa-export         | Client wrote “El pedregal”                                                |
| receptionVenueAddress | Avenida parque industrial col tepoztequito s/n, Huejutla de Reyes Hgo                                | verified       | wa-export         |                                                                           |
| receptionVenueMapsUrl | maps:salon (opaque; session holds URL)                                                               | verified       | owner 2026-07-31  | Owner: **first** Maps link = salón                                        |
| distinctVenues        | true                                                                                                 | verified       | wa-export         | Iglesia + salón                                                           |
| clientColors          | Verde Oliva + Beige o toques dorados                                                                 | verified       | wa-export         |                                                                           |
| dressCode             | Etiqueta formal; mujeres vestido largo de noche (evitar blanco, beige o gamas claras); hombres traje | verified       | wa-export         | Client typo “vestigo” → vestido                                           |
| godparents            | —                                                                                                    | not_applicable | wa-export         | Explicit “NO PONER”                                                       |
| brideParents          | Madre: Laura Carrillo Morales; Padre: Pilar Medina Martínez                                          | verified       | owner 2026-08-04  | Pilar = padre                                                             |
| groomParents          | Madre: María de Jesús Felipe Redondo (solo mamá)                                                     | verified       | owner 2026-08-04  | No father row                                                             |
| photoSetConstraint    | Use only the two provided HR files (D2.jpg, D4.jpg)                                                  | verified       | owner 2026-07-31  | OD4 confirmed                                                             |
| sourceAssetPath       | source:hr-photos                                                                                     | verified       | owner             | Opaque label; session holds real path                                     |
| baseDemoId            | demo-boda-jewelry-box-wedding                                                                        | verified       | owner OD1         | Sole catalog `boda` preset; Lane A olive/beige/gold                       |
| themePreset           | jewelry-box-wedding                                                                                  | verified       | owner OD1         | From baseDemoId                                                           |
| sectionOrder          | hero, quote, countdown, location, family, gallery, gifts, personalizedAccess, rsvp, thankYou         | verified       | owner 2026-08-04  | Gifts added; interludes after countdown + gifts                           |
| rsvpConfirmationMode  | api                                                                                                  | verified       | owner OD3         | Access mode hybrid                                                        |
| rsvpAccessMode        | hybrid                                                                                               | verified       | owner OD3         |                                                                           |
| musicUrl              | —                                                                                                    | not_applicable | owner             | Omitted unless client later requests                                      |
| giftsMode             | Amazon store link + lluvia de sobres (cash)                                                          | verified       | owner 2026-08-04  | `https://www.amazon.com.mx/wedding/guest-view/30EX58RGSIPUM`              |
| itinerary             | religiosa 17:30 → recepción 19:30 → civil 20:15                                                      | verified       | wa-export         | Inside `location` + civil indication                                      |
| interludes            | stock atmospheric frames (2)                                                                         | verified       | owner             | Not client HR portraits; after countdown and gifts                        |
| godparentsSection     | —                                                                                                    | not_applicable | wa-export         | Client: “NO PONER”                                                        |

---

## Event Completeness

Contract maturity for this event type: `partial` (`getEventCompletenessContract('boda')`)

| requirement | fields                                                                                                | status              |
| ----------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| required    | slug, celebrantName, secondaryName, eventDate, sourceAssetPath, primaryVenueName, primaryVenueAddress | satisfied           |
| required    | baseDemoId, sectionOrder, rsvpConfirmationMode                                                        | satisfied (OD1–OD3) |
| recommended | reception*, itinerary times, colors, dress, gifts                                                     | verified            |
| optional    | godparents                                                                                            | N/A — omit          |

### Missing blockers

- None for partial `boda` contract.

### Non-blocking gaps

- Gallery is a single frame (D4); hero is D2 only
- Music omitted unless later requested
- Aesthetic polish deferred (owner separate pass)

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

---

## Placeholders

None. Parent tokens retired 2026-08-04.

---

## Owner Decisions

| id  | category              | issue                | evidence          | options             | recommendation    | status                                    |
| --- | --------------------- | -------------------- | ----------------- | ------------------- | ----------------- | ----------------------------------------- |
| OD1 | demo-design-decisions | Base demo / preset   | Catalog           | jewelry-box-wedding | Accept            | **accepted**                              |
| OD2 | demo-design-decisions | Exact `sectionOrder` | See concrete list | OK / edit list      | List below        | **accepted** (updated 2026-08-04: +gifts) |
| OD3 | missing-client-facts  | RSVP mode            | Product practice  | api + hybrid        | api + hybrid      | **accepted**                              |
| OD4 | photograph-acceptance | Only D2 + D4         | Owner             | freeze              | freeze            | **accepted**                              |
| OD5 | ambiguous-data        | Parents              | WA + owner        | resolve names       | publish confirmed | **resolved**                              |
| OD6 | missing-client-facts  | Gifts                | Client 2026-08-04 | Amazon + sobres     | include           | **accepted**                              |
| OD7 | demo-design-decisions | Display / slug names | Client audio      | Daniela / Martín    | rename + display  | **accepted**                              |

### OD2 — section order (accepted; gifts 2026-08-04)

1. `hero` (D2) → 2. `quote` → 3. `countdown` → 4. `location` → 5. `family` → 6. `gallery` (D4) → 7.
   `gifts` → 8. `personalizedAccess` → 9. `rsvp` → 10. `thankYou`

Interludes: after `countdown`, after `gifts`.

**Omitted:** padrinos, music, multi-image gallery.

---

## Agent Recommendations

| topic    | recommendation                  | basis                            | status   |
| -------- | ------------------------------- | -------------------------------- | -------- |
| demo     | `demo-boda-jewelry-box-wedding` | OD1                              | accepted |
| palette  | Olive + beige + gold Lane A     | Client colors                    | accepted |
| sections | OD2 list with gifts             | Chat + Amazon + lluvia de sobres | accepted |
| rsvp     | `api` + hybrid                  | OD3                              | accepted |
| photos   | D2 hero; D4 gallery only        | OD4                              | accepted |
| names    | Daniela & Martín guest-facing   | OD7                              | accepted |
| delivery | Preview first                   | Owner 2026-08-04                 | accepted |

---

## Sections

| bucket     | section keys                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------- |
| accepted   | hero, quote, countdown, location, family, gallery, gifts, personalizedAccess, rsvp, thankYou |
| omitted    | padrinos/godparents, music                                                                   |
| unresolved | —                                                                                            |

---

## Design Direction

| decision                          | value                                                                   | classification |
| --------------------------------- | ----------------------------------------------------------------------- | -------------- |
| Client-selected demo              | `demo-boda-jewelry-box-wedding` (owner OD1; WA had shown XV by mistake) | verified       |
| Recommended demo alternatives     | —                                                                       | not_applicable |
| Selected variant / visual profile | `jewelry-box-wedding` / `daniela-y-martin`                              | verified       |
| Client color requirements         | Verde oliva + beige / toques dorados                                    | verified       |
| Recommended palette               | Olive–beige–gold Lane A                                                 | verified       |
| Unresolved visual decisions       | Aesthetic polish deferred                                               | accepted gap   |

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque) Owner constraint: **only these two client files** (session
2026-07-31).

| source filename | dims      | format | orientation | weight  | quality          | role    | duplicate | processing               | derivative                               |
| --------------- | --------- | ------ | ----------- | ------- | ---------------- | ------- | --------- | ------------------------ | ---------------------------------------- |
| D2.jpg          | 4000×6000 | jpeg   | portrait    | ~8.0 MB | production-ready | hero    | no        | normalize WebP (managed) | `hero-desktop.webp` / `hero-mobile.webp` |
| D4.jpg          | 4000×6000 | jpeg   | portrait    | ~7.0 MB | production-ready | gallery | no        | normalize WebP (managed) | `gallery-01.webp`                        |

### Uniqueness table (required before READY_*)

| role    | source | derivative                           | intentional multi-role? |
| ------- | ------ | ------------------------------------ | ----------------------- |
| Hero    | D2.jpg | hero-desktop.webp / hero-mobile.webp | no                      |
| Gallery | D4.jpg | gallery-01.webp                      | no                      |

---

## Implementation Constraints

- prepReadiness is `READY_FOR_IMPLEMENTATION` — parents and gifts resolved; no prep placeholders.
- Lane A inheritance resets: olive–beige–gold profile; dual-venue location via `venues[]` (ceremony
  first for hero metadata); civil ceremony stays in `location.indications`.
- Padrinos: omit (`NO PONER`).
- Family published with confirmed names (bride: Laura madre / Pilar padre; groom: María de Jesús
  madre only).
- Photo set: client D2 + D4 (OD4); thankYou without a third client frame; stock interludes allowed.
- Gifts: Amazon store URL + cash “Lluvia de sobres”.
- Maps association: salón = first link; iglesia = second link (owner).
- Reveal: seal is the sole `[data-envelope-open]` control; `microcopy` empty; seal hint
  `Toque el sello`; seal initials `D·M`.
- Only the canonical slug `daniela-y-martin` may remain in the runtime registry, assets, or active
  docs.
- Delivery target: Preview (not Production) until owner authorizes promote.
- Active plans: `.agent/plans/active/daniela-y-martin-*.md`.

---

## Preparation Readiness History

| date       | readiness                  | helper basis                   | notes                                                                                          |
| ---------- | -------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| 2026-07-31 | `NOT_READY`                | `evaluatePreparationReadiness` | Initial canonical state                                                                        |
| 2026-07-31 | `READY_WITH_PLACEHOLDERS`  | `evaluatePreparationReadiness` | OD2 accepted; non-blocking parent placeholders remain                                          |
| 2026-08-01 | `READY_WITH_PLACEHOLDERS`  | Closure audit                  | Local visual/readiness closure under former slug                                               |
| 2026-08-04 | `READY_FOR_IMPLEMENTATION` | owner session                  | Parents resolved; Daniela/Martín display + slug rename; Amazon + lluvia de sobres; Preview aim |
| 2026-08-04 | `READY_FOR_IMPLEMENTATION` | owner session                  | Slug corrected to `daniela-y-martin` (drop redundant `boda-` prefix); creation-contract rule   |
