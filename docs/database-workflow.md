# Database Workflow

**Owns:** how to operate Local / Preview / Production databases (migrations, backups, refresh,
authorization boundaries).

**Does not own:** schema ERD or entity semantics — those live in
[`docs/domains/database/overview.md`](domains/database/overview.md). Content promote/mirror vs RSVP
isolation lives in
[`docs/core/content-parity-rsvp-isolation.md`](core/content-parity-rsvp-isolation.md). See the
Ownership Matrix in [`.agent/index.md`](../.agent/index.md).

## Principle

Local development uses local Supabase. Production is the source of real customer data. Production
can be read for backups/local refreshes. Production can only be mutated through reviewed migrations.

The workflow is asymmetric:

```txt
Production -> Local: allowed for read-only refreshes and backups.
Local -> Production: allowed only for reviewed migrations.
```

## Observability projection decision

The Local-only observability dashboard reads each environment through one slug-filtered batch query
plus one migration-history query. Reconciliation stays in TypeScript and uses the durable managed
provenance/receipt baseline. All database sessions are read-only and share a hard six-invocation
budget across Local, Preview, and Production.

The current projection deliberately remains application-owned SQL rather than a database view. A
view would not reduce the one content invocation per environment, would add an independently
grantable object, and could broaden access to draft or managed-projection JSON. Introduce a view
only after measurement demonstrates a material query-plan or contract benefit. Any future view must
have explicit grants and invoker semantics where supported; any materialized view must also define
refresh ownership, maximum staleness, and failure behavior. See
[`docs/core/observability-dashboard.md`](core/observability-dashboard.md) for the wire and resource
contract.

## Required-database availability preflight

Tasks that claim cross-environment integrity, parity, reconciliation, deployment readiness, or live
database state must first verify only the targets they depend on:

```bash
pnpm db:availability:verify -- --targets local,preview,production
```

The preflight verifies target identity, bounded reachability, and server-enforced read-only mode. A
failure is evidence of `CREDENTIALS_REQUIRED`, `IDENTITY_CONFLICT`, `UNREACHABLE`, or
`READ_ONLY_ENFORCEMENT_FAILED`; it is never equivalent to an empty database or no pending change.
Dependent work stops until evidence becomes available. The observability dashboard remains usable
and reports the same condition as typed unverified coverage, because reporting unavailable state is
its job rather than a reason to conceal the snapshot.

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

Production completed the `20260729140514`/`20260729152113` cutover, so backup **creation** always
captures the standard `phase3` integrity profile; the legacy `--integrity-profile=pre-phase3`
creation flag was removed. Restore-side tooling (`disposable-restore-verify`,
`create-disposable-recovery-backup` drills) still reads the profile stored in each retained backup
manifest, so historical `pre-phase3` recovery points remain restorable and verifiable until they age
out of retention. Required Storage bytes are active Supabase-backed invitation assets plus objects
referenced by published or draft content; stale, unreferenced `storage.objects` metadata is
preserved in the metadata dump but is not misclassified as a required binary. The disposable restore
rebuilds only through the manifest's last migration, so each recovery point is tested against its
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
- **Phase 3 hosted alignment complete (2026-07-29)**: Preview was migrated and verified first, then
  Production was migrated through the guarded canonical workflow. Both environments reported all
  **67** repository migrations with `20260729152113` latest. The hosted contract verifier passed for
  both targets, including atomic Editor RPCs, managed baseline fields, append-only mutation
  receipts, and revocation of `service_role` writes to guest confirmations and guest audit/history.
- **Receipt-lock serialization (`20260730101500`)**: Atomic metadata/restore RPCs serialize on the
  invitation row and must not row-lock append-only receipts. Promote that migration through Local →
  Preview → Production; never grant receipt `UPDATE` via the dashboard to silence `42501`.
- **Public Guest RSVP Atomic RPCs (`20260730113000`, fix `20260730164613`, portable pgcrypto
  `20260730220544`)**: Public guest RSVP submission, guest auto-creation, and view telemetry
  tracking use dedicated `SECURITY DEFINER` RPCs (`submit_guest_rsvp_public` and
  `track_guest_invitation_view_public`). Hybrid create qualifies `extensions.gen_random_bytes` under
  `search_path=public` (hosted Supabase does not expose unqualified `gen_random_bytes` in `public`).
  `p_guest_comment` is an absolute SET when provided; `status_changed` audit is owned by
  `trg_guest_invitations_emit_audit`. Direct `INSERT`, `UPDATE`, and `DELETE` on protected guest
  tables remain revoked from `service_role`. Telemetry updates degrade gracefully on error so
  view-tracking issues never break the primary public invitation experience. Promote Local → Preview
  → Production.
