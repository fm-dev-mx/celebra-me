---
title: Dashboard Creation Flow Plan
status: active
created: unknown
updated: 2026-05-31
---

# Dashboard Creation Flow Plan

## 1. Purpose

Celebra-me currently has two dashboard views with overlapping operational meaning:

- `/dashboard/eventos`
- `/dashboard/invitaciones`

The audit found parallel paths that both touch the `events` table, different slug constraints
(`events.slug` globally unique vs `published_invitation_content` composite unique), and an
invitation production pipeline whose relationship to the classic RSVP event system is undocumented
and partly accidental.

This plan defines a phased approach to unify and clarify the flow without over-refactoring. The
intended operating model is:

- `/dashboard/invitaciones` is the main invitation production pipeline.
- `/dashboard/eventos` is RSVP/event administration (manual or exceptional cases only).
- Publishing an invitation produces public content; RSVP event creation is a secondary concern whose
  necessity must be decided explicitly.

## 2. Current confirmed model

The following is confirmed from code (not documentation):

| Concept                         | Table / Entity                                | Managed from                                           |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| RSVP event                      | `events`                                      | `/dashboard/eventos` and side-effect of `publishDraft` |
| Invitation project              | `invitation_projects`                         | `/dashboard/invitaciones`                              |
| Intake request (capture link)   | `intake_requests`                             | `/dashboard/invitaciones/[id]`                         |
| Intake submission (client data) | `intake_submissions`                          | `/dashboard/invitaciones/[id]/review`                  |
| Draft content                   | `invitation_content_drafts`                   | `/dashboard/invitaciones/[id]/draft`                   |
| Published invitation content    | `published_invitation_content`                | Created by `publishDraft`                              |
| Guest RSVP record               | `guest_invitations`                           | `/dashboard/invitados` (FK → events)                   |
| Static demo content             | `src/content/event-demos/*.json` (filesystem) | Code-managed                                           |
| Demo preset configuration       | `demo-preset-catalog.ts` (in-memory)          | Code-managed                                           |

Confirmed risks:

- `events.slug` is `UNIQUE NOT NULL` globally. `published_invitation_content` uses
  `UNIQUE(event_type, slug)`. These constraints diverge.
- `findEventBySlugService` queries by slug alone, ignoring event_type.
- `publishDraft` auto-generates slug as `project.slug || `${eventType}-${id.slice(0,8)}`` — no
  collision protection.
- `publishDraft` only creates an `events` record if `project.createdBy` is set; otherwise the event
  is silently skipped.
- The content resolver (`resolveInvitationContent`) checks static content collections before
  `published_invitation_content`, so a static entry with a matching slug would shadow a published
  project.
- Demos are not created through any dashboard UI. The dashboard only selects an existing demo preset
  as a project template.

Assumptions (reasonable but not fully verified in all environments):

- Astro content collections load correctly at runtime on Vercel/Linux.
- The `previewSlug` on every `DemoPreset` matches an existing `event-demos/*.json` file.
- All required env vars are present in production.

## 3. Target operating model

1. Admin creates invitation projects from `/dashboard/invitaciones`.
2. Admin selects a demo base when creating a project (defines theme, layout, assets, visual
   structure).
3. Admin generates a capture link and shares it with the client.
4. Client data enters through the intake form at `/captura/[token]`.
5. Admin reviews the submission at `/dashboard/invitaciones/[id]/review`.
6. Admin generates and manually edits the draft at `/dashboard/invitaciones/[id]/draft`.
7. Admin previews at `/dashboard/invitaciones/[id]/preview`.
8. Admin publishes.
9. Publishing creates or updates `published_invitation_content` (powers `/[eventType]/[slug]`).
10. Publishing conditionally creates or updates an `events` record for RSVP guest management — only
    when the current architecture explicitly requires it and owner data is available.
11. `/dashboard/eventos` remains available for RSVP/event administration or exceptional manual cases
    only.

