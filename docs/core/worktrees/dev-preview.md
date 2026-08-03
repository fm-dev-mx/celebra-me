# dev-preview worktree

**Path:** `<worktrees-root>\dev-preview` (sibling `<repo-dir>-worktrees/` directory of the repository root; see `docs/core/git-governance.md` for the reference-machine example)  
**Executable SSOT:** [`scripts/shared/worktree-lane.ts`](../../../scripts/shared/worktree-lane.ts)  
**Policy SSOTs:** [`git-governance.md`](../git-governance.md), [`env-workflow.md`](../../env-workflow.md), [`database-workflow.md`](../../database-workflow.md), [`.agent/rules/database.md`](../../../.agent/rules/database.md)

## Purpose

Preview development and hosted-validation affinity lane. Preferred place to run authorized Preview operations; still not an authorization token.

## Runtime default

Preview Supabase via required `.env.preview.local` overlay (`CELEBRA_RUNTIME_TARGET=preview`).

```text
local Astro → Preview Supabase API/Auth/Storage → Preview-backed app state
```

This is independent of Vercel Preview deployments (`VERCEL_ENV=preview`).

## Idle / active state

- Idle: Clean persistent branch `dev-preview` (or `git switch --detach develop`), aligned with `develop`
- Active: Ephemeral branch created explicitly from `develop`
- Release: Merge to `develop`; reset lane branch after integration

## Environment files

- `.env.local` — shared non-remote defaults (Local URL placeholders OK; Preview URLs must not live
  here)
- **Required:** `.env.preview.local` with matching Preview `SUPABASE_*` / `PUBLIC_SUPABASE_*`
- Optional ops keys in the same file: `PREVIEW_DB_URL`, `PREVIEW_SUPABASE_*`
- Optional: `.env.e2e.local` for Preview Playwright

## Common operations

- Local Astro against Preview for Auth/SSR/data validation
- Preferred lane for authorized `pnpm db:preview:*`, Preview `invitation:update`, Preview E2E
- Read-only `pnpm db:preview:audit` when credentials resolve

## Restrictions

- Runtime connectivity ≠ mutate privilege
- `db:preview:migrate`, sync-invitations, invitation apply, E2E provision/publish still need
  existing flags, guards, and task authorization
- Never treat this path as Production access

## Agents

Explicit `cwd`. Human navigation: `lane preview`.
