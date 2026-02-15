# RSVP Database (Supabase)

This document defines how RSVP database schema is created, evolved, and operated for `celebra-me`.

## Scope

The RSVP backend persists data in Supabase through PostgREST using `SUPABASE_SERVICE_ROLE_KEY`. The
schema includes:

- `public.rsvp_records`
- `public.rsvp_audit_log`
- `public.rsvp_channel_log`

## Migration strategy

Schema changes are versioned in `supabase/migrations` and applied in order.

Current baseline:

- `20260215000100_rsvp_init.sql`
- `20260215000200_rsvp_hardening.sql`

Do not apply ad-hoc SQL directly in production without creating a migration file first.

## Local workflow

Prerequisites:

- Docker running
- Supabase CLI available (`npx supabase ...` scripts are provided)

Commands:

```bash
pnpm db:start
pnpm db:push
```

Reset local database:

```bash
pnpm db:reset:local
```

Create a new migration:

```bash
pnpm db:migrate:new <migration_name>
```

Remote runbook helper (PowerShell):

```powershell
pwsh -File scripts/rsvp-db-remote-runbook.ps1
# optional: pwsh -File scripts/rsvp-db-remote-runbook.ps1 -ProjectRef <project_ref>
```

## Staging / Production workflow

1. Ensure remote project is linked (`npx supabase link --project-ref <ref>`).
2. Apply migrations:

```bash
pnpm db:push
```

3. Run RSVP API smoke tests:

- submit confirmed RSVP
- submit declined RSVP
- admin list and CSV export
- channel telemetry event

SQL verification queries:

- `supabase/verification/rsvp_schema_checks.sql`

## Data model notes

### `rsvp_records`

- `store_key` is primary key and conflict key for upsert.
- `rsvp_id` is unique business id.
- Business check enforced in DB:
    - `declined` requires `attendee_count = 0`
    - `confirmed` requires `attendee_count >= 1`
- `last_updated_at` is maintained by trigger as safety net.

### `rsvp_audit_log`

- References `rsvp_records(rsvp_id)` with `on delete cascade`.

### `rsvp_channel_log`

- References `rsvp_records(rsvp_id)` with `on delete cascade`.

## Security model

RLS is enabled and forced on all RSVP tables.

- `anon`: denied
- `authenticated`: denied
- access is backend-only using `SUPABASE_SERVICE_ROLE_KEY`

This protects RSVP data from accidental client-side exposure.

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RSVP_TOKEN_SECRET`
- `RSVP_ADMIN_USER`
- `RSVP_ADMIN_PASSWORD`

## Rollback checklist (basic)

1. Identify last migration that introduced issue.
2. Create a new forward-fix migration (preferred) instead of manual revert.
3. If rollback is unavoidable:

- snapshot affected tables
- run targeted SQL revert in controlled window
- re-run RSVP smoke tests
- verify admin/export responses and data integrity

## Operational checks

- `pnpm test -- --runInBand tests/api/rsvp.context.test.ts tests/api/rsvp.post-canonical.test.ts tests/api/rsvp.channel.test.ts tests/api/rsvp.admin.test.ts tests/api/rsvp.export.test.ts`
- Verify `/api/rsvp/admin` and `/api/rsvp/export.csv` require Basic Auth
- Confirm data remains after process restart
