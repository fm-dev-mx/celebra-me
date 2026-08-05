# Invitation Database Synchronization Audit — Goal 1 Contract for `pnpm db:sync`

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **Report id**       | `invitation-db-sync-goal1-audit`                                                                     |
| **Version**         | `1.0.0`                                                                                              |
| **Date**            | 2026-08-04                                                                                           |
| **Lane**            | `dev-local`                                                                                          |
| **HEAD (short)**    | `9cd86bf2`                                                                                           |
| **HEAD (full)**     | `9cd86bf2d26e9565976f225b00e9a67deb8a2d74`                                                           |
| **Mode**            | Read-only diagnostics; sole permitted write is this report                                           |
| **Authority**       | Live source, `package.json`, active rules/docs, and focused tests — not Graphify, not archived plans |
| **Hosted DB state** | **UNVERIFIED** (no Preview/Production/Local mutation; no live hosted reads invoked for this audit)   |
| **Git safety**      | `pnpm agent:git-safety:check` → PASSED with warnings (authorized session)                            |

### Evidence classes

- **[V]** Verified from repository source, tests, or package aliases.
- **[I]** Inference / judgment required for Goal 2 design (called out explicitly).
- **[D]** Documentation claim that contradicts or under-states live code.

### Commands executed (audit session)

```text
git rev-parse HEAD
git rev-parse --short HEAD
git status --short
git branch --show-current
git log -3 --oneline
pnpm agent:git-safety:check
```

Static inspection covered the files cited below. No Preview/Production writes, no browser
automation, no broad test suites, and no hosted mutations were performed.

---

## 0. Executive verdict

**There is no `pnpm db:sync` today.** Invitation database synchronization is a **multi-engine
control plane**:

| Concern                           | Authoritative command                                     | Engine                                          |
| --------------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| Read-only env/status              | `pnpm dbs` / `pnpm db:availability:verify`                | `StatusProbeSession` + availability preflight   |
| Schema migrate                    | `pnpm db:migrate` (`--target` local\|preview\|production) | `migrate-orchestrator.ts` + per-target policies |
| Managed content update            | `pnpm invitation:update`                                  | Local apply + Preview import engine             |
| Preview approval                  | `invitation:update` approval finalize                     | `preview-approval-service.ts` (schema `2.1.0`)  |
| Production content promote        | `pnpm invitation:promote`                                 | Import engine + owner Production apply          |
| Production→Preview content mirror | `pnpm db:preview:sync-invitations`                        | `preview-sync-*` modules                        |
| Semantic compare                  | `pnpm invitation:content-parity`                          | `promotion-comparison.ts` canonicalization      |
| Demo publish UI                   | Dashboard Content Sync                                    | `content-publication/*` (demos only)            |
| Production dump → Local           | `pnpm db:local:restore-from-dump`                         | Restore (PII exception; **not** content sync)   |

Goal 2 must introduce `pnpm db:sync` as a **thin orchestration facade** that reuses these engines,
preserves direction and authorization gates, and does **not** become a second migration, Storage,
approval, backup, promote, or mirror engine.

---

## 1. Current architecture map

### 1.1 Package aliases (SSOT: `package.json`)

| Alias                                                   | Chain                                                                                          | Mutation?                              | Sync relevance                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------- |
| _(missing)_ `db:sync`                                   | —                                                                                              | —                                      | **Goal 2 deliverable**                        |
| `dbs`                                                   | `scripts/provision/dbs-cli.ts`                                                                 | No                                     | Live CONTENT+SCHEMA matrix                    |
| `db:availability:verify`                                | `verify-required-database-availability.ts`                                                     | No                                     | Fail-closed identity + read-only reachability |
| `db:preview:sync-invitations`                           | `db-guard check --target preview --operation sync-invitations` → `preview-sync-invitations.ts` | Only `--apply`                         | Prod→Preview content mirror                   |
| `invitation:update`                                     | `invitation-update-cli.ts`                                                                     | Local/Preview only                     | Definition/package → Local/Preview            |
| `invitation:promote`                                    | `invitation-promote-cli.ts`                                                                    | Owner `--apply`                        | Approved package → Production                 |
| `invitation:content-parity`                             | `content-parity-cli.ts`                                                                        | No                                     | Semantic cross-env compare                    |
| `invitation:cross-db-reconcile`                         | `cross-db-invitation-reconciliation-cli.ts`                                                    | No                                     | Inventory-level slug/packageHash              |
| `db:migrate` / `db:prod:migrate` / `db:preview:migrate` | migrate CLI / wrappers                                                                         | Only `--apply`                         | Schema only — **outside** content sync        |
| `db:prod:backup*` / `db:backup:*`                       | backup scripts                                                                                 | Read Production; write local artifacts | Promote/migrate gates                         |
| `release-check`                                         | `release-check.ts`                                                                             | Writes gitignored evidence             | Production apply prerequisite                 |
| `db:local:restore-from-dump`                            | `local-restore-from-dump.ts`                                                                   | Local only                             | Debugging PII import — **not** sync           |

**[V]** No `db:sync` string matches in the repository.

