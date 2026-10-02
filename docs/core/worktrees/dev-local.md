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

## Environment files

- `.env.local` → Local Supabase
- Do not put Preview or Production Supabase URLs in `.env.local`
- `.env.preview.local` usually absent

## Common operations

- Feature/fix implementation, Local `pnpm dev`, unit tests

## Agents

Explicit `cwd`.
