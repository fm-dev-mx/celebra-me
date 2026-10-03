# Integration worktree

**Path:** `<repo-root>`  
**Executable SSOT:** [`scripts/shared/worktree-lane.ts`](../../../scripts/shared/worktree-lane.ts)  
**Policy SSOTs:** [`git-governance.md`](../git-governance.md),
[`env-workflow.md`](../../env-workflow.md), [`database-workflow.md`](../../database-workflow.md),
[`.agent/rules/git-safety.md`](../../../.agent/rules/git-safety.md)

## Purpose

Canonical Integration lane on trunk `develop` for integration, release preparation, and explicitly
authorized operational work.

## Runtime default

Local Supabase (`CELEBRA_RUNTIME_TARGET=local`).

## Idle / active state

- Idle state: `develop` checked out (not detached), clean.
- Integration may host one task when it is assigned there. Create a task branch first
  (`git switch -c <feat|fix|candidate>/<name> develop`); never author commits directly on `develop`
  or `main`. `develop` only receives fast-forwards or merges of task branches.
- Before integrating, return to `develop` with a clean tree (`git switch develop`), then follow the
  Integrate step in [Git governance](../git-governance.md#task-lifecycle) and delete the task
  branch.

## Environment files

- Required for app: `.env.local` with Local `SUPABASE_*` / `PUBLIC_SUPABASE_*`
- Optional Preview ops: `.env.preview.local`
- Optional Preview E2E: `.env.e2e.local`
- Never put Production credentials in ordinary `.env.local`

## Common operations

- Fast-forward integration into `develop`, release prep, `pnpm ops worktree-status`
- Authorized Local DB workflows; authorized Preview/Production ops when tasked

## Agents

Use an explicit `cwd` of this root.
