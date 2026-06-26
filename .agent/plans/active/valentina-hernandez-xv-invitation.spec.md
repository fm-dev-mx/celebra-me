---
title: Valentina Hernández Almaguer — XV Invitation Spec
status: draft
created: 2026-06-26
updated: 2026-06-26
related_plans:
  - .agent/plans/active/xv-xareni-iyarit-client-invitation.md
  - .agent/plans/active/invitation-workflow-flow-analysis.md
related_rules:
  - .agent/rules/invitation-production.md
  - .agent/rules/invitation-preset-source-of-truth.md
  - .agent/rules/manual-sql-manifest.md
  - .agent/rules/database.md
commercial_scope: template-adaptation ($499 tier)
supersedes: []
superseded_by: []
---

# Valentina Hernández Almaguer — XV Invitation Spec

## 1. Goal

Create a DB-published client invitation for Valentina Hernández Almaguer's XV años (Saturday, August
29, 2026) at Finca Las Palmas, Texcoco. This is a **$499 template adaptation**: use an existing XV
demo as the structural and visual base, customize copy, colors, photos, gifts, RSVP, guest passes,
and music — and achieve an editorial/fashion-magazine feel through hero composition, copy, palette,
and photography, not through custom component architecture or a new theme preset.

## 2. Commercial Scope Guard

| Scope level                         | What it includes                                                                                                      | Price tier |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Template adaptation (this spec)** | Existing demo base, color override, content swap, photo replacement, gift/RSVP config, guest passes, music link       | $499       |
| Custom editorial build              | New template from scratch, custom hero layout, new section components, editorial-specific tailwind-like layout system | $1,499     |

**If implementation reveals any of the following, pause and flag:**

- A new Astro/React component is required (beyond swapping props/content)
- A new section variant or new `data-variant` branch is needed
- The existing section order or layout cannot accommodate the client copy/photos without structural
  changes
- A new theme preset must be created in the theme contract, schemas, and publish guard
- The hero, envelope, or gallery requires a fundamentally different layout structure than what
  existing component branches provide

If any of these triggers fires, do not proceed — escalate to Paco for commercial re-scoping.

## 3. Recommended Base — Compact Demo Comparison

### Base candidates (all `eventType: xv` in `DEMO_PRESET_CATALOG`)

| Criterion                      | celestial-blue                                                                                                          | enchanted-rose                                              | editorial                                                                                                               | jewelry-box                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Visual fit**                 | Blue — must be fully overridden to pink/white                                                                           | Rose/blush — closest warm base to pink                      | Noir/black/onyx — opposite direction                                                                                    | Jewel/purple tones — neutralish                   |
| **Has `sectionOrder`**         | ❌ No (implicit from JSON keys)                                                                                         | ✅ Yes (includes `personalizedAccess`)                      | ❌ No                                                                                                                   | ❌ No                                             |
| **Component branches**         | Proven: ItineraryProgram, ThankYou, gallery layout all have `celestial-blue` variant                                    | Has own branches for rose-specific treatments               | Has editorial-specific branches (noir framing, gold accents)                                                            | Fewer modern branches, older component support    |
| **Proven as client base**      | ✅ Xareni Iyarit used this pattern successfully                                                                         | ❌ Not yet used for a client                                | ❌ Not yet used for a client                                                                                            | ❌ Not yet used for a client                      |
| **CSS override effort**        | ~52 tokens to remap (Xareni pattern exists)                                                                             | ~40 tokens to remap (less drift from target palette)        | Would need full brightening (high risk of dark-token leakage)                                                           | ~30 tokens, but coverage gaps in section variants |
| **Gifts structure**            | bank + cash (needs store support added)                                                                                 | bank + cash (needs store support added)                     | store + bank + cash (multi-type ready)                                                                                  | store + bank + paypal + cash (richest)            |
| **Music support**              | ✅ Has music section                                                                                                    | ✅ Has music section                                        | ❌ No music in demo                                                                                                     | ✅ Has music section                              |
| **Section count (non-render)** | 13 (hero, location, family, gallery, gifts, rsvp, quote, thankYou, itinerary, countdown, interludes, envelope, sharing) | 14 (same 13 + `sectionOrder` with `personalizedAccess`)     | 12 (hero, location, family, gallery, gifts, rsvp, quote, thankYou, itinerary, countdown, interludes, envelope, sharing) | 13 (same as celestial-blue + richer gifts)        |
| **Risk**                       | Low (proven pattern)                                                                                                    | Medium (component branch coverage unknown for all sections) | High (overriding dark→light may cause regressions)                                                                      | Medium (older demo, may have undocumented gaps)   |

