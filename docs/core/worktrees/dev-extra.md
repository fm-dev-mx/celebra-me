# dev-extra worktree

**Path:** `D:\code\celebra-me\.worktrees\dev-extra`  
**Policy SSOTs:** [`git-governance.md`](../git-governance.md),
[`env-workflow.md`](../../env-workflow.md),
[`.agent/rules/git-safety.md`](../../../.agent/rules/git-safety.md)

## Purpose

Additional parallel Local development lane when `dev-local` is occupied.

## Runtime default

Local Supabase.

## Idle / active state

- Idle: detached at `develop`, clean
- Active: ephemeral branch from `develop`
- Release: detach to `develop`

## Environment files

- `.env.local` → Local Supabase
- No Preview/Production credentials in ordinary lane config

## Common operations

- Parallel Local feature/fix work, Local `pnpm dev`

## Restrictions

- Path ≠ privilege
- Same mutation rules as other Local lanes

## Agents

Explicit `cwd`. Human navigation: `lane extra`.
