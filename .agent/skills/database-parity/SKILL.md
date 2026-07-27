---
name: database-parity
description: |
  Authoritative branch-lane handoff for database-sensitive changes: compare migration identity and
  content between refs, detect duplicates and applied-file mutation risk, audit Local/Preview/
  Production migration history and schema drift, evaluate Production guest/RSVP backup coverage,
  and clear or block resume of Git integration/promotion. Does not redefine database ops policy.
domain: workflow
version: 1.0.0
when_to_use:
  - branch-lane detects database-sensitive changes before promote or sync
  - User asks for a database-parity audit between main and develop
  - Release or promotion range includes migrations, DB scripts, or production SQL manifests
  - Need to verify migration divergence, duplicates, content mutation, or schema drift before promote
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/rules/git-safety.md
  - Read .agent/rules/database.md
  - Read docs/database-workflow.md
related_skills:
  - branch-lane
  - production-sql-patches
  - supabase
  - supabase-postgres
related_docs:
  - docs/database-workflow.md
  - docs/domains/database/overview.md
  - .agent/rules/database.md
  - .agent/rules/manual-sql-manifest.md
---

# Database Parity

Canonical **agent handoff** when [`branch-lane`](../branch-lane/SKILL.md) stops because the lane
range includes database-sensitive changes.

**Policy / ops SSOT** remains [`docs/database-workflow.md`](../../../docs/database-workflow.md) and
[`.agent/rules/database.md`](../../rules/database.md). This skill orchestrates checks; it does not
duplicate guard policy, embed migrate/backup/deploy into `branch-lane`, or treat Preview as a
Production backup.

Preview and Production writes, backups, restores, real-data copies, and migration applications
require **explicit current-task authorization** under existing governance.

## Inputs

| Input | Source |
| ----- | ------ |
| Lane mode | `promote-develop-to-main` / `sync-main-into-develop` / advisory from `release-prepare` |
| Base / head refs | From branch-lane gate (`origin/main`↔`origin/develop`, or baseline..HEAD) |
| Sensitive file list | `pnpm db:branch:parity` report |

## Procedure

### 1. Confirm database-sensitive scope

Re-run (or reuse) the lane command and record the affected files:

```bash
pnpm db:branch:parity -- --base <base> --head <head>
```

Sensitive path classes (classifier SSOT:
`scripts/db/database-sensitive-paths.ts`):

- `supabase/migrations/**` and related Supabase test/verification/config paths
- `scripts/db/**`, `scripts/manual/production-patches/**`, `scripts/sql/**`
- `docs/database-workflow.md`, `docs/domains/database/**`
- `.agent/rules/database.md`, `.agent/rules/manual-sql-manifest.md`

App runtime / content Zod under `src/` is **not** a gate trigger.

### 2. Migration identity and branch divergence

Interpret the same `db:branch:parity` report. Validation must use version identity and content
hashes — **not filename sorting alone**:

| Check | Finding |
| ----- | ------- |
| Duplicate 14-digit version on a ref | Block — ambiguous ordering |
| Malformed migration filename | Block |
| Version only on head | New / pending relative to base |
| Version only on base | Divergence — investigate |
| Same version, different content hash | Applied-file mutation risk — block unless owner accepts with evidence |

### 3. Workspace integrity (when migrations are in scope)

When CI-class confidence is required for a migration-bearing promote:

```bash
pnpm db:validate:pipeline
```

Otherwise note the lighter substitute used. Do not claim full pipeline validation without running
it.

### 4. Remote migration history and schema drift (read-only)

When credentials exist and the user authorizes the exact read-only audit:

```bash
pnpm db:local:audit
pnpm db:preview:audit
pnpm db:prod:audit
```

Cover:

- pending local migrations not applied remotely
- extra remote versions not in the workspace
- reordered or divergent remote history
- unexplained schema drift vs the disposable canonical reference

Fail closed on unresolved Production history/schema errors unless the human owner explicitly accepts
the finding for this task.

### 5. Application dependencies on unapplied migrations

If Production (or the promote target) still has pending migrations that the application/tests
already require, **block** promote clearance until migrations are applied through the approved
workflow (`pnpm db:preview:migrate` / `pnpm db:prod:migrate` with separate authorization) or the
owner explicitly accepts shipping code that depends on unapplied schema.

### 6. Production backup coverage (guest / RSVP critical)

Independently from Preview:

1. Inventory recent dumps under `.backups/prod/` (gitignored; do not commit).
2. If coverage is missing or stale for a migration-bearing Production window, request authorization
   for `pnpm db:prod:backup` before recommending migrate/promote.
3. **Preview is never a Production backup.** Do not cite Preview dumps or Preview sync as guest/RSVP
   recovery coverage.

### 7. Preview completeness for migration-bearing releases

Before returning promote clearance when migrations (or DB-sensitive scripts that affect schema) are
in the range:

- Prefer a passing `pnpm db:preview:audit` (and Preview migrate when separately authorized).
- Incomplete Preview validation **blocks** clearance unless the human owner explicitly accepts that
  limitation in this task.

### 8. Clearance back to branch-lane

Resume [`branch-lane`](../branch-lane/SKILL.md) only when:

- every finding is **resolved**, or
- every remaining finding is **explicitly accepted** by the human owner for this task.

Do not silently continue promote/sync.

## Report template

```md
## Database Parity Report

### Decision

Cleared / Blocked / Cleared-with-owner-acceptance

### Range

- base:
- head:
- branch-lane mode:

### Database-sensitive files

- ...

### Migration identity / content

- head-only:
- base-only:
- content mutations:
- duplicates:
- malformed:

### Remote audits

| Target | Command | Result | Notes |
| ------ | ------- | ------ | ----- |
| local | db:local:audit | ... | ... |
| preview | db:preview:audit | ... | ... |
| production | db:prod:audit | ... | ... |

### Code-to-schema dependencies

- pending migrations required by app/tests:
- owner acceptance (if any):

### Production backup coverage

- `.backups/prod/` inventory:
- `db:prod:backup` authorized/run: yes/no
- Preview treated as backup: **no**

### Owner-accepted findings

- ...

### Clearance for branch-lane

- resume promote/sync: yes/no
```

## Hard constraints

- No force-push; no rebase of `main`/`develop` from this skill.
- No Production/Preview writes without explicit current-task authorization.
- Do not copy guest, RSVP, Auth, or other prohibited Production data into Preview.
- Do not embed this procedure inside `branch-lane` beyond the detection handoff.
