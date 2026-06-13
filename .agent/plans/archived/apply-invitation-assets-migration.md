---
title: Apply invitation_assets Migration & Fix Preview Pipeline
status: historical-non-executable
created: 2026-06-03
updated: 2026-06-03
related_skills:
  - supabase
  - supabase-postgres-best-practices
related_docs:
  - supabase/migrations/20260602000000_invitation_assets.sql
  - src/lib/intake/repositories/asset.repository.ts
  - src/lib/invitation/draft-preview-helper.ts
  - src/pages/dashboard/invitaciones/[id]/preview.astro
  - src/lib/rsvp/repositories/supabase.ts
  - .agent/plans/archived/invitation-asset-library-plan.md
supersedes: []
superseded_by: []
---

# Apply invitation_assets Migration & Fix Preview Pipeline

## Status

Historical / non-executable. This note is retained for context only and must not be used as an
active runbook. Use `docs/database-workflow.md` and `docs/env-workflow.md` for current DB and env
operations.

Do not run the remote Supabase `curl` examples that previously lived here, do not pass
`SUPABASE_SERVICE_ROLE_KEY` to ad-hoc remote API calls, and do not edit real `.env*` files from this
plan.

## Problem

Two runtime errors in the editor route:

1. **Asset library panel (404):**
   `Supabase error (404): PGRST205 — Could not find the table 'public.invitation_assets' in the schema cache`
2. **Embedded preview pane:** "Vista previa no disponible / No se pudo generar la vista previa con
   el contenido disponible."

## Root Cause

At the time this note was written, the migration
`supabase/migrations/20260602000000_invitation_assets.sql` appeared not to have been applied to the
remote Supabase project, and local environment files appeared to point at remote credentials. Treat
those observations as historical; verify current state through the approved DB workflow before
taking action.

The preview failure is a **downstream consequence**: `buildDraftPreviewPageContext`
(`draft-preview-helper.ts:60`) calls `findAssetsByInvitationId`, which hits the missing table. The
404 bubbles up through the generic catch block and collapses the entire fallback chain. Both errors
share the same root cause and are not independent.

## Scope

This plan covers the minimal safe fix: apply the pending migration. It explicitly excludes:

- Schema changes, new tables, or new API routes
- UI-only error papering or catch-block widening
- Adding generated Supabase types or altering the type contract
- Switching the active environment (`.env.local`)

## Implementation Plan

### Historical Step 1: Apply the migration through the production workflow

```bash
PROD_DB_URL=... pnpm db:prod:migrate
```

This applies `20260602000000_invitation_assets.sql` through the reviewed production migration
workflow. The migration is additive (CREATE TABLE, INSERT INTO storage.buckets, CREATE POLICY) and
does not conflict with any previously applied migration.

Use the current production migration workflow only if this work is reactivated and reviewed. Do not
use ad-hoc linked Supabase commands from this historical note.

### Historical Step 2: Verify schema

Historical remote API checks were removed because they encouraged ad-hoc calls against remote
Supabase, including service-role bearer auth. If this plan is reactivated, add reviewed,
least-privilege verification steps that do not expose keys and do not bypass the approved DB
workflow.

### Historical Step 3: Run unit tests

```bash
pnpm test -- --runInBand tests/unit/publishing.service.test.ts
pnpm test -- --runInBand tests/unit/draft-preview-helper.test.ts
pnpm test -- --runInBand tests/unit/asset-usage.service.test.ts
pnpm test -- --runInBand tests/unit/asset-library.service.test.ts
pnpm test -- --runInBand tests/unit/draft-to-published.mapper.test.ts
pnpm type-check
```

All tests mock `findAssetsByInvitationId` and should pass regardless of DB state.

### Historical Step 4: Manual browser verification

Navigate to the editor route and check:

1. `/dashboard/invitaciones/[id]/editar#assetLibrary` — Asset Library panel loads without error,
   shows empty state "Aún no has subido imágenes."
2. Preview pane iframe — reload via "Recargar" button; preview renders invitation content instead of
   "Vista previa no disponible"
3. `/dashboard/invitaciones/[id]/preview` in a separate tab — full preview route renders correct
   fallback chain (draft → published → empty)

### Historical Step 5: Environment cleanup note

The env audit notes from 2026-06-03 are historical context only, not current instructions:

- Do not rename, edit, or clean real `.env*` files from this plan.
- `DATABASE_URL` and `RSVP_TOKEN_SECRET` are stale/deferred unless active code references reappear.
- Follow `docs/env-workflow.md` for current env source hierarchy.
- Local Supabase startup remains:

```bash
supabase start
pnpm db:local:reset
```

## Risk Assessment

| Risk                                         | Severity | Mitigation                                                                                                                        |
| -------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Migration order conflict                     | Low      | Migration is additive, no DDL overlaps with existing migrations                                                                   |
| Storage bucket already exists                | Low      | `insert ... on conflict (id) do nothing` handles it                                                                               |
| Generated types stale                        | Low      | `InvitationAsset` is hand-typed in `types.ts`, not auto-generated                                                                 |
| Vercel deploy without migration              | Medium   | API routes hitting `invitation_assets` will 404 until migration is applied. Run `pnpm db:prod:migrate` before or alongside deploy |
| `.env.local` permanently overrides local dev | Low      | Optional cleanup step; not required for the fix                                                                                   |

## Verification

```bash
# Historical tests
pnpm test -- --runInBand tests/unit/publishing.service.test.ts
pnpm test -- --runInBand tests/unit/draft-preview-helper.test.ts
pnpm test -- --runInBand tests/unit/asset-usage.service.test.ts
pnpm test -- --runInBand tests/unit/asset-library.service.test.ts
pnpm test -- --runInBand tests/unit/draft-to-published.mapper.test.ts
pnpm type-check

# Historical manual — editor route browser checks
```
