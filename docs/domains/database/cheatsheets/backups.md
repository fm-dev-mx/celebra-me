# Cheat sheet — Backups & restore drills

**Purpose:** Capture and verify Production recovery points; critical RPO is 15 minutes for
migrate/promote gates; daily job is the 24h catastrophic RPO.  
**User:** Owner / authorized Windows operator for daily job.  
**Prerequisites:** Production credentials; gitignored `.backups/` output.

## Commands

```bash
pnpm db:prod:backup:critical             # recovery point (DB/Auth/Storage)
pnpm db:prod:backup:daily                # scheduled 24h operator capture
pnpm db:prod:backup                      # public dump only — local refresh, not recovery
pnpm db:backup:verify-manifest -- --manifest <path>
pnpm db:backup:create-manifest           # assemble manifest from artifacts (no integrity)
pnpm db:restore:verify-disposable -- --manifest <path>
pnpm db:local:restore-from-dump -- …     # persistent-local only; never Preview
```

Invitation images: Cloudinary is delivery SSOT. The critical set stores Cloudinary metadata in the
DB dump and downloads only `provider = 'supabase'` binaries. Do not route backups through Vercel.

**Expected result:** Manifest + artifacts under `.backups/`; migrate/promote reuse fresh critical
coverage when identity/history match and age ≤ RPO. `pnpm dbs` shows daily age and orphan count.

**Failures:** Identity mismatch, capture-window drift, EFS failure, `BACKUP_COVERAGE_EXPIRED`.

**Recovery:** Re-capture critical set; verify with disposable drill. Stale RPO blocks hosted writes
— treat as blocking incident, not a skip. Local machine/EFS is not off-site DR.
