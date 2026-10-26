# Back-merge mode — `sync-main-into-develop`

Load after `.agent/skills/branch-lane/SKILL.md`. Policy:
[`docs/core/git-governance.md`](../../../../docs/core/git-governance.md#production-promotion).
Orchestration and statuses live in the parent skill.

## Intent

Bring commits that exist on `main` but not on `develop` back into `develop`. The normal case is the
release PR merge commit after each release: `develop` kept receiving merges during the release
(d289), so it lands through an ordinary pull request from `main` into `develop`, merged with a merge
commit. A true divergence (for example a commit that reached `main` outside the release pull
request, with conflicts) is recovery on a task branch.

Integration: **merge only** (not rebase, not reset-hard, not automatic `ours`/`theirs`), never a
history rewrite.

## Preconditions

- Parent discovery completed; mode is `sync-main-into-develop`.
- Exclusive commits on `origin/main`. If none → `Pass` no-op (do not create an empty merge).
- `pnpm db:branch:parity -- --base origin/develop --head origin/main --json` completed; route to
  `database-parity` when `requiresParityAudit` is true.
- Parity and diagnosis ran for the exact SHAs before writes.
- Pull request creation and merge authorized (`Needs authorization` until yes).

## Procedure

1. Confirm with consolidated authorization prompt (detected exclusive commits, pull request or
   recovery branch, exact commands that will run).
2. Normal case, with authorization:

```bash
gh pr create --base develop --head main --title "chore(release): merge vX.Y.Z back into develop"
```

Wait for Repository CI and the review its risk requires, then merge it with a merge commit pinned to
its head (`gh pr merge <n> --merge --match-head-commit <main-sha>`). Integration then runs
`git pull --ff-only origin develop`. Land it before the next candidate is cut.

3. Recovery, when that pull request conflicts: in an assigned lane, create a task branch from
   `origin/develop` and merge `main` into it:

```bash
git switch -c chore/sync-main-into-develop origin/develop
git merge --no-ff origin/main -m "chore(git): sync production tip from main into develop"
```

4. On conflicts: **Hard blocked** until human disposition. List conflicted files. No automatic
   `ours`/`theirs`. Ask: continue assisted resolution **or** `git merge --abort`. Provide resume
   instructions after resolution. The resolved branch reaches `develop` through its own pull
   request.

Never `--force` / `--force-with-lease`.

## Report

Use the parent nine-section report.