## 4. Non-goals

- Do not build a full demo editor yet.
- Do not migrate demo presets to the database yet.
- Do not redesign the entire dashboard visually in one step.
- Do not change the global `events.slug` constraint in Phase 1.
- Do not remove manual event creation until dependencies are audited.
- Do not introduce a complex planning/manifest system.
- Do not create task.md, implementation_plan.md, manifest.json, commit-map.json, or archive
  machinery.

## 5. Phased implementation plan

### Phase 1 — Technical stabilization

Scope:

- Audit the current publishing path before changing it.
- In `publishDraft` (`src/lib/intake/services/publishing.service.ts`), make event matching safe with
  respect to both `slug` and `event_type`:
  - If an `events` record exists with the same slug and same event_type, update it.
  - If an `events` record exists with the same slug but a different event_type, block publishing
    with a clear error (contains slug, expected event_type, found event_type).
  - If no `events` record exists, create one only when `project.createdBy` is available. If
    `createdBy` is null, either block publishing with a clear error or skip event creation and
    document the gap.
- Add explicit slug collision handling:
  - After resolving the publish slug, check whether an `events` record already uses that slug. If it
    does and event_type matches, proceed with update. If event_type mismatches, error.
  - If the slug collides with `published_invitation_content` for a different project, block
    publishing with a clear error. Do not auto-version slugs in Phase 1.
- Keep `events.slug` globally unique for now. No schema migration in this phase.
- Validate the `project.createdBy` / `ownerUserId` requirement before creating or updating an RSVP
  event. If the project has no creator, decide: either require an owner before publishing, or skip
  event creation with a logged warning.
- Add or update focused tests around the publish path.

Expected outcome:

- Publishing is safer.
- Slug and event-type assumptions are explicit.
- Failures produce clear admin-facing errors (in Spanish for the UI, English for logs).
- No database constraint migration is introduced.

Verification:

- `pnpm type-check`
- `pnpm lint`
- `pnpm test -- tests/unit/publishing.service.test.ts` (add if missing)
- `pnpm build` if practical

Decision gate before Phase 2:

**Confirm: should `publishDraft` always create/update an `events` record?**

Options:

- A) Always — if `createdBy` is null, block publishing until an owner is assigned.
- B) Only when an event already exists with matching slug+type (update existing, never create).
- C) Skip event management entirely — rely solely on `published_invitation_content` for public
  routing, and mark events as optional.

### Phase 2 — Documentation alignment

Scope:

Plan a future documentation file at `docs/domains/intake/production-flow.md`.

The future document should explain each entity:

- **Static demo**: A showcase JSON file in `src/content/event-demos/`. Provides visual reference,
  default images, and section fallback content. Code-managed.
- **Demo preset**: An in-memory configuration object in `demo-preset-catalog.ts`. Defines theme,
  supported blocks, required assets, and previewSlug. Snapshot into `invitation_projects.snapshot`
  at creation time.
- **Invitation project**: A row in `invitation_projects`. Represents a single client engagement from
  creation through publication.
- **Intake request**: A row in `intake_requests`. Contains a token-authenticated capture link
  configuration.
- **Intake submission**: A row in `intake_submissions`. Contains the client-submitted block data for
  one request.
- **Draft**: A row in `invitation_content_drafts`. Generated from an approved submission, editable
  by the admin.
- **Published invitation content**: A row in `published_invitation_content`. Powers the public route
  `/[eventType]/[slug]`. Linked to the project via `invitation_project_id`.
- **RSVP event**: A row in `events`. Supports guest management and RSVP. May be created as a
  side-effect of publishing. Has a globally unique `slug`.

The future document should document the full flow:

create project → select demo base → generate capture link → client submits → admin reviews →
generate draft → edit/preview → publish.

It should document slug behavior:

