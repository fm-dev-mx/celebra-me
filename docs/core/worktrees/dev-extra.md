# dev-extra worktree

**Path:** `celebra-me-worktrees/dev-extra`  
**Executable SSOT:** [`scripts/shared/worktree-lane.ts`](../../../scripts/shared/worktree-lane.ts)  
**Policy SSOTs:** [`git-governance.md`](../git-governance.md),
[`env-workflow.md`](../../env-workflow.md),
[`.agent/rules/git-safety.md`](../../../.agent/rules/git-safety.md)

## Purpose

Additional parallel Local development lane when `dev-local` is occupied.

## Runtime default

Local Supabase (`CELEBRA_RUNTIME_TARGET=local`).

## Idle / active state

- Idle: Clean persistent branch `dev-extra` (or `git switch --detach develop`), aligned with
  `develop`
- Active: Ephemeral branch from `develop`
- Release: Merge to `develop`; reset lane branch after integration

## Environment files

- `.env.local` → Local Supabase
- No Preview/Production credentials in ordinary lane config

## Common operations

- Parallel Local feature/fix work, Local `pnpm dev`
- Dev URL: `http://localhost:4322/` (stable lane port; do not use `:4321` while `dev-local` is up)

## Restrictions

- Path ≠ privilege
- Same mutation rules as other Local lanes

## Agents

Explicit `cwd`. Human navigation: `lane extra`.
