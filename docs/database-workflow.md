# Database Workflow

## Principle

Local development uses local Supabase. Production is the source of real customer data. Production
can be read for backups/local refreshes. Production can only be mutated through reviewed migrations.

The workflow is asymmetric:

```txt
Production -> Local: allowed for read-only refreshes and backups.
Local -> Production: allowed only for reviewed migrations.
```

## Environments

- `.env` is for local Supabase and should point to `http://127.0.0.1:54321`.
- Local DB workflow scripts require PostgreSQL client tools. `psql` must be installed and available
  on PATH; verify with `psql --version`.
- `.env.local` must not point to production during normal development.
- Production credentials must come from shell environment variables or gitignored secret files such
  as `.env.production.local`, `.env.prod.local`, `.secrets/prod-db-url`, or
  `.tmp/secrets/prod-db-url`.
- `.tmp/` and `.backups/` are never committed.
- Never print or paste a full production connection string in logs, docs, issues, or chat.

## Common Commands

```bash
pnpm db:local:refresh-from-prod
pnpm db:local:backup-wip
pnpm db:local:bootstrap-admin
pnpm db:local:validate
pnpm db:prod:backup
pnpm db:prod:migrate
pnpm db:prod:patch -- --file <path>
pnpm db:sql:lint -- --file <path>
```

`pnpm db:local:refresh-from-prod`

- Reads production `public` data through `PROD_DB_URL`.
- Does not mutate production.
- Destructively resets only the local Supabase DB.
- Imports through a local staging schema, recreates local auth users, runs local backfills, and
  validates FK integrity.
- Allows exactly one extra local `app_user_roles` row for the local super-admin user.
- Refreshes `invitation_assets` metadata only; actual Supabase Storage files are not copied by the
  database dump, so metadata does not guarantee local object availability.
- Already bootstraps the local super-admin user and role.
- Use when local development needs a current production-shaped dataset.

`pnpm db:local:backup-wip`

- Dumps selected risky local `public` tables under `.tmp/db/local-wip/`.
- Does not touch production.
- Does not include Supabase Storage binaries.
- Does not include a full auth snapshot.
- Use before refresh only when local draft/editor work needs manual recovery insurance.

`pnpm db:local:bootstrap-admin`

- Connects only to local Supabase.
- Creates or updates the first `SUPER_ADMIN_EMAILS` user as the local super admin.
- Reads the password from `LOCAL_SUPER_ADMIN_PASSWORD || RSVP_ADMIN_PASSWORD`.
- Ensures `auth.users.raw_app_meta_data.role = 'super_admin'`, upserts
  `public.app_user_roles.role = 'super_admin'`, and verifies password login.
- Use after a local-only reset when you do not want to import production data.

`pnpm db:local:validate`

- Checks local Supabase URL, required tables, auth relationships, local super-admin login, and the
  asset library empty state.
- Validates the `invitation-assets` bucket registration, but does not enforce strict
  `invitation_assets` row parity because Storage binaries are not copied.
- Does not touch production.
- Does not mutate production.
- Use after `supabase start`, after local resets, and before debugging data-dependent flows.

`pnpm db:prod:backup`

- Reads production `public` data and writes a timestamped dump under `.backups/prod/`.
- Touches production read-only.
- Does not mutate production.
- Use before migration windows or whenever a manual protected backup is needed.
- Backups contain real customer data and must not be committed.

`pnpm db:prod:migrate`

- Runs `pnpm type-check`, `pnpm test`, `pnpm build`, and `supabase migration list`.
- Creates a production backup first.
- Applies pending Supabase migrations only.
- Mutates production and requires explicit confirmation.
- This is the only approved production mutation workflow.

`pnpm db:sql:lint -- --file <path>`

- Reads a SQL file only.
- Requires the production patch manifest documented in
  [`.agent/db/manual-sql-manifest.md`](../.agent/db/manual-sql-manifest.md).
- Blocks unsafe production-patch patterns including unscoped `UPDATE`/`DELETE`, `TRUNCATE`, broad
  `DROP`, `ALTER TABLE`, RLS policy changes, `SECURITY DEFINER`, and `CASCADE`.

`pnpm db:prod:patch -- --file <path>`

- Dry-run lint only.
- Does not open a database connection and does not execute SQL.
- Exists so production patches have one fail-closed entrypoint while the full execution harness is
  still intentionally deferred.

## Workflows

### Daily local development

```bash
supabase start
pnpm dev
pnpm db:local:validate
```

### Refresh local from production

```bash
pnpm db:start
PROD_DB_URL=... pnpm db:local:refresh-from-prod
pnpm db:local:validate
```

