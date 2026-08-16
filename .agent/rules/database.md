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
- [`docs/domains/database/cheatsheets/README.md`](../../docs/domains/database/cheatsheets/README.md)
  owns concise operator cards and the status evidence taxonomy.

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

| Target               | Identification                                                                  | Usage                                                               | Destructive ops allowed?                                           |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **production**       | Supabase cloud host (`*.supabase.co`, `*.supabase.com`)                         | Read-only inspection; owner apply via `pnpm prod:apply`             | NEVER                                                              |
| **preview**          | Hosted branch DB (`PREVIEW_DB_URL` or secret files)                             | Provisioned hosted Preview project for Vercel `develop` deployments | NO — schema mutated via `pnpm db:migrate -- --target preview` only |
| **persistent-local** | `127.0.0.1:54322` or `localhost:54322`, container `supabase_db_celebra-me-rsvp` | Normal development through `pnpm dev`                               | NO — protected state                                               |
| **disposable-test**  | `127.0.0.1:54332` or `localhost:54332`, container `celebra-me-test-db`          | Migration reconstruction/pgTAP/seed/canonical audit reference       | YES — created/recreated on demand                                  |

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
- **Hosted migration state**: Never freeze applied or pending migration counts in active guidance.
  Obtain live pending/applied sets from `pnpm db:prod:audit` / `pnpm db:preview:audit` before any
  migration decision.
- **Migration Ownership**: All schema changes must be introduced through versioned migrations under
  `supabase/migrations/` and promoted Local → Preview → Production through the guarded workflows. Do
  not repair schema or privilege drift with manual Supabase dashboard SQL/grants.
- **Mutation receipt ledger**: `invitation_mutation_operation_receipts` is append-only
  (`service_role`: `SELECT`+`INSERT`, never `UPDATE`/`DELETE`). Atomic invitation mutations
  serialize on the target invitation row; do not add receipt row locks that would require `UPDATE`.
- **No Direct Production SQL**: Direct production SQL execution is not part of the normal workflow.
  Emergency patch files must contain the manifest required by
  [`manual-sql-manifest.md`](manual-sql-manifest.md). Lint with
  `pnpm db:prod:patch -- --dry-run --file <path>`; mutation is only
  `pnpm prod:apply -- --patch <path> --apply`. Patches are not a substitute for versioned migrations
  or `invitation:release`.
- **One-Time Recovery Tool Removed**: `scripts/db/reconcile-prod-baseline.ts` was a one-time
  recovery tool and is no longer part of the repository.
- **Production Migration Safety Workflow**: Public owner apply is `pnpm prod:apply`
  (`APPLY <8-hex>`). Schema primitive remains `pnpm db:migrate -- --target production` (used by the
  owner command; standalone schema confirmation uses `MIGRATE <8-hex>`). Default is read-only
  preflight; mutation requires `--apply`. The schema primitive sequence:
  1. Production perimeter + exact project-ref identity (in-policy; equivalent to db-guard)
  2. Read-only production schema audit (BEHIND without drift is ready-to-migrate)
  3. Dry-run pending set (optional `--expected` pin must match exactly when provided)
  4. Migration / deployment compatibility using current clean `HEAD` + rollout registry
     (`supabase/migration-rollout-registry.json`; SSOT
     `scripts/db/migration-deployment-compatibility.ts`). Hosted candidates without an explicit
     registry phase fail closed.
  5. Apply `prepareApply`: valid `pnpm release-check` evidence for the current clean `HEAD` (`test`
     in parallel with `type-check` → `build:app`; ordinary preflight does not run the suite)
  6. Verified pre-migration critical backup coverage (`.backups/prod/...`) with bounded RPO (default
     15 minutes). Reuse when project/artifacts/EFS/profile/migration-history match and age ≤ RPO;
     business-row drift after capture is allowed (online RSVP traffic). Otherwise capture a new set
     automatically (one capture retry on mid-capture instability).
  7. One post-backup revalidation against the reviewed plan (material drift aborts)
  8. Structural coverage confirm before owner gate (`BACKUP_COVERAGE_EXPIRED` /
     `BACKUP_STRUCTURAL_DRIFT`). Shared owner boundary: Cancel-default arrow menu, optional
     technical review, then short bound code `<VERB> <8-hex>` from stable `planId`.
  9. Migration application (`supabase db push --db-url <url> --yes`) after
     `requireOwnerProductionApply` issues an in-process write permit
  10. Post-migration `schema_migrations` + durable owner-apply record
      (`.backups/prod/owner-apply/`) + `pnpm db:contract:verify --target production`
  11. Verified post-migration critical backup