- The Production cutover used verified EFS-encrypted pre/post DB/Auth/Storage recovery points and
  preserved migration-before-code ordering. Never infer future hosted status from this point-in-time
  record; rerun the read-only audit and `pnpm db:contract:verify -- --target <production|preview>`.
- **Migration Ownership**: All schema changes must be introduced through versioned migrations in
  `supabase/migrations/` and promoted Local → Preview → Production. Direct production SQL and manual
  dashboard privilege repairs are prohibited as a normal workflow.
- **One-Time Recovery Tool**: `scripts/db/reconcile-prod-baseline.ts` was a one-time recovery tool
  and is no longer part of the repository.

## Environments

See [`env-workflow.md`](env-workflow.md) for the canonical environment source hierarchy, variable
categories, and precedence notes.

- `.env` is for local Supabase and should point to `http://127.0.0.1:54321`.
- Local DB workflow scripts require PostgreSQL client tools. `psql` must be installed and available
  on PATH; verify with `psql --version`.
- `.env.local` must not point to production during normal development.
- Production credentials must come from shell environment variables or the single canonical
  gitignored secret file `.env.production.local` (template: `.env.production.local.example`).
- Preview credentials must come from `PREVIEW_DB_URL` or the single canonical gitignored secret file
  `.env.preview.local` (template: `.env.preview.local.example`). On the `dev-preview` worktree,
  `.env.preview.local` also supplies the Preview **application** runtime (`SUPABASE_*` /
  `PUBLIC_SUPABASE_*`) via lane bootstrap; that runtime overlay does not authorize `db:preview:*` or
  `invitation:update` mutations.
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

Managed invitation promotion follows the contract in
[`docs/core/content-parity-rsvp-isolation.md`](core/content-parity-rsvp-isolation.md):

```text
Definition → normalized release → Local → immutable package → Preview → Production
```

### Distinction: Update vs Promote vs Mirror vs Restore

| Mechanism                          | Role                                                         | Direction                                  |
| ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| `pnpm invitation:update`           | **Update** managed content on Local and/or Preview           | Definition → Local / Preview               |
| `pnpm invitation:promote`          | **Promote** managed content to Production (owner-only)       | Approved package → Production              |
| `pnpm invitation:preview-fixture`  | **Bootstrap** Preview E2E publication fixture (Preview-only) | Creates/verifies `e2e-preview-publication` |
| `pnpm db:preview:sync-invitations` | **Mirror** invitation-facing content for regression          | Production → Preview only                  |
| `pnpm db:local:restore-from-dump`  | **Restore** debugging dump (may include PII)                 | Production backup → Local                  |
| `pnpm invitation:content-parity`   | Read-only **semantic** content parity check                  | Compares Local/Preview/Production          |
| `pnpm dbs` / `pnpm dbs --compact`  | Read-only managed **status** (content + schema classifiers)  | Local / Preview / Production               |

Production never imports from the Preview DB or Preview Storage. Mirror is never promotion. Normal
`invitation:update` is Local/Preview only; use `invitation:promote` for Production managed content.
Temporary Production one-off (`romina-draft-reset`) and its retirement condition are listed in
[`.agent/rules/invitation-production.md`](../.agent/rules/invitation-production.md). Credential
presence, worktree path, runtime target, and UI banners do not authorize mutations.

### Commands

1. **Plan/update a managed definition (Local / Preview)**:

   ```bash
   pnpm invitation:update -- --slug <slug> --targets local,preview --source-dir <path> --dry-run
   pnpm invitation:update -- --slug <slug> --targets local,preview --source-dir <path> --apply
   ```

2. **Promote to Production (owner-only)**:

   ```bash
   pnpm invitation:promote -- --slug <slug> --package <path> --dry-run
   pnpm invitation:promote -- --slug <slug> --package <path> --apply --backup-manifest <path>
   ```

3. **Semantic content parity (read-only)**:
   ```bash
   pnpm invitation:content-parity -- --slug <slug> --event-type <type> --envs local,preview,production
   ```

## Preview Environment Workflow

```text
PROVISIONED & HOSTED-VALIDATED
```

- **Status & Parity**: Ephemeral Preview database environment is provisioned and hosted-validated.
  Dedicated Supabase Preview project is used for Vercel Preview deployments from `develop`.
