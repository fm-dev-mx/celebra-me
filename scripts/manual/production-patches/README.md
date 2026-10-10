# Production Patch Directory

This directory holds reviewed SQL patches for exceptional, owner-applied Production corrections.
**The owner applies them.** Agents may author and lint a patch but never run `--apply`.

Patches are not a substitute for versioned migrations (`pnpm prod:apply -- --schema`) or for managed
invitation content (`pnpm prod:apply -- --slug <slug>`); see
[`.agent/rules/database.md`](../../../.agent/rules/database.md). The required header is owned by
[`.agent/rules/manual-sql-manifest.md`](../../../.agent/rules/manual-sql-manifest.md); the lint,
plan, and apply sequence is owned by
[`docs/database-workflow.md`](../../../docs/database-workflow.md) (Check a manual production patch).

## Active status catalog

`pnpm dbs` and `/dashboard/estado` discover every file in this directory that declares
`@paired-stores` unless the header also has `@catalog: historical`. Older SQL files without
`@paired-stores` remain historical and are not probed. The catalog checks the approved path, unique
`@script-id`, manifest, `@env`, row bounds and `@dry-run-query` before any read-only query is
issued.

Each active patch is reported independently per environment:

- `NOT_APPLICABLE`: the environment is not a declared target (Local and Preview for these patches).
- `NOT_NEEDED`: the live detector returned zero rows. This does **not** prove the patch was applied.
- `PENDING`: a positive live count is inside the approved range; the output includes an owner plan
  command.
- `BLOCKED`: the catalog/manifest is invalid or the live count is outside the approved range.
- `UNVERIFIED`: the target could not be queried, timed out, failed, or returned an invalid count.

Status refreshes use bounded, read-only transactions and redact connection details and raw
SQL/errors. They never execute a patch or create an apply receipt. The dashboard only refreshes
evidence and copies commands; a `PENDING` plan is only a plan, and mutation still requires the owner
TTY workflow with `--apply`. Query failures, timeouts, invalid output, or counts outside the
approved range never recommend applying the patch.

## Credentials and project identity

`prod:apply -- --patch` reads `PROD_DB_URL` from the shell or the gitignored
`.env.production.local`. The Production API URL is derived from the project ref in `PROD_DB_URL`; an
optional `PROD_SUPABASE_URL` must be an `https://` Supabase URL for the same project. Local
`SUPABASE_URL` is never used. The identity check runs before the backup and aborts before connecting
when the project refs differ, the URL is malformed, or the format is unsupported.

Supported `PROD_DB_URL` formats:

| Format                    | Example                                                                      |
| ------------------------- | ---------------------------------------------------------------------------- |
| Direct (db prefix)        | `postgresql://user:***@db.<ref>.supabase.co:5432/postgres`                   |
| Direct (no prefix)        | `postgresql://user:***@<ref>.supabase.co:5432/postgres`                      |
| Pooler (`postgres.<ref>`) | `postgresql://postgres.<ref>:***@<region>.pooler.supabase.com:6543/postgres` |

Pooler hostnames carry no project ref, so the ref comes from the `postgres.<ref>` username. No
credentials or project URLs are printed in logs.

## Commands

```bash
pnpm db:prod:patch -- --dry-run --file "scripts/manual/production-patches/<patch-file>.sql"
pnpm prod:apply -- --patch "scripts/manual/production-patches/<patch-file>.sql"
pnpm prod:apply -- --patch "scripts/manual/production-patches/<patch-file>.sql" --apply
```

The first command is lint-only and opens no database connection. The plan (second command) runs the
manifest `@dry-run-query` against Production in read-only mode. `--apply` revalidates the reviewed
plan and artifact, the row-count bounds, a current critical backup, and the owner TTY confirmation,
then sends the session settings (`app.supabase_project_url`, plus `app.owner_user_id` only when the
SQL reads it and `--owner-user-id` is passed) and the patch SQL in one `psql` invocation.

> **Never paste credentials into logs, documentation or chat.** If a Production database credential
> is exposed, rotate it immediately (Supabase Project Settings → Database → Reset password).

## Verification and re-runs

- After apply, the manifest `@dry-run-query` must return 0 rows (the residual rule), and `pnpm dbs`
  reports the patch as `NOT_NEEDED` for Production.
- After a preflight failure, fix the reported issue and re-run; no mutation occurred.
- After a successful apply, do not re-run the same patch.
- After a mid-execution failure, restore from the verified backup, fix the root cause, and re-plan.
