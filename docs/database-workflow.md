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
- `.env.local` must not point to production during normal development.
- Production credentials must come from shell environment variables or gitignored secret files such
  as `.env.production.local`, `.env.prod.local`, `.secrets/prod-db-url`, or
  `.tmp/secrets/prod-db-url`.
- `.tmp/` and `.backups/` are never committed.
- Never print or paste a full production connection string in logs, docs, issues, or chat.

## Common Commands

```bash
pnpm db:local:refresh
pnpm db:local:validate
pnpm db:prod:backup
pnpm db:prod:migrate
```

`pnpm db:local:refresh`

- Reads production `public` data through `PROD_DB_URL`.
- Does not mutate production.
- Destructively resets only the local Supabase DB.
- Imports through a local staging schema, recreates local auth users, runs local backfills, and
  validates FK integrity.
- Refreshes `invitation_assets` metadata only; actual Supabase Storage files are not copied by the
  database dump.
- Use when local development needs a current production-shaped dataset.

`pnpm db:local:validate`

- Checks local Supabase URL, required tables, auth relationships, local super-admin login, and the
  asset library empty state.
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

## Workflows

### Daily local development

```bash
supabase start
pnpm dev
pnpm db:local:validate
```

### Refresh local from production

```bash
PROD_DB_URL=... pnpm db:local:refresh
```

Production is read-only. The local DB is reset. Data is imported through a staging schema, then
copied into the current local `public` schema. Local auth users and backfills are recreated.
Production public data is preserved where possible, but local auth UUIDs may be deterministically
remapped when Supabase Auth cannot create users with production UUIDs. Any mapping must be written
under `.tmp/db/`. `invitation_assets` metadata can refresh from production, but local rows may be
empty when current content uses only internal bundled assets.

If schema drift is detected during staging import or copy, the script stops and reports the failure.
Do not patch around drift manually; add or apply the missing migration locally.

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

## Never Do This

- Do not restore local DB dumps into production.
- Do not commit production dumps, secrets, passwords, or DB URLs.
- Do not put production credentials in `.env.local`.
- Do not use production as the default target for local development.
- Do not mutate production during local refresh.
- Do not run ad-hoc `supabase db push --linked` outside the approved migration workflow.
- Do not run `supabase link` casually.

## Troubleshooting

- Login fails locally: run `pnpm db:local:validate`; then verify `SUPER_ADMIN_EMAILS` and
  `RSVP_ADMIN_PASSWORD` or `LOCAL_SUPER_ADMIN_PASSWORD` are local values.
- `PGRST205` table-not-found errors: reset local with `supabase db reset`, then validate. If it
  persists, confirm the table exists in `supabase/migrations`.
- Local schema drift: refresh stops during staging import/copy. Apply missing local migrations or
  add a reviewed migration; do not hand-edit production dumps.
- Missing `PROD_DB_URL`: export it in the shell or place it in a gitignored secret file. Never store
  it in `.env.local`.
- Broken Storage assets: `invitation_assets` metadata can refresh from production, but actual
  Storage objects are not copied by the DB dump. Re-upload or sync Storage separately through a
  reviewed, read-only-first process.
- Restore/import failures: keep the dump under `.tmp/db/`, read the first SQL error, fix the schema
  mismatch through migrations, and rerun the refresh.