### Recommendation

**Primary: `demo-xv-celestial-blue`** — for the same reasons Xareni used it: the component branch
coverage is complete, the override pattern is proven, and risk is lowest.

**Secondary: `demo-xv-enchanted-rose`** — if the pink visual target proves difficult to achieve
through blue→pink override. Switch only if the CSS override diff exceeds ~150 lines or blue leakage
cannot be eliminated through CSS variable overrides alone.

**Rejected:** `demo-xv-editorial` (dark→light reversal is high-risk and unproven),
`demo-xv-jewelry-box` (older, fewer features, fewer component branches).

### Expected customization effort

| Item                      | Estimate                                                                 |
| ------------------------- | ------------------------------------------------------------------------ |
| Content payload (DB JSON) | ~280 lines (matching `eventContentSchema`)                               |
| CSS variable overrides    | ~250 lines (matching Xareni pattern)                                     |
| Photo assets              | 12–16 WebP files (hero, portrait, gallery, family, thankYou, interludes) |
| Gifts payload             | 2–3 items (store with Liverpool links + cash)                            |
| Music                     | 1 URL (if provided)                                                      |
| SQL patch                 | ~100 lines with preflight + verification                                 |

## 4. Claims Requiring Verification

The following claims in this spec are **not** proven by the audit alone and must be confirmed during
implementation:

| Claim                                                                                             | Current evidence                                                                                                      | How to verify                                                                                                     |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `demo-xv-celestial-blue` has no `sectionOrder` and no `personalizedAccess` content section        | File read of `src/content/event-demos/xv/demo-xv-celestial-blue.json` — confirmed absent                              | Re-read file; check that `sectionOrder` and `personalizedAccess` keys don't exist                                 |
| `personalizedAccess` renders without content-section data                                         | None of the 4 XV demos include a `personalizedAccess` section in JSON; Xareni payload added it to `sectionOrder` only | Inspect published Xareni payload; check if `personalizedAccess` appears in published content or is render-derived |
| WhatsApp photos are 37–214 KB each (compressed)                                                   | `ls -la` showed sizes on the WhatsApp Chat folder                                                                     | Re-verify file sizes; compare to originals from WeTransfer when received                                          |
| PDF `Fotos Valeria.pdf` has 16 pages                                                              | `_chat.txt` line 164 states "Fotos Valeria.pdf • 16 pages"                                                            | Extract and count PDF pages when implementing                                                                     |
| Client WhatsApp name is "Llita-Al 29 💫" and is Valentina Hernández Almaguer                      | `_chat.txt` line 166 confirms: "Es Valentina Hernandez Almaguer"                                                      | Cross-reference with client's actual phone number or message                                                      |
| Liverpool registry number `52020257` is unconfirmed                                               | Inferred from client brief only                                                                                       | Ask client to verify by opening `https://mesaderegalos.liverpool.com.mx/milistaderegalos/52020257`                |
| Music "CAN'T STOP THE FEELING!" by Justin Timberlake is desired                                   | Screenshot `00000154-PHOTO-2026-06-24-13-12-33.jpg` referenced in chat                                                | View the screenshot; confirm with client                                                                          |
| Guest/pass flow supports per-guest different pass counts                                          | WhatsApp chat lines 123–130 show client asking about this                                                             | Test: create guest with 4 passes and another with 2 passes in dashboard, verify personalized link                 |
| Route `/xv/valentina-hernandez` is available (no slug collision)                                  | Not checked against production DB `events` table                                                                      | Query: `SELECT slug FROM events WHERE slug = 'valentina-hernandez'`                                               |
| 4 existing static routes (ana-sofia, cesar-ramses, gerardo-sesenta, ximena-meza) still return 200 | Historical commit `7377006f` shows migration to DB-first; routes depend on DB state                                   | `curl -s -o /dev/null -w "%{http_code}"` for each after deployment                                                |
| Vercel strips `Server-Timing` but `X-Render-Timing` survives                                      | Memory entry + commits `7264632f`, `f67522da`                                                                         | Verify with `curl -I` on Vercel preview deployment                                                                |

