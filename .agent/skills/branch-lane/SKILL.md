---
name: branch-lane
description: |
  Prepare releases or promote/sync develop and main through the existing parity and checkpoint workflow. Git writes require exact current-task authorization; this skill does not perform database or deployment operations.
domain: workflow
version: 2.1.1
absorbed_skills: [release-prepare]
when_to_use:
  - User asks to promote develop to main / fast-forward main / "promueve a main"
  - Solo trunk work on develop is ready for production
  - User asks to prepare a release or release candidate (former release-prepare)
  - Version bump / changelog promotion for a checkpoint
  - Production hotfix already on main must be absorbed into develop (recovery)
  - Phrases like "fast-forward main", "promueve a main", "prepara release", "pasa main a develop",
    "sincroniza develop con main"
  - Resume a previously interrupted branch-lane / database-parity flow
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/rules/git-safety.md
  - Read docs/core/git-governance.md
  - For release mode: Read docs/core/release-process.md
  - Load only the selected mode reference under .agent/skills/branch-lane/references/
related_skills:
  - commit-planner
  - database-parity
  - git-stash-branch-cleanup
related_docs:
  - docs/core/git-governance.md
  - docs/core/release-process.md
  - docs/database-workflow.md
  - CHANGELOG.md
---

# Branch Lane

**Single user entry point** for supported Git lane operations. This skill orchestrates discovery,
routing, authorization gates, and reporting. **Policy SSOT** stays in docs — this skill does not
redefine it.

| Authority                   | Doc                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Branch model, FF, promotion | [`docs/core/git-governance.md`](../../../docs/core/git-governance.md)                                                |
| Versions, tags, changelog   | [`docs/core/release-process.md`](../../../docs/core/release-process.md)                                              |
| Agent Git authorization     | [`.agent/rules/git-safety.md`](../../rules/git-safety.md)                                                            |
| Database ops / parity audit | [`docs/database-workflow.md`](../../../docs/database-workflow.md) + [`database-parity`](../database-parity/SKILL.md) |

This skill is **Git-only**. It does not implement migrations, schema audits, backups, restores, or
deployments. Those stay in `database-parity` / `docs/database-workflow.md`. Executable helpers:

- `scripts/db/branch-lane-status.ts` — status + mode selection
- `scripts/db/branch-migration-parity.ts` — `pnpm db:branch:parity`
- `scripts/db/branch-lane-checkpoint.ts` — partial read-only progress (`.agent/tmp/`)
- `scripts/db/branch-lane-clearance.ts` — write-ready clearance fingerprint (`.agent/tmp/`)
- `scripts/db/branch-lane-diagnosis.ts` — read-only diagnosis / auth-plan helpers
- `scripts/db/branch-lane-diagnose.ts` — `pnpm db:branch:diagnose` (evidence → JSON)
- `scripts/db/branch-lane-disposable-remediate.ts` — verified disposable remediation
  (`pnpm db:branch:remediate-disposable`)

## Status contract

Use exactly: `Pass` | `Needs decision` | `Needs authorization` | `Needs manual action` | `Fail` |
`Hard blocked` | `Skipped`.

Do **not** invent informal variants (for example `Pass (info)`). Put routing context in the finding
`id`, `cause`, or description while keeping a valid status.

Every non-`Pass` finding must include **cause**, **impact**, **owner**, **remediation**, **next
step**.

| Situation                                                                                                                        | Status                |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Missing credentials                                                                                                              | `Needs manual action` |
| Correctable command/network/ref/CI/migration-file issue                                                                          | `Fail`                |
| Intentional non-critical drift needing disposition                                                                               | `Needs decision`      |
| Remote write or backup ready                                                                                                     | `Needs authorization` |
| Validation deferred with no unsafe continuation                                                                                  | `Skipped`             |
| Unsafe Git state, force/rebase, duplicate/malformed migration, applied-migration content mutation, incompatible structural drift | `Hard blocked`        |

**Applied migration content mutation is never an acceptable exception.** Restore the original file
and add a corrective migration.

## Proactive read-only rule (non-negotiable)

On every invocation, **exhaust safe automatic investigation before any user prompt**:

1. Gather Git/repo facts without asking.
2. Run parity and, when required, delegate `database-parity` immediately.
3. For every `Fail` / ambiguous audit signal, run all reliable **read-only** diagnosis available
   (files, Git, migration SQL, audit output, scripts, already-resolved credentials).
