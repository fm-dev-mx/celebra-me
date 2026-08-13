# Cheat sheet — Schema migrate

**Purpose:** Apply versioned SQL from `supabase/migrations/` via one orchestrator.  
**User:** Developer (Local/Preview/disposable); Owner (Production apply).  
**Prerequisites:** Clean worktree for hosted; Preview URL = canonical project ref; Production needs
`pnpm release-check` evidence + critical backup coverage; hosted pending versions need registry
phase.

## Commands

```bash
pnpm prod:apply                                 # read-only Production plan
pnpm prod:apply -- --schema --apply             # owner TTY schema apply
pnpm prod:apply -- --slug <slug> --apply        # owner TTY invitation apply
pnpm prod:apply -- --all-ready --apply          # owner TTY READY schema + invitations
pnpm prod:apply -- --patch <file> --owner-user-id <uuid> --apply
pnpm db:migrate                                 # TTY target picker (Cancelar default)
pnpm db:migrate -- --target <t>                 # read-only preflight (default)
pnpm db:migrate -- --target production --apply --expected … # schema primitive
CELEBRA_TASK_SCOPE=preview:schema:migrate pnpm db:migrate -- --target preview --apply --expected …
```

`pnpm db:migrate -- --target production` is the schema **primitive** used by `prod:apply`. It is
not the routine owner-facing command.

**Expected result:** Preflight prints pending plan; apply runs policy gates then writes schema;
history + contract verify for hosted. `pnpm db:*:audit` reports history (`CURRENT`/`BEHIND`) and
named public object drift independently.

**Failures:** `TARGET_REQUIRED`, missing registry phase, `BACKUP_COVERAGE_EXPIRED`, release-check
stale, `--expected` mismatch, Preview auth/perimeter failure.

**Recovery:** Re-run preflight (no cached resume). Fix forward with a new migration for bad SQL.
Never auto-migrate from `pnpm invitation:release`; schema remains a separate `pnpm db:migrate`
workflow.
