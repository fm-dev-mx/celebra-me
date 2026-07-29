# Database Workflow

**Owns:** how to operate Local / Preview / Production databases (migrations, backups, refresh,
authorization boundaries).

**Does not own:** schema ERD or entity semantics — those live in
[`docs/domains/database/overview.md`](domains/database/overview.md). See the Ownership Matrix in
[`.agent/index.md`](../.agent/index.md).

## Principle

Local development uses local Supabase. Production is the source of real customer data. Production
can be read for backups/local refreshes. Production can only be mutated through reviewed migrations.

The workflow is asymmetric:

```txt
Production -> Local: allowed for read-only refreshes and backups.
Local -> Production: allowed only for reviewed migrations.
```

## Production backup and recovery authority

The repository owner (or explicitly delegated Production operator) owns backup creation, access,
restore authorization, and drills. While Production remains on the Supabase Free plan, the temporary
targets are catastrophic-loss RPO ≤24 hours and RTO ≤4 hours. Every planned Production mutation also
requires a complete verified recovery point immediately before the mutation and another after schema
contract verification. Supabase documents managed daily backups only for Pro, Team, and Enterprise;
Free projects must maintain their own exports. No managed backup, PITR, hosted backup service, or
off-machine recovery point is claimed. See
[Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).

The independent critical set comprises the public database (including invitation, RSVP, publication,
provenance, and operation receipts), Auth reconstruction data, Storage metadata, and actual critical
Storage object bytes. A DB dump or `storage.objects` rows alone are incomplete. Artifacts stay in
encrypted, access-restricted local storage outside Git, retaining the newest 30 daily recovery
points plus one point from each of the newest 12 older calendar months.

`pnpm db:prod:backup:critical` captures the complete set read-only, verifies Production DB/API/
Storage/credential identity, downloads actual object bytes, rejects a changing capture window, and
writes a SHA-256 manifest only after all checks pass. It requires `PROD_DB_URL`,
`PROD_SUPABASE_URL`, and `PROD_SUPABASE_SERVICE_ROLE_KEY` from the shell or approved ignored secret
files. Incomplete output is removed. `pnpm db:backup:verify-manifest -- --manifest=<path>` rejects
missing, empty/truncated, size-mismatched, or checksum-mismatched artifacts.

`pnpm db:prod:backup:daily` is the canonical unattended command for the local operator machine's OS
scheduler. It runs the same critical capture once, verifies the manifest and Windows EFS encryption,
applies retention, and writes an encrypted JSON report under `.backups/prod/reports/`. The report
records start/end/recovery-point timestamps, outcome, duration, bytes for database, Auth, Storage
metadata, and Storage object bytes, total downloaded bytes, total backup size, a 30-run monthly
egress estimate, manifest verification, retention results, and the retained path. A nonzero exit is
a failed backup. The command is intentionally absent from CI, builds, deployments, application code,
and ordinary development/test workflows.

For the `20260729140514`/`20260729152113` cutover, pass `-- --integrity-profile=pre-phase3` before
migration. This profile records the exact hosted migration list, fingerprints the 18 critical tables
available in the predecessor schema, and does not pretend the not-yet-created receipt table exists.
Required Storage bytes are active Supabase-backed invitation assets plus objects referenced by
published or draft content; stale, unreferenced `storage.objects` metadata is preserved in the
metadata dump but is not misclassified as a required binary. The disposable restore rebuilds only
through the manifest's last migration, so the pre-migration recovery point is tested against its
real schema rather than today's latest schema.

Windows Task Scheduler owns the once-per-24-hours trigger; the repository owns capture, validation,
reporting, exit status, and retention. The operator must review the newest report and the age of the
latest valid point after a missed or failed run. The local directory is protected with Windows EFS
AES-256 encryption restricted to the operator account. There is no EFS recovery certificate and the
backup remains on the same machine as the operator workflow. This protects against logical/data
failure and accidental disclosure at rest, but **is not an independent disaster-recovery failure
domain**: machine loss, disk loss, or EFS-key loss can destroy both the operating workflow and its
backups. Never place `.backups/` in Git, application logs, or CI artifacts.

