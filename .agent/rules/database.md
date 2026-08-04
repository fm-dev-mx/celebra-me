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
- [`docs/core/content-parity-rsvp-isolation.md`](../../docs/core/content-parity-rsvp-isolation.md)
  owns content promote/mirror/parity vs RSVP isolation (do not redefine here).
- [`scripts/README.md`](../../scripts/README.md) is command inventory and ownership only.

## Scope Boundary

These rules govern operational database work: CLI commands, migrations, backups, local refreshes,
manual SQL patches, service-role repair scripts, and any agent-directed Supabase operation.

Legitimate runtime application writes are different. Authenticated app flows, dashboard APIs, RSVP
submissions, draft saves, intake captures, and other production code paths may write to Supabase
when they are part of the shipped application and protected by the normal auth, RLS, validation, and
code-review boundaries. Do not treat those runtime writes as operational DB work unless the task
asks you to change, backfill, replay, or manually invoke them.

## Database Environment Architecture

Four distinct database targets exist:

| Target               | Identification                                                                  | Usage                                                                             | Destructive ops allowed?                               |
| -------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **production**       | Supabase cloud host (`*.supabase.co`, `*.supabase.com`)                         | Read-only inspection and export; schema mutations via `pnpm db:prod:migrate` only | NEVER                                                  |
| **preview**          | Hosted branch DB (`PREVIEW_DB_URL` or secret files)                             | Provisioned hosted Preview project for Vercel `develop` deployments               | NO — schema mutated via `pnpm db:preview:migrate` only |
| **persistent-local** | `127.0.0.1:54322` or `localhost:54322`, container `supabase_db_celebra-me-rsvp` | Normal development through `pnpm dev`                                             | NO — protected state                                   |
| **disposable-test**  | `127.0.0.1:54332` or `localhost:54332`, container `celebra-me-test-db`          | Migration reconstruction/pgTAP/seed/canonical audit reference                     | YES — created/recreated on demand                      |

Unknown targets cause an immediate abort. The guard script `scripts/db/db-guard.ts` enforces these
boundaries through classification, identity verification, and per-target policy checks.

### Worktree Location Grants No Database Privilege

Worktree directory location (e.g. `dev-preview`, `dev-local`, `dev-extra`, or root `celebra-me`)
**never** grants implicit database mutation privileges.

```text
Environment authorization =
task scope
+ target environment
+ operation risk
+ existing repository safety rules
```

Being inside `dev-preview` does not grant Preview or Production mutation permission even when that
lane's application runtime targets Preview Supabase. Operational access to Preview requires explicit
task authorization, target classification, and standard guard checks.

---

## Production Status & Governance

- **Reconciliation Complete**: Production migration-history reconciliation is 100% complete.
- **Hosted migration state**: Never freeze an applied/pending count in active guidance. Obtain the
  current state with the read-only Production audit before any migration decision.
- **Pending Migrations**: Do not freeze a hosted pending count here. Obtain live pending sets from
  `pnpm db:prod:audit` / `pnpm db:preview:audit` before any migrate decision.
- **Migration Ownership**: All schema changes must be introduced through versioned migrations under
  `supabase/migrations/` and promoted Local → Preview → Production through the guarded workflows. Do
  not repair schema or privilege drift with manual Supabase dashboard SQL/grants.
- **Mutation receipt ledger**: `invitation_mutation_operation_receipts` is append-only
  (`service_role`: `SELECT`+`INSERT`, never `UPDATE`/`DELETE`). Atomic invitation mutations
  serialize on the target invitation row; do not add receipt row locks that would require `UPDATE`.
- **No Direct Production SQL**: Direct production SQL execution is not part of the normal workflow.
  Emergency patch files must contain the manifest required by
  [`manual-sql-manifest.md`](manual-sql-manifest.md). Prefer `pnpm db:prod:patch -- --dry-run`
  first; owner-only `--apply` is specialized maintenance, not a substitute for versioned migrations
  or `invitation:promote`.
- **One-Time Recovery Tool Removed**: `scripts/db/reconcile-prod-baseline.ts` was a one-time
  recovery tool and is no longer part of the repository.
