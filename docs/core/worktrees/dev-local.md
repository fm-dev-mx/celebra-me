# dev-local worktree

**Path:** `<worktrees-root>\dev-local`  
**Executable SSOT:** [`scripts/shared/worktree-lane.ts`](../../../scripts/shared/worktree-lane.ts)  
**Policy SSOTs:** [`git-governance.md`](../git-governance.md),
[`env-workflow.md`](../../env-workflow.md),
[`.agent/rules/git-safety.md`](../../../.agent/rules/git-safety.md)

## Purpose

Primary development lane for feature and fix work on ephemeral task branches.

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
- Do not put Preview or Production Supabase URLs in `.env.local`
- `.env.preview.local` usually absent

## Common operations

- Feature/fix implementation, Local `pnpm dev`, unit tests

## Agents

Explicit `cwd`.
