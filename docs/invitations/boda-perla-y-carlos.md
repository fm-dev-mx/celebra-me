# Canonical Invitation Preparation State — `boda-perla-y-carlos`

> Schema owner: `docs/core/invitation-preparation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Workflow: `.agent/workflows/invitation-preparation.md`

---

## Identity

| Parameter              | Value                     |
| ---------------------- | ------------------------- |
| **Slug**               | `boda-perla-y-carlos`     |
| **Host Login Alias**   | `perla_medina`            |
| **Event Type**         | `boda`                    |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS` |

**Preparation Readiness (prepReadiness):** `READY_WITH_PLACEHOLDERS`

Must equal `evaluatePreparationReadiness`. OD1–OD5 closed. Non-blocking parent placeholders remain;
assets are production-ready HR (D2/D4) under the two-photo freeze.

Technical Local/Preview/Production readiness (**envReadiness**) is **out of scope** for this
document and remains owned by `pnpm invitation:update --status` / `invitation-readiness.ts`.

---

## Sources

| Source                        | Reference                   | Notes                                                              |
| ----------------------------- | --------------------------- | ------------------------------------------------------------------ |
| WhatsApp / conversation       | `source:wa-export` (opaque) | Evidence only — never photo SoT; no chat-title dumps               |
| High-res photos / assets root | `source:hr-photos` (opaque) | Authoritative asset source; real path session-only; **2** HR JPEGs |
| Owner session (2026-07-31)    | `source:owner-session`      | Maps link↔venue; photo-set freeze to the 2 provided HR files       |

---

## Fact Register

| field                 | value                                                                                                | classification | source             | notes                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------- | -------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| slug                  | boda-perla-y-carlos                                                                                  | verified       | owner 2026-07-31   | Lowercase hyphenated; orthography from verified names                                                                   |
| hostLoginAlias        | perla_medina                                                                                         | verified       | owner 2026-07-31   | Preferred `{primer_nombre}_{primer_apellido}` from partner A                                                            |
| celebrantName         | Perla Daniela Medina Carrillo                                                                        | verified       | wa-export          |                                                                                                                         |
| secondaryName         | Carlos Martín Ochoa Felipe                                                                           | verified       | wa-export          | Partner B                                                                                                               |
| hostContactName       | Daniela Medina                                                                                       | verified       | wa-export          | Organizer contact; same person as partner A first names                                                                 |
| eventDate             | 2026-11-28                                                                                           | verified       | wa-export          | “28 de noviembre 2026”                                                                                                  |
| timeZone              | America/Mexico_City                                                                                  | inferred       | MX / Hidalgo       | Huejutla de Reyes, Hgo.                                                                                                 |
| ceremonyTime          | 17:30                                                                                                | verified       | wa-export          | Ceremonia religiosa                                                                                                     |
| receptionTime         | 19:30                                                                                                | verified       | wa-export          | Salón                                                                                                                   |
| civilTime             | 20:15                                                                                                | verified       | wa-export          | Civil en recepción                                                                                                      |
| primaryVenueName      | Catedral de Cristo Rey                                                                               | verified       | wa-export          | Ceremonia religiosa                                                                                                     |
| primaryVenueAddress   | Sta. Irene, Centro, 43000 Huejutla de Reyes, Hgo.                                                    | verified       | wa-export          |                                                                                                                         |
| primaryVenueMapsUrl   | maps:iglesia (opaque; session holds URL)                                                             | verified       | owner 2026-07-31   | Owner: **second** Maps link = iglesia (corrects earlier agent order guess)                                              |
| receptionVenueName    | Salón El Pedregal                                                                                    | verified       | wa-export          | Client wrote “El pedregal”                                                                                              |
| receptionVenueAddress | Avenida parque industrial col tepoztequito s/n, Huejutla de Reyes Hgo                                | verified       | wa-export          |                                                                                                                         |
| receptionVenueMapsUrl | maps:salon (opaque; session holds URL)                                                               | verified       | owner 2026-07-31   | Owner: **first** Maps link = salón                                                                                      |
| distinctVenues        | true                                                                                                 | verified       | wa-export          | Iglesia + salón                                                                                                         |
| clientColors          | Verde Oliva + Beige o toques dorados                                                                 | verified       | wa-export          |                                                                                                                         |
| dressCode             | Etiqueta formal; mujeres vestido largo de noche (evitar blanco, beige o gamas claras); hombres traje | verified       | wa-export          | Client typo “vestigo” → vestido                                                                                         |
| godparents            | —                                                                                                    | not_applicable | wa-export          | Explicit “NO PONER”                                                                                                     |
| brideParents          | [[PENDIENTE:BRIDE_PARENTS]]                                                                          | ambiguous      | wa-export          | Three parent names total; mapping per partner unresolved — see Placeholders                                             |
| groomParents          | [[PENDIENTE:GROOM_PARENTS]]                                                                          | ambiguous      | wa-export          | Only one name clearly Felipe/Redondo side; Ochoa parent missing — see Placeholders                                      |
| photoSetConstraint    | Use only the two provided HR files (D2.jpg, D4.jpg)                                                  | verified       | owner 2026-07-31   | OD4 confirmed. Not stated in wa-export (WA mentioned WeTransfer).                                                       |
| sourceAssetPath       | source:hr-photos                                                                                     | verified       | owner              | Opaque label; session holds real path                                                                                   |
| baseDemoId            | demo-boda-jewelry-box-wedding                                                                        | verified       | owner OD1          | Sole catalog `boda` preset; Lane A olive/beige/gold                                                                     |
| themePreset           | jewelry-box-wedding                                                                                  | verified       | owner OD1          | From baseDemoId                                                                                                         |
| sectionOrder          | hero, quote, countdown, location, gallery, personalizedAccess, rsvp, thankYou                        | verified       | owner OD2 + Goal 2 | Family omitted from published route until parent names confirmed; no padrinos/music/gifts/interludes; gallery = D4 only |
| rsvpConfirmationMode  | api                                                                                                  | verified       | owner OD3          | Access mode hybrid (product practice)                                                                                   |
| rsvpAccessMode        | hybrid                                                                                               | verified       | owner OD3          |                                                                                                                         |
| musicUrl              | —                                                                                                    | not_applicable | owner OD2 clarify  | Omitted unless client later requests                                                                                    |
| giftsMode             | —                                                                                                    | not_applicable | owner OD2 clarify  | Omitted unless client later requests (not in WA)                                                                        |
| itinerary             | religiosa 17:30 → recepción 19:30 → civil 20:15                                                      | verified       | wa-export          | Prefer inside `location` + short itinerary if section included; not a separate photo-heavy block                        |
| interludes            | —                                                                                                    | not_applicable | owner OD4          | No spare HR frames beyond hero + gallery                                                                                |
| godparentsSection     | —                                                                                                    | not_applicable | wa-export          | Client: “NO PONER” — **no padrinos**                                                                                    |

