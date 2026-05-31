---
title: Dashboard: Migrate /dashboard/eventos into /dashboard/invitaciones
status: active
created: unknown
updated: 2026-05-31
---

# Dashboard: Migrate `/dashboard/eventos` into `/dashboard/invitaciones`

## Intent

Eliminate the redundant `/dashboard/eventos` technical UI by absorbing its useful capabilities into
`/dashboard/invitaciones`, making invitation projects the single operational spine for the admin
dashboard.

## Current-State Findings

### Two overlapping dashboard views

| Aspect         | `/dashboard/eventos`                                     | `/dashboard/invitaciones`                                  |
| -------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Title          | "Eventos RSVP — administración técnica"                  | "Producción de invitaciones"                               |
| Primary entity | `events` table (raw RSVP records)                        | `invitation_projects` table                                |
| Create action  | "+ Crear evento manual"                                  | "Nueva invitación"                                         |
| Table columns  | Título, Slug, Tipo, Estado, Responsable (UUID), Acciones | Título, Cliente, Tipo, Estado, Creado, Siguiente paso, Ver |
| Actions        | Editar, Publicar/Archivar/Restaurar                      | Ver → project detail                                       |
| Filtering      | None                                                     | Status tabs (7 filters)                                    |
| Owner column   | `ownerUserId` (truncated UUID) — useless                 | N/A (client name instead)                                  |

### Data model gap

- **`invitation_projects`** → `intake_requests` → `intake_submissions` → `invitation_content_drafts`
  → `published_invitation_content`
- **`events`** (standalone RSVP table) → `guest_invitations`, `claim_codes`, `role_memberships`
- **No FK** from `events` back to `invitation_projects` — only a `slug`-based heuristic link created
  in `publishing.service.ts:115-137`

### File inventory

**Eventos-specific** (to migrate or remove):

- `src/pages/dashboard/eventos.astro` + `src/pages/api/dashboard/admin/events.ts` + `[eventId].ts`
- `src/components/dashboard/events/EventsAdminTable.tsx`, `EventFormModal.tsx`,
  `EventConfirmDialog.tsx`
- `src/hooks/use-events-admin.ts`
- `src/lib/dashboard/dto/events.ts`
- `src/lib/rsvp/services/event-admin.service.ts`

**Invitation-specific** (to enhance):

- `src/pages/dashboard/invitaciones.astro`, `[id].astro`, `[id]/draft.astro`, `[id]/preview.astro`,
  `[id]/review.astro`
- `src/components/dashboard/intake/InvitationList.tsx`, `InvitationDetail.tsx`, `DraftSection.tsx`,
  `DraftEditor.tsx`, `DraftReview.tsx`
- `src/hooks/use-invitation-admin.ts`, full `src/lib/intake/` layer

**Shared dep consumers**:

- `src/pages/dashboard/admin.astro` — stat links `/dashboard/eventos`
- `src/pages/dashboard/claimcodes.astro` / `ClaimCodeFormModal.tsx` — loads raw events list
- `src/hooks/use-claim-codes-admin.ts` — uses `adminApi.listEvents()`
- `src/lib/dashboard/admin-page-data.ts` — `listAdminEvents()` for stats
- `src/middleware.ts` — `/dashboard/eventos` in `ADMIN_ONLY_PATHS`

---

## Capability Migration Matrix

| #   | Capability                             | Decision                  | Target                                       |
| --- | -------------------------------------- | ------------------------- | -------------------------------------------- |
| 1   | List all RSVP events                   | Migrate                   | Show in `InvitationDetail` as an RSVP module |
| 2   | Show event title                       | Already shown             | Project title in invitation list             |
| 3   | Show event slug                        | Technical read-only       | Show in detail page as metadata              |
| 4   | Show event type                        | Keep                      | Already in list as badge                     |
| 5   | Show published/archived status         | Migrate                   | Map to RSVP status in detail view            |
| 6   | Show responsible (ownerUserId)         | Remove                    | Useless UUID — no business value             |
| 7   | Edit event (title, slug, type, status) | Remove standalone         | Belongs in project editing                   |
| 8   | Archive event                          | Replaced                  | See archive semantics section below          |
| 9   | Create manual event                    | Remove                    | No current business case                     |
| 10  | Publish/unpublish event                | Remove independent action | Handled by draft publish flow                |

---

## Data Relationship Findings