### 1.2 Responsibility map (authoritative components)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         Read / diagnose layer                            │
│  StatusProbeSession (status-core/probe-runner.ts)                        │
│    ← dbs-status.ts ← dbs-cli.ts / managed-status.ts                      │
│    ← invitation-meta.ts, migration-probe.ts, observability               │
│  verify-required-database-availability.ts  (stronger than select 1)      │
│  content-parity.ts ← promotion-comparison.ts                             │
│  schema-lifecycle-state.ts (CURRENT|BEHIND|SCHEMA_DRIFT|UNVERIFIED)      │
└──────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    Managed content write layer                           │
│  invitation-package*.ts → invitation-update-plan.ts (planId)             │
│    → invitation-lifecycle-execution.ts                                   │
│    → applyLocalInvitation | runImportEngine                              │
│  preview-approval-service.ts (Preview approval artifact 2.1.0)           │
│  invitation-promote.ts → requireOwnerProductionApply                     │
└──────────────────────────────────────────────────────────────────────────┘
                │                         │
                │                         ▼
                │        ┌──────────────────────────────────────────────┐
                │        │ Production→Preview mirror (separate path)    │
                │        │ preview-sync-invitations.ts                  │
                │        │   + preview-sync-db/storage/guards/report    │
                │        │   + authorizePreviewWriteApply               │
                │        │   tables: CONTENT_MIRROR_TABLES              │
                │        │   exclude: EXCLUDED_TABLES                   │
                │        └──────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Shared safety / identity                                                 │
│  db-target-config.ts (classify, redact, CONTENT_MIRROR_TABLES, EXCLUDED) │
│  db-guard.ts (target check)                                              │
│  environment-identity.ts (SUPABASE_PROJECT_REFS)                         │
│  preview-write-auth.ts vs owner-production-apply.ts (never conflate)     │
│  release-check.ts, backup-manifest.ts, migration-deployment-compat       │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Directional data flow (contract SSOT)

**Authoritative terminology:** `docs/core/content-parity-rsvp-isolation.md` **[V]**

```text
Managed content:   definition/package → Local → Preview → Production
Regression mirror: Production → Preview          (never promotion)
RSVP:              environment-local only
Restore (debug):   Production backup → Local     (PII exception; not sync)
```

| Direction                                       | Writer                        | Allowed?                           |
| ----------------------------------------------- | ----------------------------- | ---------------------------------- |
| Definition → Local                              | `invitation:update`           | Yes                                |
| Definition → Preview                            | `invitation:update`           | Yes (Preview auth)                 |
| Approved package → Production                   | `invitation:promote`          | Yes (owner TTY only)               |
| Production → Preview (content tables + Storage) | `db:preview:sync-invitations` | Yes (Preview auth; RSVP reset)     |
| Preview → Production                            | —                             | **Forbidden**                      |
| Preview DB/Storage → Local as promotion source  | —                             | **Forbidden**                      |
| Production PII → Preview                        | —                             | **Forbidden**                      |
| Production dump → Local                         | `db:local:restore-from-dump`  | Debugging only; never seed Preview |
| Schema Local → Preview → Production             | `db:migrate`                  | Separate orchestrator              |

### 1.4 Mirror pipeline detail (Production→Preview)

**Entrypoint:** `pnpm db:preview:sync-invitations` → `scripts/db/preview-sync-invitations.ts`
**[V]**

| Phase                     | Behavior                                                                                                   | Dry-run         | Apply                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| Guards                    | Source=Production, target=Preview, distinct refs, not local/disposable, Preview ref `iwipdvisoyerfdytuhwi` | Read            | Read                                                                     |
| Admin                     | Resolve `preview@preview.com`; role/profile upsert                                                         | Resolve only    | Write                                                                    |
| Tables                    | Upsert `invitations`, drafts, published, assets (URL rewrite on `content`/`snapshot`)                      | Read/report     | Write                                                                    |
| Events                    | `TRUNCATE events CASCADE` + remapped upsert + `event_memberships`                                          | Read/report     | Write (RSVP children reset)                                              |
| Storage                   | Fetch Production public object → PUT Preview with service role                                             | Skip writes     | Write (skipped if no service role)                                       |
| Stale Preview invitations | Detect only                                                                                                | Report          | Report (no prune)                                                        |
| Excluded tables           | Count on Production only                                                                                   | Count           | Count                                                                    |
| Report file               | `.tmp/reports/preview-sync-*.json`                                                                         | **Not written** | Written (URL-redacted)                                                   |
| Auth                      | —                                                                                                          | Skipped         | `authorizePreviewWriteApply` (`preview:content-mirror:sync-invitations`) |

**Allowlist / denylist SSOT:** `scripts/db/db-target-config.ts` **[V]**

```text
CONTENT_MIRROR_TABLES =
  invitations, invitation_content_drafts, published_invitation_content,
  invitation_assets, events

EXCLUDED_TABLES =
  guest_invitations, guest_invitation_audit, event_claim_codes,
  intake_requests, intake_submissions, audit_logs,
  rsvp_records, rsvp_audit_log, rsvp_channel_log,
  visitor_sessions, commercial_attribution_identity, commercial_analytics
```

Side writes on apply (not in `CONTENT_MIRROR_TABLES`): Preview admin `auth.users` metadata,
`app_user_roles`, `host_profiles`, `event_memberships`, Storage bucket `invitation-assets`.

### 1.5 Managed promote / update / approval flow

```text
definition → package (hashes) → invitation:update (Local/Preview)
  → Preview hosted validation → approval artifact (.agent/tmp/approvals/)
  → invitation:promote dry-run → owner TTY + release-check + critical backup
  → apply → post-verify zero-drift
```

