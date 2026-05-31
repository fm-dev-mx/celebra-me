---
title: Invitation Workflow Flow Analysis and Implementation Plan
status: active
created: unknown
updated: 2026-05-31
---

# Invitation Workflow Flow Analysis and Implementation Plan

## 1. Problem Statement

The current dashboard flow at Celebra-me.com has overlapping and unclear separation between demos,
invitation projects, capture links, published invitations, and RSVP events. Creating an invitation
mixes internal project setup with final invitation content. Capture links exist but their lifecycle
and visibility could be clearer. Some projects can appear published while missing public content or
an associated RSVP event.

Hardcoded real client data in `src/content/events/*.json` is a **high-priority source-of-truth and
privacy issue**: four production invitations have their full content (real names, dates, locations)
version-controlled in the repository. Any admin change requires editing code, deploying, and
exposing PII in git history. Client data must live exclusively in the database, editable through the
dashboard.

## 2. Current-State Findings (Verified Against Actual Code)

### Data Model

| Entity                          | Table / File                                                                    | Managed From                                  | Status               |
| ------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- | -------------------- |
| Demo/template preset            | `demo-preset-catalog.ts` (code) + `src/content/event-demos/*.json` (filesystem) | Code                                          | ✅ Well-separated    |
| Invitation project              | `invitation_projects` (DB)                                                      | `/dashboard/invitaciones`                     | ✅ Operational spine |
| Intake request (capture link)   | `intake_requests` (DB)                                                          | `/dashboard/invitaciones/[id]`                | ✅ Good              |
| Intake submission (client data) | `intake_submissions` (DB)                                                       | `/dashboard/invitaciones/[id]/review`         | ✅ Good              |
| Draft content                   | `invitation_content_drafts` (DB)                                                | `/dashboard/invitaciones/[id]/draft`          | ✅ Good              |
| Published invitation content    | `published_invitation_content` (DB)                                             | Created by `publishDraft`                     | ✅ Good              |
| RSVP event                      | `events` (DB)                                                                   | Side-effect of `publishDraft` + legacy manual | ✅ Has FK            |
| Hardcoded real client events    | `src/content/events/*.json` (4 files)                                           | Code                                          | ❌ Problematic       |
| Master template                 | `src/content/event-templates/xv/master.json`                                    | Code                                          | Ambiguous            |

### State Machines (Current)

```
InvitationProject:
  draft → waiting_for_client → client_submitted → in_review →
  in_production → preview_sent → approved → published → archived
  (9 states, 2 not actively used in UI: preview_sent, approved)

IntakeRequest:
  draft → active → submitted → closed | expired
  (5 states)

IntakeSubmission:
  in_progress → submitted → needs_changes → submitted → approved
  (4 states, cyclical through submitted)

InvitationContentDraft:
  draft → reviewed → approved
  (3 states)
```

### Happy Path (Current Code)

1. Admin clicks "Nueva invitación" on `/dashboard/invitaciones`
2. Form: title, client name/whatsapp/email, event type, demo preset
3. Creates `invitation_projects` row, redirects to detail page
4. On detail: selects blocks → "Generar enlace de captura" → creates `intake_requests` with
   encrypted token
5. Admin shares link: `/captura/[token]`
6. Client opens link, fills multi-step form (auto-saves per step), submits
7. Transitions: `IntakeRequest → submitted`, `InvitationProject → client_submitted`
8. Admin reviews at `/dashboard/invitaciones/[id]/review` → approves or requests changes
9. Admin generates draft at `/dashboard/invitaciones/[id]/draft`
10. Admin edits draft, publishes
11. `publishDraft()`: creates `published_invitation_content`, creates/updates `events` (RSVP),
    transitions project → `published`, draft → `approved`

### Sad Paths and Broken States (Current Code)

