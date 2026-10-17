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
  (`git switch -c <feat|fix|docs|chore|candidate>/<name> develop`); never author commits directly on
  `develop` or `main`. `develop` receives task branches only through the Integrate step (one
  `--no-ff` merge per task) and the release back-merge.
- Before integrating, return to `develop` with a clean tree (`git switch develop`), then follow the
  Integrate step in [Git governance](../git-governance.md#task-lifecycle) and delete the task
  branch.

## Environment files

- Required for app: `.env.local` with Local `SUPABASE_*` / `PUBLIC_SUPABASE_*`
- Optional Preview ops: `.env.preview.local`
- Optional Preview E2E: `.env.e2e.local`
- Never put Production credentials in ordinary `.env.local`

## Common operations

- Merge integration into `develop`, release prep, `pnpm ops worktree-status`
- Authorized Local DB workflows; authorized Preview/Production ops when tasked

## Agents

Use an explicit `cwd` of this root.

## Agent worktrees

Agent tools add worktrees of this repository outside the four lanes: the Claude desktop app under
`.claude/worktrees/<name>` (branch `claude/<name>`) and Codex under its own home directory. They are
not lanes and never become persistent. Integration owns their cleanup during a hygiene sweep
([Git governance](../git-governance.md#branch-and-worktree-hygiene)):

1. Check `git worktree list` and the agent session list; keep every worktree whose session is still
   open or whose branch has an open pull request.
2. Run `git -C <worktree> status --porcelain` and rule out Git LFS false positives before calling
   the worktree dirty.
3. Remove a finished worktree with the app or `git worktree remove <path>`, then delete its merged
   `claude/<name>` branch with `git branch -d`.