- `published_invitation_content` uses `(event_type, slug)` as its routing key.
- `events.slug` is currently globally unique (separate constraint).
- The publishing service must coordinate between these two different uniqueness domains.

It should document that demos are currently code/content-managed.

Expected outcome:

- Future documentation work is clearly scoped.
- Future agents understand why both `events` and `published_invitation_content` exist.

Verification:

- Future documentation to be reviewed against actual code.
- No stale claims copied from outdated docs.

### Phase 3 — UI copy and workflow clarification

Scope:

- Update `/dashboard/invitaciones` so it clearly communicates it is the main production pipeline.
- Add concise Spanish helper text explaining:
  - projects start from a demo base,
  - the demo defines visual structure/assets,
  - client content comes through intake,
  - publishing creates the final public invitation and prepares RSVP/event management when
    applicable.
- Improve visible Spanish text quality:
  - "invitacion" → "invitación"
  - "aun" → "aún"
  - "Si" → "Sí"
  - "telefono" → "teléfono"
  - "publicacion" → "publicación"
  - "revision" → "revisión"
  - similar obvious corrections, only where those strings actually exist in the UI.
- Update `/dashboard/eventos` copy so it is clearly RSVP/event management.
- If the manual event create action remains, label it as technical/manual:
  - heading helper: "Eventos RSVP — administración técnica"
  - create button label: "Crear evento manual"
  - helper text: "Usa esta opción solo para eventos RSVP técnicos o casos especiales. Las
    invitaciones de cliente deben crearse desde Producción de invitaciones."
- Do not remove functionality in this phase unless clearly safe.

Expected outcome:

- The correct workflow is understandable from the frontend.
- The two dashboard views no longer appear to be competing creation paths.

Verification:

- Manual UI review of both views.
- Confirm all UI-facing text is Spanish.
- Confirm no broken routes or client/server boundary issues.
- `pnpm type-check`
- `pnpm lint`

### Phase 4 — Shared dashboard UI primitives

Scope:

- Identify repeated dashboard patterns.
- Introduce shared components only where they reduce duplication and improve consistency.
- Candidate shared components:
  - `DashboardPageHeader` (title + action button slot)
  - `DashboardPanel` (consistent card/chrome)
  - `DashboardTable` (consistent table chrome)
  - `StatusBadge` (unified badge for events statuses and invitation project statuses)
  - `EmptyState` (consistent empty state with guidance)
  - `PrimaryActionButton`
  - `RowActions` (consistent action button group)
- Apply carefully to `/dashboard/eventos` and `/dashboard/invitaciones`.
- Avoid broad visual redesign. Do not restyle the whole app.

Expected outcome:

- Both views feel like part of the same product.
- Layout, spacing, buttons, badges, and table patterns are more consistent.

Verification:

- `pnpm type-check`
- `pnpm lint`
- Visual smoke test in local dev across both views.
- `pnpm build` if practical.

Decision gate before Phase 5:

- Confirm shared primitives reduced duplication instead of adding abstraction noise. If a component
  wraps only one consumer, revert it.

### Phase 5 — Workflow affordances

Scope:

- Add filters/tabs to `/dashboard/invitaciones` by project status:
  - Todas
  - Borrador
  - Esperando cliente
  - En revisión
  - En producción
  - Publicadas
  - Archivadas
- Add a "Siguiente paso" affordance where practical (inline hint or visual indicator per row):
  - `draft` → "Generar link de captura"
  - `waiting_for_client` → "Esperando respuesta del cliente"
  - `client_submitted` → "Revisar captura"
  - `in_review` → "En revisión"
  - `in_production` → "Continuar producción"
  - `approved` → "Generar borrador"
  - `preview_sent` → "Esperando aprobación final"
  - `published` → "Ver invitación pública"
  - `archived` → "Archivada"
- Improve empty states with actionable guidance per status tab.
- Consider search/filter input for both dashboard tables.
- Do not add complex state machines unless the current code requires it.