- **Production Migration Safety Workflow**: Canonical planner is
  `pnpm db:migrate -- --target production` (alias `pnpm db:prod:migrate`). Default is read-only
  preflight; mutation requires `--apply`:
  1. Target guard check (`db-guard.ts check --target production --operation migrate`)
  2. Exact Production project-ref identity
  3. Read-only production schema audit (`pnpm db:prod:audit`)
  4. Dry-run pending set (optional `--expected` pin must match exactly when provided)
  5. Migration / deployment compatibility using current clean `HEAD` + rollout registry
     (`supabase/migration-rollout-registry.json`; SSOT
     `scripts/db/migration-deployment-compatibility.ts`). Hosted candidates without an explicit
     registry phase fail closed.
  6. Valid `pnpm release-check` evidence for the current clean `HEAD` (apply only; ordinary
     preflight does not run the full suite)
  7. Verified pre-migration backup (`.backups/prod/...`)
  8. Shared owner boundary: operation summary + exact interactive TTY confirmation bound to release
     SHA, pending versions, and immutable `planId`
  9. Migration application (`supabase db push --db-url <url> --yes`)
  10. Post-migration `schema_migrations` + `pnpm db:contract:verify --target production`
  11. Verified post-migration critical backup
- **Owner authorization**: All owner-only Production mutators use `requireOwnerProductionApply`
  (explicit `--apply`, Production project identity, agent rejection, release-check evidence, TTY
  confirmation). No token, secret, or noninteractive confirmation alternative exists.
  `production_authorization_receipts` is historical inert state.
- **Hosted identity vs environment selection**: Selecting Preview/Production and having credentials
  is not authorization. Production migrate derives release identity from clean `HEAD` +
  `pnpm release-check`. Preview migrate still requires `CELEBRA_TARGET_RELEASE_SHA`. Contract-phase
  migrations also require deployed-app evidence (`CELEBRA_DEPLOYED_APP_SHA` /
  `CELEBRA_DEPLOYED_APP_CAPABILITIES`). Local is not gated by hosted deployment identity. See
  `docs/database-workflow.md` → Migration / Deployment Compatibility Contract.
- **Unified orchestration**: Local, Preview, and Production schema migrate share
  `scripts/db/migrate-orchestrator.ts` with isolated environment policies. Invitation promote,
  Preview content mirror, seeds, restores, and `db:prod:patch` remain outside that orchestrator.
  After any failed apply, re-run preflight — no resume from cached plans. Cross-machine concurrency
  is an accepted single-operator residual risk (no distributed lock).

## Preview Environment Status & Rules

- **Preview Status**: `PROVISIONED & HOSTED-VALIDATED`
- **Hosted Project**: Dedicated Supabase Preview project used by Vercel Preview deployments from
  `develop`.
- **Credentials & Secret Resolution**: Credentials come from the `PREVIEW_DB_URL` environment
  variable or the single canonical gitignored secret file `.env.preview.local`.
- **Audit Workflow (`pnpm db:preview:audit`)**: Reads Preview migration and schema state,
  reconstructs the canonical disposable reference database (`127.0.0.1:54332`), and compares Preview
  against the canonical reference without mutating Preview or persistent local. Report the live
  remote/pending migration counts from the audit; never freeze a hosted pending total in this rule.
- **Separation of Operations**: Migration (`pnpm db:preview:migrate` /
  `pnpm db:migrate -- --target preview`), seed, and audit (`pnpm db:preview:audit`) are separate
  operations. Preview migrate defaults to read-only preflight; mutations require explicit `--apply`
  plus Preview authorization (`CELEBRA_TASK_SCOPE=preview:schema:migrate` or interactive TTY
  confirmation) after dry-run, optional `--expected` pin (deprecated `--allowlist` /
  `EXPECTED_MIGRATIONS` shim still accepted with a warning), and the compatibility contract. It does
  not automatically seed or audit.
- **Preview mirror**: `pnpm db:preview:sync-invitations --dry-run` performs zero DB, role, profile,
  Storage, or report-file writes. `--apply` requires Preview authorization
  (`CELEBRA_TASK_SCOPE=preview:content-mirror:sync-invitations` or interactive confirmation).
- **Failure Handling**: When Preview credentials are missing/unconfigured, `pnpm db:preview:migrate`
  and `pnpm db:preview:audit` fail closed with exit code `1`.
- **Content promote / mirror / RSVP isolation**: Follow
  [`docs/core/content-parity-rsvp-isolation.md`](../../docs/core/content-parity-rsvp-isolation.md).
  `pnpm db:preview:sync-invitations` is a Production→Preview **content regression mirror** (not
  promotion). It excludes RSVP/PII tables and replaces Preview `events` via `TRUNCATE CASCADE`,
  which resets Preview RSVP children — re-provision gated synthetic fixtures afterward.
- **No Production PII Copy**: Production Auth users, guest data, RSVP records, tracking, commercial,
  and other private operational data must NEVER be copied into Preview.

## Current Contract

- `pnpm db:push` is intentionally blocked. Do not bypass it with raw `supabase db push`.
- `pnpm db:local:reset` is blocked. Use `pnpm db:disposable:reset` for destructive tests.
- `pnpm db:migrate` is the canonical schema migrate planner/orchestrator (`--target` required;
  default read-only preflight).
