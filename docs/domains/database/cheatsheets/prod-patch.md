# Cheat sheet — Manual Production SQL patch

**Purpose:** Owner-only specialized SQL maintenance when a versioned migration cannot yet cover the
case. Not a substitute for `db:migrate -- --target production` or `invitation:release`.
**User:** Repository owner.  
**Prerequisites:** Manifest per `.agent/rules/manual-sql-manifest.md`; dry-run first.

## Commands

```bash
pnpm db:sql:lint -- --file <path>
pnpm db:prod:patch -- --dry-run --file <path>
pnpm db:prod:patch -- --apply --file <path>     # owner TTY only
```

**Expected result:** Lint/dry-run report; apply executes after owner gate.

**Failures:** Missing manifest, lint errors, identity mismatch, agent/non-TTY apply attempt.

**Recovery:** Fix SQL/manifest; prefer a follow-up versioned migration for durable schema changes.