- **Supported Credentials**: `PREVIEW_DB_URL` environment variable or the canonical secret file
  `.env.preview.local`.
- **Target Classification**: `scripts/db/db-guard.ts` classifies targets matching `PREVIEW_DB_URL`
  as `preview`.
- **Migration Command**: Canonical planner is `pnpm db:migrate -- --target preview` (alias
  `pnpm db:preview:migrate`). Defaults to **read-only preflight** against `PREVIEW_DB_URL` (dry-run
  pending set, optional `--expected` pin, and the Migration / Deployment Compatibility Contract).
  Deprecated Preview-only shims `--allowlist` / `EXPECTED_MIGRATIONS` still parse through the shared
  `--expected` parser with a warning. Mutations require explicit `--apply` plus Preview
  authorization (`CELEBRA_TASK_SCOPE=preview:schema:migrate` or interactive TTY `YES`). Hosted
  Preview fails closed without `CELEBRA_TARGET_RELEASE_SHA`. Hosted candidates without an explicit
  rollout registry phase fail closed.
- **Invitation Sync Command**: `pnpm db:preview:sync-invitations` mirrors invitation-facing data
  from Production to Preview:
  - `--dry-run`: report what would change with **zero** DB, role, profile, Storage, or report-file
    writes.
  - `--apply`: execute the sync after Preview authorization
    (`CELEBRA_TASK_SCOPE=preview:content-mirror:sync-invitations` or interactive TTY `YES`).
    Requires `PROD_DB_URL`, `PREVIEW_DB_URL`, `PREVIEW_SUPABASE_URL`,
    `PREVIEW_SUPABASE_SERVICE_ROLE_KEY`. Policy, excluded PII tables, and the Preview RSVP reset
    caused by `TRUNCATE events CASCADE` are owned by
    [`content-parity-rsvp-isolation.md`](core/content-parity-rsvp-isolation.md). After apply, re-run
    Preview E2E fixture bootstrap (`pnpm invitation:preview-fixture --apply`) then gated content
    reconcile (`pnpm test:e2e:preview:provision`) when Preview RSVP E2E needs those fixtures. Stale
    Preview-only invitation candidates are reported, not auto-pruned.
- **Audit Command**: `pnpm db:preview:audit` performs read-only schema drift audit against
  `PREVIEW_DB_URL` by comparing hosted Preview against a canonical disposable local reconstruction
  (`127.0.0.1:54332`). The audit reports the live remote/pending counts; documentation does not
  freeze a migration total.
- **Separation of Operations**: Migration, seed, and audit are separate operations.
  `pnpm db:preview:migrate` preflights by default and applies only with `--apply`; it does NOT
  automatically seed or audit.
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
pnpm release-check
pnpm db:migrate -- --target local
pnpm db:local:migrate
pnpm db:migrate -- --target preview
pnpm db:preview:migrate
pnpm db:preview:migrate -- --apply
pnpm db:migrate -- --target production
pnpm db:prod:migrate -- --expected <versions>
pnpm db:prod:migrate -- --apply --expected <versions>
pnpm db:preview:audit
pnpm db:local:audit
pnpm db:preview:sync-invitations -- --dry-run
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

### Migration / Deployment Compatibility Contract

SSOT: `scripts/db/migration-deployment-compatibility.ts` +
`supabase/migration-rollout-registry.json`. Wired into `pnpm db:migrate` (and aliases
`db:preview:migrate` / `db:prod:migrate`) via the shared orchestrator (does not replace
`--expected` pin, dry-run, backup, or contract verification).

Hosted targets prove migration membership from Git contents
(`candidate ∈ <release-sha>:supabase/migrations/`), not filename chronology. Branch name, worktree
path, UI banner, and credential presence alone never authorize hosted mutation.

```bash
# Canonical planner (default: read-only preflight)
pnpm db:migrate -- --target local|preview|production [--expected <versions>] [--json]

# Preview — read-only preflight (default)
CELEBRA_TARGET_RELEASE_SHA=<git-sha> pnpm db:preview:migrate
CELEBRA_TARGET_RELEASE_SHA=<git-sha> pnpm db:preview:migrate -- --expected <versions>

# Preview — apply after Preview authorization
CELEBRA_TASK_SCOPE=preview:schema:migrate CELEBRA_TARGET_RELEASE_SHA=<git-sha> \
  pnpm db:preview:migrate -- --apply --expected <versions>

# Production — release identity is the current clean HEAD after pnpm release-check
pnpm release-check
pnpm db:prod:migrate                                          # read-only preflight (derived pending set)
pnpm db:prod:migrate -- --expected <versions>                 # preflight with exact pin
pnpm db:prod:migrate -- --apply --expected <versions>         # owner TTY apply
```