| State                                                            | Detection                                                                                | Current Behavior                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Project marked `published` but no `published_invitation_content` | `hasInconsistency()` → `status === 'published' && !project.published`                    | Red warning badge: "marcado como publicado pero no tiene contenido público"        |
| Published project missing RSVP event                             | `hasInconsistency()` → `status === 'published' && !rsvpEventStatus`                      | Yellow warning badge: "No se encontró el evento RSVP asociado"                     |
| Published content exists but project not `published`             | `hasInconsistency()` → `published && status !== 'published'`                             | Red warning badge: "contenido existe pero proyecto no está marcado como publicado" |
| Expired/revoked capture link                                     | `resolveCaptureLink()` checks `status` and `expiresAt`                                   | Shows "Expirado" or "Revocado" badge; no link displayed                            |
| Missing capture link (no intake request)                         | `request === null` → `captureLinkStatus: 'missing'`                                      | Shows "Sin enlace" badge; empty link panel shows guidance                          |
| Unavailable token (ciphertext present but decryption fails)      | `decryptIntakeToken()` returns null                                                      | Shows "No recuperable" with regenerate option                                      |
| Invalid/missing `INTAKE_TOKEN_ENCRYPTION_KEY`                    | `getEnv()` throws at runtime                                                             | Crashes on any token operation                                                     |
| Draft generation without approved submission                     | `generateDraft()` checks for approved submission; if none → creates phantom intake chain | Works but bypasses intended flow                                                   |
| Project with no `createdBy` during publish                       | `publishDraft()` throws validation error                                                 | Blocks publishing with Spanish error message                                       |
| Slug collision across event types                                | `publishDraft()` checks `findEventBySlugService` → blocks if event_type mismatch         | Spanish error message with details                                                 |

### Hardcoded Client Data — Current Inventory

Four files in `src/content/events/` contain real client PII:

- `ana-sofia-cota-guillen.json` (218 lines)
- `cesar-ramses.json` (218 lines)
- `ximena-meza-trasvina.json`
- `gerardo-sesenta.json`

These are NOT demo data — they have `isDemo: false` and contain real names, dates, locations, etc.
They are the **primary source of truth** for public routes (`/[eventType]/[slug]`) because the
content resolver checks static collections before the DB.

The `src/content/event-demos/` JSONs contain **placeholder/fake data** (e.g., "Lucía García") —
these are correct as demo data.

### Existing Forms Classification

| Form                   | Location                                     | Classification           | Notes                                                        |
| ---------------------- | -------------------------------------------- | ------------------------ | ------------------------------------------------------------ |
| Create project form    | `InvitationList.tsx` (inline)                | **Keep, rename**         | "Nueva invitación" → "Crear proyecto de invitación"          |
| Intake blocks selector | `InvitationDetail.tsx` + `BlockSelector.tsx` | **Keep**                 | Well-separated operational config                            |
| Capture link panel     | `IntakeLinkPanel.tsx`                        | **Keep, enhance**        | Add WhatsApp direct link, copy/open actions already exist    |
| Client intake form     | `/captura/[token]` (multi-step)              | **Keep**                 | The source of truth for client data                          |
| Admin review form      | `SubmissionReview.tsx`                       | **Keep, improve labels** | Use block definitions for Spanish labels instead of raw keys |
| Draft editor           | `DraftEditor.tsx`                            | **Keep**                 | Inline editing by sections, works well                       |
| Draft review           | `DraftReview.tsx`                            | **Keep**                 | Read-only grouped display                                    |
| Publish action         | `DraftReview.tsx` + API                      | **Keep**                 | Validated transition                                         |
| RSVP detail            | `InvitationRsvpPanel.tsx`                    | **Keep**                 | Shows counts, links management                               |

## 3. Desired Conceptual Model — Validation

| Model Component                                                | Current Code Status                         | Validated?                           |
| -------------------------------------------------------------- | ------------------------------------------- | ------------------------------------ |
| Demo/template = reusable visual example with placeholder data  | ✅ Exists in `event-demos/`                 | Yes                                  |
| Invitation project = internal work record with client metadata | ✅ `invitation_projects` table              | Yes                                  |
| Intake request / capture link = secure link for client/admin   | ✅ `intake_requests` + encrypted tokens     | Yes                                  |
| Intake submission = source of truth for real content           | ✅ `intake_submissions.blockData`           | Yes, but 4 static events bypass this |
| Invitation draft = generated from approved intake data         | ✅ `invitation_content_drafts`              | Yes, but generation is permissive    |
| Published invitation = public content from draft               | ✅ `published_invitation_content`           | Yes                                  |
| RSVP event = separate linked module                            | ✅ `events` with FK `invitation_project_id` | Yes                                  |

