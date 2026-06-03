---
title: Apply invitation_assets Migration & Fix Preview Pipeline
status: active
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
  - .env
  - .env.local
  - .agent/plans/archived/invitation-asset-library-plan.md
supersedes: []
superseded_by: []
---

# Apply invitation_assets Migration & Fix Preview Pipeline

## Status

Active — pending implementation.

## Problem

Two runtime errors in the editor route:

1. **Asset library panel (404):**
   `Supabase error (404): PGRST205 — Could not find the table 'public.invitation_assets' in the schema cache`
2. **Embedded preview pane:** "Vista previa no disponible / No se pudo generar la vista previa con
   el contenido disponible."

## Root Cause

The migration `supabase/migrations/20260602000000_invitation_assets.sql` exists in the codebase but
has **never been applied** to the remote Supabase project (`ineitkdkyrxqyressllp.supabase.co`). The
`.env.local` file overrides the local dev URLs with production credentials, so every environment —
local dev included — connects to the remote project where the table is absent.

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

### Step 1: Apply the migration to the remote project

```bash
supabase db push --linked
```

This applies `20260602000000_invitation_assets.sql` to the linked remote project
(`ineitkdkyrxqyressllp`). The migration is additive (CREATE TABLE, INSERT INTO storage.buckets,
CREATE POLICY) and does not conflict with any previously applied migration.

If migration order is in doubt, first verify:

```bash
supabase migration list --linked
```

The last applied migration should pre-date `20260602000000_invitation_assets.sql`. If a later
migration was already pushed (e.g. `20260601000001_invitations_domain.sql`), this is safe — the new
migration only creates a new table and has no dependencies on later DDL.

### Step 2: Verify schema

```bash
curl -s -H "apikey: $SUPABASE_ANON_KEY" \
  "https://ineitkdkyrxqyressllp.supabase.co/rest/v1/invitation_assets?select=id&limit=1"
```

Expected: `[]` (empty array, successful 200).

Also verify the `invitation-assets` storage bucket exists:

```bash
curl -s -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "https://ineitkdkyrxqyressllp.supabase.co/storage/v1/bucket/invitation-assets"
```

### Step 3: Run unit tests

```bash
pnpm test -- --runInBand tests/unit/publishing.service.test.ts
pnpm test -- --runInBand tests/unit/draft-preview-helper.test.ts
pnpm test -- --runInBand tests/unit/asset-usage.service.test.ts
pnpm test -- --runInBand tests/unit/asset-library.service.test.ts
pnpm test -- --runInBand tests/unit/draft-to-published.mapper.test.ts
pnpm type-check
```

All tests mock `findAssetsByInvitationId` and should pass regardless of DB state.

### Step 4: Manual browser verification

Navigate to the editor route and check:

1. `/dashboard/invitaciones/[id]/editar#assetLibrary` — Asset Library panel loads without error,
   shows empty state "Aún no has subido imágenes."
2. Preview pane iframe — reload via "Recargar" button; preview renders invitation content instead of
   "Vista previa no disponible"
3. `/dashboard/invitaciones/[id]/preview` in a separate tab — full preview route renders correct
   fallback chain (draft → published → empty)

### Step 5: Environment cleanup (already applied)

The env audit (2026-06-03) normalized the environment setup:

- `.env.local` → renamed to `.env.local.remote.bak` (gitignored) so local dev defaults to `.env`
  (Supabase local)
- Removed dead vars `RSVP_TOKEN_SECRET` and `DATABASE_URL` from `.env`
- Removed duplicate `SUPABASE_SERVICE_ROLE_KEY` from `.env`
- Local Supabase must be started for local dev:

```bash
supabase start
supabase db push
```

## Risk Assessment

| Risk                                         | Severity | Mitigation                                                                                                                             |
| -------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Migration order conflict                     | Low      | Migration is additive, no DDL overlaps with existing migrations                                                                        |
| Storage bucket already exists                | Low      | `insert ... on conflict (id) do nothing` handles it                                                                                    |
| Generated types stale                        | Low      | `InvitationAsset` is hand-typed in `types.ts`, not auto-generated                                                                      |
| Vercel deploy without migration              | Medium   | API routes hitting `invitation_assets` will 404 until migration is applied. Run `supabase db push --linked` before or alongside deploy |
| `.env.local` permanently overrides local dev | Low      | Optional cleanup step; not required for the fix                                                                                        |

## Verification

```bash
# 1. Migration status
supabase migration list --linked

# 2. Schema reachable
curl -s -H "apikey: $SUPABASE_ANON_KEY" \
  "https://ineitkdkyrxqyressllp.supabase.co/rest/v1/invitation_assets?select=id&limit=1"

# 3. Tests
pnpm test -- --runInBand tests/unit/publishing.service.test.ts
pnpm test -- --runInBand tests/unit/draft-preview-helper.test.ts
pnpm test -- --runInBand tests/unit/asset-usage.service.test.ts
pnpm test -- --runInBand tests/unit/asset-library.service.test.ts
pnpm test -- --runInBand tests/unit/draft-to-published.mapper.test.ts
pnpm type-check

# 4. Manual — editor route browser checks
```