## 5. Source of Truth

| Stage                          | Source of truth                                                                                 | Notes                                                                                                                                                                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client brief / client manifest | WhatsApp chat at `Clientes/xv revista/WhatsApp Chat/_chat.txt`                                  | Informal reference; re-confirm before final production patch                                                                                                                                                                                                                     |
| Client photos (raw)            | WhatsApp Chat folder (28 JPGs + `Fotos Valeria.pdf` 16 pages)                                   | Compressed. Request originals via WeTransfer before hero/gallery production                                                                                                                                                                                                      |
| Event copy/text                | This spec + WhatsApp chat + printed invitation images (00000113–00000128)                       | Cross-reference PDF content for names, dates, venue                                                                                                                                                                                                                              |
| Demo structural base           | `src/content/event-demos/xv/demo-xv-celestial-blue.json`                                        | Reference for section schema, not client data                                                                                                                                                                                                                                    |
| Published content              | `published_invitation_content` (DB), created via versioned SQL/scripted patch                   | **Primary creation path.** The same commit + same payload + same SQL must produce the same state across local/staging/production. Dashboard `publishDraft()` is available for visual review iterations and post-delivery operational edits, not for initial structured creation. |
| Theme/preset                   | `invitations.theme_id` + `DEMO_PRESET_CATALOG`                                                  | Resolver: `resolveInvitationTheme()`. Always match `base_demo_id` → `themeId`                                                                                                                                                                                                    |
| Draft content                  | `invitation_content_drafts` (DB), created via scripted creation patch or dashboard draft editor | The scripted creation patch writes content directly to `published_invitation_content`. Draft content is used for dashboard-based visual review/iteration before re-publishing.                                                                                                   |
| Asset registry                 | `src/assets/images/events/xv-valentina-hernandez/index.ts`                                      | Build-time. Register via `export const assets = { ... }`                                                                                                                                                                                                                         |
| RSVP event                     | `events` table (DB), created by `publishDraft()` as side-effect                                 | Verify after every publish. If missing, use dashboard repair or SQL                                                                                                                                                                                                              |
| Guests/passes                  | `guests` table (DB), managed via dashboard UI                                                   | Do not use SQL for guest management. Dashboard is the only supported path                                                                                                                                                                                                        |
| Public route                   | `/[eventType]/[slug]` via `src/lib/content/events.ts` → `src/lib/adapters/event.ts`             | DB-first resolution since commit `7377006f`                                                                                                                                                                                                                                      |

## 6. Required Client/Manual Inputs

| Input                                                            | Status         | Needed from           | Why it matters                                                                                                                                                               |
| ---------------------------------------------------------------- | -------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parents: Nadia Estrella Almaguer [surname?]                      | **Unresolved** | Paco/client           | Surname must be confirmed. Chat shows "Nadia Estrella Almaguer" but full maternal surname of mother is unclear                                                               |
| Parents: Juan Carlos Hernández [surname?]                        | **Unresolved** | Paco/client           | Surname must be confirmed                                                                                                                                                    |
| Godparents: Nayeli Almaguer [surname?]                           | **Unresolved** | Paco/client           | Role clear, surname incomplete                                                                                                                                               |
| Godparents: César A. Pérez Monroy                                | **Unresolved** | Paco/client           | Name clear, confirm role (madrina/padrino or both)                                                                                                                           |
| Ceremony venue                                                   | **Unresolved** | Paco/client           | Chat says "Finca Las Palmas" for reception. Where is the 3:45 PM ceremony? Same venue or church?                                                                             |
| Google Maps link(s)                                              | **Unresolved** | Paco/client           | Required for location cards with map navigation                                                                                                                              |
| Liverpool registry number (`52020257?`)                          | **Unresolved** | Paco/client           | Must be verified before SQL patch. Check `https://mesaderegalos.liverpool.com.mx/milistaderegalos/52020257`                                                                  |
| Liverpool registry name (`Valens Dream Team?`)                   | **Unresolved** | Paco/client           | Display name in gifts section                                                                                                                                                |
| Original photos (non-WhatsApp)                                   | **Unresolved** | Client via WeTransfer | WhatsApp photos may be compressed. Hero must support a usable crop around 1600px wide after framing. Gallery images must look sharp on mobile and desktop after WebP export. |
| Music: "CAN'T STOP THE FEELING!" (J. Timberlake) — usable source | **Unresolved** | Paco/client           | Screenshot exists (chat line 179). Need: YouTube/Spotify/Apple Music link OR audio file. Screenshot is not a usable asset                                                    |
| RSVP deadline                                                    | **Unresolved** | Paco/client           | Required for location indication cards ("Confirma antes del...")                                                                                                             |
| Instagram profile (`@val27_0811`) — is it active?                | **Unresolved** | Paco/client           | Confirm handle is correct and publicly accessible                                                                                                                            |
| Route slug preference                                            | **Unresolved** | Agent/Paco            | `valentina-hernandez`? `xv-valentina-hernandez`? Check slug uniqueness                                                                                                       |
| Final copy approval                                              | **Unresolved** | Paco/Client           | All copy must be signed off before preview is treated as final                                                                                                               |

