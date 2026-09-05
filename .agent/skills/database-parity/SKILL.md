---
name: database-parity
description: |
  Validate migration identity, schema compatibility, and backup evidence for a database-sensitive branch/release range. Use standalone for an explicit parity audit or when branch-lane requires it; database access remains governed by database rules.
domain: workflow
version: 2.1.1
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
`Needs manual action` | `Fail` | `Hard blocked` | `Skipped`. No informal status variants.

## Inputs (from branch-lane)

| Input                                 | Source                                                   |
| ------------------------------------- | -------------------------------------------------------- |
| Mode                                  | promote / sync / release advisory                        |
| Base / head refs + SHAs               | Lane range                                               |
| `pnpm db:branch:parity --json` result | Already run by orchestrator; re-run if fingerprint stale |
| Checkpoint                            | `.agent/tmp/branch-lane-checkpoint.json`                 |
| Clearance fingerprint                 | `.agent/tmp/branch-lane-clearance.json`                  |

## Procedure

### 1. Confirm scope

Reuse trustworthy parity JSON when the checkpoint/clearance fingerprint still matches. If stale,
re-run:

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
- Technical/command failure → `Fail` with remediation — then **immediately** run §5 diagnosis
- Unexplained Production schema/history errors → `Hard blocked` until fixed (incompatible structural
  drift is not a soft accept)
- Intentional non-critical drift with evidence → `Needs decision` (owner disposition)

Do not ask the user whether to run an audit when the URL already resolves and the task is the
branch-lane parity path — run it. Still require authorization for any **write** to Preview,
Production, or persistent-local.

### 5. Automatic diagnosis of correctable Local audit failures

When `pnpm db:local:audit` fails with persistent-local vs disposable schema discrepancies, **do not
ask the user whether to investigate**. Automatically determine:

1. Which databases and migration histories are being compared (persistent-local vs disposable-test
   canonical reference).
2. Whether each head-only / expected migration version (for example `20260727180000`) is present in
   each path.
3. Whether the disposable rebuild is stale, incomplete, cached, or incorrectly initialized.
4. Whether persistent-local contains genuine unversioned drift.
5. The minimum safe remediation and validation sequence.

Use `diagnoseLocalDisposableDrift` / `pnpm db:branch:diagnose -- --evidence-json <path>` with
structured evidence (version lists, column diffs, migration SQL expectations). Persist a
**checkpoint** after this diagnosis.

| Classification                   | Status                | Agent action                                                                                                                                                                                                                                 |
| -------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disposable_stale_or_incomplete` | `Fail` (agent-owned)  | After conclusive disposable-test target verification, automatically remediate via `pnpm db:disposable:reset` (disposable-only write) and re-audit — **no user “investigate?” prompt**. If target identity cannot be proven → `Hard blocked`. |
| `migration_history_mismatch`     | `Fail`                | Continue automatic history alignment / verified disposable remediation when disposable is behind workspace                                                                                                                                   |
| `local_unversioned_drift`        | `Hard blocked`        | Stop; owner must add corrective versioned migration (never mutate applied files)                                                                                                                                                             |
| `aligned`                        | `Pass`                | Continue                                                                                                                                                                                                                                     |
| `inconclusive`                   | `Needs manual action` | Only after automatic evidence collection is exhausted                                                                                                                                                                                        |

**Disposable remediation is not read-only.** It is automated low-risk mutation of disposable-test
only, gated by `verifyDisposableRebuildTarget` / `scripts/db/branch-lane-disposable-remediate.ts`.
Never rebuild persistent-local, Preview, or Production through this path.

Do **not** present Preview / Production / Git authorization until this diagnosis (and any verified
disposable remediation + re-audit) completes.

### 6. Code-to-schema / unapplied migrations / Git-only compatibility

Pending Production/Preview migrations required by app/tests:

- Recommend approved migrate path → `Needs authorization` (after diagnosis is stable)
- **Git-only promote** without applying those migrations: run `evaluateGitOnlyPromotionAlternative`.
  If head depends on pending schema (or compatibility is unknown while schema-changing migrations
  exist) → `Hard blocked` — **not** an owner-acceptable exception. Offer Git-only only when
  compatibility is demonstrated (`Needs decision` at most).

### 7. Production backup coverage (guest / RSVP)

Inventory `.backups/prod/` (no commit). Use `evaluateProductionBackupRequirement`:

- Require a **fresh pre-migration** Production backup to capture state immediately before migrate.
- Do **not** require a separate backup solely because the newest dump has a different calendar date.
- When `pnpm db:migrate -- --target production` already creates the pre-migration backup, fold that
  into migrate authorization rather than a date-skew-only backup prompt.
- Empty or unusable inventory → `Needs authorization` for `pnpm db:prod:backup`.

**Preview is never a Production backup.**

### 8. Preview completeness

Migration-bearing promote without Preview audit → block clearance (`Needs authorization` to run
Preview audit/migrate, or `Needs decision` to accept incomplete Preview as intentional non-critical
limitation — only after compatibility rules in §6 are satisfied).

### 9. Checkpoint and clearance back to branch-lane

After meaningful read-only progress (parity, audits, diagnosis):

1. Write/update **checkpoint** via `scripts/db/branch-lane-checkpoint.ts`.
2. When all findings are `Pass` or explicitly accepted non-critical `Needs decision` items, write
   **clearance** via `scripts/db/branch-lane-clearance.ts` (`clearanceStatus: Pass`).
3. Return control to `branch-lane` for consolidated Git/DB authorization — only when
   `mayRequestUserInput` is true (no remaining automatic steps).

Do not silently continue promote/sync.

## Prompt format (when human input remains)

1. What was detected
2. Why input is required
3. Recommended option
4. Alternatives and consequences (omit incompatible Git-only)
5. Exact action that will follow (source branch → target branch @ SHAs)

## Report

Use the same nine-section structure as `branch-lane`. Include remote audit table, backup reasoning,
owner-accepted findings, checkpoint/clearance paths (no secrets), diagnosis classification, and
clearance yes/no. When no user action is required yet, say so and continue.

## Hard constraints

- No force-push; no rebase of `main`/`develop`.
- No Production/Preview/persistent-local writes without explicit current-task authorization.
- Disposable-test remediation (after conclusive target verification) is an automated low-risk write
  that does not require a separate user “investigate?” prompt; unverified targets are
  `Hard blocked`.
- Do not copy prohibited Production data into Preview.
- Do not embed this procedure inside `branch-lane` beyond orchestration/routing.
- Never accept applied-migration content mutation as an exception.