**Conflicts found:**

1. **4 hardcoded client events bypass the entire intake pipeline.** They are static JSON in
   `src/content/events/`. The content resolver (`resolveInvitationContent`) checks static
   collections first. These events cannot be edited from the dashboard. **Must migrate to
   DB-published content.**

2. **Draft generation does not strictly require an approved submission.** `generateDraft()` in
   `draft-generation.service.ts:82-113` creates phantom intake request/submission rows if none
   exist. This is useful for "always-available admin editing" but means the "intake submission as
   source of truth" model is not enforced.

3. **Master template `src/content/event-templates/xv/master.json`** is unused by current code paths.
   It may be dead material or for future use. It contains placeholder data.

4. **`events.slug` is globally unique** while `published_invitation_content` uses
   `UNIQUE(event_type, slug)`. The publishing service bridges this with app-level checks but the
   schema mismatch persists.

## 4. Proposed Target Flow

```
  ┌──────────────────────────────────────────────────┐
  │  1. Admin creates invitation project             │
  │     (title, client, event type, demo base)       │
  │     → InvitationProject.status = 'draft'        │
  └──────────────────┬───────────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────────┐
  │  2. Admin generates capture link                 │
  │     (selects enabled blocks)                     │
  │     → IntakeRequest created with encrypted token │
  │     → InvitationProject.status = 'waiting_for_client' │
  │     → Link shown in list + detail views          │
  └──────────────────┬───────────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────────┐
  │  3. Client (or admin) fills intake form          │
  │     → Per-step auto-save                        │
  │     → Submit → IntakeSubmission.status = 'submitted' │
  │     → InvitationProject.status = 'client_submitted' │
  └──────────────────┬───────────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────────┐
  │  4. Admin reviews submission                     │
  │     → Approve → submission='approved', project='in_production' │
  │     → Request changes → submission='needs_changes', project='waiting_for_client' │
  └──────────────────┬───────────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────────┐
  │  5. Admin generates draft from approved data     │
  │     → Deterministic mapping block data → DraftContent │
  │     → InvitationContentDraft.status = 'draft'   │
  └──────────────────┬───────────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────────┐
  │  6. Admin edits/previews draft                   │
  │     → Inline editing by sections                 │
  │     → Preview at /dashboard/invitaciones/[id]/preview │
  └──────────────────┬───────────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────────┐
  │  7. Admin publishes                              │
  │     → Validates: draft exists, status='draft',   │
  │       project has createdBy, snapshot exists     │
  │     → Creates/updates published_invitation_content │
  │     → Creates/updates events (RSVP) row          │
  │     → InvitationProject.status = 'published'    │
  │     → InvitationContentDraft.status = 'approved' │
  └──────────────────┬───────────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────────┐
  │  8. Public route resolved from DB content        │
  │     → /[eventType]/[slug]                        │
  │     → RSVP guest management available            │
  └──────────────────────────────────────────────────┘
```

## 5. Data Model Implications

### Required Changes

1. **Migrate 4 hardcoded client events to `published_invitation_content`**
   - Create invitation projects for each
   - Publish them, creating `published_invitation_content` rows
   - The static JSON files become superseded; content resolver gives priority to DB content (or
     remove static entries)
   - Ideally, the intake submission becomes the source for these events too

2. **Remove or archive `src/content/event-templates/`** if unused
   - Verify no code path reads from `event-templates` collection
   - If confirmed unused, delete or keep as archive

3. **No schema migrations required** for the core flow changes
   - Existing schema supports all states
   - Phase 6 items from `dashboard-creation-flow-plan.md` already evaluated: no changes justified

### What Must Stay as Code/Seed Data