## 7. Data/Content Changes Required

### Invitation metadata

- `eventType: "xv"`
- `isDemo: false`
- title: "XV Años — Valentina Hernández Almaguer"
- description: Editorial/fashion magazine inspired XV invitation
- `_assetSlug: "xv-valentina-hernandez"`
- theme: `{ fontFamily: "serif", preset: "celestial-blue" }`
- route slug: TBD (must be unique across `events.slug` and
  `published_invitation_content(event_type, slug)`)

### SectionOrder

Define explicit `sectionOrder` including `personalizedAccess` (matching the Xareni pattern):

```
quote, family, countdown, itinerary, location, gallery, gifts, personalizedAccess, rsvp, thankYou
```

### Hero

- name: "Valentina Hernández Almaguer"
- label: "Mis XV Años" (or editorial variant like "XV Edition")
- date: `2026-08-29T21:45:00.000Z` (UTC of 3:45 PM Mexico City — verify offset)
- backgroundImage: hero image
- portrait: portrait image

### Quote

Candidate: "Dicen que la moda es temporal, pero los recuerdos son eternos. Acompáñame a escribir el
primer capítulo de mi nueva historia..." Author: "Valentina Hernández Almaguer"

### Countdown

Target: Saturday, August 29, 2026

### Family

- Parents: confirmed names only
- Godparents: confirmed names only

### Itinerary

- 3:45 PM — Ceremonia religiosa
- 4:30 PM — Cóctel de bienvenida
- Later — Recepción / celebración

### Location

- Ceremony venue (TBD — confirm if at Finca Las Palmas or elsewhere)
- Reception: Finca Las Palmas, 4ta Cerrada de Palma s/n, San Luis Huexotla, Texcoco, México
- Indications: dress code "Formal. El color rosa y lila están reservados para la quinceañera." +
  RSVP deadline
- Punctuality copy: "Agradecemos tu puntualidad para disfrutar juntos cada momento mágico de esta
  noche."

### Dress code (via location indications or dedicated section)

- Formal
- Pink and lilac reserved for the XV / celebrant
- "Damas: divinas" / "Caballeros: guapos" (if client approved)

### Gifts

Gift intro: "Su presencia es mi mejor regalo, pero si desean tener un detalle conmigo, les comparto
estas opciones."

1. Store/Liverpool registry (number/name TBD) — prefer multi-link pattern from `fb830ec5`
2. "Lluvia de sobres" — "Se proporcionará un sobre el día del evento."

### RSVP

- `accessMode: "hybrid"`
- `confirmationMode: "api"`
- Copy: "Confirma tu asistencia desde esta invitación. Me encantará saber que vienes."
- WhatsApp fallback available but platform RSVP remains primary

### Gallery

8–12 photos from the best available originals.

### Music

Only if usable asset provided (link or audio file). Screenshot is not sufficient.

### Social section

- Instagram: `@val27_0811`
- Copy: "Comparte tus mejores fotos y videos de la fiesta etiquetándome: @val27_0811. Me encantará
  ver la celebración desde tu perspectiva."

### Envelope

- sealInitials: "V·H" or "V·H·A"
- sealedPalette: pink editorial tones

### Sharing

Spanish WhatsApp template with `{name}`, `{eventTitle}`, `{inviteUrl}`

