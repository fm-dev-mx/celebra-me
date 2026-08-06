# Cheat sheet — Preview approvals & provenance

**Purpose:** Shared Preview DB release identity for Production promote.  
**User:** Preview writers (finalize); promote (read).  
**Prerequisites:** Migration `20260806120000` applied on Preview; finalize with package hash +
hosted validation evidence.

## Commands

```bash
pnpm invitation:update -- --package-hash <hash> --evidence <path> --apply
pnpm invitation:approvals:migrate --                 # dry-run import of legacy JSON
pnpm invitation:approvals:migrate -- --apply         # requires Preview auth
```

**Expected result:** Row in `public.preview_approval_artifacts` with `approval_state=approved`
within the 7-day freshness window.

**Failures:** Stale approval, obsolete contract version, missing hosted_validation, Preview auth,
missing table (migration not applied).

**Recovery:** Re-approve on Preview. Legacy JSON → migrate once, then stop using filesystem SSOT.
Owner checklist: confirm Preview migrate applied before promote.
