# Database Agent Rules

Production contains real invitation, guest, RSVP, published-content, draft, and client data. Treat
all production database work as high risk.

## Source Hierarchy

- This file is the short operational contract and decision tree for agents.
- [`docs/env-workflow.md`](../../docs/env-workflow.md) is the canonical environment source hierarchy
  and variable category guide.
- [`manual-sql-manifest.md`](manual-sql-manifest.md) defines the required manifest for manual
  production SQL patch files.
- [`docs/database-workflow.md`](../../docs/database-workflow.md) is the full human runbook: the
  Production apply sequence and owner gate, backups and restore, guard and disposable environment,
  and the manual patch flow.
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

Worktree location (`dev-preview`, `dev-local`, `dev-extra`, or Integration) **never** grants
database mutation privileges, even when a lane's runtime targets Preview Supabase. Environment
authorization is task scope + target environment + operation risk + existing repository safety rules
(see [`docs/env-workflow.md`](../../docs/env-workflow.md)).

---

## Production Governance

- **Hosted migration state**: Never freeze applied or pending migration counts in active guidance.
  Obtain live pending/applied sets from `pnpm db:prod:audit` / `pnpm db:preview:audit` before any
  migration decision.
- **Migration Ownership**: All schema changes must be introduced through versioned migrations under
  `supabase/migrations/` and promoted Local → Preview → Production through the guarded workflows. Do
  not repair schema or privilege drift with manual Supabase dashboard SQL/grants.
- **Mutation receipt ledger**: `invitation_mutation_operation_receipts` is append-only
  (`service_role`: `SELECT`+`INSERT`, never `UPDATE`/`DELETE`). Atomic invitation mutations
  serialize on the target invitation row; do not add receipt row locks that would require `UPDATE`.
- **Owner apply is the only Production mutation path**: `pnpm prod:apply` — schema via `--schema`,
  managed content via `--slug` / `--all-ready`, specialized DML via `--patch`. It is a read-only
  plan by default; `--apply` requires `pnpm release-check` evidence for the clean `HEAD`, verified
  critical backup coverage, and the owner TTY gate `requireOwnerProductionApply` (short bound code
  `<VERB> <8-hex>`; no token, secret, or noninteractive alternative). The full schema sequence and
  gate are in [`docs/database-workflow.md`](../../docs/database-workflow.md) (`pnpm db:migrate` and
  Push migrations to production).
- **Agent boundary**: Agents may run `prod:apply` without `--apply` for planning; Production
  `--apply` is denied in agent Shell. Cursor session/preToolUse hooks set `CELEBRA_AGENT_CONTEXT`
  and reject `false`/`0`/empty overrides; do not assume other hosts provide these hooks. Agent
  Production writes remain prohibited regardless of host enforcement. Read-only Production MCP/SQL
  remains allowed within task authorization.
- **Hosted identity vs environment selection**: Selecting Preview/Production and having credentials
  is not authorization. Hosted migrate derives release identity from clean `HEAD`, the Preview URL
  must match the canonical project ref, and contract-phase migrations need the smoke-checked
  Production deployment attestation (`scripts/db/contract-deployment-evidence.ts`); see the
  Migration / Deployment Compatibility Contract in the runbook.
- **Unified orchestration**: Local, Preview, and Production schema migrate share
  `scripts/db/migrate-orchestrator.ts`. After any failed apply, re-run preflight — no resume from
  cached plans.

## Preview Rules

- **Credentials**: `PREVIEW_DB_URL` or the gitignored `.env.preview.local`.
- **Separation of Operations**: Migration (`pnpm db:migrate -- --target preview`), seed, and audit
  (`pnpm db:preview:audit`) are separate operations. Migrate defaults to read-only preflight;
  `--apply` requires `CELEBRA_TASK_SCOPE=preview:schema:migrate` or interactive TTY confirmation.
  Missing Preview credentials fail closed with exit code `1`.
- **Preview mirror**: `pnpm db:preview:sync-invitations --dry-run` writes nothing. `--apply`
  requires `CELEBRA_TASK_SCOPE=preview:content-mirror:sync-invitations` or interactive confirmation.
  It is a Production→Preview **content regression mirror** (not promotion) that excludes RSVP/PII
  tables and resets Preview RSVP children via `TRUNCATE events CASCADE` — re-provision gated
  synthetic fixtures afterward. Policy:
  [`docs/core/content-parity-rsvp-isolation.md`](../../docs/core/content-parity-rsvp-isolation.md).
- **No Production PII Copy**: Production Auth users, guest data, RSVP records, tracking, commercial,
  and other private operational data must NEVER be copied into Preview.

## Current Contract

- `pnpm db:push` is intentionally blocked. Do not bypass it with raw `supabase db push`. Cursor
  hooks and the in-process spawn guard also block raw `supabase db push` / mutating Production
  `psql`. Production MCP `apply_migration` and mutating `execute_sql` are blocked.