Expected outcome:

- The admin can quickly understand what to do next.
- The list view becomes operational, not just informational.

Verification:

- Manual test across representative project statuses.
- Confirm links/actions route correctly.
- `pnpm type-check`
- `pnpm lint`

### Phase 6 — Data model hardening (only after earlier phases)

Scope:

Evaluate, but do not blindly implement:

- Whether `events` should keep globally unique `slug` or move to `UNIQUE(event_type, slug)`.
- Whether `invitation_projects` should store `event_id` after publish for explicit cross-reference.
- Whether published projects should require a project slug earlier (e.g., at creation time).
- Whether manual RSVP events and invitation-produced events need an explicit source column
  (`source: 'manual' | 'production_pipeline'`).
- Whether intake tables need soft delete consistency.
- Whether demo content should be snapshotted into the draft/published content to reduce filesystem
  dependency.

Expected outcome:

- A future migration plan, only if justified by real usage and risk.
- No unnecessary schema churn.

Verification:

- Data audit before any migration (check current `events` for slug collision patterns).
- Migration dry run against a local Supabase instance.
- Tests around publish, lookup, and RSVP behavior after migration.

Decision gate:

- Do not perform schema changes without a separate migration plan and data audit signed off.

#### Phase 6 evaluation (executed 2026-05-30)

After implementing Phases 1–5, the following assessment was made:

| Item                                                          | Recommendation                              | Rationale                                                                                                                                                                                |
| ------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events.slug` globally unique vs `UNIQUE(event_type, slug)`   | **Keep globally unique**                    | Phase 1 already blocks cross-type collisions at the application level (`publishDraft`). A schema migration is only justified if cross-type slug reuse becomes a common operational need. |
| `invitation_projects` store `event_id`                        | **Defer**                                   | Would create an explicit cross-reference but is not critical. Worth adding if tighter integration is needed between intake system and RSVP events.                                       |
| Require project slug at creation time                         | **Defer**                                   | Auto-generated slug pattern is functional. Requiring slug at creation adds friction without proportional benefit.                                                                        |
| Source column on `events` (`manual` vs `production_pipeline`) | **Worth adding when cleaning events table** | Low-effort, high-traceability value. Enables filtering and reporting on event origin. No schema migration needed yet — document as future task.                                          |
| Intake tables soft delete consistency                         | **Not urgent**                              | Only needed if deletion tracking becomes an operational requirement. Most intake tables don't use soft delete.                                                                           |
| Snapshot demo content into draft/published content            | **Defer**                                   | Would reduce filesystem dependency but adds storage bloat. The current mapper already merges demo data at publish time.                                                                  |

**Summary**: No schema changes are justified at this point. The application-level safeguards added
in Phase 1 mitigate the primary risk. If a future phase touches the `events` table, adding a
`source` column is the most valuable change.

### Phase 7 — Demo management (later optional phase)

Scope:

Evaluate whether dashboard-based demo creation is actually needed.

Options:

- Keep demos code/content-managed.
- Add documentation for creating a new demo via files (follow existing pattern in
  `demo-preset-catalog.ts` + new JSON in `event-demos/` + new SCSS preset if needed).
- Add a lightweight internal checklist for demo creation.
- Only later consider a dashboard demo editor.

Expected outcome:

- Demo operations are clear.
- No premature CMS-like system is introduced.

Decision gate:

- Only build a demo editor if repeated operational friction justifies it.

#### Phase 7 evaluation (executed 2026-05-30)

**Assessment**: Keep demos code/content-managed.

Current process (adding a new demo):

1. Create `src/content/event-demos/<preset-name>.json` with content defaults.
2. Add entry in `src/lib/intake/demo-preset-catalog.ts` with preset metadata.
3. Optionally add SCSS preset if a new theme is needed.

**Rationale**:

- Demo creation is infrequent (7 presets exist). The current pattern is straightforward and benefits
  from code review.
- A dashboard editor would require a DB migration for demo storage, a full CRUD UI, and asset
  management — significant complexity for an uncommon operation.
- The snapshot mechanism (`invitation_projects.snapshot`) already captures the preset configuration
  at creation time, so changes to a preset don't affect existing projects.

**If creating demos becomes frequent (e.g., weekly)**: Create a lightweight internal checklist
document (`docs/demo-creation-checklist.md`) documenting the three-file pattern rather than building
a dashboard editor.

## 6. Implementation principles

- Prefer small, reversible changes.
- Keep the app buildable after each phase.
- Do not mix schema migrations with broad UI redesign unless necessary.
- Do not trust documentation over current code.
- UI-facing text must be Spanish. Code comments and identifiers should remain English.
- Respect Astro server/client boundaries:
  - API routes (`src/pages/api/`) are the server entry point.
  - React islands (`client:load`) call APIs, not server modules directly.
  - Do not import server-only modules (repositories, service-role supabase client) into client
    components.
- Be careful with Vercel/Linux casing behavior (file paths, imports, asset references).
- Avoid over-abstracting shared components too early (revert a shared component if it only wraps one
  consumer).
- Prefer current codebase state over documentation when they conflict.

## 7. Verification expectations

Commands to run after each phase:

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build  # when practical or before merging
```