- `pnpm db:local:migrate` is a deprecated compatibility wrapper that defaults to `--apply` for
  legacy callers (stderr warning). Prefer `pnpm db:migrate -- --target local` (preflight-first)
  then explicit `--apply`. Remove the default-apply shim when no callers rely on it.
- `pnpm db:prod:migrate` is the approved production **schema** mutation workflow (wrapper over
  `db:migrate -- --target production`).
- `pnpm invitation:promote` is the approved production **managed-content** promotion workflow
  (owner-only; separate from schema migrate).
- `pnpm db:preview:migrate` preflights Preview (`PREVIEW_DB_URL`); `--apply` applies pending
  migrations after Preview authorization (wrapper over `db:migrate -- --target preview`).
- Schema status evidence: `pnpm dbs` / observability use **migration_history_parity**;
  `pnpm db:*:audit` uses **object_audit_readiness**. Do not treat them as equivalent.
- `pnpm db:prod:patch` disposition is `RESTRICT_OWNER_ONLY` / `KEEP_SPECIALIZED`: `--dry-run` is
  lint-only; `--apply` is owner-confirmed specialized maintenance and must not bypass
  `db:prod:migrate` or `invitation:promote`.
- Production patch files must include the manifest required by
  [`manual-sql-manifest.md`](manual-sql-manifest.md).
- Non-manifest SQL patch files are historical records only and must not be copied as templates.
- Removed one-shot ops commands (`adopt-legacy-events`, `new-invitation`, `optimize-assets`) are no
  longer registered.

## Decision Tree

### Required-database availability preflight

Before any task claims database integrity, parity, reconciliation, deployment readiness, data state,
or a result derived from database contents, identify its required targets and run:

```bash
pnpm db:availability:verify -- --targets local,preview,production
```

Use only the targets the conclusion actually depends on. The preflight classifies target identity,
opens a bounded session with `default_transaction_read_only=on`, and fails closed when credentials,
identity, reachability, or read-only enforcement cannot be proven.

If a required target is unavailable:

- report the target and typed reason; never translate unavailable evidence into zero rows,
  no-change, alignment, or integrity;
- stop every remaining step whose correctness depends on that target and do not claim the task is
  complete;
- continue only independent, non-database work whose conclusion does not rely on the missing
  evidence;
- do not automatically reset, restore, migrate, recreate, or repair a target. Starting an existing
  persistent-Local stack is allowed only when the user authorized recovery and its persistent
  volumes were verified first.

Read-only observability is deliberately different: its purpose is to report availability. It must
return typed `UNVERIFIED`/unavailable evidence and remain usable; it must not hide the failure,
invent a healthy state, or acquire mutation authority.

- Need local development data? Use `pnpm db:prod:backup` + `pnpm db:local:restore-from-dump` (see
  `docs/database-workflow.md` and the PII exception in
  `docs/core/content-parity-rsvp-isolation.md`). Restore may import real Production PII and must
  never seed Preview. `pnpm db:local:refresh-from-prod` and
  `pnpm db:local:refresh-from-prod-preserve-local` are blocked — they run `supabase db reset` which
  destroys the persistent-local database.
- Need a schema change? Create a migration, test it on the disposable environment
  (`tsx scripts/db/disposable-test-env.ts run-tests`), and use `pnpm db:prod:migrate` for the
  reviewed production path.
- Need a production backup? Use `PROD_DB_URL=... pnpm db:prod:backup`; keep output gitignored. The
  guard verifies the target is a Supabase cloud host before proceeding.
- Need the Free-plan daily recovery point? Run `pnpm db:prod:backup:daily` from the authorized
  Windows operator account. Windows Task Scheduler may invoke it once every 24 hours; it must never
  run through CI, Vercel, Supabase scheduled compute, or application infrastructure.
- Need to reset a database for tests? Use `tsx scripts/db/disposable-test-env.ts reset`. The guard
  allows all operations on the disposable-test target.
- Need a manual production SQL patch? Require the [`manual SQL manifest`](manual-sql-manifest.md),
  run `pnpm db:prod:patch -- --dry-run --file <path>`, and only use owner-confirmed `--apply` for
  specialized maintenance that cannot yet be a versioned migration.
- Asked to run `pnpm db:push`, `pnpm db:local:reset`, raw `supabase db push --linked`, or removed
  one-shot ops commands? Do not run them. Report that the path is blocked.
- Unsure whether a command could touch production or destroy persistent local? Run the guard check:
  `tsx scripts/db/db-guard.ts check --target <target> --operation "<op>"`. Fail closed and ask for a
  narrower, explicit operation.

## Executable Guard

