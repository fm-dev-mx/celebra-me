---
name: branch-lane
description: |
  Bidirectional develop/main lane for Celebra-me: (1) sync commits from main into develop
  after production hotfixes, (2) prepare a release candidate (version + CHANGELOG), and
  (3) propose or execute fast-forward promotion of develop onto main. Absorbs release-prepare.
  Never force-pushes. Git writes require explicit authorization in the current task.
domain: workflow
version: 1.1.0
absorbed_skills: [release-prepare]
when_to_use:
  - User asks to sync main into develop / pass main to develop / realinear develop con main
  - Production hotfix landed on main and develop must absorb it
  - User asks to prepare a release or release candidate (former release-prepare)
  - Version bump / changelog promotion for a checkpoint
  - User asks to promote develop to main via fast-forward
  - Phrases like "pasa main a develop", "sincroniza develop con main", "prepara release",
    "fast-forward main", "promueve a main"
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/rules/git-safety.md
  - Read docs/core/git-governance.md
  - For release mode: Read docs/core/release-process.md
  - Load only the selected mode reference under .agent/skills/branch-lane/references/
related_skills:
  - commit-planner
  - documentation-governance
  - git-stash-branch-cleanup
related_docs:
  - docs/core/git-governance.md
  - docs/core/release-process.md
  - CHANGELOG.md
---

# Branch Lane

Canonical agent procedure for the linear two-branch model. **Policy SSOT** stays in docs — this
skill does not redefine it.

| Authority                   | Doc                                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| Branch model, FF, promotion | [`docs/core/git-governance.md`](../../../docs/core/git-governance.md)   |
| Versions, tags, changelog   | [`docs/core/release-process.md`](../../../docs/core/release-process.md) |
| Agent Git authorization     | [`.agent/rules/git-safety.md`](../../rules/git-safety.md)               |

## Modes (choose exactly one)

| Mode                      | Direction               | Load                                                                             |
| ------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `sync-main-into-develop`  | `main` → `develop`      | [`references/sync-main-into-develop.md`](references/sync-main-into-develop.md)   |
| `release-prepare`         | files only              | [`references/release-prepare.md`](references/release-prepare.md)                 |
| `promote-develop-to-main` | `develop` → `main` (FF) | [`references/promote-develop-to-main.md`](references/promote-develop-to-main.md) |

### Selection

1. Sync / “pasa main a develop” / hotfix back-port → Mode A
2. Prepare release / version bump / CHANGELOG → Mode B
3. Promote / FF main / “promueve a main” → Mode C
4. If ambiguous, ask — do not guess a Git write

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

## Shared Git preflight (Modes A and C)

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

## Cross-mode flow

- Preferred hotfix path: land on `develop`, validate, Mode C (keeps `main` ⊂ `develop`).
- If `main` already has commits not in `develop`: Mode A first, then resume trunk; Mode C only when
  FF is possible.
- Normal release: Mode B → authorize commit (`commit-planner`) → push `develop` → Mode C.
- When the user only asks to “prepare” or “what should we do”, propose commands and wait for yes.