Manual checks after UI changes:

- `/dashboard/invitaciones` — list load, create form, empty state, status tabs (Phase 5)
- `/dashboard/invitaciones/[id]` — detail load, block selector, capture link, draft section
- `/dashboard/invitaciones/[id]/draft` — draft review, edit, publish
- `/dashboard/invitaciones/[id]/preview` — preview renders without error
- `/dashboard/invitaciones/[id]/review` — submission review, approve, request changes
- `/dashboard/eventos` — list load, create/edit modal, publish/archive actions

## 8. Risks and decisions still open

| Decision                                                                        | Options                                                                | Impact                                                                                                                           |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Should `publishDraft` always create/update an `events` record?                  | Always / Only if exists / Never                                        | Affects Phase 1 and Phase 6. If never, guest management for published projects is broken. If always, all projects need an owner. |
| Should manual event creation remain visible in the UI?                          | Keep visible with warning / Hide behind admin toggle / Remove entirely | Affects Phase 3 copy. Removing prematurely would break existing workflows.                                                       |
| Should `events.slug` stay globally unique?                                      | Keep as-is / Change to `UNIQUE(event_type, slug)`                      | Affects Phase 6. Changing requires a migration and impacts all event lookups.                                                    |
| Should `invitation_projects.slug` be required earlier?                          | Required at creation / Remain optional / Set at publish                | Affects Phase 6. Would give custom URLs from the start.                                                                          |
| Should there be a true "create from demo content" shortcut?                     | Build / Don't build                                                    | Affects Phase 7 or an additional phase. Would bypass client intake for admin-created content.                                    |
| Should demo presets remain code-managed?                                        | Keep / Move to DB                                                      | Affects Phase 7. Moving to DB enables a demo editor but adds migration complexity.                                               |
| Should `invitation_projects` store `event_id` after publishing?                 | Add column / Don't add                                                 | Affects Phase 6. Would create an explicit cross-reference between the two systems.                                               |
| Should published content preview continue depending on filesystem demo content? | Keep filesystem dependency / Snapshot content into DB                  | Affects Phase 6. Snapshotting would decouple preview from the filesystem.                                                        |

## 9. Expected output from this task

- File created: `.agent/plans/dashboard-creation-flow-plan.md`
- The plan describes 7 phases from technical stabilization through optional demo management.
- Open decisions are documented in section 8.
- The plan follows `.agent/plans/README.md` conventions: single lightweight Markdown file, no
  archive/manifest machinery.
- No production files were modified.
- No documentation outside `.agent/plans/` was modified.
