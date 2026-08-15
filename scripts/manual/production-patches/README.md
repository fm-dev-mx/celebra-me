# Production Patch Execution Workflow

This directory contains generated SQL patches for manual production execution. **You (the operator)
execute these patches.** The agent never connects to production.

## Active status catalog

`pnpm dbs` and `/dashboard/estado` discover every file in this directory that declares
`@paired-stores` unless the header also has `@catalog: historical`. Residual and pair-key rules are
in `.agent/rules/manual-sql-manifest.md`. Older SQL files without `@paired-stores` remain historical
and are not probed. The catalog checks the approved path, unique `@script-id`, manifest, `@env`, row
bounds and `@dry-run-query` before any read-only query is issued.

Each active patch is reported independently per environment:

- `NOT_APPLICABLE`: the environment is not a declared target (Local and Preview for these patches).
- `NOT_NEEDED`: the live detector returned zero rows. This does **not** prove the patch was applied.
- `PENDING`: a positive live count is inside the approved range; the output includes an owner plan
  command.
- `BLOCKED`: the catalog/manifest is invalid or the live count is outside the approved range.
- `UNVERIFIED`: the target could not be queried, timed out, failed, or returned an invalid count.

Status refreshes use bounded, read-only transactions and redact connection details and raw
SQL/errors. They never execute a patch or create an apply receipt. A `PENDING` plan is only a plan;
mutation still requires the owner TTY workflow with `--apply`.

## Dashboard action hierarchy

`/dashboard/estado` answers in this order: global health, prioritized actions, then technical
detail. The queue is shared with the CLI semantics and deduplicates repeated read-only refreshes. A
green `Todo en orden` requires live evidence for every applicable control, valid disposable proof,
no pending migration/publication/patch action, and intact Production authorization. `NOT_APPLICABLE`
is neutral; `NOT_NEEDED` is green only when the detector returned zero rows and never means
“applied”.

The dashboard is read-only. `Revalidar todo` only refreshes evidence and the `Copiar` buttons only
copy commands. For a `PENDING` patch, review the plan command first and then run the owner apply
command with `--apply` from an authorized TTY. Query failures, timeouts, invalid output, or counts
outside the approved range never recommend applying the patch.

---

## Approved patch directory

Only SQL files under `scripts/manual/production-patches/` are valid targets for the production patch
runner. Generated SQL is immutable — do not hand-edit it.

## Prerequisites

| Requirement       | Source                                                      | How to supply                                                                                    |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `SUPABASE_URL`    | Vercel environment / `.env.production.local`                | Set as env var: `$env:SUPABASE_URL = "https://<project>.supabase.co"`                            |
| `PROD_DB_URL`     | `.env.production.local` or gitignored secret file           | The runner's `getProdDbUrl()` reads from `PROD_DB_URL` env var or `./.env.production.local` etc. |
| `--owner-user-id` | Production Celebra-me admin panel (create user → copy UUID) | Pass as CLI argument to `--apply`                                                                |

## Supported PROD_DB_URL formats and project validation

Before executing any patch, the runner verifies that `SUPABASE_URL` and `PROD_DB_URL` reference the
**same Supabase project**. Supported connection string formats:

| Format                       | Example                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Direct (db prefix)           | `postgresql://user:***@db.<ref>.supabase.co:5432/postgres`                   |
| Direct (no prefix)           | `postgresql://user:***@<ref>.supabase.co:5432/postgres`                      |
| Pooler (ref in username)     | `postgresql://<ref>.<region>:***@<region>.pooler.supabase.com:6543/postgres` |
| Pooler (postgres.<ref> user) | `postgresql://postgres.<ref>:***@<region>.pooler.supabase.com:5432/postgres` |
| Pooler (host prefix)         | `postgresql://user:***@postgres.<ref>.pooler.supabase.com:5432/postgres`     |

The project reference is extracted from:

- **SUPABASE_URL**: hostname (`<ref>.supabase.co`)
- **PROD_DB_URL**: hostname OR database username, depending on format

**Pooler URLs** that use `<region>.pooler.supabase.com` hostnames extract the project reference from
the **username**. Two username formats are supported:

- `<ref>.<region>` — project ref is the first segment (e.g., `abcdef.us-east-1` → ref = `abcdef`)
- `postgres.<ref>` — project ref is the segment after `postgres.` (e.g., `postgres.abcdef` → ref =
  `abcdef`)

The `postgres.<ref>` format is common when connecting as the `postgres` role for a specific project
through the Supabase connection pooler.

The runner aborts **before connecting** when:

- The project references do not match
- The connection format is unsupported or ambiguous
- Either URL is malformed