## 8. Validation Requirements

### 8.1 Invitation Preview / Publication Readiness

| Stage                   | Validation                                                                    | Evidence expected                               | Blocks preview? |
| ----------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- | --------------- |
| Local build             | `pnpm type-check`, `pnpm lint`, `pnpm build`                                  | All pass 0 errors                               | ✅ Yes          |
| Schema                  | DB payload validated against `eventContentSchema`                             | Schema passes                                   | ✅ Yes          |
| Theme preset            | `resolveInvitationTheme()` returns valid `ThemePreset`                        | No drift                                        | ✅ Yes          |
| Snapshot                | Snapshot matches `DEMO_PRESET_CATALOG` entry                                  | No repair needed                                | ✅ Yes          |
| Asset registry          | All image keys resolve at build time                                          | Build passes, no missing asset errors           | ✅ Yes          |
| Route renders           | `/{eventType}/{slug}` returns 200                                             | 200 OK, correct name/date                       | ✅ Yes          |
| All sections present    | Quote, countdown, family, itinerary, location, gallery, gifts, RSVP, thankYou | Each section renders with content               | ✅ Yes          |
| Gifts                   | Liverpool links resolve + cash item renders                                   | Both items visible                              | ✅ Yes          |
| RSVP form               | Form renders, accepts test submission                                         | 200 on RSVP POST                                | ✅ Yes          |
| Mobile layout           | DevTools iPhone SE / Pixel 7                                                  | No layout breakage, no blue leakage             | ✅ Yes          |
| Desktop layout          | 1440px viewport                                                               | Hero framing, section spacing correct           | ✅ Yes          |
| Vercel preview          | Deploy preview URL                                                            | Accessible, cache headers visible               | ✅ Yes          |
| No blue palette leakage | Every section checked for blue custom properties                              | All blue tokens overridden to pink/white/silver | ✅ Yes          |

### 8.2 Guest/Pass Capability Validation

These validations prove the RSVP/guest system works with a small number of test guests. They do
**not** require the real guest list to be loaded. The client manages real guest loading and pass
assignment after delivery.

| Stage                     | Validation                                                                      | Evidence expected                                                     | Blocks delivery?                           |
| ------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| Guest management UI       | UI is available and functional at `/dashboard/invitaciones/[id]/invitados`      | Page renders, can add/edit/delete guests                              | ❌ No (real list not needed)               |
| Personalized link works   | Create 1–2 test guests with different pass counts; click their personalized URL | Correct pass count displayed per guest                                | ❌ No (can be done after preview)          |
| RSVP from guest link      | Test guest submits RSVP via personalized link                                   | RSVP recorded in dashboard with correct guest identity and pass count | ❌ No (can be done after preview)          |
| Incremental guest loading | Add a new guest after initial setup                                             | Guest appears and receives working personalized link                  | ❌ No (proves client can add guests later) |

### 8.3 Production / Client Delivery

| Stage                  | Validation                                  | Evidence expected                        | Blocks delivery?        |
| ---------------------- | ------------------------------------------- | ---------------------------------------- | ----------------------- |
| Production route       | `/{slug}` returns 200 on production         | Live URL accessible                      | ✅ Yes                  |
| Preflight passes       | Production SQL patch preflight runs clean   | `PREFLIGHT OK` notice                    | ✅ Yes                  |
| DB backup taken        | Backup file exists                          | File on disk, verify size                | ✅ Yes                  |
| No regression          | All existing public routes still 200        | 4 routes + all demos                     | ✅ Yes                  |
| RSVP event exists      | `events` row for this invitation            | `GET /api/rsvp/event/{slug}` returns 200 | ✅ Yes                  |
| Vercel cache behaviour | `X-Vercel-Cache: HIT` on repeat requests    | Cache operational                        | ❌ No (informational)   |
| Client opens link      | Client confirms they can see the invitation | WhatsApp thumbs-up or reply              | ✅ Yes (final sign-off) |

## 9. Production Safety Requirements

### Primary creation path: versioned SQL/scripted data patch

For this invitation, the initial structured creation and publication data are produced through a
**versioned SQL/scripted data patch**. This ensures the process is reproducible across
local/staging/production:

> The same commit + same assets + same payload + same SQL/script must produce the same intended
> invitation state in any environment.