| Concept            | Authoritative module          | Notes                                                                                 |
| ------------------ | ----------------------------- | ------------------------------------------------------------------------------------- |
| Package hashes     | `invitation-package.ts`       | `packageHash`, `sourceHash`, `metadataHash`, `projectionHash`, `assetManifestHash`    |
| planId             | `invitation-update-plan.ts`   | SHA-256 slice; **excludes** `assetStateHash` (CDN nondeterminism)                     |
| Preconditions      | `verifyPlanPreconditions`     | source/package/manifest/project/invitation/owner/draft `updated_at`/published version |
| Canonical equality | `promotion-comparison.ts`     | Storage URLs → placeholder; semantic assets by key+sha256                             |
| Approval           | `preview-approval-service.ts` | Schema `2.1.0`; 7-day freshness; old schemas rejected                                 |
| Backup gate        | `evaluatePromotionBackupGate` | Critical manifest ≤24h, matching projectRef                                           |
| Owner apply        | `owner-production-apply.ts`   | No token/env confirmation; agent blocked; TTY required                                |
| Post-apply         | promote verification dry-run  | `APPLIED_BUT_VERIFICATION_FAILED` if residual mutations                               |

### 1.6 Status / connectivity

| Mechanism                                           | Strength         | Evidence class                                            |
| --------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| `StatusProbeSession.probeConnectivity` (`select 1`) | Observability    | `migration_history_parity` for schema via migration-probe |
| `db:availability:verify`                            | Task gate        | Identity + `BEGIN READ ONLY` + `transaction_read_only=on` |
| `db:*:audit`                                        | Object readiness | **Not** equivalent to `dbs` history parity                |

**[V]** `database.md` and `dbs-cli.ts` forbid equating status history parity with object audit
readiness.

**StatusProbeSession contracts [V]** (`scripts/status-core/probe-runner.ts`):

- Default `readOnly: true` → `PGOPTIONS=-c default_transaction_read_only=on`
- Memoization by `sha256(dbUrl\0sql)` (execution-local only)
- Sync `psqlSync` passes `redact: [dbUrl]`; async `runPsqlAsync` does **not** (exposure gap — §3)

### 1.7 Orthogonal systems (must not be folded into `db:sync`)

| System                                                | Why separate                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Schema `db:migrate`                                   | Explicitly outside invitation content; separate plan/auth/backup policies |
| Dashboard Content Sync / `synchronizeDemoInvitations` | Demo Astro collections ↔ published demos; `is_demo` only                  |
| `lane:sync` / `scripts/agent/lane-sync.ts`            | Git branch sync, not invitation DB                                        |
| Preserve-local refresh plan (blocked)                 | Future Local refresh design; not live `db:sync`                           |
| `db:local:restore-from-dump`                          | Full dump including PII; debugging only                                   |

### 1.8 Server-only boundaries

**Must remain server/CLI (never client islands):** DB URLs, service-role keys, package binaries
(`dataBase64`), approval artifacts, backup manifests, release-check evidence, import/promote/mirror
engines, `targetDbUrl`.

**Client-safe:** Dashboard Content Sync panel calling authenticated APIs with demo drift summaries
only (`ContentSyncPanel` → `/api/dashboard/admin/*`).

---

## 2. Contract inventory (Goal 2 must preserve)

### 2.1 Resource boundary

1. **Synchronized invitation-facing state** is the allowlisted content set in
   `CONTENT_MIRROR_TABLES` plus Storage objects under `invitation-assets` referenced by those rows,
   **or** the semantic equivalent applied by the managed import engine (definition/package →
   draft/published/assets/events shell). **[V]**
2. **Never synchronize** `EXCLUDED_TABLES`, Auth users (except Preview admin role/profile remap on
   mirror apply), credentials, sessions/MFA, or Production guests/claims. **[V]**
3. **Events shell** may sync as projection (`slug`, `event_type`, title, invitation link);
   environment-local RSVP children must not be promoted or mirrored from Production. Mirror apply
   **intentionally resets** Preview RSVP children via `TRUNCATE events CASCADE`. **[V]**
4. **Demos** remain content-collection / Content Sync owned; not managed promote/mirror scope unless
   an existing contract already includes them in mirror table dump. **[V]/[I]** — mirror copies
   whatever Production has in allowlisted tables, including demo rows if present; managed promote is
   slug/package scoped.

### 2.2 Supported directions (hard allowlist)

| Direction                     | Mode name (recommended) | Reuses                                             |
| ----------------------------- | ----------------------- | -------------------------------------------------- |
| Definition/package → Local    | `update-local`          | `invitation:update` / `applyLocalInvitation`       |
| Definition/package → Preview  | `update-preview`        | `invitation:update` / import engine + Preview auth |
| Approved package → Production | `promote`               | `invitation:promote` + owner gate                  |
| Production → Preview          | `mirror`                | `preview-sync-invitations` path                    |
| Read-only diagnose/compare    | `diagnose` / `compare`  | availability + `dbs`/probes + `content-parity`     |

All other directions are **fail-closed** unless listed under Open Decisions.

### 2.3 Environment & operation status vocabulary

Reuse existing classifiers; do not invent parallel enums:

| Domain                   | Vocabulary                                                                                 | Source                              |
| ------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| Schema lifecycle         | `CURRENT \| BEHIND \| SCHEMA_DRIFT \| UNVERIFIED`                                          | `schema-lifecycle-state.ts`         |
| Availability             | `CREDENTIALS_REQUIRED \| IDENTITY_CONFLICT \| UNREACHABLE \| READ_ONLY_ENFORCEMENT_FAILED` | availability verify                 |
| Promote terminal         | `PROMOTABLE \| PROMOTED \| IN_SYNC \| BLOCKED \| APPLIED_BUT_VERIFICATION_FAILED`          | `invitation-promote.ts`             |
| Mirror report            | `dry-run-pending \| applied \| failed`                                                     | `preview-sync-report.ts`            |
| Update lifecycle (ES UI) | `CAMBIOS APLICADOS` / `SIN CAMBIOS` / `BLOQUEADO` / error variants                         | `invitation-lifecycle-execution.ts` |
| Evidence class labels    | `migration_history_parity` vs `object_audit_readiness`                                     | `database.md`                       |

Unavailable evidence must never be translated into “aligned / zero / PASS”. **[V]**

### 2.4 Read-only diagnosis

1. Default `db:sync` mode is **read-only**.
2. Before claiming integrity/parity/sync success for a target set, run availability verify for
   **only** those targets. **[V]**
3. Use `StatusProbeSession` (read-only) for live matrix probes; label schema evidence as
   history-parity, not object audit.
4. Semantic compare via `invitation:content-parity` / `promotion-comparison` (paths-only option must
   not dump field values). **[V]**

### 2.5 Comparison & conflict detection

| Check              | Authoritative behavior                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Semantic equality  | Canonicalize Storage hosts; compare metadata, draft/published JSON, assets by semantic key+sha256, events projection |
| Identity conflict  | Multiple active invitations for slug → `IDENTITY_CONFLICT`; never PASS                                               |
| Promote divergence | `SAFE_MANAGED_CHANGE` / `TARGET_OWNED_DIFFERENCE` / `MANAGED_DIVERGENCE` / `CONFLICT_REQUIRES_REVIEW`                |
| Zero-drift         | Import engine reports no create/replace/delete → promote `IN_SYNC`                                                   |
| Cross-db reconcile | Inventory only — **not** a substitute for content-parity or promote preflight                                        |

### 2.6 Immutable plan identity, fingerprints, freshness, revalidation

| Artifact           | Freshness / identity rules                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Content `planId`   | Hash of slug + sourceHash + env + projectRef + functional changes + stable preconditions + operationFingerprint; exclude `assetStateHash` |
| Migration `planId` | Separate schema plan (`migration-plan.ts`); content sync must not reuse schema planId                                                     |
| Package            | `PACKAGE_STALE` unless `--allow-stale-package`                                                                                            |
| Preview approval   | Schema `2.1.0`; ≤7 days; bind package + projection hashes + planId + project refs                                                         |
| Critical backup    | ≤24h; matching Production projectRef                                                                                                      |
| Release-check      | Evidence SHA == clean HEAD                                                                                                                |
| Apply revalidation | Recompute planId + `verifyPlanPreconditions`; reject drift; no resume from cached plans after failed apply                                |

### 2.7 Concurrency & idempotency

- Optimistic concurrency via draft `updated_at` + published version preconditions +
  `publish_invitation_atomic`.
- Receipts: `invitation_mutation_operation_receipts` append-only; replay/`on conflict do nothing`.
- Zero-drift apply → `replayed` / `IN_SYNC` without mutation.
- **No distributed lock**; single-operator residual risk accepted (same as migrate).
- Mirror upserts currently continue on per-row failure (`throwOnError: false`) — Goal 2 must define
  stricter completion semantics when orchestrating mirror (§3, §7).

### 2.8 Preview approval for verified zero-drift candidate

Preserve `preview-approval-service.ts`:

- Pending → hosted validation finalize → `approved`
- Promote consumes approved artifact; re-binds Production projectRef
- Zero-drift candidate: engine reports no remaining mutations / promote `IN_SYNC` or promotable with
  only safe managed changes and no unresolved `MANAGED_DIVERGENCE`

### 2.9 Production prerequisites (non-weakening)

For any Production **content** mutation path invoked via `db:sync`:

1. Exact Production project ref (`SUPABASE_PROJECT_REFS.production`)
2. Schema lifecycle `CURRENT` (history parity) — promote does not migrate
3. Exact Preview-approved release (when promote)
4. Verified critical backup ≤24h
5. Valid `release-check` evidence for clean HEAD
6. `requireOwnerProductionApply` — interactive TTY; `CELEBRA_AGENT_CONTEXT` blocked; **no**
   `CELEBRA_TASK_SCOPE` for Production
7. Post-apply verification; non-zero residual mutations → failure status

### 2.10 Preview write prerequisites

- Interactive TTY: type `YES` after verify short-circuit
- Headless: exact `CELEBRA_TASK_SCOPE=preview:<slug>:<operation>` (mirror uses
  `content-mirror:sync-invitations`; update uses its own slug/op)
- Lane/worktree/credential presence is **not** authorization

### 2.11 Failure & partial-completion reporting

Preserve typed terminal statuses from update/promote; for mirror, report phase failures and exit 1
when `report.failures.length > 0`. Goal 2 must also surface **partial table upsert** incompleteness
that today can still exit 0 (§3).

### 2.12 Secret redaction

- Never print full DB URLs; use `redactDbUrl` / `redactCredentials` / command `redact` lists
- Promote public JSON strips `targetDbUrl`
- Owner prompts on **stderr**; human diagnostics vs `--json` on stdout (migrate pattern)
- Approval / report / JSON output must not embed service-role keys, passwords, or raw connection
  strings
- Content-parity `--paths` must not dump values

### 2.13 Interactive vs headless semantic parity

