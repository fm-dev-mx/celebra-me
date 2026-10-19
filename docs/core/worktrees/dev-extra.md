# dev-extra worktree

**Path:** `<worktrees-root>\dev-extra`  
**Executable SSOT:** [`scripts/shared/worktree-lane.ts`](../../../scripts/shared/worktree-lane.ts)  
**Policy SSOTs:** [`git-governance.md`](../git-governance.md),
[`env-workflow.md`](../../env-workflow.md),
[`.agent/rules/git-safety.md`](../../../.agent/rules/git-safety.md)

## Purpose

Additional parallel Local development lane when `dev-local` is occupied.

## Runtime default

Local Supabase (`CELEBRA_RUNTIME_TARGET=local`).

## Idle / active state

See [`git-governance.md`](../git-governance.md) for the canonical lane lifecycle.

## Start a task

Start the task branch without an upstream, whether it starts from `develop` or `origin/develop`:

```bash
git switch -c <task-branch> --no-track origin/develop
```

`--no-track` keeps `origin/develop` from becoming the branch's upstream; the first push is
`git push -u origin <task-branch>`.

## Environment files

- `.env.local` → Local Supabase
- No Preview/Production credentials in ordinary lane config

## Common operations

- Parallel Local feature/fix work, Local `pnpm dev`
- Dev URL: `http://localhost:4322/` (stable lane port; do not use `:4321` while `dev-local` is up)

## Agents

Explicit `cwd`.