### Scripted creation patch requirements

Each scripted creation patch must:

1. Include the full manifest (`@script-id`, `@purpose`, `@env`, `@ticket`, `@tables`, `@operation`,
   `@expected-rows-min`, `@expected-rows-max`, `@requires-backup: true`, `@dry-run-query`,
   `@rollback`) per `.agent/rules/manual-sql-manifest.md`
2. Wrap in `BEGIN; ... COMMIT;`
3. Include `DO $$ ... preflight ... END $$;` block that raises `PREFLIGHT_ABORT` if state is
   unexpected (expected row counts, existing state checks)
4. Include verification `SELECT` after mutation
5. Pass `pnpm db:sql:lint -- --file <path>` (dry-run lint only)
6. Be validated on local or staging environment before production
7. Require explicit Paco approval before production execution
8. Require production DB backup before execution

### Preflight and backup — when mandatory

| Scenario                                                      | Preflight required? | DB backup required? |
| ------------------------------------------------------------- | ------------------- | ------------------- |
| Executing the scripted creation patch against production      | ✅ Mandatory        | ✅ Mandatory        |
| Executing any post-publish SQL repair against production      | ✅ Mandatory        | ✅ Mandatory        |
| Dashboard-only operations (add guest, edit draft, re-publish) | ❌ Not required     | ❌ Not required     |
| Dashboard post-delivery operational edits                     | ❌ Not required     | ❌ Not required     |

### Dashboard/application role

Dashboard/application flows are used for:

- **Visual review** of the published invitation (preview route, section inspection)
- **RSVP testing** (submit test RSVPs, verify storage)
- **Guest/pass capability validation** (create 1–2 test guests, verify personalized links)
- **Post-delivery operational edits** (add guests, update guest pass counts, minor content
  corrections)

Dashboard is **not** the primary path for initial structured creation/publication data.

### Safety checklist (for scripted creation patch)

- [ ] Preflight query executed and shows expected state on target environment
- [ ] Back up taken (`PROD_DB_URL=... pnpm db:prod:backup`)
- [ ] Dry-run lint passes (`pnpm db:sql:lint -- --file <path>`)
- [ ] Patch reviewed by Paco
- [ ] Expected row count bounded (min/max)
- [ ] Mutation targeted by slug + event_type + is_demo = false + deleted_at IS NULL
- [ ] Verification SELECT confirms correct mutation
- [ ] Same patch validated on local or staging first

## 10. Acceptance Criteria

### 10.1 Invitation — Content Correctness

1. Route `/xv/{slug}` returns 200 with correct event title, name, date, venue(s)
2. Hero shows Valentina's name and "Mis XV Años" label
3. Theme preset `celestial-blue` is retained internally; visual output is pink/white/silver — no
   blue legacy
4. All 4 existing static routes return 200 (regression)
5. All local demos (`/xv/demo-xv-*`) render identically before/after changes
6. `pnpm type-check` passes 0 errors
7. `pnpm lint` passes 0 errors
8. `pnpm build` passes

### 10.2 Invitation — Functional Correctness

9. Gifts section: Liverpool registry link(s) resolve + "Lluvia de sobres" renders
10. RSVP form: renders, accepts submissions, stores data
11. Music block: plays if asset provided; silently hidden if not
12. Gallery: all photos render at correct aspect ratios
13. Envelope: seal initials correct, seal animation works
14. Social section: Instagram link renders and is clickable
15. Mobile + desktop: no layout breakage, texts readable

### 10.3 Guest/Pass Capability (does NOT block preview/publication — test guests only)

16. Guest management UI is available at `/dashboard/invitaciones/[id]/invitados`
17. Creating 1–2 test guests with different pass counts produces working personalized links
18. RSVP via personalized guest link records correct guest identity and pass count
19. Adding a new guest after initial setup works without re-publishing
20. The client understands that real guest loading and pass assignment are managed after delivery

### 10.4 Production Safety

21. Snapshot is consistent with `DEMO_PRESET_CATALOG` entry (no drift repairs needed)
22. `audit-theme-preset-drift.sql` returns clean
23. DB backup taken before any production mutation
24. Preflight query executed and returned expected state before mutation
25. Rollback plan documented and reviewed

### 10.5 Client Delivery