| Mode             | Interactive                     | Headless                            |
| ---------------- | ------------------------------- | ----------------------------------- |
| Diagnose/compare | Same evidence, human formatting | `--json` same fields, no secrets    |
| Preview apply    | TTY `YES`                       | Exact `CELEBRA_TASK_SCOPE`          |
| Production apply | TTY challenge only              | **Forbidden** (agents dry-run only) |
| Mirror dry-run   | Zero writes                     | Zero writes                         |

Semantic results (planId, hashes, statuses, drift kinds) must match across interactive/headless for
the same inputs.

### 2.14 Versioned JSON output & exit codes (target contract for Goal 2)

**Recommended `db:sync` JSON envelope [I — design contract; no live implementation]:**

```json
{
  "schemaVersion": "1.0.0",
  "command": "db:sync",
  "mode": "diagnose|compare|plan|apply",
  "direction": "...",
  "planId": "...",
  "ok": true,
  "status": "...",
  "targets": [],
  "evidenceClass": "migration_history_parity|semantic_content_parity|...",
  "redactedIdentities": {},
  "drifts": [],
  "failures": [],
  "artifacts": []
}
```

**Exit codes (align with existing CLIs where possible):**

| Code                | Meaning                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `0`                 | Success / dry-run complete without failures; diagnose with all required targets available and no blocking drifts when `--strict`     |
| `1`                 | Auth failure, identity conflict, unavailable required target, plan drift, apply failure, verification failure, or blocking conflicts |
| `0` with `ok:false` | **Forbidden** for `db:sync` apply/diagnose-strict (unlike `dbs --compact` hook-safe exit)                                            |

---

## 3. Gap and risk register

| ID  | Finding                                                                                     | Class                       | Evidence                                                                                   | Goal 2 impact                                                              |
| --- | ------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| G1  | No `pnpm db:sync` alias or orchestrator                                                     | Gap                         | `package.json`; repo grep                                                                  | Must add facade only                                                       |
| G2  | Three content writers + one mirror + schema migrate are separate                            | Architecture                | content-parity doc; package aliases                                                        | Orchestrate; do not merge engines                                          |
| G3  | Mirror per-row upsert failures warn and continue; may exit 0 with incomplete apply          | Risk                        | `preview-sync-db.ts` `throwOnError: false`; orchestrator counts only thrown phase failures | Define completion contract when wrapping mirror                            |
| G4  | Mirror Storage skipped if Preview service role missing; DB rows may lack binaries           | Risk                        | `preview-sync-invitations.ts` Phase 6                                                      | Fail closed or explicit `STORAGE_SKIPPED` blocking status                  |
| G5  | `pruneStaleRecords` exported but **zero callers**; live path is report-only stale detection | Dead / policy ambiguity     | `preview-sync-db.ts:141+`; no imports                                                      | Do not enable prune silently; decide in Open Decisions                     |
| G6  | Async StatusProbeSession path lacks `redact: [dbUrl]`                                       | Exposure                    | `probe-runner.ts` `runPsqlAsync` vs `psqlSync`                                             | Prefer sync+redact or fix before reuse in JSON errors                      |
| G7  | Dry-run mirror still reads Production content into process memory/console                   | Exposure (accepted for ops) | dry-run tests; orchestrator                                                                | Redact URLs; avoid dumping content values in JSON                          |
| G8  | `secure_url` / Cloudinary columns not rewritten by mirror                                   | Gap                         | URL rewrite only on `content`/`snapshot`                                                   | Document out-of-scope or extend allowlist carefully                        |
| G9  | README claims `invitation:update` does “direct Production release”                          | Doc drift **[D]**           | `README.md` vs `invitation-update-options.ts` rejecting Production                         | Fix in Goal 3 docs pass; do not encode in `db:sync`                        |
| G10 | `docs/database-workflow.md` Principle says Local→Production only via migrations             | Doc drift **[D]**           | Omits `invitation:promote`                                                                 | Same                                                                       |
| G11 | Content Sync UI name overlaps “sync” but is demo-only                                       | Confusion                   | `content-sync.astro`, `ContentSyncPanel`                                                   | Keep out of `db:sync`; document boundary                                   |
| G12 | Outer `db-guard` does not see mirror `TRUNCATE CASCADE` SQL                                 | Residual                    | guard operation string `sync-invitations`                                                  | Keep in-script guards; document                                            |
| G13 | Compact `dbs` exits 0 when `ok:false`                                                       | Contract trap               | `dbs-cli.ts`                                                                               | `db:sync` must not copy hook-safe exit semantics for apply/diagnose-strict |
| G14 | Cross-machine concurrency uncoved                                                           | Accepted residual           | `database.md`                                                                              | Document; no distributed lock in Goal 2                                    |
| G15 | Preserve-local refresh plan blocked / incomplete                                            | Unrelated legacy plan       | `.agent/plans/active/preserve-local-refresh-workflow.md`                                   | Do not absorb into Goal 2                                                  |
| G16 | Windows `${PREVIEW_DB_URL}` expansion in npm script                                         | Residual **[I]**            | `package.json` mirror alias                                                                | Existing pattern; validate in Goal 2 CLI tests on Windows                  |

---

## 4. Reuse and extraction plan

### 4.1 Reuse directly (do not reimplement)

