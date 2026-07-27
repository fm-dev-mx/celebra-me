---
name: database-parity
description: |
  Authoritative branch-lane delegate for database-sensitive validation: migration identity/content
  findings, Local/Preview/Production read-only audits when credentials resolve, Production
  guest/RSVP backup coverage, Preview completeness, and clearance fingerprint updates. Invoked
  automatically by branch-lane — not a separate user entry point for the lane flow.
domain: workflow
version: 2.0.0
when_to_use:
  - branch-lane sets requiresParityAudit or identityStatus fail handling
  - User asks for a database-parity audit between main and develop (standalone)
  - Release or promotion range includes migrations, DB scripts, or production SQL manifests
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

Delegate of [`branch-lane`](../branch-lane/SKILL.md) for database-sensitive validation. For the
supported Git lane flow, **users enter via `branch-lane`**; this skill runs automatically when
parity routing is required.

**Policy / ops SSOT:** [`docs/database-workflow.md`](../../../docs/database-workflow.md) and
[`.agent/rules/database.md`](../../rules/database.md).

Statuses match the branch-lane contract: `Pass` | `Needs decision` | `Needs authorization` |
`Needs manual action` | `Fail` | `Hard blocked` | `Skipped`.

## Inputs (from branch-lane)

| Input                                 | Source                                                   |
| ------------------------------------- | -------------------------------------------------------- |
| Mode                                  | promote / sync / release advisory                        |
| Base / head refs + SHAs               | Lane range                                               |
| `pnpm db:branch:parity --json` result | Already run by orchestrator; re-run if fingerprint stale |
| Clearance fingerprint                 | `.agent/tmp/branch-lane-clearance.json`                  |

## Procedure

### 1. Confirm scope

Reuse trustworthy parity JSON when the clearance fingerprint still matches. If stale, re-run:

```bash
pnpm db:branch:parity -- --base <base> --head <head> --json
```

### 2. Migration identity findings

| Finding                                                 | Status                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Duplicate / malformed version                           | `Hard blocked`                                                                          |
| Same version, different content (applied-file mutation) | `Hard blocked` — **never accept as exception**; restore original + corrective migration |
| Head-only versions                                      | Continue; remote audits required                                                        |
| Base-only / intentional non-critical divergence         | `Needs decision`                                                                        |
| Correctable file/path issues                            | `Fail`                                                                                  |

### 3. Workspace integrity

When CI-class confidence is required for migration-bearing promote:

```bash
pnpm db:validate:pipeline
```

Otherwise record `Skipped` with explicit reason. Never claim pipeline pass without running it.

### 4. Remote audits (read-only)

When credentials **already resolve** and policy permits read-only access, run automatically:

```bash
pnpm db:local:audit
pnpm db:preview:audit
pnpm db:prod:audit
```

- Missing credentials → `Needs manual action` (exact env/secret file locations; never print secrets)
- Technical/command failure → `Fail` with remediation
- Unexplained Production schema/history errors → `Hard blocked` until fixed (incompatible structural
  drift is not a soft accept)
- Intentional non-critical drift with evidence → `Needs decision` (owner disposition)

Do not ask the user whether to run an audit when the URL already resolves and the task is the
branch-lane parity path — run it. Still require authorization for any **write**.

### 5. Code-to-schema / unapplied migrations

Pending Production migrations required by app/tests:

- Recommend approved migrate path → `Needs authorization`
- Shipping without apply → only via explicit `Needs decision` acceptance (non-critical only)

### 6. Production backup coverage (guest / RSVP)

Inventory `.backups/prod/` (no commit). Missing/stale for a migration-bearing Production window →
`Needs authorization` for `pnpm db:prod:backup`.

**Preview is never a Production backup.**

### 7. Preview completeness

Migration-bearing promote without Preview audit → block clearance (`Needs authorization` to run
Preview audit/migrate, or `Needs decision` to accept incomplete Preview as intentional non-critical
limitation).

### 8. Clearance back to branch-lane

When all findings are `Pass` or explicitly accepted non-critical `Needs decision` items:

1. Write clearance fingerprint via `scripts/db/branch-lane-clearance.ts` (`clearanceStatus: Pass` or
   document accepted exceptions in the report — never for content mutation).
2. Return control to `branch-lane` for Git authorization / execution.

Do not silently continue promote/sync.

## Prompt format (when human input remains)

1. What was detected
2. Why input is required
3. Recommended option
4. Alternatives and consequences
5. Exact action that will follow

## Report

Use the same nine-section structure as `branch-lane`. Include remote audit table, backup coverage,
owner-accepted findings, fingerprint path (no secrets), and clearance yes/no.

## Hard constraints

- No force-push; no rebase of `main`/`develop`.
- No Production/Preview writes without explicit current-task authorization.
- Do not copy prohibited Production data into Preview.
- Do not embed this procedure inside `branch-lane` beyond orchestration/routing.
- Never accept applied-migration content mutation as an exception.
