---
title: Preserve-Local Refresh Workflow
status: active
created: 2026-06-14
updated: 2026-06-14
related_skills:
  - backend-engineering
  - supabase
  - supabase-postgres
related_docs:
  - docs/database-workflow.md
  - scripts/db/db-workflow-lib.ts
supersedes:
  - replaced-scripts.md
---

# Preserve-Local Refresh Workflow

## Objective

Refresh the local Supabase database from production data while preserving local-only invitations,
events, demos, and all their dependent data. The final state should be:

```txt
local DB = production snapshot + preserved local-only invitations/demos
```

## Constraints

- Production is read-only. Never write to production.
- All safety rules from `.agent/rules/database.md` and the task prompt apply.
- Prefer dedicated new files over bloating `db-workflow-lib.ts`.
- Follow existing patterns: psql COPY blocks, FK-safe ordering, staging schemas.
- Full backups already exist at `D:\code\celebra-me-backup\db-full-20260614-084026`.

## Implementation Files

| File                                                     | Purpose                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `.agent/plans/active/preserve-local-refresh-workflow.md` | This plan                                                                                              |
| `scripts/db/preserve-local-lib.ts`                       | Shared preserve-local logic (slug detection, row tracing, export, restore, validation, dry-run report) |
| `scripts/db/refresh-local-from-prod-preserve-local.ts`   | CLI entrypoint orchestrating all 8 phases                                                              |
| `tests/unit/preserve-local-planning.test.ts`             | Pure-logic tests for detection, export planning, validation                                            |
| `docs/database-workflow.md`                              | Updated with new command docs                                                                          |

## Phases

### Phase 0 — Preflight

- Assert local env, local DB, local API
- Load PROD_DB_URL, assert production host
- Verify production reachable (read-only query)
- Verify backup dumps exist and are non-empty
- Validate backup dumps are readable via `pg_restore --list`

### Phase 1 — Detect local-only identities

- Query local and production for slugs in `invitations`, `events`,
  `published_invitation_content(event_type, slug)`
- Classify: local-only (preserve), overlapping (production wins), production-only (import)
- Report ambiguous (null slugs, demos not in DB)

### Phase 2 — Trace dependent rows

- For each local-only identity, trace FK-dependent rows across all 17 tables
- Use real schema/FK inspection
- Detect auth user references needing remapping
- Detect Storage binary references

### Phase 3 — Dry-run report

- Print slugs, row counts, risks, file paths
- No DB mutation

### Phase 4 — Export preserve bundle

- COPY blocks in FK-safe order to `.tmp/db/preserve-local/preserve-local-*.sql`
- Manifest JSON with metadata

### Phase 5 — Storage binary safety check

- For preserved `invitation_assets`, determine if binary is local/prod/missing
- Back up local-only Storage binaries if found
- Fail if preserved rows would point to missing binaries

### Phase 6 — Refresh local from production

- Use existing `supabase db reset` + production import
- Delegate to existing lib functions

### Phase 7 — Restore preserved data

- Execute preserve SQL dump
- Recreate auth user placeholders if needed
- Restore Storage binaries if backed up

### Phase 8 — Post-restore validation

- Orphan checks, slug resolution, type-check, focused tests

## Verification

```bash
pnpm type-check
pnpm test -- tests/unit/db-safety.test.ts tests/unit/db-workflow-lib.test.ts tests/unit/preserve-local-planning.test.ts
```

## Commands

```bash
pnpm db:local:refresh-from-prod-preserve-local -- --dry-run
pnpm db:local:refresh-from-prod-preserve-local -- --export
pnpm db:local:refresh-from-prod-preserve-local -- --confirm
```
