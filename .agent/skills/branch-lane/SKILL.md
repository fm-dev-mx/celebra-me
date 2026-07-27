---
name: branch-lane
description: |
  Default develop→main lane for Celebra-me solo trunk: fast-forward promote develop onto main,
  optionally prepare a release candidate (version + CHANGELOG), and recover by merging main into
  develop only when production drifted. Absorbs release-prepare. Never force-pushes. Git writes
  require explicit authorization in the current task. Stops and hands off to database-parity when
  the lane range includes database-sensitive changes.
domain: workflow
version: 1.3.0
absorbed_skills: [release-prepare]
when_to_use:
  - User asks to promote develop to main / fast-forward main / "promueve a main"
  - Solo trunk work on develop is ready for production
  - User asks to prepare a release or release candidate (former release-prepare)
  - Version bump / changelog promotion for a checkpoint
  - Production hotfix already on main must be absorbed into develop (recovery)
  - Phrases like "fast-forward main", "promueve a main", "prepara release", "pasa main a develop",
    "sincroniza develop con main"
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
  - documentation-governance
  - git-stash-branch-cleanup
related_docs:
  - docs/core/git-governance.md
  - docs/core/release-process.md
  - docs/database-workflow.md
  - CHANGELOG.md
---

# Branch Lane

Canonical agent procedure for the linear two-branch model. **Policy SSOT** stays in docs — this
skill does not redefine it.

**Default assumption (solo trunk):** daily work lands on `develop`; production advances by
fast-forward from `develop` onto `main`. Prefer that path.

| Authority                   | Doc                                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| Branch model, FF, promotion | [`docs/core/git-governance.md`](../../../docs/core/git-governance.md)   |
| Versions, tags, changelog   | [`docs/core/release-process.md`](../../../docs/core/release-process.md) |
| Agent Git authorization     | [`.agent/rules/git-safety.md`](../../rules/git-safety.md)               |
| Database ops / parity audit | [`docs/database-workflow.md`](../../../docs/database-workflow.md) + [`database-parity`](../database-parity/SKILL.md) |

This skill is **Git-only**. It does not run migrations, schema audits, backups, data copies, or
deployments. When the lane range includes database-sensitive changes, stop and hand off to
[`database-parity`](../database-parity/SKILL.md).

## Modes (choose exactly one)

| Priority    | Mode                      | Direction               | Role                                        | Load                                                                             |
| ----------- | ------------------------- | ----------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| **Default** | `promote-develop-to-main` | `develop` → `main` (FF) | Habitual production update                  | [`references/promote-develop-to-main.md`](references/promote-develop-to-main.md) |
| Optional    | `release-prepare`         | files only              | Version + CHANGELOG before a checkpoint     | [`references/release-prepare.md`](references/release-prepare.md)                 |
| Recovery    | `sync-main-into-develop`  | `main` → `develop`      | Only if `main` has commits not in `develop` | [`references/sync-main-into-develop.md`](references/sync-main-into-develop.md)   |

### Selection

1. Promote / FF main / “promueve a main” / bare `branch-lane` when `develop` is ahead and FF is
   possible → **`promote-develop-to-main` (default)**
2. Prepare release / version bump / CHANGELOG → **`release-prepare`**
3. Sync / “pasa main a develop” / hotfix already on `main` → **`sync-main-into-develop` (recovery)**
4. If still ambiguous after preflight, ask — do not guess a Git write

**Bare skill invocation:** run shared preflight. If working tree is clean, `main` ⊂ `develop`, and
`develop` is ahead → propose **default promote** (do not run sync). If `main` has exclusive commits
→ propose recovery sync first. If tips are equal → no-op report.

Load **only** the selected reference after this file. Do not preload all three.

## Shared hard constraints

- No force-push. No history rewrite of `main` or `develop`.
- No commit, tag, push, deploy, or publish unless the **current task** explicitly authorizes that
  exact operation.
- User-owned working tree: never stash, discard, or overwrite without explicit authorization.
- Dirty tree for Git modes: **abort** and report `git status --short`.
- Mid merge/rebase/cherry-pick/bisect or detached HEAD: **abort**.
- Branch/stash cleanup → `git-stash-branch-cleanup`, not this skill.
- `release-prepare` may edit only paths allowed in its reference.
- No migration, schema-parity, backup, data-copy, or deployment logic inside this skill.

## Shared Git preflight (promote and sync modes)

```bash
git status --short
git rev-parse --abbrev-ref HEAD
git fetch origin
git rev-parse origin/main origin/develop
git log --oneline --left-right origin/develop...origin/main | head -40
```

Abort unless the working tree is clean (or an exception is explicitly authorized), the repo is not
mid-rebase/merge, and the user authorized the planned writes. Report whether `origin/main` is ahead,
behind, or diverged from `origin/develop` before proceeding.

## Database-sensitive gate (promote and sync)

After shared preflight and **before any remote integration or promotion write**, detect
database-sensitive changes for the mode range:

| Mode                      | Range                                       |
| ------------------------- | ------------------------------------------- |
| `promote-develop-to-main` | `origin/main` → `origin/develop` (`--base origin/main --head origin/develop`) |
| `sync-main-into-develop`  | `origin/develop` → `origin/main` (`--base origin/develop --head origin/main`) |

```bash
pnpm db:branch:parity -- --base <base> --head <head>
```

**Behavior:**

- **No database-sensitive hits and migration identity/content OK** → continue the selected Git mode
  normally.
- **Database-sensitive hits and/or migration identity failures** → **stop**. List the affected
  files from the command report. Do **not** checkout/merge/push/promote. Load
  [`database-parity`](../database-parity/SKILL.md), require findings resolved or explicitly accepted
  by the human owner, then resume this skill only after clearance.

Do not re-implement database rules here. The gate only detects and routes.

### `release-prepare` advisory

`release-prepare` may edit release files even when `baseline..HEAD` includes database-sensitive
paths. Report the advisory and require `database-parity` clearance before a later promote — do not
block the allowed `package.json` / `CHANGELOG.md` edits.

## Cross-mode flow

- **Habitual:** work on `develop` → (optional `release-prepare` + commit) → push `develop` →
  database-sensitive gate → **`promote-develop-to-main`**.
- Hotfixes: land on `develop`, validate, then promote (keeps `main` ⊂ `develop`).
- Recovery only: if `main` already has commits not in `develop`, run database-sensitive gate, then
  `sync-main-into-develop` (merge only), then resume trunk; promote only when FF is possible again.
- When the user only asks to “prepare” or “what should we do”, propose commands and wait for yes.
