---
name: git-stash-branch-cleanup
description: |
  Audit, risk-classify, and clean up stale git stashes and local branches with explicit user
  confirmation before any destructive operation. Supersedes ad-hoc branch cleanup.
domain: workflow
version: 1.0.0
when_to_use:
  - Repo accumulated stashes from apply/backup workflows
  - User asks to clean old branches, prune stashes, or do git housekeeping
  - Before a major rebase/merge when a clean slate helps
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/git-safety.md
  - Working tree is clean
  - Not mid merge/rebase/cherry-pick/bisect; not detached HEAD
  - User must authorize each destructive git write in this task
related_skills:
  - staged-code-review-apply
  - commit-planner
related_docs:
  - docs/core/git-governance.md
---

# Git Stash and Branch Cleanup

Audit stashes and local/remote branches, produce a risk report, get confirmation, then execute only
the approved cleanups. Designed for repos where stashes accumulate from automated backups (e.g.
`pre-staged-code-review-apply-*`).

**Stash deletion is permanent** — stashes have no practical reflog recovery. Branches may be
recoverable via reflog for a limited time.

## Protected branches (never delete)

- Default branch (`main` or detected default)
- Integration branch (`develop` when present)
- Currently checked-out branch (`HEAD`)
- Any branch the user marks protected

## Phase 0 — Setup

1. `git status --short` must be empty. If dirty, abort (do not stash user work).
2. Abort if `MERGE_HEAD`, `REBASE_HEAD`, or `CHERRY_PICK_HEAD` exists.
3. Record current branch and protected set.
4. If `pnpm agent:git-safety:start` exists in `package.json`, run it; otherwise skip.

## Phase 1 — Stash inventory

```bash
git stash list --date=relative
```

For each `stash@{N}`:

```bash
git stash show -s stash@{N}
git stash show --stat stash@{N}
```

Record: ref, age, origin branch, message, files, +/- lines.

Classify:

| Level        | Criteria                                                                       | Disposition         |
| ------------ | ------------------------------------------------------------------------------ | ------------------- |
| Safe         | Origin merged/deleted, age ≥1 day, generic/auto message (`pre-*`, WIP, backup) | Candidate           |
| Questionable | Active origin branch, age <1 day, or feature-specific message                  | Ask user            |
| Keep         | Only copy of meaningful work, origin is HEAD, or very recent large diff        | Do not suggest drop |

Generic `pre-staged-code-review-apply-*` stashes are often safe after a successful apply, but still
confirm before drop.

## Phase 2 — Branch inventory

```bash
git branch -vv
git branch --merged develop   # or main if no develop
git branch --no-merged develop
```

For each non-protected local branch: last commit age, tracking, whether remote is gone.

Classify:

| Level        | Criteria                                                         | Disposition                   |
| ------------ | ---------------------------------------------------------------- | ----------------------------- |
| Safe         | Merged into integration AND (remote gone OR local-only)          | Candidate `git branch -d`     |
| Questionable | Merged but remote alive, or unmerged with ≥90 days idle          | Ask; offer archive-tag option |
| Keep         | Current, recent unmerged activity, or referenced by keep-stashes | Keep                          |

List remote branches merged into `origin/develop` (or `origin/main`) as **read-only candidates**.
Remote deletes need a separate explicit confirmation because they affect other developers.

## Phase 3 — Risk report

Present tables for stashes and local branches, plus remote candidates. Summarize safe vs
questionable counts. Remind that stash drops are irreversible.

## Phase 4 — Confirmation

Ask in rounds (keep choices small):

1. Main: delete safe stashes only / safe branches only / both / detailed selection / cancel
2. If detailed: confirm each item or small batches
3. Remotes: separate yes/no; default skip

Do not proceed on silence. Free-text "cancel" / "nothing" aborts writes.

## Phase 5 — Execute (authorized only)

Only after explicit confirmation:

```bash
git stash drop stash@{N}    # drop highest indices first if batching
git branch -d <branch>      # prefer -d over -D; use -D only if user insists
git push origin --delete <branch>   # only if user confirmed remotes
```

After writes, re-list stashes/branches and report what was removed vs kept. If a Git Safety session
was started in Phase 0, close it with `pnpm agent:git-safety:finish` (and
`--authorized-operation=...` only when the Task Contract already authorized exact Git writes that
changed protected state).

## Hard constraints

- No destructive git writes without current-task authorization (git-safety).
- Never delete protected branches.
- Never auto-drop questionable/keep stashes.
- Do not run this mid-conflict or with a dirty working tree.
