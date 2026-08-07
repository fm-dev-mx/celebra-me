# Cheat sheet — Schema migrate

**Purpose:** Apply versioned SQL from `supabase/migrations/` via one orchestrator.  
**User:** Developer (Local/Preview/disposable); Owner (Production apply).  
**Prerequisites:** Clean worktree for hosted; Preview URL = canonical project ref; Production needs
`pnpm release-check` evidence + critical backup coverage; hosted pending versions need registry
phase.

## Commands

```bash
pnpm db:migrate                                 # TTY target picker (Cancelar default)
pnpm db:migrate -- --target <t>                 # read-only preflight (default)
pnpm db:migrate -- --target production --apply --expected … # owner TTY apply
CELEBRA_TASK_SCOPE=preview:schema:migrate pnpm db:migrate -- --target preview --apply --expected …
```

**Expected result:** Preflight prints pending plan; apply runs policy gates then writes schema;
history + contract verify for hosted.

**Failures:** `TARGET_REQUIRED`, missing registry phase, `BACKUP_COVERAGE_EXPIRED`, release-check
stale, `--expected` mismatch, Preview auth/perimeter failure.

**Recovery:** Re-run preflight (no cached resume). Fix forward with a new migration for bad SQL.
Never auto-migrate from `pnpm invitation:release`; schema remains a separate `pnpm db:migrate`
workflow.
