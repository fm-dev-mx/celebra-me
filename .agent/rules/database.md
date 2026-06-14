# Database Agent Rules

Production contains real invitation, guest, RSVP, published-content, draft, and client data. Treat
all production database work as high risk.

## Source Hierarchy

- This file is the short operational contract and decision tree for agents.
- [`docs/env-workflow.md`](../../docs/env-workflow.md) is the canonical environment source hierarchy
  and variable category guide.
- [`manual-sql-manifest.md`](manual-sql-manifest.md) defines the required manifest for manual
  production SQL patch files.
- [`docs/database-workflow.md`](../../docs/database-workflow.md) is the full human runbook.
- [`scripts/README.md`](../../scripts/README.md) is command inventory and ownership only.

## Scope Boundary

These rules govern operational database work: CLI commands, migrations, backups, local refreshes,
manual SQL patches, service-role repair scripts, and any agent-directed Supabase operation.

Legitimate runtime application writes are different. Authenticated app flows, dashboard APIs, RSVP
submissions, draft saves, intake captures, and other production code paths may write to Supabase
when they are part of the shipped application and protected by the normal auth, RLS, validation, and
code-review boundaries. Do not treat those runtime writes as operational DB work unless the task
asks you to change, backfill, replay, or manually invoke them.

## Current Contract

- `pnpm db:push` is intentionally blocked. Do not bypass it with raw `supabase db push`.
- `pnpm db:prod:migrate` is the only implemented production mutation workflow.
- `pnpm db:prod:patch -- --file <path>` is dry-run lint only. It never connects to the database and
  never executes SQL.
- Production patch files must include the manifest required by
  [`manual-sql-manifest.md`](manual-sql-manifest.md).
- Non-manifest SQL patch files are historical records only and must not be copied as templates.
- `pnpm ops adopt-legacy-events` is disabled because it can mutate data with the service role.

## Decision Tree

- Need local development data? Use local Supabase commands from the runbook. Production may only be
  read for approved refreshes/backups.
- Need a schema change? Create a migration, test it locally, and use `pnpm db:prod:migrate` for the
  reviewed production path.
- Need a production backup? Use `PROD_DB_URL=... pnpm db:prod:backup`; keep output gitignored.
- Need a manual production SQL patch? Require the [`manual SQL manifest`](manual-sql-manifest.md),
  then stop at `pnpm db:prod:patch -- --file <path>`. That command is lint-only.
- Asked to run `pnpm db:push`, raw `supabase db push --linked`, or `pnpm ops adopt-legacy-events`?
  Do not run it. Report that the path is blocked.
- Unsure whether a command could touch production? Fail closed and ask for a narrower, explicit
  operation.

## Agent Rules

- Do not connect to production unless the user explicitly asks for that exact production operation.
- Do not execute manual production SQL from `scripts/manual/production-patches/` or `scripts/sql/`.
- Do not run `supabase db push --linked`.
- For production patches, stop at `pnpm db:prod:patch -- --file <path>` until a reviewed execution
  harness exists.
- Prefer fail-closed behavior over preserving old command compatibility.

## Completion Checklist

- Classified the task as operational DB work or legitimate runtime app writes.
- Used the runbook for command details and kept production credentials out of logs/docs/chat.
- Blocked `pnpm db:push`, raw linked Supabase push, and disabled service-role repair scripts.
- Required the manifest before any production patch linting.
- Ran the relevant DB safety, link, and doc checks before reporting back.