Production is read-only through `PROD_DB_URL`. `db:local:refresh-from-prod` owns the destructive
reset/import/bootstrap sequence: it resets local Supabase, imports production data through a staging
schema, copies into the current local `public` schema, recreates local auth users, and bootstraps
the local super admin. Do not run `db:local:reset` before it during the normal refresh workflow.

Production public data is preserved where possible, and local auth UUIDs are preserved by creating
local placeholder users for production references. Any mapping or diagnostic report must be written
under `.tmp/db/`. `app_user_roles` may have exactly one extra local row for the local super admin.
`invitation_assets` metadata can refresh from production, but actual Storage objects are not copied,
so local metadata may point at missing local files.

If schema drift is detected during staging import or copy, the script stops and reports the failure.
Do not patch around drift manually; add or apply the missing migration locally.

### Preserve local WIP before refresh

```bash
pnpm db:start
pnpm db:local:backup-wip
PROD_DB_URL=... pnpm db:local:refresh-from-prod
pnpm db:local:validate
```

This backup is manual, partial, and intended for recovery reference only. It includes selected local
public tables such as drafts, intake rows, invitations, and `invitation_assets` metadata. It does
not include Supabase Storage binaries or a full auth snapshot.

### Reset local only

```bash
pnpm db:local:reset
```

Use this only when manually resetting local Supabase without importing production data. It is a
lower-level command, not a step in the normal production refresh workflow. It does not create the
local admin user.

### Reset and recreate local admin

```bash
pnpm db:local:reset-ready
```

Use this when you want a local reset without importing production data, but still need the local
super admin to log in afterward. It runs `pnpm db:local:reset` and then
`pnpm db:local:bootstrap-admin`.

To bootstrap or repair the local admin without resetting:

```bash
pnpm db:local:bootstrap-admin
```

The first `SUPER_ADMIN_EMAILS` entry must be `celebra.me.com@gmail.com`. The password must be set in
`LOCAL_SUPER_ADMIN_PASSWORD` or `RSVP_ADMIN_PASSWORD`. Do not hardcode real passwords in source
code.

### Backup production

```bash
PROD_DB_URL=... pnpm db:prod:backup
```

Backups contain real customer data. Keep them only in gitignored storage, rotate them manually, and
delete them when they are no longer needed.

For schema-only:

```bash
PROD_DB_URL=... pnpm db:prod:backup -- --schema-only
```

### Push migrations to production

```bash
PROD_DB_URL=... pnpm db:prod:migrate
```

This is the only workflow allowed to mutate production. It runs preflight checks, creates a backup
first, applies migrations only, and never pushes local data dumps.

### Check a manual production patch

```bash
pnpm db:prod:patch -- --file scripts/manual/production-patches/<script>.sql
```

This command only validates the manifest and SQL safety rules. It does not execute the patch. A
production patch file without the [required manifest](../.agent/db/manual-sql-manifest.md) is
blocked.

## Never Do This

- Do not restore local DB dumps into production.
- Do not commit production dumps, secrets, passwords, or DB URLs.
- Do not put production credentials in `.env.local`.
- Do not use production as the default target for local development.
- Do not mutate production during local refresh.
- Do not run `pnpm db:push`; it is blocked because raw Supabase push can target a linked remote.
- Do not run `pnpm db:local:reset` before `pnpm db:local:refresh-from-prod`; refresh already resets
  local Supabase.
- Do not run `pnpm ops adopt-legacy-events`; it is disabled because it can create invitations and
  patch events with the service role.
- Do not run ad-hoc `supabase db push --linked` outside the approved migration workflow.
- Do not run `supabase link` casually.

## Troubleshooting

- `psql` missing or not found: install PostgreSQL client tools, make sure `psql` is on PATH, and
  verify with `psql --version`. Local DB scripts cannot validate, back up WIP, or import refresh
  data without it.
- Login fails locally: run `pnpm db:local:validate`; then verify `SUPER_ADMIN_EMAILS` and
  `RSVP_ADMIN_PASSWORD` or `LOCAL_SUPER_ADMIN_PASSWORD` are local values.
- `PGRST205` table-not-found errors: run `pnpm db:local:refresh-from-prod` for a production-shaped
  local dataset, or `pnpm db:local:reset` for schema-only local reset. If it persists, confirm the
  table exists in `supabase/migrations`.
- Local schema drift: refresh stops during staging import/copy. Apply missing local migrations or
  add a reviewed migration; do not hand-edit production dumps.
- Missing `PROD_DB_URL`: export it in the shell or place it in a gitignored secret file. Never store
  it in `.env.local`.
- Broken Storage assets: `invitation_assets` metadata can refresh from production, but actual
  Storage objects are not copied by the DB dump. Re-upload or sync Storage separately through a
  reviewed, read-only-first process.
- Restore/import failures: keep the dump under `.tmp/db/`, read the first SQL error, fix the schema
  mismatch through migrations, and rerun the refresh.