| Component                              | Path                                                  | Use in `db:sync`       |
| -------------------------------------- | ----------------------------------------------------- | ---------------------- |
| Target classify / redact / table lists | `scripts/db/db-target-config.ts`                      | Direction + allow/deny |
| DB guard                               | `scripts/db/db-guard.ts`                              | Preflight identity     |
| StatusProbeSession                     | `scripts/status-core/probe-runner.ts`                 | Read probes            |
| Availability verify                    | `scripts/db/verify-required-database-availability.ts` | Integrity claims       |
| Schema lifecycle                       | `schema-lifecycle-state.ts` + migration-probe         | Schema posture         |
| Canonical compare                      | `promotion-comparison.ts` + `content-parity.ts`       | Compare mode           |
| Package / plan / preconditions         | `invitation-package*.ts`, `invitation-update-plan.ts` | Plan mode              |
| Local/Preview/Production writers       | update CLI engines + promote                          | Apply dispatch         |
| Preview approval                       | `preview-approval-service.ts`                         | Promote prerequisites  |
| Preview write auth                     | `preview-write-auth.ts`                               | Preview apply          |
| Owner Production apply                 | `owner-production-apply.ts`                           | Production apply       |
| Release-check / backup manifest        | `release-check.ts`, `backup-manifest.ts`              | Production gates       |
| Mirror implementation                  | `preview-sync-*`                                      | Mirror direction only  |
| Project refs                           | `environment-identity.ts`                             | Identity assertions    |

### 4.2 Minimum shared extraction (only if required)

Extract **only** when Goal 2 cannot safely call existing entrypoints without duplication:

| Candidate                         | Trigger to extract                                                   | Keep out of extraction            |
| --------------------------------- | -------------------------------------------------------------------- | --------------------------------- |
| Secret-free JSON result mapper    | If multiple CLIs need one envelope                                   | Do not move mutation logic        |
| Direction/policy allowlist module | If CLI + docs need one SSOT table                                    | Do not re-encode auth             |
| Mirror completion aggregator      | If wrapping mirror and needing fail-closed partial upsert accounting | Do not rewrite Storage/upsert SQL |

**Do not extract** a new Storage client, approval schema, backup format, or import engine.

### 4.3 Must not reimplement

1. Second Production→Preview table/Storage mirror
2. Second promote/update engine or publication RPC path
3. Second canonicalizer
4. Second owner-auth or Preview-auth mechanism
5. Schema migrate inside content sync
6. Demo Content Sync inside managed sync
7. Authorization from worktree/lane/credential presence

---

## 5. Legacy disposition

| Candidate                                                                | Disposition                                                                                           | Evidence                                          | Goal                                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| `pruneStaleRecords` in `preview-sync-db.ts`                              | **Unresolved → likely REMOVE** if confirmed unused after Goal 2 wiring; today zero callers            | Grep: definition only                             | Goal 2/3                                                             |
| README Production-release wording for `invitation:update`                | **FIX docs**                                                                                          | README vs code                                    | Goal 3                                                               |
| `docs/database-workflow.md` Principle Local→Production “migrations only” | **FIX docs**                                                                                          | Omits promote                                     | Goal 3                                                               |
| `db:local:refresh-from-prod*` blocked aliases                            | **KEEP** fail-closed                                                                                  | package.json                                      | —                                                                    |
| Removed ops (`adopt-legacy-events`, etc.)                                | **KEEP removed**                                                                                      | database.md / scripts README                      | —                                                                    |
| `db:preview:sync-invitations`                                            | **KEEP** as specialized alias; optionally become thin wrapper over `db:sync --direction mirror` later | package.json; KEEP_SPECIALIZED in migration audit | Goal 2 optional alias; Goal 3 deprecation only after callers migrate |
| Content Sync dashboard                                                   | **KEEP** orthogonal                                                                                   | demo-only APIs                                    | —                                                                    |
| Preserve-local refresh plan                                              | **Unresolved / blocked** — not obsolete proof for code deletion                                       | active plan status `blocked`                      | Out of Goal 2                                                        |
| `production_authorization_receipts`                                      | Historical inert (per database.md)                                                                    | rules                                             | Do not revive                                                        |
| Deprecated `--allowlist` / `EXPECTED_MIGRATIONS` migrate shims           | Schema-only; out of content sync                                                                      | database.md                                       | Out of Goal 2                                                        |

Unproven “obsolete” claims remain **unresolved**.

---

## 6. Goal 2 specification

### 6.1 Objective

Implement `pnpm db:sync` as the **canonical orchestration CLI** for invitation database
synchronization diagnosis, comparison, planning, and delegated apply — without creating a second
sync/migration/Storage/approval/backup/promotion engine.

### 6.2 In scope

1. Register `db:sync` in `package.json` (SSOT).
2. New orchestrator module under `scripts/db/` (or `scripts/provision/` if it only composes
   provision engines — prefer `scripts/db/db-sync-cli.ts` + thin `db-sync-orchestrator.ts` to match
   other `db:*` aliases). **[I default]**
3. Modes:
   - `diagnose` (default): availability + status probes + schema lifecycle for requested targets
   - `compare`: semantic content-parity (+ optional inventory cross-db reconcile as secondary)
   - `plan`: build immutable plan (direction-specific) with `planId`, fingerprints, redacted
     identities
   - `apply`: revalidate plan, enforce auth gates, **delegate** to existing engines
4. Direction allowlist from §2.2; fail closed otherwise.
5. Versioned JSON (`schemaVersion: 1.0.0`) + human stderr/stdout conventions matching
   migrate/promote patterns.
