# dev-preview worktree

**Path:** `<worktrees-root>\dev-preview`  
**Executable SSOT:** [`scripts/shared/worktree-lane.ts`](../../../scripts/shared/worktree-lane.ts)  
**Policy SSOTs:** [`git-governance.md`](../git-governance.md),
[`env-workflow.md`](../../env-workflow.md), [`database-workflow.md`](../../database-workflow.md),
[`.agent/rules/database.md`](../../../.agent/rules/database.md)

## Purpose

Preview development and hosted-validation affinity lane. Preferred place to run authorized Preview
operations; still not an authorization token.

## Runtime default

Preview Supabase via required `.env.preview.local` overlay (`CELEBRA_RUNTIME_TARGET=preview`).

```text
local Astro → Preview Supabase API/Auth/Storage → Preview-backed app state
```

This is independent of Vercel Preview deployments (`VERCEL_ENV=preview`).

## Idle / active state

See [`git-governance.md`](../git-governance.md) for the canonical lane lifecycle.

## Environment files

- `.env.local` — shared non-remote defaults (Local URL placeholders OK; Preview URLs must not live
  here)
- **Required:** `.env.preview.local` with matching Preview `SUPABASE_*` / `PUBLIC_SUPABASE_*`
- Optional ops keys in the same file: `PREVIEW_DB_URL`, `PREVIEW_SUPABASE_*`
- Optional: `.env.e2e.local` for Preview Playwright

## Common operations

- Local Astro against Preview for Auth/SSR/data validation
- Preferred lane for authorized `pnpm db:preview:*`, Preview `invitation:release`, Preview E2E
- Read-only `pnpm db:preview:audit` when credentials resolve

## Agents

Explicit `cwd`.