1. **No FK** from `events` to `invitation_projects`. Link via `slug` is heuristic.
2. **Strong FK**: `published_invitation_content.invitation_project_id` → `invitation_projects.id`
3. **Strong FK**: `guest_invitations.event_id` → `events.id`
4. **Strong FK**: `claim_codes.event_id` → `events.id`
5. **Orphan risk**: Manually created events with no project link exist.

---

## Target Architecture

```
InvitationProject (spine)
  ├── IntakeRequest / IntakeSubmission (client capture)
  ├── InvitationContentDraft (canonical editable content)
  ├── PublishedInvitationContent (public)
  └── Event (RSVP module, FK: invitation_project_id)
        ├── GuestInvitations
        └── ClaimCodes
```

### Content resolution order

1. `InvitationContentDraft.content`
2. `PublishedInvitationContent.content`
3. Demo defaults from `event-demos` collection
4. Empty structured fallback

### RSVP visibility

Not a standalone view. Shown in `InvitationDetail` as a module when an event exists for the project:

- RSVP status badge (active / disabled)
- Guest summary (total, confirmed, declined)
- Link to guest management (`/dashboard/invitados?eventId=...`)
- Associated claim codes

### FK strategy

- Add `events.invitation_project_id` as a **nullable** UUID column with an index.
- Add a **partial unique index** only if the current domain model guarantees one RSVP event per
  invitation project (evaluate during Stage 0).
- Link RSVP to `invitation_projects`, **not** to `published_invitation_content`. RSVP belongs to the
  project lifecycle, not a specific published version.
- New events created by publishing must always set `invitation_project_id`.
- Do not add a `NOT NULL` constraint until orphan events are resolved (post-backfill verification).

---

## Archive semantics

Separate two concerns that were conflated in `/dashboard/eventos`:

| Action                  | Scope                 | What it does                                                                                                                                                                             |
| ----------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Archivar invitación** | `invitation_projects` | Sets project status to `archived`. All content, RSVP, and guest pages become inaccessible to the public. Available from invitation detail page as a project-level action.                |
| **Desactivar RSVP**     | `events`              | Flips the event to `archived` status. Prevents new guest RSVP submissions but keeps existing guest data and claim codes intact. Available from the RSVP module inside invitation detail. |

The standalone "Archivar evento" from the old `/dashboard/eventos` page is removed. Archival is no
longer a raw event toggle — it is either a project-level action or an RSVP-specific toggle, both
accessible from `/dashboard/invitaciones/:id`.

---

## Proposed UI Changes

### Invitation list — new columns

| Column                | Source                               |
| --------------------- | ------------------------------------ |
| Captura               | Intake request/submission status     |
| Publicación           | Draft/published status               |
| RSVP                  | Event status (— / active / disabled) |
| "Ver" → "Ver detalle" | Rename                               |

### Invitation detail — new sections

1. Project metadata (existing)
2. Client capture flow (existing)
3. **Invitation content editor** (always available, not just after submission)
4. Publish flow (existing)
5. **RSVP module** (new) — status, guest counts, link to guest management, deactivate toggle
6. **Claim codes** (new, optional) — list codes for this event

### Route changes

- **Do not** use a permanent 301 redirect for `/dashboard/eventos`.
- Phase 1: Remove `/dashboard/eventos` from sidebar navigation and `ADMIN_ONLY_PATHS` in middleware.
  The route still resolves but is unreachable from normal navigation.
- Phase 2: If a transitional route is needed, use a **temporary redirect** (302) to
  `/dashboard/invitaciones`.
- Phase 3: Only delete the route file after all migrated capabilities (RSVP module, claim codes via
  projects, guest management link) are verified working.

---

## Implementation Stages

### Stage 0 — Data audit / dry run

Before any schema migration, produce a data report:

- [x] Count events matching invitation projects by `(event_type, slug)` pair.
- [x] Count events whose `slug` matches multiple projects (ambiguous).
- [x] Count events whose `slug` matches zero projects (orphaned).
- [x] Count published invitation projects without any matching event.
- [x] Count events that have guest invitations (`guest_invitations`).
- [x] Count events that have claim codes (`claim_codes`).
- [x] For each orphaned event with guests or codes, list it for manual review.
- [x] Output all counts in a structured report (JSON or Markdown table).

**Gate**: Do not proceed to Stage 1 until the audit report exists and orphan events are understood.

### Stage 0.5 — Legacy RSVP event adoption mapping

- [x] Define dry-run adoption mapping for each orphan RSVP event.
- [x] Propose minimal `invitation_project` shell for each orphan using existing event data (title,
      slug, event_type, status).