The database guard implements central safety policy. It is invoked automatically by all `pnpm db:*`
commands. Direct invocation:

```bash
tsx scripts/db/db-guard.ts check --target <production|preview|persistent-local|disposable-test> --operation "<op>"
tsx scripts/db/db-guard.ts classify --db-url <connection-string>      # Classify a DB URL
tsx scripts/db/db-guard.ts redact --text "<text>"                     # Redact credentials
tsx scripts/db/sentinel-check.ts <insert|check|remove>                # Sentinel management
```

Key behaviours:

- **Production**: blocks all write, DDL, reset, push, drop, truncate operations.
- **Persistent-local**: blocks `supabase db reset`, `docker volume rm`, `docker compose down -v`,
  `DROP ... CASCADE`, `TRUNCATE ... CASCADE`, `db push`.
- **Disposable-test**: permits all operations (warning issued).
- **Unknown**: blocks all operations with classification error.
- **Credentials**: automatically redacted from all logs and error messages.
- **Local identity**: verified by checking port (54322), host (127.0.0.1), and project ID
  (`celebra-me-rsvp` in `supabase/config.toml`).

## Disposable Test Environment

The disposable environment uses separate Docker containers, ports, and volumes:

```bash
tsx scripts/db/disposable-test-env.ts start       # Create and start the test environment
tsx scripts/db/disposable-test-env.ts reset       # Reset the test database (destructive) + seed data
tsx scripts/db/disposable-test-env.ts run-tests   # Run pgTAP and migration tests
tsx scripts/db/disposable-test-env.ts stop        # Stop the test environment
tsx scripts/db/disposable-test-env.ts cleanup     # Full cleanup (stop + remove config/data)
```

Configuration:

- Config directory: `supabase/test/config.toml`
- Project ID: `celebra-me-test`
- Ports: API 54331, DB 54332, Studio 54333, Shadow 54330
- Seed data: `supabase/test/seed-test-data.sql`
- Migrations: copied from `supabase/migrations/` on first start

## Sentinel

A sentinel row in the `public._db_sentinel` table proves the persistent local database was not
reset. It must survive all normal CI and development workflows.

```bash
tsx scripts/db/sentinel-check.ts insert    # Create the sentinel (one-time)
tsx scripts/db/sentinel-check.ts check     # Verify sentinel exists (exit 1 if missing)
tsx scripts/db/sentinel-check.ts remove    # Remove sentinel (cleanup)
```

The sentinel test is part of the guard validation suite. Run it after CI to confirm the
persistent-local database was preserved.

## Agent Rules

- The persistent local database (`celebra-me-rsvp`) is protected state. Treat it like a
  development-critical resource that must never be destroyed.
- Agents must never run `supabase db reset`, `docker volume rm`, or any destructive DDL against the
  persistent local or production targets.
- Remote reset flags (`--linked`, `--db-url` pointing to remote) are prohibited without explicit
  target classification passing the guard.
- Destructive tests (reset, schema drops, truncate, migration rollback) must use the disposable test
  environment (`pnpm db:disposable:reset`).
- Production is strictly read-only unless the user explicitly authorizes a separate production
  schema goal with `pnpm db:prod:migrate` or managed-content promotion with
  `pnpm invitation:promote`.
- Unknown database targets must cause an immediate abort of the operation.
- Dumps and credentials must never enter Git. Dumps live under gitignored `.tmp/` and `.backups/`;
  hosted DB credentials live only in gitignored `.env.preview.local` / `.env.production.local`.
- Before any database operation, classify the target using `pnpm db:guard:classify --db-url <url>`.
- Do not connect to production unless the user explicitly asks for that exact production operation.
- Do not execute manual production SQL from `scripts/manual/production-patches/` or `scripts/sql/`
  without the owner-only `db:prod:patch` workflow.
- Do not run `supabase db push --linked`.
- For production patches, prefer versioned migrations; use `pnpm db:prod:patch` only as specialized
  owner maintenance (`RESTRICT_OWNER_ONLY`).
- Prefer fail-closed behavior over preserving old command compatibility.
- `pnpm run ci` must never reset or modify the persistent local database.
- The sentinel must survive the full validation pipeline.

## Completion Checklist

- Classified the task as operational DB work or legitimate runtime app writes.
- Identified the target environment (production / persistent-local / disposable-test / unknown).
- Used the guard to verify target before any database command.
- Kept production credentials out of logs/docs/chat.
- Blocked `pnpm db:push`, `pnpm db:local:reset`, raw linked Supabase push, and disabled service-role
  repair scripts.
- Required the manifest before any production patch linting.
- Verified sentinel preservation after running CI or validation.
- Ran the relevant DB safety, link, and doc checks before reporting back.