---

## Event Completeness

Contract maturity for this event type: `partial` (`getEventCompletenessContract('boda')`)

| requirement | fields                                                                                                | status              |
| ----------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| required    | slug, celebrantName, secondaryName, eventDate, sourceAssetPath, primaryVenueName, primaryVenueAddress | satisfied           |
| required    | baseDemoId, sectionOrder, rsvpConfirmationMode                                                        | satisfied (OD1–OD3) |
| recommended | reception*, itinerary times, colors, dress                                                            | verified            |
| optional    | godparents                                                                                            | N/A — omit          |

### Missing blockers

- None for partial `boda` contract.

### Non-blocking gaps

- Parent name mapping (`[[PENDIENTE:BRIDE_PARENTS]]`, `[[PENDIENTE:GROOM_PARENTS]]`) — Family
  section stays omitted until resolved
- Gallery is a single frame (D4); hero is D2 only
- Music / gifts omitted unless later requested

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

---

## Placeholders

| token                         | missing datum                              | blocking | reason                                                                    | replacement requirement                                                        |
| ----------------------------- | ------------------------------------------ | -------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `[[PENDIENTE:BRIDE_PARENTS]]` | Bride parent pair labels/names             | no       | WA listed three “papás” names without clear Perla vs Carlos grouping      | Client or owner confirms which names appear under Perla’s parents (and roles)  |
| `[[PENDIENTE:GROOM_PARENTS]]` | Groom parent pair; likely missing one name | no       | María de Jesús Felipe Redondo present; Ochoa-side parent absent / unclear | Client supplies missing parent and confirms display names for Carlos’s parents |

`READY_WITH_PLACEHOLDERS` may contain only documented **non-blocking** placeholders. Blocking
placeholders force `NOT_READY`. Demo/RSVP/sections are **owner decisions**, not placeholders.

---

## Owner Decisions

| id  | category              | issue                | evidence          | options             | recommendation    | status       |
| --- | --------------------- | -------------------- | ----------------- | ------------------- | ----------------- | ------------ |
| OD1 | demo-design-decisions | Base demo / preset   | Catalog           | jewelry-box-wedding | Accept            | **accepted** |
| OD2 | demo-design-decisions | Exact `sectionOrder` | See concrete list | OK / edit list      | List below        | **accepted** |
| OD3 | missing-client-facts  | RSVP mode            | Product practice  | api + hybrid        | api + hybrid      | **accepted** |
| OD4 | photograph-acceptance | Only D2 + D4         | Owner             | freeze              | freeze            | **accepted** |
| OD5 | ambiguous-data        | Parents              | WA 3 names        | placeholders        | keep placeholders | **accepted** |

### OD2 — section order (accepted)

1. `hero` (D2) → 2. `quote` → 3. `countdown` → 4. `location` → 5. `gallery` (D4 only) → 6.
   `personalizedAccess` → 7. `rsvp` → 8. `thankYou` (no third photo)

**Omitted:** family (until parent names confirmed), padrinos, music, gifts, interludes, multi-image
gallery.

---

## Agent Recommendations

