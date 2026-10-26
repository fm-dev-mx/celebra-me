# Database Workflow

Use the five-operation command/evidence map in
[`docs/core/release-process.md`](core/release-process.md#canonical-operation-map) before this
domain-specific procedure.

**Owns:** how to operate Local / Preview / Production databases (migrations, backups, refresh,
authorization boundaries).

**Does not own:** schema ERD or entity semantics — those live in
[`docs/domains/database/overview.md`](domains/database/overview.md). Content promote/mirror vs RSVP
isolation lives in
[`docs/core/content-parity-rsvp-isolation.md`](core/content-parity-rsvp-isolation.md). Concise
operator cards live in
[`docs/domains/database/cheatsheets/README.md`](domains/database/cheatsheets/README.md). See the
Ownership Matrix in [`.agent/ownership.yaml`](../.agent/ownership.yaml).

## Principle

Local development uses local Supabase. Production is the source of real customer data. Production
can be read for backups/local refreshes. Production **schema and managed invitation content** may be
mutated only through owner-only `pnpm prod:apply` (delegates to
`pnpm db:migrate -- --target production` and the invitation promotion orchestrator). Specialized DML
is linted by `pnpm db:prod:patch -- --dry-run` and can mutate only through
`pnpm prod:apply -- --patch`.

The workflow is asymmetric:

```txt
Production -> Local: allowed for read-only refreshes, backups, and debug dump restore (not sync).
Local -> Production (schema): reviewed migrations only.
Local/Preview package -> Production (content): owner-only pnpm prod:apply only.
Preview -> Production: forbidden for DB/Storage content copy.
```

### Platform principle and runtime-to-database mapping

Moving the application between hosts changes where it runs, not where the data lives. All database
targets stay on Supabase under the guards above, and the server reaches Supabase only over HTTPS
`fetch` (PostgREST, Auth, Storage, RPC), so no driver, pooler or Hyperdrive is needed. Hosted
identity is enforced by `src/lib/server/deploy-identity.ts`.

| Runtime                                        | Database target                         | Identity enforcement                                                                                                                                |
| ---------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local `astro dev` / `astro preview` on workerd | persistent-local (`127.0.0.1:54321`)    | `local` only for a loopback Supabase URL; lane bootstrap writes a gitignored `.dev.vars` from the lane env instead of mutating Node's `process.env` |
| Preview Worker (`env.preview`)                 | Preview project                         | `CELEBRA_DEPLOY_ENV=preview` plus project-ref check (`SUPABASE_PROJECT_REFS.preview`); a mismatch throws                                            |
| Production Worker                              | Production project                      | `CELEBRA_DEPLOY_ENV=production` plus the Production project ref                                                                                     |
| Jest, pgTAP, migration CLIs, backups           | disposable-test and the guarded targets | Run in Node; the hosting platform does not affect them                                                                                              |

Operating rules around any host or routing change:

- Close the pending migration chain first, and run no migration while two builds of the same SHA can
  serve the same database. Both builds must share one schema so a rollback stays a routing change.
- Run no contract migration between a change of host and the first trusted smoke from the new
  pipeline, because the contract gate reads that evidence.
- Exactly one platform runs the database-writing cron jobs (memories cleanup, engagement snapshots
  and anonymization) at a time.
- Run `pnpm db:prod:backup:critical` before the change and before each guarded data step.
- Supabase Auth Site URL and Redirect URLs live in the Supabase dashboard, not in the repository;
  list the current hosts there and remove hosts of a retired platform.
- Applied migrations are immutable: editing one breaks the migrator digest check
  (`APPLIED_VERIFICATION_FAILED`), so retired-provider guards exclude `supabase/migrations/`.
- No schema redesign rides with a platform change: it would make any regression impossible to
  attribute.

### Candidate follow-ups (separate programs, owner approval each)

| Candidate                                                                                                                          | Value                                                                                | Note                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Move the legacy Supabase-Storage assets (bucket `invitation-assets`, provider `supabase`) to R2                                    | One media store, one provider value, simpler Local setup (R2 local through wrangler) | Needs its own inventory of rows and objects                                                                       |
| Drop the retired media provider value from the `invitation_assets.provider` constraint (contract), once no row and no code uses it | Smaller schema                                                                       | After a smoke-checked Production deploy; regenerate `release-hash-baseline.json` when package hashes change       |
| Retire the `valentina_*` memories-catalog objects and deduplicate the "latest published" SQL                                       | Smaller schema                                                                       | Verify each is still present first; each keeps its own owner gate                                                 |
| D1, Hyperdrive or leaving Supabase                                                                                                 | None found                                                                           | Auth, RLS, RPCs, Storage and the guarded migration tooling depend on Supabase; a move adds risk with no reduction |

## Canonical status projection decision

`pnpm dbs` runs one evidence pipeline. Each refresh uses one `StatusProbeSession` and, per
environment, at most one content SQL family plus one migration-history probe. Canonical
classification stays in TypeScript. Diagnostics may request the heavier content payload of the same
SQL family; they never run a second content query in the same cycle and never override publication,
schema, or readiness.

The same view includes the active manual-patch catalog. These detectors add one bounded
`@dry-run-query` count per targeted patch/environment (Production only for the current catalog), in
the existing read-only session. `NOT_NEEDED` is a live zero-row result, not proof of application;
`PENDING` is a positive count within the manifest range and `BLOCKED` is an invalid manifest or
out-of-range count. A patch refresh is an independent `domain=patch` merge and does not discard
schema/content evidence from other environments. Canonical status schema v3 separates a deployment
requirement from evidence that the requirement is satisfied; older status caches are rejected and
rebuilt rather than coerced.

The default `pnpm dbs` text is an operator sequence, not an apply runner. It prints only actionable
or unverified controls and orders them as preparation/backup, required code deployment, schema, data
patches, publication, and verification. Commands are cyan in an ANSI-capable TTY and remain plain,
complete, and copyable when `NO_COLOR` is set or output is redirected. A Production patch always
shows lint/dry-run, owner plan, owner apply, and residual verification separately. A hosted contract
migration reports a prior deployment only when the rollout registry declares required app
capabilities; missing registry or deployment evidence is `UNVERIFIED`. The repository has no
canonical deployment command, so `dbs` never invents one. Production apply remains an independent
owner/TTY decision even when deployment and smoke evidence are valid. Interactive commands wider
than the terminal use a shell-valid continuation marker (PowerShell backtick on Windows, backslash
on POSIX); redirected and JSON output retain the canonical one-line command. `--json` is validated
as the canonical v3 view plus its typed `operationalPlan`.

The current projection remains application-owned SQL rather than a database view. A view would not
reduce the one content invocation per environment, would add an independently grantable object, and
could broaden access to draft or managed-projection JSON. Introduce a view only after measurement
demonstrates a material query-plan or contract benefit.

## Required-database availability preflight

Tasks that claim cross-environment integrity, parity, reconciliation, deployment readiness, or live
database state must first verify only the targets they depend on:

```bash
pnpm db:availability:verify -- --targets local,preview,production
```

The preflight verifies target identity, bounded reachability, and server-enforced read-only mode. A
failure is evidence of `CREDENTIALS_REQUIRED`, `IDENTITY_CONFLICT`, `UNREACHABLE`, or
`READ_ONLY_ENFORCEMENT_FAILED`; it is never equivalent to an empty database or no pending change.
Dependent work stops until evidence becomes available. `pnpm dbs` still reports the same condition
as typed `UNVERIFIED` evidence, because reporting unavailable state is its job rather than a reason
to conceal the view.

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

Production backup **creation** always captures the standard `phase3` integrity profile. Restore-side
tooling (`disposable-restore-verify`, `create-disposable-recovery-backup` drills) reads the profile
stored in each retained backup manifest, so older `pre-phase3` recovery points remain restorable and
verifiable until they age out of retention. Required Storage bytes are active Supabase-backed
invitation assets plus objects referenced by published or draft content; stale, unreferenced
`storage.objects` metadata is preserved in the metadata dump but is not misclassified as a required
binary. The disposable restore rebuilds only through the manifest's last migration, so each recovery
point is tested against its real schema rather than today's latest schema.

Windows Task Scheduler owns the once-per-24-hours trigger; the repository owns capture, validation,
reporting, exit status, and retention. The operator must review the newest report and the age of the
latest valid point after a missed or failed run. The local directory is protected with Windows EFS
AES-256 encryption restricted to the operator account. There is no EFS recovery certificate and the
backup remains on the same machine as the operator workflow. This protects against logical/data
failure and accidental disclosure at rest, but **is not an independent disaster-recovery failure
domain**: machine loss, disk loss, or EFS-key loss can destroy both the operating workflow and its
backups. Never place `.backups/` in Git, application logs, or CI artifacts. The off-site copy below
is the independent failure domain.

#### Off-site copy (Cloudflare R2)

After the daily capture verifies its manifest, and before local retention runs, the job packs the
manifest plus every artifact into one bundle, encrypts it with [age](https://age-encryption.org) for
the public key in `PROD_OFFSITE_AGE_RECIPIENT`, and uploads it to the R2 bucket named by
`PROD_OFFSITE_R2_BUCKET` as `daily/<YYYY-MM-DD>/critical-<recovery point>.bundle.age`. The upload
never overwrites a key (`If-None-Match: *`) and re-reads the stored size. Settings live in
gitignored `.env.production.local` next to `PROD_DB_URL`:

| Variable                            | Value                                                      |
| ----------------------------------- | ---------------------------------------------------------- |
| `PROD_OFFSITE_R2_ACCOUNT_ID`        | Cloudflare account id (32 hex characters)                  |
| `PROD_OFFSITE_R2_BUCKET`            | Bucket name                                                |
| `PROD_OFFSITE_R2_ACCESS_KEY_ID`     | R2 API token Access Key ID (Object Read & Write, 1 bucket) |
| `PROD_OFFSITE_R2_SECRET_ACCESS_KEY` | R2 API token Secret Access Key                             |
| `PROD_OFFSITE_AGE_RECIPIENT`        | age public key (`age1...`)                                 |

With none set, the daily report records `offsite.status = "not_configured"` and the job still
succeeds; a partial set, an upload failure, or a size mismatch fails the run with
`failureCode = "offsite_copy_failed"` and skips local retention.

Key custody: the operator machine holds only the public key, which can encrypt but never decrypt.
`pnpm db:offsite:keygen -- --out=<path outside the repository>` writes the private identity file and
prints the public key; the owner stores the identity in a password manager plus a paper copy and
removes the file from the machine. Losing the identity makes every off-site copy unreadable.

The bucket owns retention and deletion protection; the repository never deletes objects:

- an object lifecycle rule deletes objects older than 30 days (R2 removes them within about 24 hours
  of expiry);
- a Bucket Lock rule on the `daily/` prefix retains each object for 30 days, so neither the upload
  token nor a dashboard user can delete or overwrite a recovery point early. Lock rules take
  precedence over lifecycle rules, and a locked bucket cannot be emptied until the rule is removed.

Restore from R2 (disposable target only):

1. `pnpm db:offsite:list` (or `-- --prefix=test`) shows the available copies, newest first.
2. `pnpm db:offsite:restore -- --identity=<identity file> [--key=<object key>]` downloads the newest
   (or the named) copy, decrypts it, verifies every checksum, and writes the bundle into an empty
   EFS-encrypted directory under ignored `.tmp/offsite-restore/` with a manifest that points at the
   extracted files.
3. Run the `pnpm db:restore:verify-disposable` command the restore prints.

Drills use a synthetic set and the `test/` prefix, never Production data:
`pnpm db:backup:create-disposable-fixture -- --output-dir=<path>`, then
`pnpm db:offsite:upload -- --manifest=<path>/manifest.json --prefix=test`, then steps 2–3 with the
printed `test/` key.

Restores are disposable-only, never Production. Run
`pnpm db:restore:verify-disposable -- --manifest=<path> --report=<path> --storage-root=<new-empty-path>`.
`--target-db-url` defaults to the disposable superuser URL
`postgresql://supabase_admin:postgres@127.0.0.1:54332/postgres`; the `postgres` role cannot write
the Auth and Storage tables, so an override must also connect as `supabase_admin`. Production can
run a newer Supabase Storage service than the frozen `supabase/test/storage-schema.sql`: before
loading Storage metadata the drill adds every column named by the dump's `COPY` headers that the
disposable tables lack, typed from the Supabase Storage migrations (unknown columns fall back to
`text`), and records them as `storageColumnsAdded` in the report. The workflow rebuilds all
migrations, restores public/Auth/Storage metadata, materializes and re-hashes actual object bytes,
compares deterministic critical-table and business-state fingerprints, checks
RSVP/ownership/orphan/uniqueness/phone invariants, and writes restore/verification/total timings. A
synthetic complete set can be created with
`pnpm db:backup:create-disposable-fixture -- --output-dir=<path>`.

#### Media originals copy (Cloudflare R2)

The database dump keeps media URLs and sha256 digests but no R2 bytes. After the database part, the
daily job copies every new **original** from the Production media buckets into the private backup
bucket named by `PROD_MEDIA_COPY_R2_BUCKET` (`scripts/db/media-backup-copy.ts`):

| Source bucket                 | Originals copied                           | Backup prefix       |
| ----------------------------- | ------------------------------------------ | ------------------- |
| `celebra-me-invitation-media` | `invitations/`, `shared/` (photos, mp3)    | `invitation-media/` |
| `celebra-memories`            | `events/` guest uploads, without `thumbs/` | `memories/`         |

Width variants (`.w<width>.webp`), social cards (`.og.jpg`) and memories thumbnails are not copied:
they are regenerated from the original. A key already in the backup is skipped, so each run copies
only what is new. Uploads never overwrite (`If-None-Match: *`), keep the source content type and
cache headers, record the sha256 as `x-amz-meta-sha256`, and re-read the stored size. A backup
object whose size differs from its source is reported and left as it is. An invitation original
whose bytes do not match the sha256 in its key is not copied. One failing object does not stop the
others; the run fails at the end. An original deleted between listing and download is skipped. The
code never deletes.

Two R2 API tokens keep Production read-only for the job; settings live in `.env.production.local`:

| Variable                                   | Value                                                 |
| ------------------------------------------ | ----------------------------------------------------- |
| `PROD_MEDIA_COPY_R2_ACCOUNT_ID`            | Cloudflare account id (32 hex characters)             |
| `PROD_MEDIA_COPY_R2_BUCKET`                | Backup bucket name (never a Production bucket)        |
| `PROD_MEDIA_COPY_SOURCE_ACCESS_KEY_ID`     | Token "Object Read only" on the two source buckets    |
| `PROD_MEDIA_COPY_SOURCE_SECRET_ACCESS_KEY` | Secret of that token                                  |
| `PROD_MEDIA_COPY_TARGET_ACCESS_KEY_ID`     | Token "Object Read & Write" on the backup bucket only |
| `PROD_MEDIA_COPY_TARGET_SECRET_ACCESS_KEY` | Secret of that token                                  |

With none set, the daily report records `mediaCopy.status = "not_configured"`. A partial set or a
failed copy records `mediaCopy.status = "failed"` and makes the job exit nonzero; it does not change
the database recovery point, its retention or its health receipt.

The backup bucket owns retention (no public access, no custom domain):

- Bucket Lock `invitation-media/` 365 days, no lifecycle rule: invitation media is kept.
- Bucket Lock `memories/` 30 days plus a lifecycle rule that deletes `memories/` objects after 31
  days. While a guest photo still exists in `celebra-memories`, the next run copies it again; once a
  guest or the cleanup deletes it, its backup copy is gone within about a month.

Commands (read Production, write only the backup bucket):

- `pnpm db:media-copy:run -- --dry-run` lists what the next run would copy; without `--dry-run` it
  copies now.
- `pnpm db:media-copy:restore [-- --key=<backup key>]` is the restore drill: it downloads one object
  (default: the newest invitation original) into ignored `.tmp/media-restore/`, checks its sha256
  against the key digest or the recorded one, and compares it with the Production original while
  that still exists. It writes nothing to R2.

Putting an object back into Production is a separate, owner-authorized media step: upload the drill
file to the same key with the same content type and cache control. Invitation keys are
content-addressed and locked, so an existing key is never replaced.

After a drill on Production-derived data, reset the disposable database to synthetic data and remove
the materialized Production-derived files. A passing drill is the RTO evidence; the daily OS
schedule and newest successful report establish ongoing RPO evidence. Planned mutations share the
critical migrate RPO (`CRITICAL_BACKUP_RPO_MS`, 15 minutes). Treat an older recovery point as a
blocking incident before promote/migrate apply.

### Free-tier recovery monitoring

Use current provider dashboards for volatile quota limits rather than copying numeric limits here.
At least once per backup review, record or inspect Supabase uncached egress, Storage usage, database
size, downloaded bytes per recovery point, projected monthly backup egress, age of the latest valid
backup, date of the latest successful restore drill, and restore duration. Measure real daily runs
before considering incremental Storage capture. Backups never route through the application hosting
and must not poll Production or download an object more than once within one recovery operation.

## Hosted schema invariants

Never infer hosted migration status from documentation. Obtain live pending sets from
`pnpm db:prod:audit` / `pnpm db:preview:audit` and verify with
`pnpm db:contract:verify -- --target <production|preview>`.

- **Receipt-lock serialization**: atomic metadata/restore RPCs serialize on the invitation row and
  must not row-lock append-only receipts. Never grant receipt `UPDATE` via the dashboard to silence
  `42501`.
- **Public guest RSVP RPCs**: public submission and guest auto-creation use the `SECURITY DEFINER`
  RPC `submit_guest_rsvp_public`; guest engagement uses `record_guest_engagement_events_public` (the
  legacy `track_guest_invitation_view_public` was retired by `20261013110000`). Hybrid create
  qualifies `extensions.gen_random_bytes` under `search_path=public`. `p_guest_comment` is an
  absolute SET when provided; `status_changed` audit is owned by `trg_guest_invitations_emit_audit`.
  Direct `INSERT`, `UPDATE`, and `DELETE` on protected guest tables stay revoked from
  `service_role`. Telemetry failures degrade gracefully and never break the public invitation.
- **Migration ownership**: every schema change is a versioned migration in `supabase/migrations/`,
  promoted Local → Preview → Production with migration-before-code ordering and verified recovery
  points. Direct Production SQL and manual dashboard privilege repairs are prohibited as a normal
  workflow.

## Environments

See [`env-workflow.md`](env-workflow.md) for the canonical environment source hierarchy, variable
categories, and precedence notes.

- `.env` is for local Supabase and should point to `http://127.0.0.1:54321`.
- Local DB workflow scripts require PostgreSQL client tools. `psql` must be installed and available
  on PATH; verify with `psql --version`.
- `.env.local` must not point to production during normal development.
- Production credentials must come from shell environment variables or the single canonical
  gitignored secret file `.env.production.local` (no tracked template).
- Preview credentials must come from `PREVIEW_DB_URL` or the single canonical gitignored secret file
  `.env.preview.local` (no tracked template). On the `f11-preview` and `f12-release` worktrees,
  `.env.preview.local` also supplies the Preview **application** runtime (`SUPABASE_*` /
  `PUBLIC_SUPABASE_*`) via lane bootstrap; that runtime overlay does not authorize `db:preview:*` or
  `invitation:release` mutations.
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

| Mechanism                          | Role                                                           | Direction                                  |
| ---------------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `pnpm invitation:release`          | **Release** managed content (Local/Preview/approve/Production) | Definition → Local → Preview → Production  |
| `pnpm invitation:preview-fixture`  | **Bootstrap** Preview E2E publication fixture (Preview-only)   | Creates/verifies `e2e-preview-publication` |
| `pnpm db:preview:sync-invitations` | **Mirror** invitation-facing content for regression            | Production → Preview only                  |
| `pnpm db:local:restore-from-dump`  | **Restore** debugging dump (may include PII)                   | Production backup → Local                  |
| `pnpm invitation:content-parity`   | Read-only **semantic** content parity check                    | Compares Local/Preview/Production          |
| `pnpm dbs` / `pnpm dbs --compact`  | Read-only managed **status** (content + schema classifiers)    | Local / Preview / Production               |

Command authority is `package.json`. Use `pnpm dbs` for read-only status,
`pnpm db:migrate -- --target <target>` for schema, `pnpm invitation:release` for managed content,
and `pnpm db:preview:sync-invitations` only for the separate Production-to-Preview regression
mirror. `pnpm lane:sync` and `pnpm db:local:restore-from-dump` remain separate systems.

Policy for mirror exclusions, RSVP reset, and remote-host vs Supabase Storage boundaries:
[`docs/core/content-parity-rsvp-isolation.md`](core/content-parity-rsvp-isolation.md).

Production never imports from the Preview DB or Preview Storage. Mirror is never promotion. Use
`invitation:release --targets local|preview` for content stages. `--targets production --dry-run` is
Production preflight only. Owner apply is `pnpm prod:apply -- --slug <slug> --apply`. Credential
presence, worktree path, runtime target, and UI banners do not authorize mutations. A Preview
automation scope (`CELEBRA_TASK_SCOPE`) is refused by `prod:apply --apply` before the owner
confirmation and before any write, schema included; read-only plans still work with it set.

### Commands

1. **Plan/update a managed definition (Local / Preview)**:

   ```bash
   pnpm invitation:release -- --slug <slug> --targets local,preview --source-dir <path> --dry-run
   pnpm invitation:release -- --slug <slug> --targets local,preview --source-dir <path> --apply
   ```

2. **Promote to Production (owner-only)**:

   ```bash
   pnpm prod:apply -- --slug <slug>
   pnpm prod:apply -- --slug <slug> --apply
   pnpm prod:apply -- --slug <slug> --acknowledge-discard-unpublished-draft
   pnpm prod:apply -- --slug <slug> --acknowledge-discard-unpublished-draft --apply
   pnpm prod:apply -- --all-ready --apply
   ```

   No arguments prints a read-only Production plan and does not write. `--all-ready` includes only
   evidence-backed READY schema and invitations; it never includes draft discards. Expired
   definitions (event date + 1 year, end of day in the event time zone) and definitions still in
   authoring (`lifecycle: 'in_progress'`) are left out of no-argument and `--all-ready` plans and
   counted apart in the summary; `--slug <slug>` still inspects an expired one, while an authoring
   one is `BLOCKED` with `LIFECYCLE_NOT_PUBLISHED` until its definition is published. The read-only
   Production dry-run runs before the approval is enforced: a package identical to Production is
   `IN_SYNC` without an approval, and a package that would write is `MISSING_PREVIEW_APPROVAL` with
   the reason (never approved, approval of another hash, pending, or expired after 7 days without a
   live recheck). A divergent unpublished draft (`UNPUBLISHED_DRAFT_DIVERGENCE`; `pnpm dbs` prints
   the exact discard command) can be replaced only for explicitly selected `--slug`/`--slugs` when
   the plan includes `--acknowledge-discard-unpublished-draft`; manual/editor managed-baseline drift
   (`MANAGED_DIVERGENCE`) remains BLOCKED. The hosted apply writes the draft, resets it and
   publishes in one database transaction, so an interrupted apply never leaves such a draft behind.
   Review the plan and its owner-confirmation summary before applying. Domain dry-run remains
   available: `pnpm invitation:release -- --slug <slug> --targets production --dry-run`.

3. **Semantic content parity (read-only)**:
   ```bash
   pnpm invitation:content-parity -- --slug <slug> --event-type <type> --envs local,preview,production
   ```

## Preview Environment Workflow

```text
PROVISIONED & HOSTED-VALIDATED
```

- **Status & Parity**: Ephemeral Preview database environment is provisioned and hosted-validated.
  Dedicated Supabase Preview project is used for Preview Worker deployments from `develop`.
- **Supported Credentials**: `PREVIEW_DB_URL` environment variable or the canonical secret file
  `.env.preview.local`.
- **Target Classification**: `scripts/db/db-guard.ts` classifies targets matching `PREVIEW_DB_URL`
  as `preview`.
- **Migration Command**: Canonical planner is `pnpm db:migrate -- --target preview`. Defaults to
  **read-only preflight** against the canonical Preview project URL (exact project-ref perimeter via
  `assertPreviewDbUrl` / `validateEnvironmentUrlsPreflight`). Release identity is the current clean
  Git `HEAD` (same pattern as Production). Mutations require explicit `--apply` plus Preview
  authorization (`CELEBRA_TASK_SCOPE=preview:schema:migrate` or interactive TTY `YES`). Hosted
  candidates without an explicit rollout registry phase fail closed.
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
  `pnpm db:migrate -- --target preview` preflights by default and applies only with `--apply`; it
  does NOT automatically seed or audit.
- **Expected Failure Mode**: If Preview credentials are unconfigured or unavailable, Preview
  commands fail closed with exit code `1`.
- **Synthetic Data & Privacy**: Preview must use isolated synthetic data
  (`supabase/test/seed-test-data.sql` or synthetic test fixtures) for non-invitation operational
  data. Production customer data must NEVER be copied into Preview.
- **Invitation Content Exception**: Preview MAY mirror invitation-facing production content (names,
  dates, locations, photographs) required for regression testing. Guest, RSVP, Auth, intake, audit,
  and commercial/tracking data stay prohibited; the list is owned by
  [`content-parity-rsvp-isolation.md`](core/content-parity-rsvp-isolation.md#strict-isolation-never-promote-or-mirror)
  (executable: `EXCLUDED_TABLES` in `scripts/db/db-target-config.ts`).
- **Ownership Remapping**: Copied invitations and events are owned by `preview@preview.com` (the
  dedicated Preview admin). Real Production auth users are never copied.
- **Storage Mirroring**: Supabase Storage binaries under `invitation-assets` (rows with
  `storage_path`) are copied to Preview Storage. Supabase public Storage URLs inside mirrored JSON
  `content`/`snapshot` are rewritten Production→Preview. Remote-host `secure_url` / CDN references
  are preserved as-is and are **not** a Supabase Storage completeness claim — see
  [`content-parity-rsvp-isolation.md`](core/content-parity-rsvp-isolation.md). Apply fails closed on
  partial upsert, missing transferable assets, Storage credential gaps, unregistered Storage refs,
  or residual Production Storage URLs after rewrite.

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
pnpm db:migrate -- --target preview
pnpm db:migrate -- --target preview --apply
pnpm db:migrate -- --target production
pnpm db:migrate -- --target production --expected <versions>
pnpm db:migrate -- --target production --apply --expected <versions>
pnpm db:preview:audit
pnpm db:local:audit
pnpm db:preview:sync-invitations -- --dry-run
pnpm db:prod:patch -- --dry-run --file <path>
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

Read-only evidence is not persisted: parity and diagnosis re-run for the current base/head SHAs on
each invocation, and a write proceeds only on evidence for the exact SHAs it moves.

Complete remote audits via `pnpm db:local:audit` / `db:preview:audit` / `db:prod:audit` when
credentials resolve. Production migration safety requires a verified complete DB/Auth/Storage
recovery point immediately before mutation and captures another after applying migrations and
verifying the application schema contract; both use the standard `phase3` integrity profile. Preview
is never a Production backup.

### Migration / Deployment Compatibility Contract

SSOT: `scripts/db/migration-deployment-compatibility.ts` +
`supabase/migration-rollout-registry.json`. Wired into `pnpm db:migrate` via the shared orchestrator
(does not replace `--expected` pin, dry-run, backup, or contract verification).

Hosted targets prove migration membership from Git contents
(`candidate ∈ <release-sha>:supabase/migrations/`), not filename chronology. Branch name, worktree
path, UI banner, and credential presence alone never authorize hosted mutation.

```bash
# Canonical planner (TTY: target selector with Cancelar default; non-TTY requires --target)
pnpm db:migrate
pnpm db:migrate -- --target local|preview|production [--expected <versions>] [--json]

# Preview — apply after Preview authorization (release = clean HEAD)
CELEBRA_TASK_SCOPE=preview:schema:migrate \
  pnpm db:migrate -- --target preview --apply --expected <versions>

# Production — read-only preflight; owner apply is pnpm prod:apply -- --schema --apply
pnpm release-check
pnpm db:migrate -- --target production                        # schema primitive, read-only
pnpm db:migrate -- --target production --expected <versions> # preflight with exact pin
```

Production apply fails closed without valid `pnpm release-check` evidence for the current clean
`HEAD`. Ordinary preflight does not run the full release suite. Preview also requires a clean `HEAD`
and exact Preview project perimeter. Local / disposable remain free to develop against repository
`HEAD` for membership, but Local migrate is preflight-first (never implicit `--apply`). After any
failed apply, re-run preflight and obtain a newly validated plan — do not resume from cached
assumptions. Cross-machine concurrent migrate is an accepted single-operator residual risk.

Rollout phases (registry metadata; **hosted candidates must have an explicit phase** — omission
fails closed; do not backfill already-applied historical migrations without need):

| Phase      | Meaning                                                    | Hosted rule                                                                                                                                          |
| ---------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expand`   | Adds capability compatible with the currently deployed app | May run before target deployment when release membership + DB deps hold                                                                              |
| `neutral`  | Does not invalidate current or target app contracts        | Normal guarded path + membership                                                                                                                     |
| `contract` | Removes/restricts behavior an older app relies on          | Blocked until GitHub/Cloudflare prove a prior Production deployment passed smoke and its versioned capability manifest provides the replacement path |

Safe RSVP-class sequencing:

```text
EXPAND (RPC / portable capability)
→ Production deploy + verified GitHub/Cloudflare smoke of replacement application
→ CONTRACT (revoke legacy direct DML paths)
```

The `contract` rule applies to Preview and Production alike: both migrate policies resolve the same
attestation of the latest smoke-checked Production deployment
(`scripts/db/contract-deployment-evidence.ts`). A preflight without reachable GitHub evidence
reports `UNVERIFIED`; an apply fails closed.

When the deployed application requires a DB capability the database (including pending candidates)
does not provide, the gate reports `ENVIRONMENT NOT READY` rather than treating the environment as
healthy.

### Blocked refresh aliases

`db:local:refresh-from-prod` and `db:local:refresh-from-prod-preserve-local` remain in
`package.json` only as fail-closed safety rails. They print a blocked-operation message and exit
with a failure. They are not runnable refresh workflows and must not be bypassed with direct
Supabase commands.

Use `pnpm db:prod:backup` followed by `pnpm db:local:restore-from-dump` for a non-destructive import
(see
[Refresh local from production](#refresh-local-from-production-blocked--use-restore-from-dump)).

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
- Never hardcode real emails or passwords in source or docs.

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

- Reads production `public` data read-only and writes a timestamped dump under `.backups/prod/`
  (`-- --schema-only` for a schema dump).
- Use for local refresh / debug dump restore only. It is **not** the critical recovery set.
- For migrate/patch/promote gates or the 24h RPO, use `pnpm db:prod:backup:critical` or
  `pnpm db:prod:backup:daily`.
- Backups contain real customer data: keep them only in gitignored storage, never commit them, and
  delete them when no longer needed.

`pnpm db:prod:backup:critical`

- Reads Production only and creates the complete public/Auth/Storage metadata/object-byte set.
- Always captures the standard `phase3` integrity profile (older retained backups stay restorable
  via the profile stored in their manifests).
- Verifies project identity, capture-window coherence, object size/hash, manifest completeness, and
  critical business integrity before success.
- Creates and verifies an EFS-encrypted directory under ignored `.backups/prod/`.
- Does not schedule itself or route artifacts through any hosted system.

`pnpm db:prod:backup:daily`

- Is the deterministic once-per-24-hours entrypoint for Windows Task Scheduler.
- Runs one complete critical backup, verifies manifest/checksums and EFS encryption, records byte
  and duration metrics, and applies 30-daily/12-monthly local retention.
- Uploads an age-encrypted copy to Cloudflare R2 when the off-site settings exist (see Off-site
  copy).
- Copies new media originals to the R2 backup bucket when its settings exist (see Media originals
  copy).
- Returns nonzero on capture, integrity, encryption, off-site copy, media copy, reporting, or
  retention failure.

`pnpm release-check`

- Requires a clean working tree.
- Runs `pnpm test` in parallel with (`pnpm type-check` → `pnpm build:app`) against the full current
  `HEAD` (`build:app` avoids a nested type-check).
- Writes gitignored evidence to `.agent/tmp/release-check-evidence.json` (SHA + pass metadata).
- Evidence is rejected when `HEAD` changes, the tree becomes dirty, or required checks did not pass.
- Production apply may reuse valid evidence or run release-check once when missing/stale.

`pnpm db:migrate`

- Canonical schema entry: `pnpm db:migrate -- --target <local|preview|production|disposable-test>`.
- Production commands:
  - `pnpm prod:apply` — owner-facing read-only mixed plan
  - `pnpm prod:apply -- --schema --apply` — owner schema apply (delegates to the schema primitive)
  - `pnpm prod:apply -- --schema --expected <versions> --apply` — owner apply with exact pin
  - `pnpm db:migrate -- --target production` — schema primitive, read-only preflight
  - `pnpm db:migrate -- --target production --apply` — redirects to `prod:apply -- --schema --apply`
- Shared orchestrator apply sequence: reviewed plan → beforeWrite (backup) → one rebuild + drift
  check → authorize → execute → afterWrite. Human logs on stderr; `--json` plans on stdout only.
- Non-Production interactive TTY may use Cancel / Revisar / Aplicar; Production authorization is
  only the owner gate (Cancelar / Revisar cambios / Aplicar + bound code).
- Production apply sequence: identity → audit → dry-run (+ optional `--expected` pin) →
  compatibility (HEAD; explicit registry phase required) → compact plan card → concurrency notice →
  **Release** (`release-check` evidence first) → **Cobertura** (critical pre-migration backup with
  bounded RPO; reuse structurally valid recent manifests; auto-capture when expired/incompatible;
  one retry if capture is unstable due to concurrent writes) → **Revalidación** (one material plan
  rebuild) → structural coverage confirm → owner gate → `supabase db push` → history + contract
  verification → critical post-migration backup (always capture after write).
- Online migrate RPO: business-row changes (e.g. RSVP) after a verified backup do **not** invalidate
  coverage while age ≤ RPO and migration history/profile remain unchanged. Structural drift or RPO
  expiry forces a new backup. Supabase Database Backups / PITR (when enabled) protect the DB engine
  with fine granularity but do **not** include Storage object bytes; the local critical set remains
  required for Auth/Storage recovery evidence.
- Release identity for Production is the current clean `HEAD` (not `CELEBRA_TARGET_RELEASE_SHA`).
- Shared owner boundary: `requireOwnerProductionApply` (also used by promote/patch/draft-reset). The
  gate is two-step and TTY-only: (1) arrow-key intent select defaulting to Cancel; (2) type or paste
  a short bound code `<VERB> <8-hex>` (e.g. `APPLY` plus the first 8 hex characters of the current
  `planId`). Full SHA, pending versions, and fingerprints remain in the audit summary. Paste noise
  (bracketed-paste / zero-width) is sanitized. A single Yes/No confirm is never sufficient.
- Rejects sessions marked with `CELEBRA_AGENT_CONTEXT`. Only the Cursor session/preToolUse hooks set
  it; other agent hosts do not, so it is a deny signal, not the positive authorization boundary, and
  agent Production writes stay prohibited regardless of host enforcement. No token, secret, env, or
  noninteractive confirmation alternative.
- Successful Production schema apply writes a durable owner-apply record under
  `.backups/prod/owner-apply/` (gitignored). `pnpm dbs` reports `authorizationIntegrity` separately
  from schema CURRENT. Versions at or before `20260806120000` are grandfathered.
- `public.production_authorization_receipts` is historical inert state from migration
  `20260802090000`; no mutation path inserts into or depends on it.
- Raw `supabase db push`, mutating Production `psql`, and Supabase MCP Production writes are blocked
  outside this owner workflow. Read-only Production diagnostics remain allowed.
- This is the only approved production **schema** mutation workflow. Content promotion and
  specialized patches are separate owner workflows that share the same authorization boundary.

`pnpm db:sql:lint -- --file <path>`

- Reads a SQL file only.
- Requires the production patch manifest documented in
  [Manual SQL Manifest](../.agent/rules/database.md#manual-sql-manifest).
- Blocks unsafe production-patch patterns including unscoped `UPDATE`/`DELETE`, `TRUNCATE`, broad
  `DROP`, `ALTER TABLE`, RLS policy changes, `SECURITY DEFINER`, and `CASCADE`.

`pnpm db:prod:patch -- --dry-run --file <path>`

- Owner-facing lint entrypoint for reviewed manual SQL patches.
- Does not open a database connection and does not execute SQL in dry-run mode.

`pnpm prod:apply -- --patch <path> --owner-user-id <UUID>`

- Read-only owner plan for a reviewed patch. This plan **does** open Production in read-only mode to
  run the manifest `@dry-run-query` (LIVE preview). Add `--apply` only after reviewing the current
  plan.
- **Disposition: `RESTRICT_OWNER_ONLY` / `KEEP_SPECIALIZED`.** The composite owner workflow
  revalidates the exact plan and patch artifact, checks the manifest preview row-count bounds,
  requires a current critical backup, and then requires interactive TTY confirmation.
- It is narrow maintenance for reviewed DML that cannot yet be expressed as versioned
  `supabase/migrations/*`; it never auto-runs schema migrations and does not bypass the migration or
  managed-invitation workflows.

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

`pnpm db:local:restore-from-dump` is an intentional **PII-bearing debugging exception**, not content
synchronization. It may import unsanitized Production guests, intake, commercial data, and optional
Auth/Storage dumps. “Non-destructive” means no `db reset` and no overwrite of existing primary keys
(`INSERT … WHERE NOT EXISTS`) — not that the import is free of PII risk. Restored Local data must
never seed Preview. Artifacts remain under gitignored `.backups/` / `.tmp/`. Full contract:
[`content-parity-rsvp-isolation.md`](core/content-parity-rsvp-isolation.md).

If schema drift is detected during staging import, the script stops and reports the failure. Do not
patch around drift manually; add or apply the missing migration locally.

There is no preserve-refresh command. The restore above already keeps existing local primary keys
rather than overwriting them, and schema drift or incompatible data stops the import.

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

To perform destructive database testing (migration tests, schema drops, truncate, rollback), use the
isolated disposable test environment:

```bash
pnpm db:disposable:reset         # Reset the disposable database (destructive)
tsx scripts/db/disposable-test-env.ts cleanup # Full disposable cleanup
```

The disposable environment runs on port 54332 with a separate Docker container and synthetic test
data only. It cannot affect the persistent local database.

### Push migrations to production

Owner apply is `pnpm prod:apply`. The schema primitive remains
`pnpm db:migrate -- --target production`.

```bash
pnpm release-check
pnpm prod:apply -- --schema
pnpm prod:apply -- --schema --apply
```

This is the only owner-facing workflow allowed to mutate production **schema**. Preflight is
read-only. Apply requires release-check evidence, a verified backup, and exact interactive TTY
confirmation. It never pushes local data dumps. `pnpm db:migrate -- --target production --apply`
remains the delegated primitive, not the public owner command.

### Check a manual production patch

```bash
pnpm db:prod:patch -- --dry-run --file scripts/manual/production-patches/<script>.sql
pnpm prod:apply -- --patch scripts/manual/production-patches/<script>.sql
pnpm prod:apply -- --patch scripts/manual/production-patches/<script>.sql --apply
```

The `db:prod:patch` command only validates the manifest and SQL safety rules; it never executes the
patch. `prod:apply` plans and, after owner confirmation, executes the exact reviewed artifact. A
production patch file without the
[required manifest](../.agent/rules/database.md#manual-sql-manifest) is blocked.

## Executable guard

`scripts/db/db-guard.ts` implements the central target policy and runs inside every guarded
`pnpm db:*` command. Direct invocation:

```bash
tsx scripts/db/db-guard.ts check --target <production|preview|persistent-local|disposable-test> --operation "<op>"
tsx scripts/db/db-guard.ts classify --db-url <connection-string>      # Classify a DB URL
tsx scripts/db/db-guard.ts redact --text "<text>"                     # Redact credentials
```

- **Production**: blocks all write, DDL, reset, push, drop, and truncate operations.
- **Persistent-local**: blocks `supabase db reset`, `docker volume rm`, `docker compose down -v`,
  `DROP ... CASCADE`, `TRUNCATE ... CASCADE`, and `db push`.
- **Disposable-test**: permits all operations (warning issued).
- **Unknown**: blocks all operations with a classification error.
- **Credentials**: redacted from all logs and error messages.
- **Local identity**: verified by port (54322), host (127.0.0.1), and project ID (`celebra-me-rsvp`
  in `supabase/config.toml`).

## Disposable test environment

The disposable environment uses separate Docker containers, ports, and volumes:

```bash
tsx scripts/db/disposable-test-env.ts start       # Create and start the test environment
tsx scripts/db/disposable-test-env.ts reset       # Reset the test database (destructive) + seed data
tsx scripts/db/disposable-test-env.ts run-tests   # Run pgTAP and migration tests
tsx scripts/db/disposable-test-env.ts stop        # Stop the test environment
tsx scripts/db/disposable-test-env.ts cleanup     # Full cleanup (stop + remove config/data)
```

Configuration: `DISPOSABLE_TEST` in `scripts/db/db-target-config.ts` (project ID `celebra-me-test`;
ports API 54331, DB 54332, Studio 54333, Shadow 54330), seed data
`supabase/test/seed-test-data.sql`, migrations copied from `supabase/migrations/` on first start.

### Disposable migration proof

Local, Preview, and Production schema actions require a current disposable migration proof. Only
`pnpm db:migrate -- --target disposable-test --apply` writes it; with nothing pending it records the
proof without executing SQL. A stopped disposable container is started first
(`ensureDisposableDbAvailable` in `scripts/db/disposable-availability.ts`). The receipt lives in the
common Git directory (`db-evidence/disposable-migration-proof.json`) because every worktree shares
the same disposable container. It is valid only while all of these hold, and fails closed otherwise:

- the migration file set digest matches the current checkout;
- the live container is the same instance (Docker id) that produced the receipt;
- the live `schema_migrations` history equals the recorded applied versions;
- the container holds no migration absent from the checkout and no applied migration was edited in
  place (both require `pnpm db:disposable:reset`).

Digests identify committed content, not checkout bytes: SQL is normalized (BOM stripped, CRLF and
lone CR → LF) before hashing, and `.gitattributes` pins text files (SQL included) to LF, so
worktrees with different `core.autocrlf` or editor line endings share one receipt. The receipt
format is version 3; older receipts are treated as missing. `pnpm db:disposable:reset` retires the
receipt (kept as `disposable-migration-proof.json.superseded`) before re-applying, so a reset always
recovers.

`pnpm prod:apply` renews its own proof (d290): when a schema plan finds the receipt stale, it runs
`pnpm db:disposable:reset` and a full disposable-test apply, checks the receipt again and only then
builds the plan the owner confirms (`scripts/db/production-apply-disposable-proof.ts`). It does this
for `--apply`, for the interactive menu and for any plan run from a terminal; a non-interactive plan
(agents, pipes) stays read-only and reports the stale receipt. The renewal writes to disposable-test
only, never to persistent Local, Preview or Production, and a failed renewal stops before any
Production write.

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
  these are blocked (see [Blocked refresh aliases](#blocked-refresh-aliases)).
- Do not run `supabase db reset --local --yes` directly — this destroys the persistent local
  database.
- Do not delete persistent Docker volumes (`supabase_db_celebra-me-rsvp`).
- Do not run `docker compose down -v` for the persistent Supabase project.
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
