# dev-local worktree

**Path:** `D:\code\celebra-me\.worktrees\dev-local`  
**Policy SSOTs:** [`git-governance.md`](../git-governance.md),
[`env-workflow.md`](../../env-workflow.md),
[`.agent/rules/git-safety.md`](../../../.agent/rules/git-safety.md)

## Purpose

Primary development lane for feature and fix work on ephemeral task branches.

## Runtime default

Local Supabase.

## Idle / active state

- Idle: `git switch --detach develop` and clean
- Active: `git switch -c <task-branch> develop` (never from detached HEAD)
- Release: detach back to `develop`; delete branch only after integrated

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