Restores are disposable-only, never Production. Run
`pnpm db:restore:verify-disposable -- --manifest=<path> --target-db-url=<disposable-url> --report=<path> --storage-root=<new-empty-path>`.
The workflow rebuilds all migrations, restores public/Auth/Storage metadata, materializes and
re-hashes actual object bytes, compares deterministic critical-table and business-state
fingerprints, checks RSVP/ownership/orphan/uniqueness/phone invariants, and writes
restore/verification/total timings. A synthetic complete set can be created with
`pnpm db:backup:create-disposable-fixture -- --output-dir=<path>`.

The 2026-07-29 Production-derived pre-migration drill restored 65 migrations, 18 applicable critical
table fingerprints, 17 Auth users and identities, and 43 required Storage objects in 7,359 ms, with
every relationship/business invariant at zero and all object hashes matching. The disposable
database was reset to synthetic data and materialized Production-derived files were removed
afterward. This demonstrates RTO ≤4 hours for the current Production data scale and proves the
one-time recovery point. The daily OS schedule and newest successful report establish ongoing RPO
evidence; the operator must treat a latest-valid-backup age over 24 hours as a blocking incident.

### Free-tier recovery monitoring

Use current provider dashboards for volatile quota limits rather than copying numeric limits here.
At least once per backup review, record or inspect Supabase uncached egress, Storage usage, database
size, downloaded bytes per recovery point, projected monthly backup egress, age of the latest valid
backup, date of the latest successful restore drill, and restore duration. Measure real daily runs
before considering incremental Storage capture. Backups never route through Vercel and must not poll
Production or download an object more than once within one recovery operation.

## Production Reconciliation Status (point-in-time)

- **Reconciliation Complete**: Production migration-history reconciliation is complete.
- The repository contained **67** versioned migration files at the 2026-07-29 audit. Production and
  Preview each reported 65 applied migrations and lacked `20260729140514` and `20260729152113`.
  Never infer current hosted status from these recorded counts; rerun the read-only audit and
  `pnpm db:contract:verify -- --target <production|preview>`.
- **Migration Ownership**: All schema changes must be introduced through versioned migrations in
  `supabase/migrations/`. Direct production SQL is prohibited as a normal workflow.
- **One-Time Recovery Tool**: `scripts/db/reconcile-prod-baseline.ts` was a one-time recovery tool
  and is no longer part of the repository.

## Environments

See [`env-workflow.md`](env-workflow.md) for the canonical environment source hierarchy, variable
categories, and precedence notes.

- `.env` is for local Supabase and should point to `http://127.0.0.1:54321`.
- Local DB workflow scripts require PostgreSQL client tools. `psql` must be installed and available
  on PATH; verify with `psql --version`.
- `.env.local` must not point to production during normal development.
- Production credentials must come from shell environment variables or gitignored secret files such
  as `.env.production.local`, `.env.prod.local`, `.secrets/prod-db-url`, or
  `.tmp/secrets/prod-db-url`.
- Preview credentials must come from `PREVIEW_DB_URL` or gitignored secret files such as
  `.env.preview.local`, `.env.preview`, `.secrets/preview-db-url`, or `.tmp/secrets/preview-db-url`.
- `.tmp/` and `.backups/` are never committed.
- Never print or paste a full production or preview connection string in logs, docs, issues, or
  chat.

## Local Endpoints

For local development and testing, the explicit endpoints are:

```text
Supabase API:         http://127.0.0.1:54321
Local PostgreSQL:     127.0.0.1:54322
Disposable PostgreSQL: 127.0.0.1:54332
```

## Canonical Invitation Promotion Workflow

The promotion of an invitation follows a strict, safe, and reproducible pipeline:

```text
Definition -> normalized release -> Local -> immutable package -> Preview approval -> Production continuation
```

### Distinction: Promotion vs. Production-to-Preview Mirror

- **Invitation update (`pnpm invitation:update`)**: Moves an immutable, versioned invitation package
  from Local -> Preview -> Production. Preview is a validation environment only; Production NEVER
  imports directly from the Preview DB or Storage.
- **Production-to-Preview Mirror (`pnpm db:preview:sync-invitations`)**: An independent, separate
  tool that mirrors published invitations from Production -> Preview for regression testing. It
  remains unchanged.