Production apply fails closed without valid `pnpm release-check` evidence for the current clean
`HEAD`. Ordinary preflight does not run the full release suite. Preview fails closed without
`CELEBRA_TARGET_RELEASE_SHA`. Local / disposable remain free to develop against repository `HEAD`.
After any failed apply, re-run preflight and obtain a newly validated plan — do not resume from
cached assumptions. Cross-machine concurrent migrate is an accepted single-operator residual risk.

Rollout phases (registry metadata; **hosted candidates must have an explicit phase** — omission
fails closed; do not backfill already-applied historical migrations without need):

| Phase      | Meaning                                                    | Hosted rule                                                                                                                    |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `expand`   | Adds capability compatible with the currently deployed app | May run before target deployment when release membership + DB deps hold                                                        |
| `neutral`  | Does not invalidate current or target app contracts        | Normal guarded path + membership                                                                                               |
| `contract` | Removes/restricts behavior an older app relies on          | Blocked until `CELEBRA_DEPLOYED_APP_SHA` + required `CELEBRA_DEPLOYED_APP_CAPABILITIES` prove the replacement path is deployed |

Safe RSVP-class sequencing:

```text
EXPAND (RPC / portable capability)
→ deploy + verify replacement application
→ CONTRACT (revoke legacy direct DML paths)
```

When the deployed application requires a DB capability the database (including pending candidates)
does not provide, the gate reports `ENVIRONMENT NOT READY` rather than treating the environment as
healthy.

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

### Agent application identities (Local / Preview)

Agents must authenticate through normal product roles. Do not use browser `service_role`, arbitrary
DB privileges, Production access, or agent-only authorization bypasses invented for tooling.

| Environment    | Identity                                                             | Role           | Provision / repair                                                             | Used for                                                                      |
| -------------- | -------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **Local**      | First `SUPER_ADMIN_EMAILS` entry via `pnpm db:local:bootstrap-admin` | `super_admin`  | `db:local:bootstrap-admin`, `db:local:validate`                                | Login, Editor, RLS admin flows, local authenticated E2E (`PLAYWRIGHT_HOST_*`) |
| **Preview**    | `preview@preview.com`                                                | `super_admin`  | Preview mirror ownership remap; MFA bypass only via `PREVIEW_MFA_BYPASS` gates | Login, Editor, authenticated Preview E2E                                      |
| **Production** | Owner-only operators                                                 | N/A for agents | —                                                                              | Agents: dry-run / read-only; `--apply` promote is owner-only                  |

CLI provision scripts may use `service_role` in trusted server context only; that is not an
application login substitute. Host invitation flows continue to use real `host_client` users from
`invitation-host-owner`.

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
- Always captures the Phase 3 recovery contract (the legacy pre-cutover profile flag was removed;
  retained pre-cutover backups stay restorable via the profile stored in their manifests).
- Verifies project identity, capture-window coherence, object size/hash, manifest completeness, and
  critical business integrity before success.
- Creates and verifies an EFS-encrypted directory under ignored `.backups/prod/`.
- Does not schedule itself or route artifacts through any hosted system.

`pnpm db:prod:backup:daily`

- Is the deterministic once-per-24-hours entrypoint for Windows Task Scheduler.
- Runs one complete critical backup, verifies manifest/checksums and EFS encryption, records byte
  and duration metrics, and applies 30-daily/12-monthly local retention.
- Returns nonzero on capture, integrity, encryption, reporting, or retention failure.

`pnpm release-check`

- Requires a clean working tree.
- Runs `pnpm type-check`, `pnpm test`, and `pnpm build` against the full current `HEAD`.
- Writes gitignored evidence to `.agent/tmp/release-check-evidence.json` (SHA + pass metadata).
- Evidence is rejected when `HEAD` changes, the tree becomes dirty, or required checks did not pass.

`pnpm db:migrate` / `pnpm db:prod:migrate`

- Canonical schema planner:
  `pnpm db:migrate -- --target <local|preview|production|disposable-test>`. Compatibility aliases:
  `db:local:migrate`, `db:preview:migrate`, `db:prod:migrate`.
