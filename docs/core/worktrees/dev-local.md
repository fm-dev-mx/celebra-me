# dev-local worktree

**Path:** `D:\code\celebra-me-worktrees\dev-local`  
**Executable SSOT:** [`scripts/shared/worktree-lane.ts`](../../../scripts/shared/worktree-lane.ts)  
**Policy SSOTs:** [`git-governance.md`](../git-governance.md), [`env-workflow.md`](../../env-workflow.md), [`.agent/rules/git-safety.md`](../../../.agent/rules/git-safety.md)

## Purpose

Primary development lane for feature and fix work on ephemeral task branches.

## Runtime default

Local Supabase (`CELEBRA_RUNTIME_TARGET=local`).

## Idle / active state

- Idle: Clean persistent branch `dev-local` (or `git switch --detach develop`), aligned with `develop`
- Active: `git switch -c <task-branch> develop` (or work directly on clean lane branch when tasked)
- Release: Merge task branch to `develop`; reset lane branch to `develop` after integration

## Environment files

- `.env.local` → Local Supabase
- Do not put Preview or Production Supabase URLs in `.env.local`
- `.env.preview.local` usually absent

## Common operations

- Feature/fix implementation, Local `pnpm dev`, unit tests

## Restrictions

- Path ≠ privilege
- No Preview/Production mutations from path alone

## Agents

Explicit `cwd` to this path. Human navigation: `lane local` (after `$PROFILE` install).