| topic    | recommendation                  | basis                               | status            |
| -------- | ------------------------------- | ----------------------------------- | ----------------- |
| demo     | `demo-boda-jewelry-box-wedding` | OD1                                 | accepted          |
| palette  | Olive + beige + gold Lane A     | Client colors                       | accepted with OD1 |
| sections | OD2 list                        | Chat + 2-photo freeze + no padrinos | accepted          |
| rsvp     | `api` + hybrid                  | OD3                                 | accepted          |
| photos   | D2 hero; D4 gallery only        | OD4                                 | accepted          |

---

## Sections

| bucket                  | section keys                                                                  |
| ----------------------- | ----------------------------------------------------------------------------- |
| accepted (OD2 + Goal 2) | hero, quote, countdown, location, gallery, personalizedAccess, rsvp, thankYou |
| omitted                 | family (pending parent names), padrinos/godparents, music, gifts, interludes  |
| unresolved              | —                                                                             |

---

## Design Direction

| decision                          | value                                                                   | classification |
| --------------------------------- | ----------------------------------------------------------------------- | -------------- |
| Client-selected demo              | `demo-boda-jewelry-box-wedding` (owner OD1; WA had shown XV by mistake) | verified       |
| Recommended demo alternatives     | —                                                                       | not_applicable |
| Selected variant / visual profile | `jewelry-box-wedding`                                                   | verified       |
| Client color requirements         | Verde oliva + beige / toques dorados                                    | verified       |
| Recommended palette               | Olive–beige–gold Lane A                                                 | verified       |
| Unresolved visual decisions       | —                                                                       | not_applicable |

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque)  
Owner constraint: **only these two files** (session 2026-07-31). WhatsApp export does **not** state
a two-photo limit; it anticipated digital session delivery and WeTransfer.

| source filename | dims      | format | orientation | weight  | quality          | role    | duplicate | processing               | derivative                               |
| --------------- | --------- | ------ | ----------- | ------- | ---------------- | ------- | --------- | ------------------------ | ---------------------------------------- |
| D2.jpg          | 4000×6000 | jpeg   | portrait    | ~8.0 MB | production-ready | hero    | no        | normalize WebP (managed) | `hero-desktop.webp` / `hero-mobile.webp` |
| D4.jpg          | 4000×6000 | jpeg   | portrait    | ~7.0 MB | production-ready | gallery | no        | normalize WebP (managed) | `gallery-01.webp`                        |

### Uniqueness table (required before READY_*)

| role    | source | derivative                           | intentional multi-role? |
| ------- | ------ | ------------------------------------ | ----------------------- |
| Hero    | D2.jpg | hero-desktop.webp / hero-mobile.webp | no                      |
| Gallery | D4.jpg | gallery-01.webp                      | no                      |

Note: With two frames, do not invent additional gallery slots. Dual-role only if owner documents
intentional multi-role. Hero desktop/mobile release keys share one source file (`hero-source.jpg`)
with independent focals. Prep parent tokens remain below; they are **not** published.
---

## Implementation Constraints

- prepReadiness is `READY_WITH_PLACEHOLDERS` — implementation allowed with documented parent
  placeholders (OD5); not `READY_FOR_IMPLEMENTATION` until parents resolve (optional) / no other
  blockers remain for full freeze.
- Lane A inheritance resets: olive–beige–gold profile; dual-venue location via `venues[]` (ceremony
  first for hero metadata); civil ceremony stays in `location.indications`.
- Lane B: none unless jewelry-box-wedding demo also needs the same palette (unlikely for one
  client).
- Padrinos: omit (`NO PONER`).
- Parents: placeholder tokens in this prep doc only (OD5). **Family section is omitted from the
  published invitation** until names are confirmed (no guest-facing “Por confirmar”, no invented
  names).
- Photo set: only D2 + D4 (OD4); no interludes; thankYou without a third frame.
- Maps association: salón = first link; iglesia = second link (owner).
- Reveal: external CTA `Abrir invitación`; seal hint `Toca el sello` (single primary action).
- Audit remediations: `.agent/plans/active/boda-perla-y-carlos-audit-backlog.md`; implementation
  audit: `.agent/plans/active/boda-perla-y-carlos-implementation-audit.md`.

---

## Preparation Readiness History

| date       | readiness                 | helper basis                   | notes                                                                                                 |
| ---------- | ------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 2026-07-31 | `NOT_READY`               | `evaluatePreparationReadiness` | Initial canonical state                                                                               |
| 2026-07-31 | `NOT_READY`               | `evaluatePreparationReadiness` | OD1/OD3/OD4/OD5 resolved; OD2 pending                                                                 |
| 2026-07-31 | `READY_WITH_PLACEHOLDERS` | `evaluatePreparationReadiness` | OD2 accepted; non-blocking parent placeholders remain                                                 |
| 2026-07-31 | `READY_WITH_PLACEHOLDERS` | local apply                    | Managed definition + Lane A profile applied to **local** only                                         |
| 2026-07-31 | `READY_WITH_PLACEHOLDERS` | audit Goal A–B                 | Guest “Por confirmar”; Lane A inheritance-reset; uniqueness derivatives filled                        |
| 2026-08-01 | `READY_WITH_PLACEHOLDERS` | Goal 2 corrections             | Family omitted from publish; ceremony-first hero via `venues[]`; shared hero source; Lane A RSVP band |