- **Owner authorization**: All owner-only Production mutators use `requireOwnerProductionApply`
  (explicit `--apply`, Production project identity, agent rejection, release-check evidence, TTY
  intent select + short bound code). No token, secret, or noninteractive confirmation alternative
  exists. `production_authorization_receipts` is historical inert state. Successful Production
  schema applies write a local owner-apply record; schema parity is not authorization evidence.
  Agent sessions receive `CELEBRA_AGENT_CONTEXT` by default (Cursor session/preToolUse hooks) and
  cannot disable it with `false`/`0`/empty. Agent Shell denies canonical Production `--apply`. Raw
  `supabase db push` / mutating `psql` and Supabase MCP writes against Production are blocked
  outside this owner workflow. Read-only Production MCP/SQL remains allowed.
- **Hosted identity vs environment selection**: Selecting Preview/Production and having credentials
  is not authorization. Production and Preview migrate derive release identity from clean `HEAD`
  (Production also requires `pnpm release-check`). Preview URL must match the canonical project ref
  (`assertPreviewDbUrl`). Contract-phase migrations also require deployed-app evidence
  (`CELEBRA_DEPLOYED_APP_SHA` / `CELEBRA_DEPLOYED_APP_CAPABILITIES`). Local is not gated by hosted
  deployment identity. See `docs/database-workflow.md` → Migration / Deployment Compatibility
  Contract.
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
- **Separation of Operations**: Migration (`pnpm db:migrate -- --target preview`), seed, and audit
  (`pnpm db:preview:audit`) are separate operations. Preview migrate defaults to read-only
  preflight; mutations require explicit `--apply` plus Preview authorization
  (`CELEBRA_TASK_SCOPE=preview:schema:migrate` or interactive TTY confirmation) after dry-run,
  optional `--expected` pin, exact Preview perimeter, clean-HEAD release identity, and the
  compatibility contract. It does not automatically seed or audit.
- **Preview mirror**: `pnpm db:preview:sync-invitations --dry-run` performs zero DB, role, profile,
  Storage, or report-file writes. `--apply` requires Preview authorization
  (`CELEBRA_TASK_SCOPE=preview:content-mirror:sync-invitations` or interactive confirmation).
- **Failure Handling**: When Preview credentials are missing/unconfigured,
  `pnpm db:migrate -- --target preview` and `pnpm db:preview:audit` fail closed with exit code `1`.
- **Content promote / mirror / RSVP isolation**: Follow
  [`docs/core/content-parity-rsvp-isolation.md`](../../docs/core/content-parity-rsvp-isolation.md).
  `pnpm db:preview:sync-invitations` is a Production→Preview **content regression mirror** (not
  promotion). It excludes RSVP/PII tables and replaces Preview `events` via `TRUNCATE CASCADE`,
  which resets Preview RSVP children — re-provision gated synthetic fixtures afterward.
- **No Production PII Copy**: Production Auth users, guest data, RSVP records, tracking, commercial,
  and other private operational data must NEVER be copied into Preview.

## Current Contract

- `pnpm db:push` is intentionally blocked. Do not bypass it with raw `supabase db push`. Cursor
  hooks and the in-process spawn guard also block raw `supabase db push` / mutating Production
  `psql`. Production MCP `apply_migration` and mutating `execute_sql` are blocked.
- `pnpm db:local:reset` is blocked. Use `pnpm db:disposable:reset` for destructive tests.
- `pnpm db:migrate` is the canonical schema migrate planner/orchestrator (TTY target selector with
  Cancelar default; non-TTY requires `--target`; default read-only preflight).
- Environment-specific migrate aliases are retired. Use
  `pnpm db:migrate -- --target <local|preview|production|disposable-test>`.
- `pnpm prod:apply` is the owner-facing Production apply command (read-only plan by default;
  `--apply` mutates after one TTY confirmation bound to the plan). Agents may run it without
  `--apply` for planning; Production `--apply` is denied in agent Shell.
- `pnpm db:migrate -- --target production` remains the canonical **schema** primitive reused by
  `prod:apply`. The CLI Production `--apply` redirects to `pnpm prod:apply -- --schema --apply`.
- `pnpm invitation:release` remains Local/Preview/approve plus Production **dry-run**. Owner
  Production content apply is `pnpm prod:apply -- --slug <slug> --apply` (or `--all-ready`). The
  promotion orchestrator stays the domain primitive.
- `pnpm db:migrate -- --target preview` preflights Preview (`PREVIEW_DB_URL`); `--apply` applies
  pending migrations after Preview authorization (wrapper over `db:migrate -- --target preview`).