26. Client opens URL and confirms all content
27. Client can share link with first guest
28. Client understands how to add/modify guest list in dashboard

## 11. Implementation Plan

| Phase                                  | Owner                             | Input                                          | Action                                                                                                                                                                                   | Output                                                                                | Validation                                                                                                                          |
| -------------------------------------- | --------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 0. Client intake completion            | Paco                              | WhatsApp chat, client                          | Confirm all unresolved inputs (§6)                                                                                                                                                       | Confirmed data set                                                                    | All §6 items resolved or explicitly deferred                                                                                        |
| 1. This spec approval                  | Paco                              | This document                                  | Review and approve                                                                                                                                                                       | Spec accepted                                                                         | All acceptance criteria understood                                                                                                  |
| 2. Original photo + music collection   | Paco                              | Client                                         | Request WeTransfer of originals + music link                                                                                                                                             | High-res assets                                                                       | Hero supports usable crop ~1600px wide after framing; gallery images sharp on mobile/desktop after WebP export; music link resolves |
| 3. Content payload preparation         | Agent                             | Confirmed data + celestial-blue demo           | Build DB payload JSON matching `eventContentSchema`, add explicit `sectionOrder` with `personalizedAccess`                                                                               | Local payload artifact                                                                | Schema validation passes                                                                                                            |
| 4. Asset processing                    | Agent                             | Original photos                                | Crop, editorial pink grade, WebP q86, write `index.ts` registry                                                                                                                          | `src/assets/images/events/xv-valentina-hernandez/`                                    | All keys resolve at build time                                                                                                      |
| 5. Event-scoped CSS                    | Agent                             | Xareni SCSS pattern (`_xv-xareni-iyarit.scss`) | Create `_xv-valentina-hernandez.scss`, remap celestial-blue tokens → pink editorial palette                                                                                              | `src/styles/themes/sections/_xv-valentina-hernandez.scss` + register in `_index.scss` | Visual QA: zero blue leakage on any section                                                                                         |
| 6. Scripted creation patch preparation | Agent                             | Payload + asset + SCSS artifacts               | Write versioned SQL patch with manifest, preflight, expected row counts, rollback, verification SELECT. Store at `scripts/manual/production-patches/20260626_valentina_hernandez_xv.sql` | SQL patch file                                                                        | Manifest validates; local/staging dry-run passes; `pnpm db:sql:lint -- --file <path>` passes                                        |
| 7. Local/staging validation            | Agent                             | SQL patch                                      | Run patch against local or staging DB, verify published invitation renders. Reconcile with dashboard preview for visual review                                                           | Validated patch                                                                       | Route 200, RSVP API responds, visual parity with dashboard preview                                                                  |
| 8. Preview + visual QA                 | Agent + Paco                      | Preview URL                                    | Dashboard-based visual review per §8.1, test RSVP, verify all sections                                                                                                                   | Preview signed off                                                                    | All §10.1 and §10.2 criteria met                                                                                                    |
| 9. Guest/pass capability validation    | Agent                             | Dashboard                                      | Create 1–2 test guests with different pass counts, verify personalized links, RSVP, incremental guest loading                                                                            | Capability proven                                                                     | §10.3 criteria all pass                                                                                                             |
| 10. Production execution               | Paco (approves), Agent (prepares) | Validated patch + backup                       | Preflight → backup → execution → verification. Only after explicit Paco approval.                                                                                                        | Production invitation live                                                            | §10.4 criteria all pass                                                                                                             |
| 11. Client delivery                    | Paco                              | Public URL                                     | Share link via WhatsApp, confirm client access                                                                                                                                           | Client confirmed                                                                      | §10.5 criteria met                                                                                                                  |
| 12. Post-delivery documentation        | Agent                             | This session                                   | Update `.agent/rules/invitation-production.md` with step-by-step for future client invitations if new patterns emerged                                                                   | Updated doc                                                                           | No stale or contradictory docs                                                                                                      |

## 12. Manual Checklist for Paco

### Before Implementation

- [ ] **Confirm parent names** — WhatsApp shows "Nadia Estrella Almaguer" and "Juan Carlos
      Hernández". Full surnames needed. Cross-reference with the printed invitation photos
      (00000113–00000128 in WhatsApp folder).