6. Exit codes per §2.14.
7. Tests: unit/contract tests for parsing, direction gates, redaction, JSON schema, exit codes, and
   “no second engine” ownership (orchestrator imports engines; does not copy SQL/Storage).
8. Docs touch: `scripts/README.md` inventory row + pointer from
   `docs/core/content-parity-rsvp-isolation.md` / `database.md` Current Contract — **minimal**, no
   full runbook rewrite (Goal 3).

### 6.3 Out of scope (Goal 2)

- Implementing a new table upsert / Storage PUT / approval / backup / migrate engine
- Enabling automatic stale Preview pruning
- Changing Production owner-auth to allow noninteractive apply
- Copying Production PII into Preview
- Absorbing demo Content Sync or lane-sync
- Completing preserve-local refresh
- Broad hosted live applies in CI
- Removing `db:preview:sync-invitations` (may wrap; must not break callers)

### 6.4 Dependencies (must exist; already in repo)

All §4.1 components. Schema migrate remains a **prerequisite check** (`CURRENT`) for promote, not a
sub-step that applies migrations.

### 6.5 Implementation sequence

1. **Contracts module** — direction enum, mode enum, JSON envelope types, exit helpers, redaction
   asserts (pure).
2. **Diagnose/compare** — wire availability + StatusProbeSession/`dbs-status` helpers +
   content-parity; read-only.
3. **Plan** — for update/promote directions call existing plan builders; for mirror build a mirror
   plan fingerprint (source/target refs + table allowlist hash + content row counts/digests as
   available without inventing a second compare engine — prefer reusing content-parity digests).
   **[I]**
4. **Apply dispatch**
   - `update-*` → invoke existing update lifecycle APIs (not subprocess re-entry if importable;
     subprocess acceptable if safer for process isolation — prefer in-process exported functions
     already used by CLIs).
   - `promote` → existing promote preflight/apply + owner gate
   - `mirror` → existing preview-sync main phases after Preview auth; enforce stricter completion if
     G3 addressed
5. **package.json alias** + scripts README
6. **Tests** + `pnpm validate:changed` / type-check per gatekeeper
7. **Acceptance** against §6.7

### 6.6 Constraints (non-negotiable)

- Do not weaken Preview or Production controls.
- Do not move server-only logic into interactive presentation / client islands.
- Do not expose secrets in logs, reports, fixtures, snapshots, or `--json`.
- Do not execute writes against Preview/Production in Goal 2 development unless explicitly
  owner-authorized in a later task; default tests mock boundaries.
- Prefer reuse; extract only per §4.2.
- Technical commit messages must not mention “Goal 1/2”.

### 6.7 Acceptance criteria (Goal 2)

1. `pnpm db:sync` exists in `package.json` and implements diagnose/compare/plan/apply.
2. Every apply direction delegates to an existing authoritative engine; ownership test proves no
   duplicated mirror SQL/Storage/promote gate.
3. Direction allowlist enforced with fail-closed errors.
4. `EXCLUDED_TABLES` / no Production PII→Preview preserved for mirror path.
5. Production apply still requires owner TTY + release-check + backup gate; Preview apply still
   requires scope or TTY YES.
6. Plans carry immutable `planId`; apply revalidates; drift aborts.
7. JSON output is versioned and secret-free; exit codes match §2.14.
8. Interactive and headless diagnose/compare produce semantically equal machine fields.
9. Existing `db:preview:sync-invitations`, `invitation:update`, `invitation:promote`,
   `invitation:content-parity`, `dbs`, migrate, and backup contracts remain operational.
10. Repository remains buildable (`type-check` / targeted tests green).

### 6.8 Suggested test matrix

| Test                        | Proves                                                               |
| --------------------------- | -------------------------------------------------------------------- |
| Direction matrix unit       | Forbidden directions exit 1                                          |
| Redaction unit              | URLs/keys absent from JSON serializer                                |
| Diagnose unavailable target | Typed reason; no fake PASS                                           |
| Compare IDENTITY_CONFLICT   | ok false                                                             |
| PlanId stability            | Same inputs → same planId; precondition change → drift               |
| Apply promote without TTY   | Blocked                                                              |
| Apply mirror without auth   | Blocked                                                              |
| Dry-run mirror via facade   | Zero writes (reuse/extend `preview-sync-dry-run` patterns)           |
| Ownership                   | Orchestrator does not redefine `CONTENT_MIRROR_TABLES` / owner apply |

---

## 7. Open decisions

Only items that cannot be fully resolved from repository evidence:

### OD-1 — Exact product scope of `db:sync` apply directions

| Option                                                                     | Pros                                                               | Cons                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| **A. Full facade** (update + promote + mirror + diagnose/compare)          | One operator entry; matches audit breadth                          | Larger Goal 2 surface                          |
| **B. Mirror-centric** (`diagnose/compare` + Production→Preview apply only) | Smallest change; closest to existing `db:preview:sync-invitations` | Leaves promote/update as separate CLIs forever |
| **C. Diagnose/compare/plan only** (no apply)                               | Safest                                                             | Does not deliver apply orchestration           |

**Recommended default: A**, because the Goal 1 required-decision list explicitly includes Preview
approval, Production prerequisites, and headless/interactive parity across the managed lifecycle —
not only mirror. Implement apply as **dispatch**, not new engines.

### OD-2 — Stale Preview invitation prune policy

