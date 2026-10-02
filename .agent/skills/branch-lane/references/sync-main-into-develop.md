# Back-merge mode — `sync-main-into-develop`

Load after `.agent/skills/branch-lane/SKILL.md`. Policy:
[`docs/core/git-governance.md`](../../../../docs/core/git-governance.md#production-promotion).
Orchestration and statuses live in the parent skill.

## Intent

Bring commits that exist on `main` but not on `develop` back into `develop`. The normal case is the
release PR merge commit, which fast-forwards. A true divergence (for example a hotfix committed on
`main`) is recovery and uses a `--no-ff` merge.

Integration: **merge only** (not rebase, not reset-hard, not automatic `ours`/`theirs`). Run from
Integration, which keeps `develop` checked out.

## Preconditions

- Parent discovery completed; mode is `sync-main-into-develop`.
- Exclusive commits on `origin/main`. If none → `Pass` no-op (do not create an empty merge).
- `pnpm db:branch:parity -- --base origin/develop --head origin/main --json` completed; route to
  `database-parity` when `requiresParityAudit` is true.
- Clearance fingerprint valid before writes.
- Merge/push authorized (`Needs authorization` until yes).

## Procedure

1. Confirm with consolidated authorization prompt (detected divergence, FF or `--no-ff`, push
   yes/no, exact commands that will run).
2. With authorization, in Integration:

```bash
git pull --ff-only origin develop
```

If `pull --ff-only` fails → `Hard blocked` / `Fail` — do not force.

3. Merge:

```bash
git merge --ff-only origin/main
```

If Git refuses the fast-forward, the branches diverged:

```bash
git merge --no-ff origin/main -m "chore(git): sync production tip from main into develop"
```

4. On conflicts: **Hard blocked** until human disposition. List conflicted files. No automatic
   `ours`/`theirs`. Ask: continue assisted resolution **or** `git merge --abort`. Provide resume
   instructions after resolution.
5. Push only if authorized:

```bash
git push origin develop
```

Never `--force` / `--force-with-lease`.

## Report

Use the parent nine-section report.
