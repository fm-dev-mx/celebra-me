---
title: Preserve-Local Refresh Workflow
status: blocked
created: 2026-06-14
updated: 2026-07-25
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
events, demos, and all their dependent data without resetting the protected persistent-local
database. The intended final state is:

```txt
local DB = production snapshot + preserved local-only invitations/demos
```

## Constraints

- Production is read-only. Never write to production.
- Persistent-local is protected state. Never use `supabase db reset` or a destructive refresh.
- All safety rules from `.agent/rules/database.md` and the task prompt apply.
- Prefer dedicated new files over bloating `db-workflow-lib.ts`.
- Follow existing patterns: psql COPY blocks, FK-safe ordering, staging schemas.
- Backup and preserve-bundle paths must be operator-selected, gitignored, and validated at runtime.

## Implementation Files

| File                                                     | Current role                                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `.agent/plans/active/preserve-local-refresh-workflow.md` | This blocked plan                                                                                        |
| Future guarded entrypoint                                | Not implemented; must compose backup/restore without resetting persistent-local                          |
| Future focused tests                                     | Must be introduced with the guarded entrypoint rather than retaining disconnected prototype code         |
| `docs/database-workflow.md`                              | Documents only currently supported commands; update after a safe entrypoint is implemented and validated |

The previous disconnected prototype (`preserve-local-lib.ts`, `refresh-copy.sql`, and its isolated
tests) was removed during the July 2026 structural cleanup. It had no runnable entrypoint and could
not prove the non-destructive workflow described here.

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

- Import through the non-destructive staging workflow owned by `pnpm db:local:restore-from-dump`.
- Preserve existing local rows by default and stop on schema drift or identity ambiguity.
- Do not call either blocked refresh alias and do not invoke `supabase db reset`.

### Phase 7 — Restore preserved data

- Execute preserve SQL dump
- Recreate auth user placeholders if needed
- Restore Storage binaries if backed up

### Phase 8 — Post-restore validation

- Orphan checks, slug resolution, type-check, focused tests

## Verification

```bash
pnpm type-check
pnpm test -- tests/unit/db-safety.test.ts tests/unit/db-workflow-lib.test.ts
```

## Command status

No preserve-refresh command is currently runnable. The package aliases `db:local:refresh-from-prod`
and `db:local:refresh-from-prod-preserve-local` are intentional fail-closed safety rails and must
remain blocked.

The supported non-destructive import path is:

```bash
PROD_DB_URL=... pnpm db:prod:backup
pnpm db:local:restore-from-dump --dump <path-to-dump>
pnpm db:local:validate
```

Unblock this plan only after a new guarded entrypoint proves preservation, ambiguity handling,
Storage reporting, and sentinel survival without resetting persistent-local.