No credentials or project URLs are printed in logs.

## Patch SQL properties

- **Generated code** — never edit by hand; run generator `--check` to verify parity.
- **Zero operator-editable placeholders** — all runtime values injected by the runner.
- **Transactional** — wrapped in `BEGIN`/`COMMIT`; preflight failures abort before any mutation.
- **Deterministic** — safe to re-run after a preflight failure.
- **Ownership-conflict safe** — aborts with a clear message rather than silently reassigning.
- **Asset-aware** — validates exactly the expected number of active canonical assets.
- **Idempotent preflight** — repeated dry-run or preflight-triggered re-runs produce the same
  result.

## Execution order

1. **Create customer user** in the Celebra-me production system.
2. **Obtain production UUID** from the new user.
3. **Prepare invitation** through the dashboard workflow (slug, event type, correct owner, assets).
4. **Configure environment**: set `SUPABASE_URL` and ensure `PROD_DB_URL` is available.
5. **Dry-run** (recommended — no database connection).
6. **Plan and apply** only through owner `prod:apply --patch`.
7. **Verify** with read-only queries.

## Commands

### Dry-run (lint only, no database connection)

The `db:prod:patch` script delegates mode selection to the CLI. No mode is hardcoded.

```bash
pnpm db:prod:patch -- --dry-run \
  --file "scripts/manual/production-patches/<patch-file>.sql"
```

Expected output:

```
Production patch dry-run passed lint: .../<patch-file>.sql
No database connection was opened and no SQL was executed.
```

### Owner plan and apply (PowerShell)

Set the required **environment variables**, then first review the owner plan and only then apply:

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:PROD_DB_URL = "<POSTGRESQL_CONNECTION_STRING>"

pnpm prod:apply -- --patch "scripts/manual/production-patches/<patch-file>.sql"

pnpm prod:apply -- --patch "scripts/manual/production-patches/<patch-file>.sql" --apply
```

> ⚠️ **Never paste credentials into logs, documentation or chat.** The runner redacts both
> `SUPABASE_URL` and `PROD_DB_URL` from its output.

> ⚠️ **If you exposed a production database credential** (e.g. the password inside `PROD_DB_URL`) in
> a chat, screenshot or log, rotate that credential immediately. Supabase project passwords can be
> reset via Project Settings → Database → Reset password.

### Verification

The direct `db:prod:patch` runner is lint-only. `prod:apply` validates the owner workflow before any
mutation:

1. the manifest, SQL safety rules, and preview row-count bounds are valid
2. the artifact must match the reviewed plan; `--owner-user-id` is required only when the SQL reads
   `app.owner_user_id`
3. `SUPABASE_URL` must be `https://<project>.supabase.co` (rejects `postgresql://`)
4. `PROD_DB_URL` must be available from environment or gitignored secret file
5. `SUPABASE_URL` and `PROD_DB_URL` must reference the same Supabase project
6. a current critical backup and interactive owner confirmation exist immediately before the write
7. session settings (`app.supabase_project_url`, and `app.owner_user_id` only when the SQL reads it)
   plus the patch SQL are sent in a single `psql` invocation

## Ownership conflict handling

The SQL checks both `invitations.created_by` and `events.owner_user_id` before making any changes.
If either is populated with a user different from the supplied owner UUID, the patch aborts with a
message identifying the conflict.

## Safe re-run conditions

- **After preflight failure**: fix the issue and re-run — no mutation occurred.
- **After successful apply**: do not re-run the same patch; the invitation is already published.
- **Dry-run**: always safe, never opens a database connection.

## Post-execution verification

Run these read-only queries to confirm:

```sql
-- Invitation status
SELECT slug, event_type, status, created_by, base_demo_id, theme_id
FROM public.invitations WHERE slug = '<slug>' AND event_type = '<type>';

-- Published content
SELECT slug, event_type, version, published_at
FROM public.published_invitation_content WHERE slug = '<slug>' AND event_type = '<type>';

-- Event ownership
SELECT slug, event_type, owner_user_id, status, published_at
FROM public.events WHERE slug = '<slug>';

-- Owner membership
SELECT e.slug, em.user_id, em.membership_role
FROM public.event_memberships em
JOIN public.events e ON e.id = em.event_id
WHERE e.slug = '<slug>' AND em.deleted_at IS NULL;
```

## Recovery

| Failure               | Action                                                 |
| --------------------- | ------------------------------------------------------ |
| Preflight abort       | Fix the reported issue, re-run                         |
| Mid-execution failure | Restore from verified backup, fix root cause, re-apply |
| Wrong owner applied   | Archive the invitation through the approved workflow   |