- Production commands:
  - `pnpm db:prod:migrate` — read-only preflight (derived pending set; no TTY, no writes)
  - `pnpm db:prod:migrate -- --expected <versions>` — preflight with exact pin
  - `pnpm db:prod:migrate -- --apply --expected <versions>` — owner apply path
- Shared orchestrator sequence: plan → (apply: rebuild + drift check) → beforeWrite → authorize →
  execute → verify/evidence. Human logs on stderr; `--json` plans on stdout only.
- Production apply sequence: identity → audit → dry-run (+ optional `--expected` pin) →
  compatibility (HEAD; explicit registry phase required) → valid `release-check` evidence → verified
  pre-migration backup → operation summary + exact TTY confirmation bound to release SHA, pending
  versions, and `planId` → `supabase db push` → migration-history + contract verification →
  post-migration backup.
- Release identity for Production is the current clean `HEAD` (not `CELEBRA_TARGET_RELEASE_SHA`).
- Shared owner boundary: `requireOwnerProductionApply` (also used by promote/patch/draft-reset).
- Rejects `CELEBRA_AGENT_CONTEXT`. No token, secret, env, or noninteractive confirmation
  alternative.
- `public.production_authorization_receipts` is historical inert state from migration
  `20260802090000`; no mutation path inserts into or depends on it.
- This is the only approved production **schema** mutation workflow. Content promotion and
  specialized patches are separate owner workflows that share the same authorization boundary.

`pnpm db:sql:lint -- --file <path>`

- Reads a SQL file only.
- Requires the production patch manifest documented in
  [`.agent/rules/manual-sql-manifest.md`](../.agent/rules/manual-sql-manifest.md).
- Blocks unsafe production-patch patterns including unscoped `UPDATE`/`DELETE`, `TRUNCATE`, broad
  `DROP`, `ALTER TABLE`, RLS policy changes, `SECURITY DEFINER`, and `CASCADE`.

`pnpm db:prod:patch -- --dry-run --file <path>`

- Owner-facing lint entrypoint for reviewed manual SQL patches.
- Does not open a database connection and does not execute SQL in dry-run mode.

`pnpm db:prod:patch -- --apply --owner-user-id <UUID> --file <path>`

- **Disposition: `RESTRICT_OWNER_ONLY` / `KEEP_SPECIALIZED`.**
- After owner confirmation and SQL apply, runs `pnpm db:contract:verify --target production`.
- Narrow owner-only maintenance for reviewed patches that cannot yet be expressed as versioned
  `supabase/migrations/*`. Not a bypass for `db:prod:migrate` or `invitation:promote`.
- Requires valid `pnpm release-check` evidence and interactive owner TTY confirmation bound to the
  owner UUID and patch fingerprint; it never auto-runs schema migrations.

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
`.backups/prod/`. It does not mutate production.

`pnpm db:local:restore-from-dump` is an intentional **PII-bearing debugging exception**, not content
synchronization. It may import unsanitized Production guests, intake, commercial data, and optional
Auth/Storage dumps. “Non-destructive” means no `db reset` and no overwrite of existing primary keys
(`INSERT … WHERE NOT EXISTS`) — not that the import is free of PII risk. Restored Local data must
never seed Preview. Artifacts remain under gitignored `.backups/` / `.tmp/`. Full contract:
[`content-parity-rsvp-isolation.md`](core/content-parity-rsvp-isolation.md).

If schema drift is detected during staging import, the script stops and reports the failure. Do not
patch around drift manually; add or apply the missing migration locally.

### Refresh local while preserving local-only data

There is no dedicated runnable preserve-refresh command yet. Use the supported backup/restore path
above. Existing local primary keys are preserved rather than overwritten. Schema drift or
incompatible data stops the import. The broader preserve-bundle workflow remains blocked pending a
guarded implementation; see `.agent/plans/active/preserve-local-refresh-workflow.md`.

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
pnpm release-check
PROD_DB_URL=... pnpm db:prod:migrate -- --expected <versions>
PROD_DB_URL=... pnpm db:prod:migrate -- --apply --expected <versions>
```

This is the only workflow allowed to mutate production **schema**. Preflight is read-only. Apply
requires release-check evidence, a verified backup, and exact interactive TTY confirmation. It never
pushes local data dumps.

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
- Do not run removed one-shot ops commands (`adopt-legacy-events`, `new-invitation`,
  `optimize-assets`); they are no longer registered. Use managed invitation workflows and reviewed
  versioned migrations / specialized owner patches instead.
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
