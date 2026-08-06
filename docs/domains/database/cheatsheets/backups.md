# Cheat sheet — Backups & restore drills

**Purpose:** Capture and verify Production recovery points; critical RPO is 15 minutes for
migrate/promote gates.  
**User:** Owner / authorized Windows operator for daily job.  
**Prerequisites:** Production credentials; gitignored `.backups/` output.

## Commands

```bash
pnpm db:prod:backup                      # public dump (PII-bearing)
pnpm db:prod:backup:critical             # DB/Auth/Storage critical set
pnpm db:prod:backup:daily                # scheduled operator capture
pnpm db:backup:verify-manifest -- --manifest <path>
pnpm db:backup:create-manifest           # assemble manifest from artifacts
pnpm db:restore:verify-disposable -- --manifest <path>
pnpm db:local:restore-from-dump -- …     # persistent-local only; never Preview
```

**Expected result:** Manifest + artifacts under `.backups/`; migrate/promote reuse fresh critical
coverage when identity/history match and age ≤ RPO.

**Failures:** Identity mismatch, capture-window drift, EFS failure, `BACKUP_COVERAGE_EXPIRED`.

**Recovery:** Re-capture critical set; verify with disposable drill. Stale RPO blocks hosted writes
— treat as blocking incident, not a skip. Local machine/EFS is not off-site DR.