| Option                                          | Pros                | Cons                                                                   |
| ----------------------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| **A. Keep report-only** (current live behavior) | Safer; matches docs | Preview can retain orphans                                             |
| **B. Opt-in `--prune-stale` on mirror apply**   | Explicit cleanup    | Needs Preview auth + tests; revive or replace dead `pruneStaleRecords` |
| **C. Always prune on apply**                    | Cleaner Preview     | Surprising data loss                                                   |

**Recommended default: A** for Goal 2; classify `pruneStaleRecords` for Goal 3 removal or revival
under B.

### OD-3 — Mirror partial-upsert completion

| Option                                                      | Pros               | Cons                                                        |
| ----------------------------------------------------------- | ------------------ | ----------------------------------------------------------- |
| **A. Preserve warn-and-continue**                           | No behavior change | Facade can claim success incorrectly                        |
| **B. Fail closed if any row upsert fails**                  | Honest completion  | Behavior change for `db:preview:sync-invitations` if shared |
| **C. Facades fail closed; legacy alias keeps old behavior** | Compat             | Dual semantics                                              |

**Recommended default: B** when invoked through `db:sync`; if alias wraps the same function,
document the stricter contract as intentional hardening (does not weaken gates; tightens success).
Confirm with owner if legacy alias must stay soft.

### OD-4 — Orchestrator home package path

| Option                                  | Pros                        | Cons                                     |
| --------------------------------------- | --------------------------- | ---------------------------------------- |
| **A. `scripts/db/db-sync-*.ts`**        | Matches `db:*` alias family | Will import provision modules            |
| **B. `scripts/provision/db-sync-*.ts`** | Near update/promote         | Breaks `db:*` → `scripts/db/` convention |

**Recommended default: A** with imports from `scripts/provision/*`.

### OD-5 — Cloudinary / non-Supabase asset URLs in mirror

Evidence shows Supabase public URL rewrite only. Whether Cloudinary `secure_url` must be mirrored is
**unresolved**.

**Recommended default:** out of scope for Goal 2; document as known limitation; track only if
Production content depends on it for Preview regression.

---

## 8. Goal 2 readiness checklist

| Criterion                                                                                  | Status                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Authoritative implementation identified per responsibility                                 | **Met** (or explicit unresolved: OD-2/3/5) |
| Callers, dependencies, server-only boundaries, artifacts mapped                            | **Met**                                    |
| Sync resource boundary + directions unambiguous                                            | **Met** (§2.1–2.2)                         |
| Contracts for diagnose/conflicts/plans/locks/approvals/gates/redaction/failures/JSON/exits | **Met** (§2)                               |
| Reuse vs minimal extraction demonstrated                                                   | **Met** (§4)                               |
| Legacy candidates evidenced                                                                | **Met** (§5)                               |
| Security / exposure risks documented                                                       | **Met** (§3 G3–G7, G12–G13)                |
| Actionable Goal 2 spec without hidden architecture deps                                    | **Met** (open decisions listed)            |
| No runtime implementation changes in Goal 1                                                | **Met** (report only)                      |
| Buildable / operational contracts preserved                                                | **Met** (no code mutations)                |

---

## 9. Key file index (relative)

```text
package.json
docs/core/content-parity-rsvp-isolation.md
docs/database-workflow.md
docs/domains/intake/production-flow.md
.agent/rules/database.md
.agent/rules/invitation-production.md
.agent/workflows/managed-invitation-lifecycle.md
scripts/README.md
scripts/db/db-target-config.ts
scripts/db/db-guard.ts
scripts/db/preview-sync-invitations.ts
scripts/db/preview-sync-db.ts
scripts/db/preview-sync-storage.ts
scripts/db/preview-sync-guards.ts
scripts/db/preview-sync-report.ts
scripts/db/owner-production-apply.ts
scripts/db/release-check.ts
scripts/db/backup-manifest.ts
scripts/db/verify-required-database-availability.ts
scripts/db/migration-plan.ts
scripts/db/local-restore-from-dump.ts
scripts/status-core/probe-runner.ts
scripts/status-core/migration-probe.ts
scripts/status-core/invitation-meta.ts
scripts/provision/dbs-status.ts
scripts/provision/managed-status.ts
scripts/provision/dbs-cli.ts
scripts/provision/content-parity.ts
scripts/provision/promotion-comparison.ts
scripts/provision/invitation-update-cli.ts
scripts/provision/invitation-update-plan.ts
scripts/provision/invitation-lifecycle-execution.ts
scripts/provision/invitation-promote.ts
scripts/provision/invitation-promote-cli.ts
scripts/provision/preview-approval-service.ts
scripts/provision/preview-write-auth.ts
scripts/provision/invitation-package.ts
src/lib/intake/mutations/environment-identity.ts
src/pages/dashboard/admin/content-sync.astro
src/components/dashboard/content-sync/ContentSyncPanel.tsx
tests/db/preview-sync-dry-run.test.ts
tests/db/preview-sync-invitations.test.ts
tests/provision/content-parity.test.ts
tests/provision/preview-approval-service.test.ts
tests/provision/production-authorization.test.ts
tests/unit/status-core.test.ts
tests/unit/database-availability-preflight.test.ts
tests/unit/backup-manifest.test.ts
```

---

## 10. Authority note

This report is the Goal 1 deliverable and the implementation contract for Goal 2. Historical plans
under `.agent/plans/archived/` and the schema-migration unification reports are **evidence only**;
where they conflict with live code, live code wins. After Goal 2 lands, durable operator policy
should be migrated into `docs/core/content-parity-rsvp-isolation.md` / `.agent/rules/database.md`
and this report retained as point-in-time evidence.