- [ ] **Confirm godparent names** — WhatsApp shows "Nayeli Almaguer" and "César A. Pérez Monroy".
      Confirm full names and roles (madrina/padrino or both as a couple).
- [ ] **Confirm ceremony venue** — Is the 3:45 PM religious ceremony also at Finca Las Palmas, or at
      a different church/venue?
- [ ] **Obtain Google Maps link** — For Finca Las Palmas: 4ta Cerrada de Palma s/n, San Luis
      Huexotla, Texcoco, México.
- [ ] **Confirm Liverpool registry** — Verify number `52020257` and name `Valens Dream Team` at
      `https://mesaderegalos.liverpool.com.mx/milistaderegalos/52020257`.
- [ ] **Request original photos** — Ask client to send via WeTransfer to `soporte@celebra-me.com`.
      WhatsApp-compressed photos (37–214 KB) are insufficient for hero and gallery. The
      `Fotos Valeria.pdf` (16 pages, 1.1 MB) is also compressed.
- [ ] **Request music asset** — Client screenshot shows "CAN'T STOP THE FEELING!" by Justin
      Timberlake. Ask client for YouTube link, Spotify/Apple Music link, or audio file. A screenshot
      is unusable.
- [ ] **Confirm Instagram** — `@val27_0811` is correct and publicly accessible.
- [ ] **Review WhatsApp Chat folder** — At `Clientes/xv revista/WhatsApp Chat/`. Cross-reference the
      printed invitation images (files 00000113–00000128) with all copy requirements. Extract data
      from `Fotos Valeria.pdf` using `pymupdf` or similar.
- [ ] **Confirm route slug** — Propose `valentina-hernandez` or `xv-valentina-hernandez`. Check for
      uniqueness.
- [ ] **Validate this spec** — Read §10 Acceptance Criteria and confirm you agree with the scope
      boundary.
- [ ] **Understand guest responsibility** — Real guest loading and pass assignment are managed by
      the client after delivery. The implementation only proves the capability with test guests. Do
      not request or collect the real guest list during implementation.

### Before Preview (agent will have published to preview)

- [ ] **Verify hero photo resolution** — Is it the best quality original? If WhatsApp-compressed, do
      not approve.
- [ ] **Check all names** — Parents, godparents, and celebrant names correct.
- [ ] **Check event details** — Date (Aug 29, 2026), times (3:45 PM / 4:30 PM), venues and
      addresses.
- [ ] **Check itinerary** — Ceremony → cocktail → reception matches client expectation.
- [ ] **Check dress code** — "Formal" + "rosa y lila reservados" correct.
- [ ] **Check gifts** — Liverpool link works, "Lluvia de sobres" copy correct.
- [ ] **Check RSVP** — Form renders, confirmation message matches approved copy.
- [ ] **Check gallery** — Photo selection, order, and quality approved.
- [ ] **Check music** — Plays on mobile and desktop (if asset provided).
- [ ] **Check mobile layout** — Test on actual device or Chrome DevTools.
- [ ] **Check social** — Instagram handle correct.
- [ ] **Run `pnpm build`** — Confirm no errors before treating preview as final.
- [ ] **Check for blue leakage** — No celestial-blue colors visible in any section.
- [ ] **Trigger §3 scope guard** — If any layout/component change was required, re-evaluate
      commercial scope.

### Before Production / Client Delivery

- [ ] **Run `pnpm agent:git-safety:check`** — Confirm git safety.
- [ ] **Run `scripts/sql/audit-theme-preset-drift.sql`** — Clean output.
- [ ] **Run assign-owner** — Through dashboard before any publish attempt.
- [ ] **Verify published content** — Route works, all sections render.
- [ ] **Verify RSVP event** — `events` row exists and responds to API.
- [ ] **Add at least 1 test guest** — Confirm personalized link works with correct pass count. Real
      guest loading is client-managed after delivery.
- [ ] **Take production DB backup** — If SQL patch is required (mandatory for creation patch). Not
      required for dashboard-only edits.
- [ ] **Run SQL preflight** — If patch used, verify expected state before executing.
- [ ] **Check all existing routes** — Demos + existing client routes still 200.
- [ ] **Final build** — `pnpm build` passes.
- [ ] **Share with client** — Via WhatsApp with instructions: (1) how guests use the personalized
      link, (2) how the client can add/modify guests in the dashboard after delivery.