### Commands

1. **Plan/update a managed definition**:
   ```bash
   pnpm invitation:update -- --slug <slug> --targets local,preview --source-dir <path> --dry-run
   pnpm invitation:update -- --slug <slug> --targets local,preview --source-dir <path> --apply
   pnpm invitation:update -- --slug <slug> --targets production --dry-run
   pnpm invitation:update -- --slug <slug> --targets production --apply
   ```

## Preview Environment Workflow

```text
PROVISIONED & HOSTED-VALIDATED
```

- **Status & Parity**: Ephemeral Preview database environment is provisioned and hosted-validated.
  Dedicated Supabase Preview project is used for Vercel Preview deployments from `develop`.
- **Supported Credentials**: `PREVIEW_DB_URL` environment variable or secret files
  (`.env.preview.local`, `.env.preview`, `.secrets/preview-db-url`, `.tmp/secrets/preview-db-url`).
- **Target Classification**: `scripts/db/db-guard.ts` classifies targets matching `PREVIEW_DB_URL`
  as `preview`.
- **Migration Command**: `pnpm db:preview:migrate` applies pending migrations to `PREVIEW_DB_URL`.
- **Invitation Sync Command**: `pnpm db:preview:sync-invitations` mirrors invitation-facing data
  from Production to Preview:
  - `--dry-run`: report what would change without mutating.
  - `--apply`: execute the sync (requires `PROD_DB_URL`, `PREVIEW_DB_URL`, `PREVIEW_SUPABASE_URL`,
    `PREVIEW_SUPABASE_SERVICE_ROLE_KEY`).
- **Audit Command**: `pnpm db:preview:audit` performs read-only schema drift audit against
  `PREVIEW_DB_URL` by comparing hosted Preview against a canonical disposable local reconstruction
  (`127.0.0.1:54332`). The audit reports the live remote/pending counts; documentation does not
  freeze a migration total.
- **Separation of Operations**: Migration, seed, and audit are separate operations.
  `pnpm db:preview:migrate` applies migrations only and does NOT automatically seed or audit.
- **Expected Failure Mode**: If Preview credentials are unconfigured or unavailable, Preview
  commands fail closed with exit code `1`.
- **Synthetic Data & Privacy**: Preview must use isolated synthetic data
  (`supabase/test/seed-test-data.sql` or synthetic test fixtures) for non-invitation operational
  data. Production customer data must NEVER be copied into Preview.
- **Invitation Content Exception**: Preview MAY mirror invitation-facing production content (names,
  dates, locations, photographs) required for regression testing. The following categories remain
  prohibited:
  - Guest and RSVP data (`guest_invitations`, `guest_invitation_audit`)
  - Auth users, credentials, sessions, MFA factors
  - Intake submissions (`intake_requests`, `intake_submissions`)
  - Audit logs
  - Commercial/tracking data (`visitor_sessions`, `commercial_attribution_identity`,
    `commercial_analytics`)
  - Claim codes (`event_claim_codes`)
  - RSVP tables (`rsvp_records`, `rsvp_audit_log`, `rsvp_channel_log`)
- **Ownership Remapping**: Copied invitations and events are owned by `preview@preview.com` (the
  dedicated Preview admin). Real Production auth users are never copied.
- **Storage Mirroring**: Asset binaries from `invitation-assets` bucket are copied to Preview
  Storage. URLs in mirrored JSON content are rewritten from Production Storage host to Preview
  Storage host.

## Common Commands

```bash
pnpm db:local:restore-from-dump --dump <path>
pnpm db:local:backup-wip
pnpm db:local:bootstrap-admin
pnpm db:local:validate
pnpm db:disposable:reset
pnpm db:validate:pipeline
pnpm db:prod:backup
pnpm db:prod:audit
pnpm db:branch:parity -- --base <ref> --head <ref>
pnpm db:prod:migrate
pnpm db:preview:migrate
pnpm db:preview:audit
pnpm db:prod:patch -- --file <path>
pnpm db:sql:lint -- --file <path>
```

### Branch-lane database-parity audit