- [x] Do NOT create `published_invitation_content`, dummy drafts, or new RSVP events.
- [x] Store dry-run report under `.agent/plans/reports/adoption-mapping-dryrun.json`.
- [x] Report: orphan event id, slug, type, title, proposed project record, guest count, claim code
      count, warnings.

**Gate**: Do not proceed until adoption mapping is reviewed and deterministic.

### Stage 1 — Add FK `invitation_project_id` to `events`

- [x] DB migration:
      `ALTER TABLE events ADD COLUMN invitation_project_id UUID NULL REFERENCES invitation_projects(id) ON DELETE SET NULL; CREATE INDEX idx_events_invitation_project_id ON events(invitation_project_id);`
- [x] Add partial unique index:
      `CREATE UNIQUE INDEX idx_events_unique_project ON events(invitation_project_id) WHERE invitation_project_id IS NOT NULL;`
      (Stage 0 confirmed one RSVP per project).
- [x] Backfill: Create minimal invitation_projects for orphan events, set `invitation_project_id` on
      each.
- [x] Update `publishing.service.ts` to always set `invitation_project_id` on event create/update
      during publish.
- [x] Update `EventRecord` type, `EventRow` column definitions, and queries.
- [x] Add service function to find event by `invitation_project_id`.
- [x] **Do not** add `NOT NULL` constraint until Stage 6 verification.

### Stage 1.5 — Controlled adoption/backfill (production run)

- [x] Create minimal `invitation_projects` for the 4 legacy orphan RSVP events.
- [x] Link each existing event to its new project through `events.invitation_project_id`.
- [x] Preserve all existing guest and claim code relationships.
- [x] Do NOT mutate guest invitations, claim codes, or create duplicate events.
- [x] After backfill, verify: no orphans with data remain, each adopted event has exactly one
      project, no project has >1 event, guest/claim counts unchanged.

**Gate**: Do not proceed to Stage 2 until verification passes.

### Stage 2 — RSVP module in InvitationDetail

- [x] New `InvitationRsvpPanel.tsx` component:
  - Shows RSVP status badge, guest count summary, link to guest management.
  - "Desactivar RSVP" toggle that sets `events.status = 'archived'`.
  - Only visible when an associated event exists.
- [x] Add RSVP event data to project detail API response (find event by `invitation_project_id`).
- [x] Update `InvitationProjectDetailResponse` DTO with optional `rsvpEvent` field.
- [x] Render `InvitationRsvpPanel` in `InvitationDetail.tsx` after publish flow.
- [x] For adopted legacy projects without managed publication content, show "Publicación no
      disponible" instead of pretending they have content.

### Stage 3 — Always-available content editing

- [x] Modify `InvitationDetail.tsx` to always show "Contenido de la invitación" section, not only
      after submission approval.
- [x] Implement content resolution: draft → published → demo → empty.
- [x] When no draft exists, relax the "submission must be approved" constraint in
      `draft-generation.service.ts` for direct-admin edits (keep for auto-generate from client
      submission).
- [x] Wire the editor to create/update drafts directly, bypassing submission requirement.

### Stage 4 — Enhanced list columns

- Add Captura column (derived from request/submission status).
- Add Publicación column (derived from draft/published status).
- Add RSVP column (event status or — if none).
- Rename "Ver" → "Ver detalle".

### Stage 5 — Claim codes via projects

- Update `ClaimCodeFormModal.tsx` to list invitation projects instead of raw events.
- Resolve the associated `event` from the project via `invitation_project_id`.
- Update `useClaimCodesAdmin` to fetch projects.
- Update claim code API to accept project reference where possible.

### Stage 6 — Clean up `/dashboard/eventos`

Only after Stages 0–5 are verified:

- Remove from sidebar navigation (`navItems`, `navIcons`).
- Remove `/dashboard/eventos` from `ADMIN_ONLY_PATHS` in middleware.
- Update admin stat card link to point to `/dashboard/invitaciones`.
- Keep the route file as-is or add a 302 temporary redirect — do not delete yet.
- After a verification period, delete `eventos.astro`, API routes, components, hook, DTOs.
- Clean up dead types: `DashboardEventListItem`, `DashboardEventListDebug`,
  `DashboardEventSlugDebug` from admin interface (if unused elsewhere).
- Once orphan verification is final, evaluate adding `NOT NULL` to `events.invitation_project_id`.

---

## Affected Files

### Stage 0

- New: `.agent/plans/reports/data-audit-events-projects.json` (or markdown)
- Tooling: script using existing repository/service queries

### Stage 1