4. When diagnosis classifies disposable reference as stale/incomplete, run **verified disposable
   remediation** (`pnpm db:branch:remediate-disposable` / `db:disposable:reset`) — a disposable-only
   write, not read-only. If disposable identity cannot be proven → `Hard blocked`.
5. **Never ask** whether the agent should investigate a correctable finding.
6. Ask only when the next step requires a write/remote mutation outside verified disposable
   remediation, explicit authorization, business risk acceptance, unavailable credentials/access, a
   manual operation the agent cannot perform, or an ambiguity evidence cannot resolve.
7. Do **not** present Preview, Production, or Git-write authorization until blocking read-only
   diagnosis and any verified disposable remediation are complete and the consolidated plan is
   stable.
8. When no user action is required yet, say so explicitly and continue automatic work.

Helpers: `mayRequestUserInput`, `buildConsolidatedAuthorizationPlan` in
`scripts/db/branch-lane-diagnosis.ts`.

## Checkpoint vs clearance

| Artifact   | File                                     | Meaning                                                      |
| ---------- | ---------------------------------------- | ------------------------------------------------------------ |
| Checkpoint | `.agent/tmp/branch-lane-checkpoint.json` | Reusable **partial** read-only evidence; blockers may remain |
| Clearance  | `.agent/tmp/branch-lane-clearance.json`  | Validated evidence permitting the **next authorized write**  |

Fingerprint fields (both): `mode`, `baseSha`, `headSha`, `workingTreeFingerprint`,
`sensitiveFileSetFingerprint`, `repoIdentityFingerprint`, `auditContractVersion`.

Checkpoint also stores: `completedChecks`, `unresolvedFindings`, optional `diagnosis` snapshot.

- Match → reuse unaffected completed checks; re-run only invalidated work.
- Mismatch → invalidate silently and re-run (staleness alone is not a user-facing `Fail`).
- Never store secrets, PII, credential-bearing URLs, or database contents.
- Clearance `Pass` is written only after database-parity (when required) is clear for the planned
  write. Checkpoint may be written earlier after meaningful read-only progress.

## Modes

| Priority | Mode                      | Direction                       | Load                                                                             |
| -------- | ------------------------- | ------------------------------- | -------------------------------------------------------------------------------- |
| Default  | `promote-develop-to-main` | `develop` → `main` (FF)         | [`references/promote-develop-to-main.md`](references/promote-develop-to-main.md) |
| Optional | `release-prepare`         | files only                      | [`references/release-prepare.md`](references/release-prepare.md)                 |
| Recovery | `sync-main-into-develop`  | `main` → `develop` (merge only) | [`references/sync-main-into-develop.md`](references/sync-main-into-develop.md)   |

Load **only** the selected reference after this file.

Always state proposed Git actions with **exact source branch, target branch, and audited commit
SHAs** (see `formatLaneDirection`).

## Orchestrator loop

### 1. Automatic read-only discovery

Always gather (do not ask for facts obtainable from the repo):

```bash
git status --short
git rev-parse --abbrev-ref HEAD
git fetch origin
git rev-parse origin/main origin/develop
git merge-base --is-ancestor origin/main origin/develop
git rev-list --left-right --count origin/develop...origin/main
git log --oneline --left-right origin/develop...origin/main | head -40
```

Hard stops (`Hard blocked`) — non-bypassable until corrected:

- Dirty working tree for Git write modes (unless the current task explicitly authorizes an
  exception)
- Mid merge/rebase/cherry-pick/bisect or detached HEAD
- Force-push / rebase / reset-based sync / automatic `ours`/`theirs`

### 2. Automatic mode selection

Use `selectBranchLaneMode` semantics (`scripts/db/branch-lane-status.ts`):

- Tips equal → `no-op` (`Pass`)
- `main` ⊂ `develop` and develop ahead → default **promote**
- `main` has exclusive commits only → **sync** recovery
- Diverged both ways or conflicting explicit request → `Needs decision`
- Explicit release phrasing → **release-prepare**

Do not ask when unambiguous.

### 3. Always run branch parity for the mode range

| Mode            | Command                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| promote         | `pnpm db:branch:parity -- --base origin/main --head origin/develop --json`                              |
| sync            | `pnpm db:branch:parity -- --base origin/develop --head origin/main --json`                              |
| release-prepare | advisory: `pnpm db:branch:parity -- --base <BASELINE> --head HEAD --json` (non-blocking for file edits) |