[`branch-lane`](../.agent/skills/branch-lane/SKILL.md) is the user entry point. It always runs
branch parity for the lane range and **automatically** invokes
[`.agent/skills/database-parity/SKILL.md`](../.agent/skills/database-parity/SKILL.md) when
`requiresParityAudit` is true or migration identity fails.

```bash
pnpm db:branch:parity -- --base origin/main --head origin/develop --json
```

Machine-readable fields include `identityStatus`, `sensitiveChanges`, `sensitiveFiles`, `findings`,
and `requiresParityAudit`. Exit `0` means the analysis is trustworthy even when parity routing is
required; exit `≠0` means invalid input, technical failure, or identity violation.

Healthy database-sensitive changes are **not** CLI failures — they route to `database-parity`.
Applied migration content mutation is `Hard blocked` and must never be accepted as an exception
(restore original file + corrective migration).

`branch-lane` / `database-parity` must exhaust safe **read-only** diagnosis (including
persistent-local vs disposable drift classification via `pnpm db:branch:diagnose`) before asking for
decisions or authorization. When diagnosis concludes the disposable reference is stale, **verified
disposable remediation** (`pnpm db:branch:remediate-disposable` → `pnpm db:disposable:reset`) is an
automated disposable-only write — not read-only — and must not target persistent-local, Preview, or
Production. Unverified rebuild targets are `Hard blocked`. Preview / Production / persistent-local
writes still require explicit authorization. Git-only promote while remotes lack required migrations
is `Hard blocked` unless compatibility is demonstrated.

Resumable evidence (SHAs/hashes only; no credentials):

- Checkpoint: `.agent/tmp/branch-lane-checkpoint.json` — partial read-only progress
- Clearance: `.agent/tmp/branch-lane-clearance.json` — write-ready gate

Stale fingerprints invalidate automatically and re-run affected checks.

Complete remote audits via `pnpm db:local:audit` / `db:preview:audit` / `db:prod:audit` when
credentials resolve. Production migration safety creates a complete DB/Auth/Storage recovery point
with the explicit predecessor integrity profile immediately before mutation. After applying
migrations and verifying the application schema contract, `pnpm db:prod:migrate` creates the
complete Phase 3 recovery point again under the current profile. Preview is never a Production
backup.

### Blocked refresh aliases

`db:local:refresh-from-prod` and `db:local:refresh-from-prod-preserve-local` remain in
`package.json` only as fail-closed safety rails. They print a blocked-operation message and exit
with a failure. They are not runnable refresh workflows and must not be bypassed with direct
Supabase commands.

Use `pnpm db:prod:backup` followed by `pnpm db:local:restore-from-dump` for a non-destructive
import. The unresolved preserve-local enhancement remains tracked in
`.agent/plans/active/preserve-local-refresh-workflow.md`.

`pnpm db:local:backup-wip`

- Dumps selected risky local `public` tables under `.tmp/db/local-wip/`.
- Does not touch production.
- Does not include Supabase Storage binaries.
- Does not include a full auth snapshot.
- Use before refresh only when local draft/editor work needs manual recovery insurance.

`pnpm db:local:bootstrap-admin`

- Connects only to local Supabase.
- Creates or updates the first `SUPER_ADMIN_EMAILS` user as the local super admin.
- Reads the password from `LOCAL_SUPER_ADMIN_PASSWORD || RSVP_ADMIN_PASSWORD`.
- Ensures `auth.users.raw_app_meta_data.role = 'super_admin'`, upserts
  `public.app_user_roles.role = 'super_admin'`, and verifies password login.
- Use for initial local setup or to repair the local admin without resetting the database.

`pnpm db:local:validate`

- Checks local Supabase URL, required tables, auth relationships, local super-admin login, and the
  asset library empty state.
- Validates the `invitation-assets` bucket registration, but does not enforce strict
  `invitation_assets` row parity because Storage binaries are not copied.
- Does not touch production.
- Does not mutate production.
- Use after `supabase start`, local migration/import operations, and before debugging data-dependent
  flows.

`pnpm db:prod:backup`

- Reads production `public` data and writes a timestamped dump under `.backups/prod/`.
- Touches production read-only.
- Does not mutate production.
- Use before migration windows or whenever a manual protected backup is needed.
- Backups contain real customer data and must not be committed.

`pnpm db:prod:backup:critical`