| Item                             | Reason                                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/content/event-demos/*.json` | Demo/placeholder content for visual reference; required by `publishDraft` → `mapDraftToPublished` for enrichment |
| `demo-preset-catalog.ts`         | In-memory catalog of available demo presets; snapshotted at project creation                                     |
| Theme presets and contracts      | Code-managed visual identity system                                                                              |

## 6. UI/UX Changes

### Renames and Reframes

| Current                                 | Target                         | File(s)              |
| --------------------------------------- | ------------------------------ | -------------------- |
| "Nueva invitación" (button)             | "Crear proyecto de invitación" | `InvitationList.tsx` |
| Page title "Producción de invitaciones" | Keep                           | Already good         |
| "Generar enlace de captura" (button)    | Keep                           | Already clear        |
| "Invitación" (table header)             | "Proyecto"                     | `InvitationList.tsx` |

### Capture Link Visibility (Already Good)

Current code already shows capture links in:

- **List view** (`InvitationList.tsx`): shows status badge + copy button for active links
- **Detail view** (`IntakeLinkPanel.tsx`): shows full link, copy, open, WhatsApp, regenerate

Only enhancement needed: direct WhatsApp deep link (`wa.me` URL) instead of just copying a message.

### Admin Next Action (Already Implemented)

`resolvePrimaryAction()` in `display-status.ts` already provides clear next actions per status. The
`InvitationList.tsx` already renders them.

### Repair Actions for Inconsistent States

`display-status.ts` already detects 3 inconsistency types and shows warnings. The
`InvitationDetail.tsx` page is the repair surface. Consider adding:

- A "Repair" action that detects the specific inconsistency and guides the admin
- For "published but no content": suggest re-publishing
- For "published but no RSVP": suggest creating event manually or re-publishing
- For "content exists but not published": suggest updating status

## 7. Security Requirements

| Requirement                                   | Current Status                                                | Gap                                                    |
| --------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| Token hashing (SHA-256)                       | ✅ Implemented in `intake-token.service.ts`                   | None                                                   |
| Token encryption (AES-256-GCM)                | ✅ Implemented, stored in `token_ciphertext`                  | None                                                   |
| Raw token never persisted                     | ✅ Returned once at creation                                  | None                                                   |
| Token expiration                              | ✅ 30-day default, configurable                               | None                                                   |
| Token revocation                              | ✅ `status = 'closed'`                                        | None                                                   |
| Rate limiting on capture API                  | ✅ `requireAdminRateLimit('intake:captura')`                  | None                                                   |
| Admin-only dashboard routes                   | ✅ Middleware checks `ADMIN_ONLY_PATHS`                       | None                                                   |
| CSRF protection                               | ✅ `setCsrfToken()` in middleware + CSRF checks               | None                                                   |
| Service-role server-only boundaries           | ✅ All DB repos use `supabaseRestRequest()` with service role | None                                                   |
| RLS on intake tables                          | ✅ Migration 20260528000000 includes RLS                      | Verify public access to `published_invitation_content` |
| No token in logs                              | ✅ Code review shows no console.log of raw tokens             | Verify in deployment                                   |
| No PII in public payloads                     | ✅ `_assetSlug` metadata stripped from view model             | Verify `resolveInvitationContent`                      |
| Strong admin auth (MFA)                       | ✅ Required for admin routes                                  | None                                                   |
| Missing `INTAKE_TOKEN_ENCRYPTION_KEY` env var | ❌ `decryptIntakeToken` throws at runtime                     | **Validate at server boundary, not at build time**     |
| Server/client boundaries                      | ✅ All repos use service role; React islands call APIs        | Ensure no new violations                               |

### Key Security Gap

**`INTAKE_TOKEN_ENCRYPTION_KEY` must be validated at the server boundary**, not at build time. In
Astro/Vercel, build-time validation would break unrelated deployments (public routes, demos).
Instead:

- Validate the key exists when the first token operation is attempted (capture link create, resolve,
  regenerate).
- Return a clear admin-facing error in Spanish (e.g., "Error de configuración: la clave de
  encriptación no está configurada. Contacta al administrador del sistema.") rather than a crash
  or 500.
- Public routes (`/[eventType]/[slug]`) and demo rendering must never depend on this key.
- Document the env var requirement in deployment docs.

## 8. State Model Proposal

### InvitationProject (Keep 9 states, simplify display)

```
┌─────────┐     ┌──────────────────┐     ┌────────────────┐
│  draft  │ ──→ │ waiting_for_client│ ──→ │ client_submitted│
└─────────┘     └──────────────────┘     └────────────────┘
                                                  │
                                                  ▼
                                          ┌────────────────┐
                              ┌────────── │   in_review    │
                              │           └────────────────┘
                              │               │        │
                              ▼               ▼        │
                     ┌────────────┐   ┌──────────────┐ │
                     │needs_changes│   │  approved →  │←┘
                     │(same state) │   │in_production  │
                     └────────────┘   └──────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │   preview_sent    │ (optional)
                                    └──────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │     approved      │ (optional)
                                    └──────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │    published      │
                                    └──────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │    archived       │
                                    └──────────────────┘
```

**Recommendation**: The `preview_sent` and `approved` project states are defined but have no UI
implementation for transitioning to them. Either:

- **Simplify**: Remove from status enum and keep the flow as `in_production → published`
- **Implement**: Add "Enviar vista previa" and "Aprobar" actions in the detail/draft page

**Preferred**: Keep in enum (backward compatibility), remove from UI tabs/filters, document as
reserved for future use.

### IntakeSubmission (Keep 4 states)

```
in_progress → submitted → needs_changes → submitted → approved
                                     ↑         │
                                     └─────────┘
```

This is correct. The cyclical `submitted → needs_changes → submitted` pattern supports admin
requesting changes and client re-submitting.

## 9. Migration / Data Cleanup

### Phase 0 — Audit Before Changes

1. **Verify which static events are still live** — Check if the 4 hardcoded JSONs in
   `src/content/events/` have corresponding routes that are actively used
2. **Count orphan RSVP events** — Already done in earlier plans
3. **Verify `INTAKE_TOKEN_ENCRYPTION_KEY` is set** in all environments
4. **Check for projects in `published` status without published content** via DB query

### Static Event Migration Strategy

For each of the 4 hardcoded client events:

1. Create a minimal `invitation_projects` row (if not already existing)
2. Create intake + submission with the current hardcoded data
3. Generate draft from the submission
4. Publish, creating `published_invitation_content` row
5. Verify the public route renders from DB content (visual parity check)
6. **Remove the static JSON file from the repository** — do not move it to an archive path inside
   the repo
7. Update any tests that depend on static event data
8. Mark the event as migrated in a tracking document

**Important**: After removal, the JSON file remains in git history. The team may optionally perform
a separate git history cleanup (`git filter-branch` or `git-filter-repo`) to scrub PII from history.
This is a **separate optional risk decision** — weigh the effort of rewrite against the sensitivity
of the data. For the purposes of this plan, the operational goal is: **no active file in the
repository contains client PII**. Historical cleanup is out of scope for implementation phases.

**Alternative (lighter)**: Publish through the existing pipeline without backfilling intake data.
Create a draft directly with the current JSON content and publish it. This preserves the existing
data without requiring intake form completion.

### Guardrail Against Future Hardcoded PII

After migration, add a **content collection guardrail** to prevent new real client data from being
added to static content files:

1. Add a CI lint check (or `package.json` script) that scans `src/content/events/` for files without
   `"isDemo": true`. If a non-demo event is found, warn or block.
   - Can also invert: require `isDemo: true` in all `event-*` content collections, or only allow the
     collection to contain demo events.
2. Document in `.agent/` or `CONTRIBUTING.md` that real client data must never be added to content
   collections. The pipeline for real client content is: intake → draft → publish → DB.
3. Consider removing the `events` content collection definition from `src/content.config.ts` after
   all 4 events are migrated, leaving only `event-demos` and `event-templates` (if kept). This makes
   it structurally impossible to add new static client events.

### Verify Unused Templates

Confirm `src/content/event-templates/` collection is not loaded by any code path. If unused:

- Remove the `event-templates` entry from `src/content.config.ts`
- Delete the directory

## 10. Implementation Phases

### Capture Link Auto-Creation Evaluation

Before implementing phases, evaluate whether intake request creation can be automated:

**Question**: Should an intake request (capture link) be created automatically when a project is
created, using default blocks per event type/demo?

**Current state**: After project creation, admin must manually select blocks and click "Generar
enlace de captura". This is a two-step process (create project → generate link).

**Analysis**:

- The `demo-preset-catalog.ts` already defines `recommendedBlocks` per preset.
- Creating a project always needs a demo base, so recommended blocks are always available.
- Auto-creation would eliminate the manual step and prevent "project created but no capture link"
  states.
- However: the admin may want to customize blocks before generating the link. Auto-creation without
  review loses the block-selection affordance.

**Recommendation**: Keep manual generation as the default in Phase 1. The two-step flow (create
project → generate link) gives the admin an explicit review point for block selection. Re-evaluate
after Phase 2 if data shows that admin always accepts defaults. If auto-creation is adopted later:

- Create the intake request asynchronously after project creation with `recommendedBlocks` from the
  selected demo.
- Still allow block customization on the detail page.
- The project transitions to `waiting_for_client` automatically after auto-creation.

### Phase 1 — Operational Safety and UI Clarity (no data migration)

**Effort**: 1-2 days | **Risk**: Low

Scope:

1. Rename "Nueva invitación" → "Crear proyecto de invitación" in `InvitationList.tsx`
2. Rename table header "Invitación" → "Proyecto"
3. Add server-boundary validation for `INTAKE_TOKEN_ENCRYPTION_KEY`:
   - Wrap token operations (`createRequest`, `regenerateToken`, `resolveCaptureLink`) with a check
     at the top.
   - If the key is missing/empty, return an `ApiError` with code `config_error` and a Spanish
     message.
   - Do NOT add build-time validation. Do not break public routes or demo rendering.
4. Add WhatsApp deep link (`wa.me`) action to `IntakeLinkPanel.tsx` alongside copy-message button
5. Add tests for the 3 inconsistency detection paths (verify `hasInconsistency` coverage)

**Files changed**:

- `src/components/dashboard/intake/InvitationList.tsx` — rename button label, table header
- `src/components/dashboard/intake/IntakeLinkPanel.tsx` — add wa.me link
- `src/lib/intake/services/intake-token.service.ts` or `intake-request.service.ts` — validate key at
  operation start, return `config_error` ApiError
- `src/lib/rsvp/core/errors.ts` — add `'config_error'` to `ApiErrorCode` if not present
- `tests/unit/display-status.test.ts` — verify coverage

**Verification**: `pnpm type-check && pnpm lint && pnpm test && pnpm build`

### Phase 2 — Migrate Hardcoded Client Events to DB-Backed Content

**Effort**: 2-3 days | **Risk**: Medium (high impact on live routes)

Scope:

1. For each of the 4 hardcoded JSONs in `src/content/events/`: a. Create invitation project (if not
   existing) b. Create the full content pipeline (intake → draft → publish) or lightweight publish
   c. Verify visual parity: the public route renders identically from `published_invitation_content`
2. Once verified for all 4: a. **Delete** the static JSON files from the repository b. Do NOT
   archive them inside the repo — removal is the goal
3. Update `resolveInvitationContent()` to check DB content before static collections:
   - DB-first resolution, with static fallback only for demos (`isDemo: true`) and legacy entries
   - Because static files for these 4 events no longer exist, the DB is the only source
4. Update any tests referencing static event data to use DB-backed equivalents
5. Add the content collection guardrail (see §9) to prevent future hardcoded PII

**Risk**: Removing static files could break the build if `getCollection('events')` is referenced and
the collection becomes empty. Astro content collections handle this gracefully (empty array), but
verify during implementation.

**Verification**:

- Each of the 4 routes renders with identical content (compare hero text, dates, locations,
  sections)
- `pnpm type-check && pnpm lint && pnpm test && pnpm build` pass
- No hardcoded client PII remains in `src/content/events/`
- CI guardrail blocks new non-demo content in collections

### Phase 3 — DB-First Content Resolution

**Effort**: 1 day | **Risk**: Medium

Scope:

1. Update `resolveInvitationContent()` in `src/lib/invitation/content-resolver.ts`:
   - Check `published_invitation_content` first (by `(slug, eventType)`)
   - If found, adapt and return (no static fallback)
   - If not found, fall back to static collections **only if the entry is a demo** (`isDemo: true`)
   - If neither, return null → 404
2. This ensures DB-published content takes priority over any remaining static files
3. Legacy static client events that were not part of the 4 (if any exist) will no longer be served —
   this is intentional

**Acceptance criteria**:

- DB-published invitations resolve before any static file
- Demo entries (`event-demos/`) still resolve through static collection fallback
- A published invitation updated through the dashboard reflects immediately on the public route
- Unpublished drafts are never accessible through the public route

**Verification**: Manual route checks + existing content-resolver tests updated

### Phase 4 — Harden Draft Generation (Remove Phantom Intake Chains)

**Effort**: 1-2 days | **Risk**: Medium

Scope:

1. Remove the phantom intake chain creation in `generateDraft()` (lines 82-113 in
   `draft-generation.service.ts`)
2. Replace with validation: if no approved submission exists, block with typed error
   `no_approved_submission`
3. Add a separate explicit path `createDraftFromAdmin(projectId, content)` that:
   - Persists content to a real `intake_submission` row (creating the minimal intake chain
     explicitly)
   - Creates the draft from that submission
   - Logs the admin action
   - Returns the draft as if generated from client data
4. Wire the admin draft editor to use `createDraftFromAdmin` when no approved submission exists
5. This keeps "always-available admin editing" but makes the data provenance explicit

**Files changed**:

- `src/lib/intake/services/draft-generation.service.ts` — split `generateDraft` and
  `createDraftFromAdmin`
- `src/pages/api/dashboard/intake/[id]/draft.ts` — add admin-direct path if needed
- `src/lib/intake/repositories/intake-submission.repository.ts` — if new creation pattern needed
- Tests for both paths

**Verification**: `pnpm test -- tests/unit/draft-generation.service.test.ts` + manual test of admin
draft creation on a project without client submission

### Phase 5 — Repair Actions for Inconsistent States

**Effort**: 1 day | **Risk**: Low

Scope:

1. Add a `resolveRepairAction(project)` function in `display-status.ts` that returns a repair
   suggestion per inconsistency type:
   - "Publicado sin contenido" → "Volver a publicar" (links to draft page)
   - "Publicado sin RSVP" → "Reparar publicación" (re-runs publish to create/update event)
   - "Contenido existe pero no publicado" → "Marcar como publicado" (updates project status)
2. Render repair actions in `InvitationDetail.tsx` with Spanish explanation text
3. Add API endpoint or re-use existing publish endpoint for repair operations

**Files changed**:

- `src/lib/intake/display-status.ts` — add `resolveRepairAction()`
- `src/components/dashboard/intake/InvitationDetail.tsx` — render repair section

**Verification**: Manual UI test across all 3 inconsistency states + `pnpm type-check`

### Phase 6 (Optional) — Remove Dead States

**Effort**: 1 day | **Risk**: Medium

Scope:

1. Evaluate whether `preview_sent` and `approved` project statuses are used anywhere in the flow
2. If unused: remove from enum, update UI filters, update labels
3. If kept: implement at least basic UI transitions for them (buttons in detail page)

**Verification**: Search for all references to these statuses across the codebase

## 11. Acceptance Criteria per Phase

### Phase 1 — Operational Safety and UI Clarity

- [ ] "Crear proyecto de invitación" visible instead of "Nueva invitación"
- [ ] "Proyecto" column header instead of "Invitación"
- [ ] Missing `INTAKE_TOKEN_ENCRYPTION_KEY` returns admin-facing Spanish error on capture link
      operations; does not break public routes or builds
- [ ] IntakeLinkPanel shows a WhatsApp deep link button in addition to copy-message
- [ ] All 3 inconsistency detection paths have passing unit tests
- [ ] `pnpm type-check && pnpm lint && pnpm test && pnpm build` pass

### Phase 2 — Hardcoded Client Data Migration

- [ ] All 4 previously hardcoded events render identically from `published_invitation_content` (hero
      text, dates, locations, sections all match)
- [ ] Static JSON files removed from `src/content/events/` (deleted, not archived inside repo)
- [ ] No hardcoded client PII remains in any content collection file
- [ ] Static demo events (`event-demos/`) continue to work unchanged
- [ ] `pnpm build` succeeds without the removed JSON files
- [ ] CI guardrail detects and blocks any new non-demo event in content collections

### Phase 3 — DB-First Content Resolution

- [ ] `resolveInvitationContent()` checks DB before static collections
- [ ] DB-published invitation updates reflect immediately on public route (no deploy needed)
- [ ] Demo entries (`event-demos/`) still resolve through static fallback
- [ ] Unpublished drafts are never accessible through public route
- [ ] All existing content-resolver tests updated and passing

### Phase 4 — Draft Generation Hardening

- [ ] `generateDraft()` requires an approved submission; fails with typed `no_approved_submission`
      error otherwise
- [ ] `createDraftFromAdmin()` exists as an explicit alternative for admin-created content
- [ ] `createDraftFromAdmin()` persists content to a real `intake_submission` row (no phantom
      chains)
- [ ] Existing projects with drafts continue to work after migration
- [ ] Tests cover both paths (approved submission → draft, admin direct → draft)

### Phase 5 — Repair Actions for Inconsistent States

- [ ] Inconsistent projects show a clear repair action in the detail view
- [ ] Each repair action has Spanish explanation text
- [ ] Repair action for "published without content" links to draft/publish flow
- [ ] Repair action for "published without RSVP" re-runs publish to create/update event
- [ ] Repair action for "content exists but not published" updates project status

## 12. Test / Verification Strategy

- **Unit tests**: Each service function, schema validation, mapper function
- **Component tests**: Draft editor, review, list render
- **API integration tests**: Capture endpoint, publish endpoint, intake CRUD
- **Manual route verification**: After Phase 2, check each migrated event renders identically
- **Build test**: `pnpm build` after each phase

## 13. Risks and Rollback Notes

| Risk                                                                                              | Severity | Mitigation                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 2 breaks public routes for 4 live events                                                    | **High** | Verify visual parity before removing static files. Keep static files during transition. Rollback = restore JSON files from git.                                         |
| Missing `INTAKE_TOKEN_ENCRYPTION_KEY` breaks capture link operations                              | Medium   | Return admin-facing Spanish error instead of crash. The key is required for capture operations; the error guides the admin to fix config. Public routes are unaffected. |
| Phase 4 draft hardening breaks existing admin workflows                                           | Medium   | The `createDraftFromAdmin` escape hatch preserves the admin-direct editing pattern. Document the change and migration path.                                             |
| DB-first resolution in Phase 3 breaks demo routes if incorrectly scoped                           | Medium   | Keep static fallback for `isDemo: true` entries. Verify with route parity tests.                                                                                        |
| Phantom intake chain removal in Phase 4 breaks existing projects that rely on the silent fallback | Medium   | Migration script: for projects with drafts but no approved submission, re-create using `createDraftFromAdmin` during upgrade.                                           |
| Git history still contains PII after Phase 2 file deletion                                        | Low      | Accept by default. Document optional `git-filter-repo` cleanup as a separate decision. The operational goal is no active PII files in the working tree.                 |

## 14. Explicit Out-of-Scope

- Building a full demo editor UI
- Migrating demo presets to DB
- File/image upload in the intake form
- Client login or account system
- Payment flow
- Webhook or third-party integrations
- AI content generation
- Visual invitation builder
- Complete visual redesign of dashboard
- Schema migrations (evaluated as unnecessary per Phase 6 of `dashboard-creation-flow-plan.md`)
- Creating a manifest-based planning system

## 15. Relationship to Existing Plans

| Existing Plan                                    | Relationship                                                     | Action                                                |
| ------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------- |
| `dashboard-creation-flow-plan.md`                | Parent plan with 7 phases (Phase 6 evaluated)                    | This plan is additive                                 |
| `client-intake-flow.md`                          | Original intake implementation plan (Release 1-3, all completed) | Fully implemented; this plan addresses remaining gaps |
| `admin-workflow-improvement.md`                  | Addresses subset of these issues                                 | Consider this plan as superseding it                  |
| `dashboard-eventos-migration-to-invitaciones.md` | Stages 0-6 for events migration                                  | Completed; events now have FK to projects             |

## 16. Recommended First Phase

**Phase 1 — Operational Safety and UI Clarity** should be implemented first:

- Lowest risk (no data changes, no DB changes)
- Immediate UX improvement (renames, WhatsApp link)
- Tightens env var error handling without breaking unrelated builds
- Builds confidence in the codebase before tackling Phase 2 (data migration)

## 17. Pre-implementation Commands

Run these before starting Phase 1 to establish baseline:

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build
pnpm test -- tests/unit/display-status.test.ts
```
