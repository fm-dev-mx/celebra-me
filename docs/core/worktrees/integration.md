# Integration worktree

**Path:** `celebra-me` (repository root)  
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

- Integration stays on `develop` (not detached).
- Do not use Integration as a disposable feature lane when a development worktree is available.

## Environment files

- Required for app: `.env.local` with Local `SUPABASE_*` / `PUBLIC_SUPABASE_*`
- Optional Preview ops: `.env.preview.local`
- Optional Preview E2E: `.env.e2e.local`
- Never put Production credentials in ordinary `.env.local`

## Common operations

- Trunk commits on `develop`, release prep, `pnpm ops worktree-status`
- Authorized Local DB workflows; authorized Preview/Production ops when tasked

## Restrictions

- Path ≠ privilege
- Production mutations require explicit authorization and Production workflows

## Agents

Use an explicit `cwd` of this root. Do not rely on the human `lane` helper.
