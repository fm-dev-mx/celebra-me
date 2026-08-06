# Cheat sheet — Schema migrate

**Purpose:** Apply versioned SQL from `supabase/migrations/` via one orchestrator.  
**User:** Developer (Local/Preview/disposable); Owner (Production apply).  
**Prerequisites:** Clean worktree for hosted; Preview URL = canonical project ref; Production needs
`pnpm release-check` evidence + critical backup coverage; hosted pending versions need registry
phase.

## Commands

```bash
pnpm db:migrate                                 # TTY target picker (Cancelar default)
pnpm db:local:migrate                           # alias → migrate-cli --target local
pnpm db:preview:migrate                         # alias → migrate-cli --target preview
pnpm db:prod:migrate                            # alias → migrate-cli --target production
pnpm db:migrate -- --target <t>                 # read-only preflight (default)
pnpm db:prod:migrate -- --apply --expected …    # owner TTY apply
CELEBRA_TASK_SCOPE=preview:schema:migrate pnpm db:preview:migrate -- --apply --expected …
```

**Expected result:** Preflight prints pending plan; apply runs policy gates then writes schema;
history + contract verify for hosted.

**Failures:** `TARGET_REQUIRED`, missing registry phase, `BACKUP_COVERAGE_EXPIRED`, release-check
stale, `--expected` mismatch, Preview auth/perimeter failure.

**Recovery:** Re-run preflight (no cached resume). Fix forward with a new migration for bad SQL.
Never auto-migrate from invitation workflows — [invitation-update](./invitation-update.md) /
[db-sync](./db-sync.md) only point at these aliases.