- Schema status evidence: `pnpm dbs` / observability use **migration_history_parity** (`CURRENT` /
  `BEHIND` are history-only). `pnpm db:*:audit` uses **object_audit_readiness** and must fail a
  `CURRENT` history when named public indexes, constraints, or contract routines drift. While
  history is `BEHIND`, those structural findings are reported but do not block `readyForMigrate`.
  Production **owner-apply evidence** is a third class (`authorizationIntegrity`). Do not treat
  CURRENT schema parity as authorization.
- Persistent schema mutation has one lifecycle: versioned `supabase/migrations/` →
  `pnpm db:migrate -- --target` (disposable → Local → Preview → owner
  `pnpm prod:apply -- --schema`). `executePsqlAtomicPending` is Local-only. There is no
  `apply-migrations` CLI.
- `pnpm db:prod:patch` is lint-only and requires `--dry-run`; it never opens Production. Specialized
  DML is `RESTRICT_OWNER_ONLY` / `KEEP_SPECIALIZED` and can execute only through
  `pnpm prod:apply -- --patch ... --apply`, which binds the current plan and artifact, validates
  preview row-count bounds and backup, and prompts the owner. Persistent DDL (`CREATE TABLE/INDEX`,
  routines, schema-changing `ALTER`, persistent `DROP`, `GRANT`/`REVOKE`) is rejected. Patches must
  not bypass `pnpm prod:apply -- --schema` or `pnpm prod:apply -- --slug`.
- `invitation:romina-draft-reset` remains a temporary explicit one-off (never `--all-ready`) until
  the owner confirms it is complete.
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
  (`tsx scripts/db/disposable-test-env.ts run-tests`), and use `pnpm prod:apply -- --schema` for the
  reviewed Production owner path (primitive: `pnpm db:migrate -- --target production`).
- Need a production recovery point? Use `pnpm db:prod:backup:critical` or the daily job
  `pnpm db:prod:backup:daily`. `pnpm db:prod:backup` is a public-schema dump for local refresh only
  — not a critical recovery set. Keep output gitignored. The guard verifies the target is a Supabase
  cloud host before proceeding.
- Need the Free-plan daily recovery point? Run `pnpm db:prod:backup:daily` from the authorized
  Windows operator account. Windows Task Scheduler may invoke it once every 24 hours; it must never
  run through CI, Vercel, Supabase scheduled compute, or application infrastructure.
- Need to reset a database for tests? Use `tsx scripts/db/disposable-test-env.ts reset`. The guard
  allows all operations on the disposable-test target.
- Need a manual production SQL patch? Require the [`manual SQL manifest`](manual-sql-manifest.md),
  run `pnpm db:prod:patch -- --dry-run --file <path>`, then use only
  `pnpm prod:apply -- --patch <path> --apply` for owner-confirmed specialized maintenance that
  cannot yet be a versioned migration.
- Asked to run `pnpm db:push`, `pnpm db:local:reset`, raw `supabase db push --linked`, or removed
  one-shot ops commands? Do not run them. Report that the path is blocked.
- Asked to use Supabase MCP `apply_migration` or mutating `execute_sql` against Production? Do not.
  Read-only Production MCP (`list_migrations`, SELECT) is allowed.
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
- Production is strictly read-only unless the user explicitly authorizes a separate production owner
  apply with `pnpm prod:apply` (schema via `--schema`, content via `--slug` / `--all-ready`,
  specialized DML via `--patch`).
- Unknown database targets must cause an immediate abort of the operation.
- Dumps and credentials must never enter Git. Dumps live under gitignored `.tmp/` and `.backups/`;
  hosted DB credentials live only in gitignored `.env.preview.local` / `.env.production.local`.
- Before any database operation, classify the target using
  `tsx scripts/db/db-guard.ts classify --db-url <url>`.
- Do not connect to production unless the user explicitly asks for that exact production operation.
- For production patches, prefer versioned migrations. Manual SQL from
  `scripts/manual/production-patches/` or `scripts/sql/` requires linting via
  `pnpm db:prod:patch -- --dry-run --file <path>` (`RESTRICT_OWNER_ONLY`) and mutates only through
  `pnpm prod:apply -- --patch <path> --apply`.
- Do not run `supabase db push --linked`.
- Do not use Supabase MCP `apply_migration` or mutating `execute_sql` against Production. Agent
  sessions set `CELEBRA_AGENT_CONTEXT` automatically; that rejects Production owner-apply
  self-authorization. Preview remains agent-operable under its existing scope/TTY policy.
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
