# Default mode — `promote-develop-to-main`

Load after `.agent/skills/branch-lane/SKILL.md`. **Follow the Fast-Forward Flow in**
[`docs/core/git-governance.md`](../../../../docs/core/git-governance.md) — do not invent a parallel
promotion policy. This reference adds agent operational gaps (hooks, validation, recovery).

## Intent

**Default lane** for solo trunk work on `develop`: update protected `main` to match `develop` using
**fast-forward only**.

## Preconditions

- Shared Git preflight completed; working tree clean.
- `origin/main` is an ancestor of `origin/develop` (FF possible). If `main` has commits not in
  `develop`: **abort**, recommend sync recovery first — never force-push to “fix” drift.
- Database-sensitive gate passed (or findings cleared via `database-parity`). If the gate stops,
  do not promote.
- User explicitly authorized checkout / FF merge / push (and tag, if any) in this task.

## Procedure

0. Database-sensitive gate (mandatory before any promote write):

```bash
pnpm db:branch:parity -- --base origin/main --head origin/develop
```

If exit code is non-zero or the report lists database-sensitive files: **stop**, list those files,
hand off to [`database-parity`](../../database-parity/SKILL.md). Do not run CI-for-promote,
checkout `main`, merge, tag, or push until parity findings are resolved or explicitly accepted by
the human owner.

1. On `develop`, update and validate before touching `main` (governance requires CI-class
   confidence):

```bash
git switch develop
git pull --ff-only origin develop
pnpm run ci
```

If `ci` is too heavy for the authorized scope, state that explicitly, run the closest
gatekeeper-appropriate substitute, and do **not** claim full CI passed. Do not promote on a red
suite without an explicit user override in this task.

2. Fast-forward `main` (no non-FF fallback):

```bash
git switch main
git pull --ff-only origin main
git merge --ff-only develop
```

If `merge --ff-only` fails: stop, report drift, suggest `sync-main-into-develop`.

3. Tag only if separately authorized (usually after `release-prepare` + release commit):

```bash
git tag -a vX.Y.Z -m "vX.Y.Z <theme>"
```

4. Push only if authorized. Local `pre-push` blocks `main` unless the override env is set:

```bash
ALLOW_MAIN_PUSH=true git push origin main
# if tag authorized:
git push origin vX.Y.Z
```

Never `--force` / `--force-with-lease`. Do not commit on `main` (pre-commit blocks it); promotion is
FF-only from `develop`.

## Report template

```md
## Branch Lane Report — promote-develop-to-main

### Decision

Completed / Aborted / Blocked (FF impossible)

### Tips

- origin/develop:
- origin/main (before):
- main (after):

### Database-sensitive gate

- command: `pnpm db:branch:parity -- --base origin/main --head origin/develop`
- sensitive files:
- parity handoff required: yes/no
- owner acceptance (if any):

### Validation

- command run (ci or substitute):
- result:

### Actions

- ff-only merge:
- tag:
- push authorized: yes/no
- ALLOW_MAIN_PUSH used: yes/no
- push result:

### git status --short

### Next steps

- ...
```