- `src/interfaces/rsvp/domain.interface.ts` — add `invitationProjectId` to `EventRecord`
- `src/lib/rsvp/repositories/shared/rows.ts` — add column to EVENT_COLUMNS
- `src/lib/intake/services/publishing.service.ts` — set `invitation_project_id` on event
  create/update
- New DB migration file

### Stage 2

- New: `src/components/dashboard/intake/InvitationRsvpPanel.tsx`
- Modified: `src/components/dashboard/intake/InvitationDetail.tsx`
- New/modified: event-by-project lookup API or DTO enrichment

### Stage 3

- Modified: `InvitationDetail.tsx`, `DraftSection.tsx`
- Modified: `draft-generation.service.ts`
- Modified: `invitation-content-draft.repository.ts`

### Stage 4

- Modified: `InvitationList.tsx`

### Stage 5

- Modified: `ClaimCodeFormModal.tsx`, `use-claim-codes-admin.ts`
- Modified: `admin-api.ts`, claim code API

### Stage 6

- Modified: `src/layouts/DashboardLayout.astro` (nav items)
- Modified: `src/components/dashboard/shell/DashboardSidebar.astro` (navIcons cleanup)
- Modified: `src/middleware.ts` (ADMIN_ONLY_PATHS)
- Modified: `src/pages/dashboard/admin.astro` (stat link)
- Modified: `src/lib/dashboard/admin-page-data.ts` (stat source)
- Modified: `src/lib/dashboard/admin-api.ts` (remove event methods)
- Possibly delete or redirect: `src/pages/dashboard/eventos.astro`
- Possibly delete: `src/pages/api/dashboard/admin/events.ts`, `[eventId].ts`
- Possibly delete: `src/components/dashboard/events/`
- Possibly delete: `src/hooks/use-events-admin.ts`
- Possibly delete: `src/lib/dashboard/dto/events.ts`
- Clean up: `src/interfaces/dashboard/admin.interface.ts` (dead types)

---

## Risks

1. **No FK critical gap** — cannot reliably link events to projects without schema migration.
2. **Backfill heuristic** — slug matching may produce wrong links. Stage 0 audit must reveal this
   before backfill.
3. **Orphaned events with guests/codes** — these must not be lost. Manual review and a bridging
   strategy needed.
4. **Claim code dependency** — claim code creation UI must be updated to work via projects.
5. **Guest dashboard dependency** — `/dashboard/invitados` expects `eventId`. The RSVP module in
   `InvitationDetail` must pass the correct `eventId`.

## Open Questions

- Is the `listHostEvents` debug endpoint dead code?
- Evaluate during Stage 0: does the domain guarantee one RSVP event per invitation project? If yes,
  add partial unique index.
- Should orphaned events with active guests/codes get a `invitation_project_id` pointing to a
  placeholder project, or remain unlinked with a manual note?

## Pre-existing Issues

1. `EntrySource` / `DeliveryFilter` types — unclear usage, possibly dead code.
2. Bautizo hidden in form but present in schema.
3. `DashboardEventListDebug` — heavy debugging machinery in production paths.
4. `ClaimCodeFormModal` shows raw event UUIDs in dropdown (fixed by Stage 5).
5. Invitation list shows raw `eventType` code (e.g. "xv" not "XV años").

## Validation

After each stage:

- [ ] TypeScript compiles
- [ ] Lint passes
- [ ] Build succeeds
- [ ] Tests pass
- [ ] No broken links
- [ ] Claim codes & guest management still work
- [ ] Host dashboard unaffected
- [ ] No raw event IDs, UUIDs, or owner IDs visible in dashboard UI
- [ ] No existing RSVP event with guests or claim codes is orphaned by the migration

## Acceptance Criteria

- [ ] `/dashboard/invitaciones` is the single operational surface for invitation production
- [ ] Full invitation lifecycle manageable from `/dashboard/invitaciones`
- [ ] No RSVP/publication capability lost
- [ ] `/dashboard/eventos` removed from navigation (deleted or 302 redirect)
- [ ] No UUIDs or raw IDs in user-facing dashboard UI
- [ ] RSVP shown only as associated module inside invitation detail
- [ ] Manual event creation removed
- [ ] Content editing available at any project stage
- [ ] Client intake separated from canonical content
- [ ] No claim code or guest management flow breaks
- [ ] No existing RSVP event with guests or codes is orphaned
- [ ] `/dashboard/invitaciones/:id` can reach guest management through the associated event
- [ ] Type-check, lint, build, tests pass
