# Cheat sheet — Manual Production SQL patch

**Purpose:** Owner-only specialized SQL maintenance when a versioned migration cannot yet cover the
case. Not a substitute for `db:migrate -- --target production` or `invitation:release`. **User:**
Repository owner.  
**Prerequisites:** Manifest per `.agent/rules/manual-sql-manifest.md`; dry-run first.

## Commands

```bash
pnpm prod:apply -- --patch <file.sql>   # owner-facing plan
pnpm prod:apply -- --patch <file.sql> --apply
pnpm db:sql:lint -- --file <path>
pnpm db:prod:patch -- --dry-run --file <path>
```

**Expected result:** `db:prod:patch` lint/dry-run never opens Production. `prod:apply -- --patch`
(plan, no `--apply`) **does** run the manifest `@dry-run-query` against Production in read-only
mode. `--apply` then validates the current preview count, artifact fingerprint, backup, and owner
gate before execution. `--owner-user-id` is required only when the patch SQL reads
`app.owner_user_id`. Persistent DDL is rejected (CREATE TABLE/INDEX, routines, schema-changing
ALTER, persistent DROP, GRANT/REVOKE). `CREATE TEMP TABLE` remains allowed.

**Failures:** Missing manifest, lint errors, identity mismatch, agent/non-TTY apply attempt.

**Recovery:** Fix SQL/manifest; prefer a follow-up versioned migration for durable schema changes.