Interpret JSON:

- `identityStatus: pass` + `sensitiveChanges: false` → continue Git path (`Pass` on parity)
- `requiresParityAudit: true` with `identityStatus: pass` → **automatically** invoke
  [`database-parity`](../database-parity/SKILL.md) (not a failure)
- `identityStatus: fail` → treat findings (`Hard blocked` / `Fail`); do not promote/sync

Exit code `0` means the analysis is trustworthy even when routing to parity. Exit `≠0` means invalid
input, technical failure, or identity violation.

### 4. Automatic `database-parity` when required

Invoke immediately when:

- database-sensitive files detected;
- migration identity does not pass;
- remote history/schema validation is required for clearance (head-only migrations, etc.).

Do not dump parity procedure into this skill. Pass mode, base/head SHAs, and sensitive file list.
Expect `database-parity` to diagnose local audit failures automatically before returning control for
authorization.

### 5. Resume: checkpoint then clearance

Before writes, evaluate checkpoint then clearance:

1. `evaluateResumeCheckpoint` — reuse completed read-only checks when valid.
2. `evaluateResumeClearance` — only when write-ready evidence is required.

Persist checkpoint after meaningful read-only progress. Persist clearance only when the next
authorized write is fully validated.

### 6. Authorization and decisions (after diagnosis is stable)

Ask only when `mayRequestUserInput` is true (no remaining automatic steps). Consolidate compatible
approvals into the **minimum** number of prompts via `buildConsolidatedAuthorizationPlan`. Every
prompt must state:

1. What was detected
2. Why input is required
3. Recommended option
4. Alternatives and consequences (exclude Git-only when Hard blocked / incompatible)
5. Exact action that will follow, including **source → target @ SHAs**

Require explicit current-task authorization before:

- Git writes, pushes, merges, tags, release-file edits
- Preview/Production DB writes (and persistent-local mutations)
- Backups, restores, rollbacks, real-data copies
- Acceptance of intentional **non-critical** discrepancies (`Needs decision`)

Never accept applied-migration content mutation as an exception.

**Git-only promote alternative:** offer only after compatibility is demonstrated
(`evaluateGitOnlyPromotionAlternative`). If head requires pending remote schema → `Hard blocked`,
not an owner-acceptable exception.

**Backups:** require a fresh pre-migration Production backup based on risk/policy (state immediately
before migrate), not merely because the newest dump has a different calendar date. When
`pnpm db:migrate -- --target production` already creates that backup, do not demand a separate
backup authorization solely for date skew — see `evaluateProductionBackupRequirement`.

### 7. Manual actions

When the agent cannot complete a step, report `Needs manual action` with:

- exact command/procedure
- required environment/location
- expected result
- verification method
- how to resume `/branch-lane` (re-invoke; checkpoint/clearance fingerprints will validate)

State what the agent will do automatically on resume vs what the human must do.

### 8. Execute authorized Git steps

Load the mode reference and perform only authorized steps. Preserve merge-only sync. No rebase.

## User-facing report (required structure)

Always present:

1. Detected operation
2. Current state
3. Planned actions
4. Completed actions
5. Findings (status + cause/impact/owner/remediation/next step) **and diagnosis**
6. Decision or authorization required (or explicit “none yet — continuing investigation”)
7. Manual action required
8. Next step (automatic vs human)
9. Final status (`Pass` / partial / unresolved) — distinguish objective complete vs incomplete

## Shared hard constraints

- No force-push. No history rewrite of `main` or `develop`. No rebase support.
- No commit/tag/push/deploy/publish unless the **current task** authorizes that exact operation.
- User-owned working tree: never stash/discard/overwrite without authorization.
- Branch/stash cleanup → `git-stash-branch-cleanup`, not this skill.
- No migration/schema-parity/backup/data-copy/deploy logic inside this skill (diagnosis helpers and
  orchestration only).
- Preview is never a Production backup.
- Do not expose credentials or personal data in prompts, logs, temp files, or reports.

## Cross-mode flow

- Habitual: work on `develop` → (optional `release-prepare`) → push `develop` → parity → (auto
  `database-parity` + diagnosis) → checkpoint → authorize → **promote**.
- Recovery: parity → (auto `database-parity` if needed) → authorize → **merge** sync → later promote
  when FF possible.
- Release-prepare: advisory parity only; require parity clearance before a later DB-sensitive
  promote.