- `pnpm db:local:reset` is blocked. Use `pnpm db:disposable:reset` for destructive tests.
- `pnpm db:migrate -- --target <local|preview|production|disposable-test>` is the canonical schema
  planner (TTY target selector with Cancelar default; non-TTY requires `--target`; default read-only
  preflight). Production `--apply` on it redirects to `pnpm prod:apply -- --schema --apply`.
- `pnpm invitation:release` covers Local/Preview/approve plus Production **dry-run**; Production
  content apply is `pnpm prod:apply -- --slug <slug> --apply` (or `--all-ready`).
- `pnpm ship:preview` runs the Local → Preview schema path in one process; without `-- --apply`
  every step is a read-only preflight, and with it each write keeps its own authorization.
- Schema status evidence classes (`migration_history_parity`, `object_audit_readiness`, Production
  `authorizationIntegrity`) are defined in the cheatsheets README. Do not treat CURRENT schema
  parity as authorization.
- `pnpm db:prod:patch` is lint-only and requires `--dry-run`; it never opens Production. Patches
  execute only through `pnpm prod:apply -- --patch <path> --apply`, reject persistent DDL, need the
  [manual SQL manifest](manual-sql-manifest.md), and must not bypass `pnpm prod:apply -- --schema`
  or `pnpm prod:apply -- --slug`. Non-manifest SQL files are historical records only.

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
  (`pnpm db:disposable:test`), and use `pnpm prod:apply -- --schema` for the reviewed Production
  owner path (primitive: `pnpm db:migrate -- --target production`).
- Need a production recovery point? Use `pnpm db:prod:backup:critical` or the daily job
  `pnpm db:prod:backup:daily` (authorized Windows operator account only; never CI, Vercel, Supabase
  scheduled compute, or application infrastructure). `pnpm db:prod:backup` is a public-schema dump
  for local refresh only — not a critical recovery set.
- Need to reset a database for tests? Use `pnpm db:disposable:reset`. The guard allows all
  operations on the disposable-test target.
- Need a manual production SQL patch? Require the [`manual SQL manifest`](manual-sql-manifest.md),
  run `pnpm db:prod:patch -- --dry-run --file <path>`, then use only
  `pnpm prod:apply -- --patch <path> --apply` for owner-confirmed specialized maintenance that
  cannot yet be a versioned migration.
- Asked to run `pnpm db:push`, `pnpm db:local:reset`, or raw `supabase db push --linked`? Do not run
  them. Report that the path is blocked.
- Asked to use Supabase MCP `apply_migration` or mutating `execute_sql` against Production? Do not.
  Read-only Production MCP (`list_migrations`, SELECT) is allowed.
- Unsure whether a command could touch production or destroy persistent local? Run the guard check:
  `tsx scripts/db/db-guard.ts check --target <target> --operation "<op>"`. Fail closed and ask for a
  narrower, explicit operation.

## Guard and Disposable Environment

`scripts/db/db-guard.ts` runs inside every guarded `pnpm db:*` command. It blocks all writes on
Production, destructive operations on persistent-local, and every operation on an unknown target; it
permits everything on disposable-test and redacts credentials. Destructive tests run in the
disposable environment (`127.0.0.1:54332`); Local, Preview, and Production schema actions also
require a current disposable migration proof. Commands, configuration, and proof validity rules:
[`docs/database-workflow.md`](../../docs/database-workflow.md) (Executable guard, Disposable test
environment).

## Sentinel

A sentinel row in the `public._db_sentinel` table proves the persistent local database was not
reset. It must survive all normal CI and development workflows. `pnpm db:local:restore-from-dump`
verifies it after a restore; to confirm it by hand, run the read-only query
`select count(*) from public._db_sentinel` against persistent Local (expected: 1).

## Agent Rules

- The persistent local database (`celebra-me-rsvp`) is protected state. Treat it like a
  development-critical resource that must never be destroyed.
- Agents must never run `supabase db reset`, `docker volume rm`, or any destructive DDL against the
  persistent local or production targets.
- Remote reset flags (`--linked`, `--db-url` pointing to remote) are prohibited without explicit
  target classification passing the guard.
- Production is strictly read-only unless the user explicitly authorizes a separate production owner
  apply with `pnpm prod:apply`. Do not connect to production unless the user explicitly asks for
  that exact production operation.
- Before any database operation, classify the target using
  `tsx scripts/db/db-guard.ts classify --db-url <url>`.
- Dumps and credentials must never enter Git. Dumps live under gitignored `.tmp/` and `.backups/`;
  hosted DB credentials live only in gitignored `.env.preview.local` / `.env.production.local`.
- Prefer fail-closed behavior over preserving old command compatibility.
- `pnpm run ci` must never reset or modify the persistent local database; the sentinel must survive
  the full validation pipeline.

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
