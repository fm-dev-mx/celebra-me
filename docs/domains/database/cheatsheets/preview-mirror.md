# Cheat sheet — Production → Preview content mirror

**Purpose:** Copy invitation-facing Production content into Preview for regression. Not promotion.  
**User:** Operator with Preview authorization.  
**Prerequisites:** `PROD_DB_URL` + Preview creds; accept RSVP reset (`TRUNCATE events CASCADE`).

## Commands

```bash
pnpm db:preview:sync-invitations -- --dry-run
CELEBRA_TASK_SCOPE=preview:content-mirror:sync-invitations \
  pnpm db:preview:sync-invitations -- --apply
```

**Expected result:** Mirrored invitation tables/assets; Preview RSVP children wiped.

**Failures:** Auth denied, partial upsert, missing transferable Storage bytes, missing Preview
service-role key when transferable assets exist, residual Production Storage URLs after rewrite.

**Recovery:** Fix blockers and re-run. Then re-seed fixtures:
`pnpm invitation:preview-fixture -- --apply` and Preview E2E provision as needed. See
[`content-parity-rsvp-isolation.md`](../../../core/content-parity-rsvp-isolation.md).