- Reads Production only and creates the complete public/Auth/Storage metadata/object-byte set.
- Defaults to the Phase 3 recovery contract; `-- --integrity-profile=pre-phase3` is the guarded
  predecessor mode for the two-migration cutover only.
- Verifies project identity, capture-window coherence, object size/hash, manifest completeness, and
  critical business integrity before success.
- Creates and verifies an EFS-encrypted directory under ignored `.backups/prod/`.
- Does not schedule itself or route artifacts through any hosted system.

`pnpm db:prod:backup:daily`

- Is the deterministic once-per-24-hours entrypoint for Windows Task Scheduler.
- Runs one complete critical backup, verifies manifest/checksums and EFS encryption, records byte
  and duration metrics, and applies 30-daily/12-monthly local retention.
- Returns nonzero on capture, integrity, encryption, reporting, or retention failure.

`pnpm db:prod:migrate`

- Runs `pnpm type-check`, `pnpm test`, `pnpm build`, and `supabase migration list`.
- Creates and verifies a complete predecessor-profile recovery point first, then creates a complete
  Phase 3 recovery set after contract verification.
- Applies pending Supabase migrations only.
- Mutates production and requires explicit confirmation.
- This is the only approved production mutation workflow.

`pnpm db:sql:lint -- --file <path>`

- Reads a SQL file only.
- Requires the production patch manifest documented in
  [`.agent/rules/manual-sql-manifest.md`](../.agent/rules/manual-sql-manifest.md).
- Blocks unsafe production-patch patterns including unscoped `UPDATE`/`DELETE`, `TRUNCATE`, broad
  `DROP`, `ALTER TABLE`, RLS policy changes, `SECURITY DEFINER`, and `CASCADE`.

`pnpm db:prod:patch -- --file <path>`

- Dry-run lint only.
- Does not open a database connection and does not execute SQL.
- Exists so production patches have one fail-closed entrypoint while the full execution harness is
  still intentionally deferred.

## Workflows

### Daily local development

```bash
pnpm db:start
pnpm dev
pnpm db:local:validate
```

### Refresh local from production (BLOCKED — use restore-from-dump)

`pnpm db:local:refresh-from-prod` is blocked — it calls `supabase db reset` which destroys the
persistent-local database. Use the following two-step workflow instead:

```bash
PROD_DB_URL=... pnpm db:prod:backup
pnpm db:local:restore-from-dump --dump <path-to-dump>
pnpm db:local:validate
```

`pnpm db:prod:backup` reads production `public` data and writes a timestamped dump under
`.backups/prod/`. It does not mutate production. `pnpm db:local:restore-from-dump` imports the dump
into the persistent-local database using a staging schema, with `INSERT...WHERE NOT EXISTS`
semantics — existing local data is preserved, not overwritten.

If schema drift is detected during staging import, the script stops and reports the failure. Do not
patch around drift manually; add or apply the missing migration locally.

### Refresh local while preserving local-only data

There is no dedicated runnable preserve-refresh command yet. The current restore script is
non-destructive: it imports through a staging schema and inserts rows that do not already exist. Use
the supported backup/restore path:

```bash
PROD_DB_URL=... pnpm db:prod:backup
pnpm db:local:restore-from-dump --dump <path-to-dump>
pnpm db:local:validate
```

Existing local rows are preserved rather than overwritten. Schema drift or incompatible data stops
the import. The broader preserve-bundle workflow is still blocked pending a guarded implementation;
see `.agent/plans/active/preserve-local-refresh-workflow.md`.

### Preserve local WIP before refresh

```bash
pnpm db:local:backup-wip
PROD_DB_URL=... pnpm db:prod:backup
pnpm db:local:restore-from-dump --dump <path-to-dump>
```

This backup is manual, partial, and intended for recovery reference only. It includes selected local
public tables such as drafts, intake rows, invitations, and `invitation_assets` metadata. It does
not include Supabase Storage binaries or a full auth snapshot.

### Reset local only (BLOCKED — use disposable-test)

The persistent local database (`celebra-me-rsvp`) is protected state. It must never be reset by
project workflows or automated agents.

The `db:local:reset` alias is a fail-closed safety rail that always exits with an error.
`db:local:reset:force` does not exist. Neither name is a runnable workflow.

