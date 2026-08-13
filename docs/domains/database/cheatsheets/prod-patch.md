# Cheat sheet — Manual Production SQL patch

**Purpose:** Owner-only specialized SQL maintenance when a versioned migration cannot yet cover the
case. Not a substitute for `db:migrate -- --target production` or `invitation:release`.
**User:** Repository owner.  
**Prerequisites:** Manifest per `.agent/rules/manual-sql-manifest.md`; dry-run first.

## Commands

```bash
pnpm prod:apply -- --patch <file.sql> --owner-user-id <uuid>   # owner-facing plan
pnpm prod:apply -- --patch <file.sql> --owner-user-id <uuid> --apply
pnpm db:sql:lint -- --file <path>
pnpm db:prod:patch -- --dry-run --file <path>
pnpm db:prod:patch -- --apply --file <path>     # protected primitive; owner TTY only
```

**Expected result:** Lint/dry-run report; apply executes after owner gate. Persistent DDL is
rejected (CREATE TABLE/INDEX, routines, schema-changing ALTER, persistent DROP, GRANT/REVOKE).
`CREATE TEMP TABLE` remains allowed.

**Failures:** Missing manifest, lint errors, identity mismatch, agent/non-TTY apply attempt.

**Recovery:** Fix SQL/manifest; prefer a follow-up versioned migration for durable schema changes.
