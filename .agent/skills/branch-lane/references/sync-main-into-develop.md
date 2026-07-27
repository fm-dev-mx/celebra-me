# Recovery mode — `sync-main-into-develop`

Load after `.agent/skills/branch-lane/SKILL.md`. Policy background:
[`docs/core/git-governance.md`](../../../../docs/core/git-governance.md) (Production tip recovery).

## Intent

**Recovery only** — not the default lane. Merge commits that exist on `main` but not on `develop`
into trunk when the invariant `main` ⊂ `develop` is already broken (e.g. emergency commit on
production). Prefer landing hotfixes on `develop` and using **`promote-develop-to-main`** instead.

Integration: **merge** only (not rebase, not reset-hard).

## Preconditions

- Shared Git preflight from the parent skill completed (`fetch` done).
- Commits reachable from `origin/main` that are not on `origin/develop`. If none → no-op report; do
  not create an empty merge.
- Database-sensitive gate passed (or findings cleared via `database-parity`). If the gate stops, do
  not merge or push.

## Procedure

0. Database-sensitive gate (mandatory before any sync merge/push):

```bash
pnpm db:branch:parity -- --base origin/develop --head origin/main
```

If exit code is non-zero or the report lists database-sensitive files: **stop**, list those files,
hand off to [`database-parity`](../../database-parity/SKILL.md). Do not merge or push until parity
findings are resolved or explicitly accepted by the human owner.

1. Confirm with the user: merge `origin/main` into `develop`, and whether push is authorized.
2. With authorization:

```bash
git switch develop
git pull --ff-only origin develop
```

If `pull --ff-only` fails, stop and report divergence on `develop` — do not force.

3. Merge production tip with a commitlint-valid message (`merge` is not an allowed type):

```bash
git merge --no-ff origin/main -m "chore(git): sync production tip from main into develop"
```

Prefer `--no-ff` so the sync is visible. If the user explicitly requests FF when Git can
fast-forward, `git merge origin/main` is acceptable.

4. On conflicts: **stop**. List conflicted files. No automatic `ours`/`theirs`. Ask whether to
   continue assisted resolution or `git merge --abort`.
5. Push only if authorized:

```bash
git push origin develop
```

Never `--force` / `--force-with-lease` from this skill.

## Report template

```md
## Branch Lane Report — sync-main-into-develop

### Decision

Completed / Aborted / No-op

### Divergence (before)

- origin/main tip:
- origin/develop tip:
- Commits on main not in develop:
- Commits on develop not in main:

### Database-sensitive gate

- command: `pnpm db:branch:parity -- --base origin/develop --head origin/main`
- sensitive files:
- parity handoff required: yes/no
- owner acceptance (if any):

### Actions

- checkout / pull:
- merge:
- conflicts:
- push authorized: yes/no
- push result:

### After

- develop tip:
- git status --short:

### Next steps

- ...
```