To perform destructive database testing (migration tests, schema drops, truncate, rollback), use the
isolated disposable test environment:

```bash
pnpm db:disposable:reset         # Reset the disposable database (destructive)
tsx scripts/db/disposable-test-env.ts cleanup # Full disposable cleanup
```

The disposable environment runs on port 54332 with a separate Docker container and synthetic test
data only. It cannot affect the persistent local database.

### Bootstrap or repair the local admin

```bash
pnpm db:local:bootstrap-admin
```

To bootstrap or repair the local admin without resetting the persistent database, run the command
above. The first `SUPER_ADMIN_EMAILS` entry must be `celebra.me.com@gmail.com`. The password must be
set in `LOCAL_SUPER_ADMIN_PASSWORD` or `RSVP_ADMIN_PASSWORD`. Do not hardcode real passwords in
source code.

### Backup production

```bash
PROD_DB_URL=... pnpm db:prod:backup
```

Backups contain real customer data. Keep them only in gitignored storage, rotate them manually, and
delete them when they are no longer needed.

For schema-only:

```bash
PROD_DB_URL=... pnpm db:prod:backup -- --schema-only
```

### Push migrations to production

```bash
PROD_DB_URL=... pnpm db:prod:migrate
```

This is the only workflow allowed to mutate production. It runs preflight checks, creates a backup
first, applies migrations only, and never pushes local data dumps.

### Check a manual production patch

```bash
pnpm db:prod:patch -- --file scripts/manual/production-patches/<script>.sql
```

This command only validates the manifest and SQL safety rules. It does not execute the patch. A
production patch file without the [required manifest](../.agent/rules/manual-sql-manifest.md) is
blocked.

## Never Do This

- Do not restore local DB dumps into production.
- Do not commit production dumps, secrets, passwords, or DB URLs.
- Do not put production credentials in `.env.local`.
- Do not use production as the default target for local development.
- Do not mutate production during local refresh.
- Do not run `pnpm db:push`; it is blocked because raw Supabase push can target a linked remote.
- Do not run `pnpm db:local:reset` — it is blocked. Use `pnpm db:disposable:reset` for destructive
  tests.
- Do not run `pnpm db:local:refresh-from-prod` or `pnpm db:local:refresh-from-prod-preserve-local` —
  these are blocked because they call `supabase db reset`. Use `pnpm db:prod:backup` +
  `pnpm db:local:restore-from-dump` instead.
- Do not run `supabase db reset --local --yes` directly — this destroys the persistent local
  database.
- Do not delete persistent Docker volumes (`supabase_db_celebra-me-rsvp`).
- Do not run `docker compose down -v` for the persistent Supabase project.
- Do not run `pnpm ops adopt-legacy-events`; it is disabled because it can create invitations and
  patch events with the service role.
- Do not run ad-hoc `supabase db push --linked` outside the approved migration workflow.
- Do not run `supabase link` casually.

## Troubleshooting

- `psql` missing or not found: install PostgreSQL client tools, make sure `psql` is on PATH, and
  verify with `psql --version`. Local DB scripts cannot validate, back up WIP, or import refresh
  data without it.
- Login fails locally: run `pnpm db:local:validate`; then verify `SUPER_ADMIN_EMAILS` and
  `RSVP_ADMIN_PASSWORD` or `LOCAL_SUPER_ADMIN_PASSWORD` are local values.
- `PGRST205` table-not-found errors: run `pnpm db:local:restore-from-dump --dump <path>` using a
  valid production dump, or use the disposable environment for schema testing.
- Local schema drift: refresh stops during staging import/copy. Apply missing local migrations or
  add a reviewed migration; do not hand-edit production dumps.
- Missing `PROD_DB_URL`: export it in the shell or place it in a gitignored secret file. Never store
  it in `.env.local`.
- Broken Storage assets: `invitation_assets` metadata can refresh from production, but actual
  Storage objects are not copied by the DB dump. Re-upload or sync Storage separately through a
  reviewed, read-only-first process.
- Restore/import failures: keep the dump under `.tmp/db/`, read the first SQL error, fix the schema
  mismatch through migrations, and rerun the restore.
