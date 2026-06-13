# Environment Workflow

This is the canonical human-facing environment guide for Celebra-me. Keep real values out of docs,
issues, logs, and chat.

## Source Hierarchy

- `.env.example`: local development template only; contains placeholders and local defaults.
- `.env`: ignored local values only.
- `.env.local`: ignored local overrides only; never point it at production.
- `.env.*.local`: ignored, machine-specific or one-off local files.
- `.secrets/` and `.tmp/secrets/`: ignored secret paths for operational values.
- Shell/Vercel environment: production and deployment values.

Production must never be inferred from `.env` or `.env.local`. Production-only values belong in the
shell, Vercel, or gitignored secret paths documented by the owning workflow.

## Variable Categories

The authoritative source for all runtime variables is `src/env.d.ts` (interface) and `.env.example`
(local template). Keep these three files in sync when adding or removing environment variables.

Only the category-level rules that cannot be expressed in code are listed here:

- **Public client-safe (`PUBLIC_*`):** Anything prefixed `PUBLIC_` can reach the browser. Never
  expose `SUPABASE_SERVICE_ROLE_KEY` or other server-only secrets with a `PUBLIC_` prefix.
- **Server-only runtime:** Loaded server-side only through `src/lib/server/env.ts`. Includes
  credentials, API keys, and internal URLs.
- **Operational script-only:** Command confirmations (e.g. `CONFIRM_REMOTE_SERVICE_ROLE`), DB
  workflow inputs, one-off script filters.
- **Production-only shell variables:** `PROD_DB_URL` is a Postgres connection string only. It must
  never be accepted where a Supabase REST/API URL is required.
- **Test-only:** `PLAYWRIGHT_*`, audit run IDs, test fixture variables.
- **Stale/manual-only:** `DATABASE_URL` and `RSVP_TOKEN_SECRET` are not active runtime inputs. Keep
  them out of templates unless a future workflow reintroduces them intentionally.

## Rules

- Use local Supabase defaults for local development: `SUPABASE_URL=http://127.0.0.1:54321` and
  `PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be used by public health checks.
- Service-role scripts must fail closed for remote Supabase unless they have a command-specific
  confirmation.
- `PUBLIC_*` variables must be browser-safe.
- `PROD_DB_URL` is only for Postgres workflows such as backups, refreshes, and reviewed migrations.
- Logs may show variable names, source filenames, presence/absence, and local/remote classification.
  They must not show full URLs, keys, passwords, raw tokens, or DB connection strings.
- Examples should use local placeholders unless explicitly marked shell-only.

## Current Precedence

- App server code reads through `src/lib/server/env.ts`: `process.env` first, then `.env.local`,
  then `.env`; file reads are skipped in test mode.
- Astro config uses Vite `loadEnv` plus `process.env`; production `BASE_URL` should come from the
  deployment shell/Vercel environment.
- DB workflow scripts centralize local app env loading in `scripts/db/db-workflow-lib.ts`, with
  `.env.local`/`.env` merged and `process.env` overriding file values.
- Older operational scripts still load env files locally and are guarded case-by-case. Broad
  precedence normalization is intentionally deferred to avoid changing deployment behavior.

## Cleanup Notes

- `RSVP_ADMIN_USER` is still used as a local admin alias during production-to-local refresh.
- `DATABASE_URL` and `RSVP_TOKEN_SECRET` only appear in historical notes/plans and should remain
  deferred unless a concrete active owner is found.
- When adding or retiring runtime variables, keep `.env.example`, `src/env.d.ts`, and this guide in
  sync.
