---
title: Status Surface Consolidation — Goal 1 Audit
status: implemented
created: 2026-08-12
updated: 2026-08-12
related_docs:
  - docs/domains/database/cheatsheets/status-diagnostics.md
  - docs/core/architecture.md
  - .agent/plans/archived/canonical-migration-invitation-state-goal1-audit.md
  - .agent/plans/archived/canonical-migration-invitation-state-goal2-report.md
  - .agent/plans/archived/invitation-promotion-status-goal1-audit.md
supersedes: []
superseded_by:
  - status-surface-consolidation-goal2-report.md
---

# Goal 1 — Consolidation Audit and Canonical Status Architecture

Read-only audit of executable paths for `pnpm dbs`, `/dashboard/estado`, and
`/dashboard/observabilidad`. No code, database, Preview, Production, route, or
configuration mutations were performed.

This document is the Goal 2 implementation contract. Goal 2 must not rediscover
ownership, introduce a second status vocabulary, or delete `/dashboard/observabilidad`
until every dependency below has the listed disposition applied.

## Task Contract

| Field | Value |
| --- | --- |
| Objective | One evidence model, one canonical status core, one technical CLI (`pnpm dbs`), one human dashboard (`/dashboard/estado`). Observability unique diagnostics survive as progressive disclosure on Estado. |
| Authorized actions | Read-only inspection. No writes. |
| Scope | The three named surfaces, their collectors, classifiers, caches, UI, tests, navigation, and documented consumers. |
| Non-goals | Redesigning the operational workflow; broadening diagnostics beyond existing justified capabilities; deleting or deprecating during Goal 1; Vercel polling; applying promotions or migrations. |
| Invariants | Schema, publication, and readiness classified once. Diagnostic code may enrich but must not override `classifySchemaLifecycle`, `classifyLiveInvitation`, `deriveSchemaOperationFields`, or `decidePromotionAction`. No secrets in UI. Relative paths only. |
| Acceptance | Every responsibility classified; one authority per shared domain; every Observability capability marked preserve / integrate / remove; duplicate probes identified; evidence strategy does not add remote polling; every Observability route dependency has MOVE / REUSE / REPLACE / DELETE; no unresolved item changes reuse vs delete. |

---

## 1. Current architecture and data-flow map

Two independent pipelines currently answer overlapping operator questions with
**different evidence, different vocabularies, and different next-action rules**.

```text
                         ┌─────────────────────────────────────┐
                         │  Shared-looking primitives (today)  │
                         │  registry.ts                        │
                         │  classifyDbTarget / resolveDbUrl    │
                         │  classifySchemaLifecycle            │
                         │  StatusProbeSession (dbs/estado)    │
                         │  runtime-gate + access (both UIs)   │
                         └──────────────┬──────────────────────┘
                                        │
            ┌───────────────────────────┴────────────────────────────┐
            │                                                        │
            ▼                                                        ▼
 ┌──────────────────────────┐                         ┌──────────────────────────────┐
 │ CANONICAL STATUS PIPELINE│                         │ OBSERVABILITY PIPELINE       │
 │ pnpm dbs  +  /estado     │                         │ /observabilidad + inventory  │
 └────────────┬─────────────┘                         └──────────────┬───────────────┘
              │                                                      │
              ▼                                                      ▼
  scripts/status-core/*                                 scripts/observability/*
  promotional-evidence SQL (sha256)                     database-projection SQL
  promotional-fingerprint.ts                            (JSON + receipts + display
  decidePromotionAction                                 meta; NO sha256)
  deriveSchemaOperationFields                           delivery-reconciliation.ts
                                                        applyNextStep per env
                                                        overall-status dual axes
              │                                                      │
              ▼                                                      ▼
  CanonicalStatusView                                   ObservabilitySnapshot v3
  LIVE | CACHED | UNVERIFIED                            FRESH | STALE | PARTIAL
  schema / publication / readiness                      HEALTHY/ATTENTION/BLOCKED
                                                        ALIGNED/IN_PROGRESS/...
              │                                                      │
      ┌───────┴────────┐                                    ┌────────┴─────────┐
      ▼                ▼                                    ▼                  ▼
 pnpm dbs text    /dashboard/estado                 /dashboard/observabilidad
 --compact        CanonicalStatusPanel              ObservabilityPanel
 git hook         GET /api/dashboard/estado         GET /api/dashboard/
                  local-first, explicit refresh     observabilidad
                                                    summary=Local probe
                                                    detail=all-env probe
                                                    auto-fetch on mount
```

### 1.1 `pnpm dbs` (technical / automation)

| Item | Path |
| --- | --- |
| Entrypoint | `package.json` `dbs` → `scripts/provision/dbs-cli.ts` |
| Default / `--json` / `<slug>` / `--verbose` / `--in-sync` | `buildCanonicalStatusView()` → `formatCanonicalStatusView` / `formatSlugStatusView` |
| `--compact` (no slug) | `runCompactManagedStatusSafe` → connectivity CONTENT + schema. Git-hook path. **Not publication.** |
| `--compact <slug>` / `--aggregate-content` | `evaluateInvitationStatus` → `classifyPackageHashContent` (provenance `package_hash` + timestamps). **Competing publication classifier.** |
| Git hook | `scripts/provision/managed-status-git-hook.mjs` → `pnpm dbs --compact --timeout-ms 2500` (fail-open) |

Default composition (`scripts/provision/canonical-status.ts`):

1. `resetStatusProbeSession()` + one `StatusProbeSession`
2. `listExpectedMigrationVersions()` (repo filesystem)
3. `assertCurrentDisposableMigrationProof()` (filesystem receipt)
4. `evaluateGeneralStatus` — connectivity, `classifyDbTarget`, active-row counts, identity-conflict counts, `readMigrationLifecycleForUrl`, `deriveSchemaOperationFields`
5. `evaluateManagedPromotionStatus` — canonical fingerprint + `readGroupedPromotionalEvidence` + `classifyLiveInvitation` + `decidePromotionAction` + `presentPromotionRow`

### 1.2 `/dashboard/estado` (human operational UI)

| Item | Path |
| --- | --- |
| Page | `src/pages/dashboard/estado.astro` |
| API | `GET /api/dashboard/estado` (`refresh=1`, optional `env`, `domain`) |
| Access | `requireLocalObservabilityAccess` + `admin:estado` rate limit (6/60s) |
| Runtime | `isLocalObservabilityRuntime` — persistent-Local only; hosted Vercel → 404 |
| SSR | `getCanonicalStatusView()` — in-memory 60s cache **or** `--local` child (repo + disposable proof, all remotes `UNVERIFIED`). **No remote probe.** |
| Refresh | `refreshCanonicalStatusView` → child `scripts/provision/print-canonical-status.ts` → same `buildCanonicalStatusView` as `pnpm dbs` |
| Merge | `src/lib/status/merge.ts` re-runs `decidePromotionAction` on partial env/domain refresh |
| UI | `src/components/dashboard/status/CanonicalStatusPanel.tsx` |
| Styles | `src/styles/dashboard/_canonical-status.scss` |

Estado and default `pnpm dbs` already share `CanonicalStatusView`. They do **not** share
collectors, caches, or classifiers with Observabilidad.

### 1.3 `/dashboard/observabilidad` (human diagnostic UI — to be removed after Goal 2)

| Item | Path |
| --- | --- |
| Page | `src/pages/dashboard/observabilidad.astro` |
| API | `GET /api/dashboard/observabilidad?mode=summary\|detail` |
| Access | Same Local + `super_admin` gate; `admin:observabilidad` rate limit (6/60s) |
| SSR summary | `buildObservabilitySummaryPayload()` — **probes Local** (content + migration) |
| Client mount | Always `mode=detail` — **probes Local + Preview + Production** |
| Cache | 60s TTL; 5 min STALE fallback with `SNAPSHOT_REFRESH_FAILED` |
| Child | `scripts/observability/print-snapshot.ts` → `collectSnapshotEvidence` → `assembleSnapshotFromEvidence` |
| UI | `src/components/dashboard/observability/ObservabilityPanel.tsx` |
| Styles | `src/styles/dashboard/_observability.scss` |

Non-dashboard consumers of the same snapshot engine:

| Consumer | How |
| --- | --- |
| `pnpm invitation:inventory-audit` | `inventory-audit-cli.ts` calls `buildObservabilitySnapshot({ probeScope: 'all' })` **and** `runInventoryAudit()` which independently calls `readEnvironmentDatabaseProjection` (duplicate probes in one command) |
| `pnpm test:local-render-corpus` / screenshot CLI | `validation-evidence.ts` / `fingerprints.ts` / `source-state.ts` — **not** the dashboard snapshot; keep as CLI validation evidence |

### 1.4 Independent domains (already established; do not collapse)

```text
SCHEMA / MIGRATION PARITY     classifySchemaLifecycle
≠ INVITATION PUBLICATION      classifyLiveInvitation + decidePromotionAction
≠ SCHEMA OPERATION READINESS  deriveSchemaOperationFields (disposable proof + pending)
≠ DIAGNOSTIC ENRICHMENT       reason codes, semantic paths, assets, baselines, draft schema
```

Observability currently mixes the first and last into dual axes
(`operationalStatus` / `deliveryStatus`) and derives **its own** next steps
(`APPLY_LOCAL` / `PROMOTE_PREVIEW` / `PROMOTE_PRODUCTION` per environment,
without Preview-first). That is a second publication authority.

---

## 2. Responsibility classification matrix

Legend: `CANONICAL_SHARED` | `DIAGNOSTIC_UNIQUE` | `PRESENTATION_ONLY` | `REDUNDANT` | `OBSOLETE` | `UNRESOLVED`

`UNRESOLVED` is used only where implementation shape is optional. **No UNRESOLVED
item changes whether a file is reused or deleted.**

### 2.1 Required domains

| Responsibility | Classification | Evidence | Goal 2 rule |
| --- | --- | --- | --- |
| Environment identity / connectivity | `CANONICAL_SHARED` | `resolveDbUrlForEnv` + `classifyDbTarget` + `StatusProbeSession.probeConnectivity`. Observability re-classifies via `targetClassification !== expectedTarget` → `ENVIRONMENT_IDENTITY_CONFLICT`. | One connectivity probe per env per session. Surface mismatch on Estado (currently missing from `CanonicalStatusView`). |
| Migration parity | `CANONICAL_SHARED` | Both call `readMigrationLifecycleForUrl` / `classifySchemaLifecycle`. Observability then remaps `BEHIND` → `SCHEMA_BEHIND` + `AUDIT_SCHEMA`, and `BEHIND` without IDs → `SCHEMA_UNAVAILABLE`. | Classify once. Exact pending/extra IDs already on `CanonicalEnvSummary`. Observability remap is presentation/diagnostic only. |
| Operation readiness | `CANONICAL_SHARED` | Only dbs/estado: `deriveSchemaOperationFields` + disposable proof. Observability **does not classify readiness** and can say `SCHEMA_BEHIND` / `AUDIT_SCHEMA` while Estado says `NEEDS_DISPOSABLE_PROOF`. | Diagnostics must not override readiness. Disposable-test stays a separate block. |
| Invitation publication / promotion state | `CANONICAL_SHARED` | Fingerprint + `classifyLiveInvitation` + `decidePromotionAction`. Observability uses 3-way semantic patch + per-env `applyNextStep` **without Preview-first**. | Publication action is canonical only. Semantic outcomes enrich; they do not decide `PROMOTE_*`. |
| Evidence freshness | `CANONICAL_SHARED` | Canonical: `LIVE` / `CACHED` / `UNVERIFIED`. Observability: `FRESH` / `STALE` / `PARTIAL` plus coverage `AVAILABLE` / `NOT_PROBED`. | Adopt canonical three-state. Map `NOT_PROBED`/failed rebuild → `UNVERIFIED`. Drop `STALE` as a fourth vocabulary (failed refresh keeps previous view as `CACHED` plus error). |
| Next-action / handoff derivation | `CANONICAL_SHARED` | `decidePromotionAction` + `derivePromotionHandoff` / `deriveSchemaOperationFields.schemaNextAction`. Observability `ObservabilityNextStep` is a parallel policy table. | Canonical handoff only. Diagnostic `nextStep` labels may describe owning workflow **after** canonical action is known; they must not emit a conflicting promote destination. |
| Semantic drift | `DIAGNOSTIC_UNIQUE` | `apply3WaySemanticPatch` + bounded `semanticPaths`. Fingerprint equality does not list fields. | Preserve as advanced diagnostics when publication is not `match`. Must not independently emit `DRIFT` as a promotion block if `classifyLiveInvitation` already returned `behind`/`diverged`/`conflict`. |
| Draft validation | `DIAGNOSTIC_UNIQUE` | Observability `eventContentSchema` → `DRAFT_INVALID` / `REPAIR_MANAGED_DRAFT`. Canonical fingerprint fail-closes to `unknown`. | Preserve as diagnostic on `unknown`/`diverged` rows. Do not invent a new publication state. |
| Baselines / provenance | `DIAGNOSTIC_UNIQUE` | `resolveVerifiedManagedBaseline` + receipts. Canonical publication **correctly ignores** provenance `package_hash` as live equality (prior audit). | Preserve to explain *how* to reconcile when fingerprints differ. Never treat provenance hash as MATCH. |
| Asset diagnostics | `DIAGNOSTIC_UNIQUE` | Observability: displayName+mime+dimensions+fileSize slot matching → `REQUIRED_PUBLISHED_ASSET_MISSING` / `UNPUBLISHED_ASSET_PENDING` / `ASSET_IDENTITY_UNVERIFIED`. Canonical: sha256 + managed key; missing digest → `unknown`. | Preserve slot/identity diagnostics. Equality authority remains sha256 fingerprint. Do not use display-meta as publication MATCH. |
| Identity conflicts | `CANONICAL_SHARED` + diagnostic detail | Canonical: `conflict` per slug; general status `identityConflictsCount` **not copied into `CanonicalStatusView`**. Observability: `INVITATION_IDENTITY_CONFLICT` + `AUTHORITATIVE_COUNT_MISMATCH`. | Count + per-slug `conflict` are canonical. Extra reason split (row vs aggregate) is diagnostic labeling only. |
| Deep diagnostic reason codes | `DIAGNOSTIC_UNIQUE` | Typed `ObservabilityReasonCode` list. Several codes duplicate canonical reasons under other names (see §5). | Keep the unique codes. Collapse duplicates onto canonical `reasonCode`. |

### 2.2 Adjacent responsibilities

| Responsibility | Classification | Disposition |
| --- | --- | --- |
| Managed registry inventory | `CANONICAL_SHARED` | `listInvitationDefinitions()` remains the only promotional corpus. |
| Active DB row counts (all non-archived) | `CANONICAL_SHARED` | Keep labeled “not registry”. |
| Dual-axis HEALTHY / ALIGNED aggregation | `REDUNDANT` | Competing status vocabulary. Do not port as Estado header. Underlying signals survive. |
| Per-env `applyNextStep` without Preview-first | `OBSOLETE` | Conflicts with `decidePromotionAction`. Delete as authority. |
| `--compact` connectivity CONTENT | `PRESENTATION_ONLY` | Keep for git hook. Must stay fast; no fingerprinting. |
| `--compact <slug>` package-hash CONTENT | `REDUNDANT` | Competing publication classifier (`classifyPackageHashContent` + clocks). Compact slug must stop claiming MATCH/BEHIND. Operators use `pnpm dbs <slug>`. |
| Observability summary mode (Local-only bootstrap) | `REDUNDANT` | Estado already bootstraps local-first `UNVERIFIED` without probing remotes. Delete summary API. |
| STALE snapshot fallback (5 min) | `REDUNDANT` | Replace with Estado behavior: keep last successful view as `CACHED` and show refresh error. |
| Auto detail-fetch on Observability mount | `OBSOLETE` | Hidden remote polling. Estado refresh is explicit. |
| Legacy render-corpus presence in dashboard | `DIAGNOSTIC_UNIQUE` | Justified, but **not** the publication queue. Advanced diagnostics or keep CLI-only via `invitation:inventory-audit`. Do not mix into attention cards. |
| Inventory category matrix | `PRESENTATION_ONLY` (CLI) | `inventory-audit.ts` stays a technical CLI. Not the human dashboard default. |
| Validation evidence (regression/screenshots) | `PRESENTATION_ONLY` (CLI) | Not consumed by either dashboard today. Keep under `scripts/observability/validation-evidence.ts`; not Estado. |
| Reporting envelope (commit SHA, evidence fingerprint) | `PRESENTATION_ONLY` | Useful for inventory-audit JSON / verbose CLI. Optional in Estado advanced details. Not a classifier. |
| CLI vs UI rendering | `PRESENTATION_ONLY` | `canonical-status-format.ts` vs `CanonicalStatusPanel.tsx`. Keep both. |
| Child-process isolation for Astro | `CANONICAL_SHARED` | One spawner (`print-canonical-status.ts`). Observability’s duplicate spawner is `REDUNDANT`. |
| Local runtime gate + strong admin | `CANONICAL_SHARED` | Reuse `runtime-gate.ts` + `access.ts` (already shared). Do not rename. |
| Rate limit | `CANONICAL_SHARED` | Keep `admin:estado`. Delete `admin:observabilidad` after route removal. |
| Vercel / deployment status | `OBSOLETE` | Not on any of the three paths. Must not be added. |
| `content-parity` / `cross-db-reconcile` | out of dashboard scope | Remain separate diagnostic CLIs. Do not duplicate into Estado. |

---

## 3. Canonical authority map

Do not create a new umbrella module that only renames these functions.

| Domain | Authoritative module | Tokens | Consolidation required? |
| --- | --- | --- | --- |
| Registry | `scripts/provision/invitations/registry.ts` `listInvitationDefinitions` | managed slugs | No |
| DB URL / target identity | `scripts/provision/dbs-status.ts` `resolveDbUrlForEnv` + `scripts/db/db-guard.ts` `classifyDbTarget` | `persistent-local` / `preview` / `production` | No. Observability must stop independent expected-target checks except as a presentation of this classification. |
| Connectivity / memoized psql | `scripts/status-core/probe-runner.ts` `StatusProbeSession` | execution-local memo | **Yes:** Observability content reads use raw `runPsql` and create a **new** `StatusProbeSession` per migration env. All collectors must accept the shared session. |
| Schema lifecycle | `scripts/db/schema-lifecycle-state.ts` `classifySchemaLifecycle` via `scripts/status-core/migration-probe.ts` | `CURRENT` \| `BEHIND` \| `SCHEMA_DRIFT` \| `UNVERIFIED` | No. Observability `readMigrationProjection` already calls this. |
| Schema operation readiness | `scripts/provision/dbs-status.ts` `deriveSchemaOperationFields` | `READY` \| `NEEDS_DISPOSABLE_PROOF` \| … | No. Not present in Observability — do not add a second readiness table. |
| Disposable proof | `scripts/db/disposable-migration-proof.ts` | valid / missing / stale | No |
| Live publication evidence (light) | `scripts/status-core/promotional-evidence.ts` | grouped JSON + sha256 | See §4 for unification with diagnostic SQL |
| Canonical fingerprint | `scripts/provision/promotional-fingerprint.ts` `classifyLiveInvitation` | `match` \| `behind` \| `absent` \| `diverged` \| `conflict` \| `unknown` | No |
| Promotion action | `src/lib/status/decision.ts` `decidePromotionAction` | `NONE` \| `PROMOTE_*` \| `BLOCKED` \| `UNKNOWN` + `PromotionReasonCode` | No |
| Handoff / labels | `src/lib/status/presentation.ts` | commands, source/destination | No |
| View model | `src/lib/status/types.ts` `CanonicalStatusView` | schemaVersion 1 | **Minimal extend:** identity-conflict counts, optional `diagnostics[]` that cannot change `action` |
| Compose | `scripts/provision/canonical-status.ts` `buildCanonicalStatusView` | — | **Minimal extend:** optional diagnostic pass using the same session |
| Dashboard cache / child | `src/lib/status/server/canonical-status.ts` | 60s, explicit refresh | Reuse; add `diagnostics=1` query flag that does **not** spawn a second child |
| Compact connectivity | `scripts/provision/managed-status.ts` | CONTENT connectivity vocabulary | Keep. Must not call fingerprint or package-hash as publication. |
| Package-hash classifier | `scripts/status-core/classify-content.ts` | MATCH_CANONICAL / clocks | **Not publication authority.** Compact slug must stop using it as CONTENT publication. Leave the function for existing tests until Goal 3 cleanup if unused. |

### 3.1 Authority invariants for Goal 2

1. Schema state is classified only by `classifySchemaLifecycle`.
2. Publication state is classified only by `classifyLiveInvitation`.
3. Promotion destination is decided only by `decidePromotionAction`.
4. Readiness is classified only by `deriveSchemaOperationFields`.
5. The same observed fact cannot mean `PROMOTE_PRODUCTION` in Observability and `PROMOTE_PREVIEW` / `BLOCKED` in Estado.
6. Diagnostic code may add `reasonCode`s, semantic paths, and asset/baseline notes onto a row whose `action` was already decided.
7. Formatter aliases (Spanish labels, `AUDIT_SCHEMA` as copy for “run protected schema audit”) are not classifiers.

---

## 4. Duplicated logic / probe / cache inventory

### 4.1 Current remote-query paths (no Vercel on any path)

Per persistent environment, **one refresh cycle today**:

| Collector | dbs / Estado refresh | Observabilidad detail | Observabilidad summary | inventory-audit CLI |
| --- | --- | --- | --- | --- |
| `select 1` connectivity | yes (memoized) | no (folded into content query failure) | Local only | no |
| `schema_migrations` | yes via `readMigrationLifecycleForUrl` + shared session | yes via **new** `StatusProbeSession` per env | Local only | no |
| Active row count + slug conflicts | yes (`count(*), count(distinct slug)`) | folded into content SQL | Local only | folded into content SQL |
| Content projection | `readGroupedPromotionalEvidence` (draft/published JSON, identity, **sha256**) | `readEnvironmentDatabaseProjection` (draft/published JSON, provenance, receipts, event, **display meta, no sha256**) via raw `runPsql` | Local only | same projection, **separate** invocations |
| Canonical package / fingerprint (local FS) | `buildCanonicalPromotionalFingerprint` (sha256 of source assets) | `buildNormalizedInvitationRelease` + `packageHash` (heavier; used for 3-way, not sha256 equality) | same | snapshot path only |
| Git identity | no | `readObservabilitySourceState` (local git, not Vercel) | yes | via snapshot |
| Disposable proof | filesystem | no | no | no |
| Child process | Estado only (`print-canonical-status.ts`) | always (`print-snapshot.ts`) | always | in-process |
| Cache | 60s in-memory; GET without refresh does **not** hit remotes | 60s + 5 min STALE; **SSR summary probes Local; client always probes all three** | n/a | none |

**Duplicate within one Observability visit:** SSR Local summary (2 queries) + client detail (6 queries) = up to 8 DB invocations, 2 of them repeating Local.

**Duplicate within `invitation:inventory-audit`:** `runInventoryAudit` (3 content) + `buildObservabilitySnapshot` (3 content + 3 migration) = 9 DB invocations.

**Duplicate across dashboards:** opening Estado (refresh) and Observabilidad (mount) in one sitting runs both SQL families against the same three databases with **zero shared memo**.

Estado GET without `refresh=1` is already cheaper than Observabilidad SSR.

### 4.2 Duplicate classifiers / derivations

| Fact | Canonical meaning | Observability meaning | Conflict? |
| --- | --- | --- | --- |
| Preview behind, Local match | `PROMOTE_PREVIEW` | per-env `APPLY` on Preview **and** possibly `PROMOTE_PRODUCTION` if Production also `APPLY` | **Yes** — Observability is not Preview-first |
| Production match, Preview behind | `BLOCKED` `PRODUCTION_AHEAD_OF_PREVIEW` | `LIFECYCLE_SEQUENCE_INVALID` | Same domain, different code; Observability next step `RECONCILE_MANAGED_CONTENT` vs canonical “do not promote” |
| Schema CURRENT, disposable missing | `NEEDS_DISPOSABLE_PROOF` | no readiness; schema looks healthy | **Yes** if operator reads Observability as migrate-ready |
| Fingerprint fail-closed | `unknown` | 3-way / baseline / draft schema may still emit APPLY/DRIFT/DRAFT_INVALID | Diagnostic OK; must not change `UNKNOWN` action |
| Provenance package_hash | not used for MATCH | baseline for 3-way when current states differ | OK if diagnostic-only |
| Asset equality | sha256 | displayName+mime+size | **Yes** if used as MATCH; OK as slot diagnostic |
| Empty publication queue | `Attention: 0` | `deliveryStatus: ALIGNED` plus possible operational issues | Dual-axis can show HEALTHY+IN_PROGRESS while Estado shows PROMOTE_* — confusing, not a third classifier after cutover |

### 4.3 Duplicate caches / spawners

| Mechanism | dbs | Estado | Observabilidad |
| --- | --- | --- | --- |
| Execution-local SQL memo | `StatusProbeSession` | same, inside child | **No** for content; per-call session for migrations |
| Process cache | none | 60s `CanonicalStatusView` | 60s snapshot + STALE 5 min |
| In-flight coalescing | session `#inflight` | `withLock` queue | cache `inFlight` + aggregation queue |
| Child spawner | n/a | `canonical-status.ts` server wrapper | nearly identical `observability/server/snapshot.ts` |

### 4.4 Target evidence strategy (Goal 2)

```text
One StatusProbeSession per refresh cycle
        │
        ├─ connectivity (memo)
        ├─ schema_migrations (memo) → classifySchemaLifecycle → deriveSchemaOperationFields
        ├─ default content SQL = promotional-evidence (sha256) → classifyLiveInvitation
        └─ diagnostics SQL = superset OR on-demand replacement of content SQL
              (never light + heavy in the same cycle)
              → diagnostic signals only
        │
        ▼
 CanonicalStatusView (authoritative)
        └─ optional diagnostics[] (enrichment)
```

Rules:

- Shared execution-local memoization via `StatusProbeSession` only.
- Dashboard GET without refresh: local/repo view or 60s `CACHED`. No remote.
- Remote refresh only when the operator requests it (`refresh=1` or `pnpm dbs`).
- Freshness: `LIVE` | `CACHED` | `UNVERIFIED` only.
- No Vercel polling for database/content status.
- No second Supabase/psql probe for the same SQL+URL in one cycle.
- Default refresh query count **must not exceed** current `pnpm dbs` / Estado refresh (3 connectivity + 3 counts + 3 schema + 3 grouped content, with memo).
- Diagnostics refresh: **replace** the light content query with one unified content query per env (must include sha256 **and** slot/baseline fields). Do not add a third content query family.
- After cutover, visiting Estado must be cheaper than today’s Estado+Observabilidad combined. Observability’s automatic SSR+mount probes disappear.
- `invitation:inventory-audit` must share one session and must not call a full second snapshot build.

### 4.5 Current vs proposed query budget (detail refresh, 3 envs)

| Path | Current unique DB invocations (typical) | Proposed |
| --- | --- | --- |
| `pnpm dbs` / Estado `refresh=1` | ~12 (3+3+3+3, memoized) | unchanged default |
| Observabilidad detail | 6 (3 content + 3 migration) | **removed** as a separate path |
| Observabilidad SSR summary | +2 Local | **removed** |
| Both UIs in one sitting | ~12 + 6 + 2 | ~12 default, or ~9 with diagnostics (counts folded into unified content) |
| inventory-audit CLI | 3 + 6 = 9 | ≤ 6 (one content + one migration per env, one session) |

Goal 2 verification: consolidation must not increase external resource consumption versus the **canonical** path (`pnpm dbs` / Estado refresh). Removing Observabilidad’s automatic probes is a reduction.

---

## 5. Diagnostic capabilities that must survive consolidation

Preserve / integrate / remove. “Integrate” means Estado advanced diagnostics, not a second page.

| Capability | Observability code | Verdict | Maps to canonical? |
| --- | --- | --- | --- |
| Dual-axis HEALTHY / ALIGNED header | `overall-status.ts` + panel header | **Remove** as status. Do not port. | Schema / publication / readiness already separate |
| Issue vs work-item grouping | `ObservabilityPanel` SignalList | **Integrate** as progressive disclosure grouping of diagnostic signals | Presentation |
| Coverage per env | `coverageFor` | **Remove** as vocabulary. Use `evidence` + reachability already on env summary | `UNVERIFIED` / `LIVE` |
| Exact pending / extra migration IDs | snapshot signals | **Preserve** — already on `CanonicalEnvSummary`; show in Estado details / `pnpm dbs --verbose` | schema domain |
| `ENVIRONMENT_UNAVAILABLE` | coverage | **Integrate** as copy for unreachable | connectivity |
| `ENVIRONMENT_IDENTITY_CONFLICT` | targetClassification mismatch | **Integrate** onto env summary (missing from view today) | `classifyDbTarget` |
| `SCHEMA_BEHIND` / `SCHEMA_DRIFT` / `SCHEMA_UNAVAILABLE` | remap of lifecycle | **Remove** as independent codes in UI default; keep IDs. Copy may say “pendiente” | `schemaLifecycle` |
| `AUTHORITATIVE_COUNT_MISMATCH` | identityConflictsCount > 0 | **Integrate** count onto `CanonicalStatusView` | general status count |
| `INVITATION_IDENTITY_CONFLICT` | rows.length > 1 | **Preserve** as diagnostic label of `conflict` | `classifyLiveInvitation` |
| `INVITATION_MISSING` for `published` lifecycle | presence | **Integrate** as diagnostic of `absent` + registry `lifecycle: published` | `absent` |
| `VALID_DRAFT_PENDING` for `in_progress` absent everywhere | presence | **Integrate** as diagnostic note; action still `PROMOTE_PREVIEW` / local apply via canonical handoff | `absent` |
| `CANONICAL_INVALID` | release build failure | **Remove** as separate code; use `CANONICAL_UNAVAILABLE` | already exists |
| `DRAFT_INVALID` + `REPAIR_MANAGED_DRAFT` | `eventContentSchema` | **Preserve** | enriches `unknown`/`diverged` |
| `BASELINE_UNAVAILABLE` / `BASELINE_VERSION_INCOMPATIBLE` | managed baseline | **Preserve** | diagnostic only |
| `MANAGED_DRIFT` + semantic paths | 3-way patch | **Preserve** when fingerprint ≠ match | must not override action |
| `DELIVERY_SCOPE_BLOCKED` | deliveryScope | **Preserve** | diagnostic; canonical already BLOCKED for divergence/conflict |
| `LIFECYCLE_SEQUENCE_INVALID` | Preview/Production ahead | **Remove** as independent action; **integrate** as copy of `PRODUCTION_AHEAD_OF_PREVIEW` / `LOCAL_BEHIND_PREVIEW_ALIGNED` | already decided |
| `LIFECYCLE_METADATA_STALE` | `in_progress` but Production aligned | **Preserve** | does **not** change `NONE`/in-sync publication action |
| `REQUIRED_PUBLISHED_ASSET_MISSING` / `UNPUBLISHED_ASSET_PENDING` / `ASSET_IDENTITY_UNVERIFIED` | `asset-signals.ts` | **Preserve** | enriches `unknown`/`behind` |
| `CANONICAL_CHANGE_PENDING` / `PARTIAL_PROMOTION` | delivery work | **Remove** as independent next-step; they duplicate `PROMOTE_*` | `decidePromotionAction` |
| `PREVIEW_VERIFICATION_REQUIRED` | preview UNVERIFIED | **Remove** as independent next-step; keep uncertainty notes | `UNKNOWN` / `EVIDENCE_INCOMPLETE` / env `unknown` |
| `DETAIL_BUDGET_EXCEEDED` | 256 KiB cap | **Preserve** if unified SQL keeps a budget | fail-closed diagnostic |
| `SNAPSHOT_REFRESH_FAILED` | stale cache | **Remove**; use refresh error + `CACHED` previous view | Estado already |
| `APPLY_LOCAL` / `PROMOTE_*` / `VERIFY_PREVIEW` as Observability next steps | `applyNextStep` | **Remove** as authority | `derivePromotionHandoff` |
| `AUDIT_SCHEMA` / `RESOLVE_IDENTITY` / `FIX_CANONICAL_DEFINITION` as copy | next-step labels | **Integrate** as Spanish guidance **after** canonical state | presentation |
| Legacy corpus presence issues | `evaluateLegacyInvitations` | **Integrate** into advanced diagnostics **or** leave CLI-only (`invitation:inventory-audit`). Must not enter publication queue | inventory CLI is sufficient if Estado links operators to it in docs; human UI may show a collapsed “Corpus legado” count |
| Reporting fingerprint / snapshotId / commitSha | `reporting-parity.ts` | **Integrate** into verbose CLI / inventory-audit JSON; optional Estado `<details>` | not a classifier |
| Public snapshot sanitizer (no UUIDs, hashes, URLs, secrets, field values) | `public-snapshot.ts` | **Preserve** for diagnostic payload crossing the browser | Estado may keep **commands** on attention cards (operational UX). Diagnostics must not add secrets or content values |
| Anomaly-first grouped UI | ObservabilityPanel | **Integrate** into Estado progressive disclosure | presentation |
| Summary/detail API split | observabilidad index | **Remove** | Estado GET vs `refresh=1` |

Legacy corpus: still justified, already covered by `pnpm invitation:inventory-audit`. Goal 2 should **not** broaden Estado’s default summary with corpus/demo/fixture slugs. Advanced diagnostics may show a count + link to the CLI. That is integrate-without-broadening.

---

## 6. Information-exposure findings

### 6.1 Duplicated / misleading / inconsistently scoped

| Finding | Surfaces | Goal 2 |
| --- | --- | --- |
| Two dashboards answer “what should I do?” with different actions | Estado vs Observabilidad | One attention queue from `decidePromotionAction` |
| Observability “Entrega: Alineada” vs Estado `PROMOTE_PREVIEW` | dual-axis vs publication | Do not show ALIGNED/HEALTHY as headers |
| Observability `AUDIT_SCHEMA` ignores disposable proof | Observabilidad vs readiness | Schema copy must defer to readiness |
| `--compact <slug>` MATCH_CANONICAL from provenance hash | CLI only | Stop; points at `pnpm dbs <slug>` |
| Active row counts vs registry | both; Observability `counts.invitations` mixes registry + legacy summaries | Keep explicit “filas activas (no son el registro)” |
| Observability auto-probes remotes on page load | Observabilidad | Misleading “just opening the page is live”. Estado’s explicit refresh is the UX |
| Commands on Estado vs forbidden on Observability | both | Keep dry-run/OWNER APPLY on attention cards. Do not put commands on diagnostic signals |
| `dbUrlRedacted` in `EnvTargetStatus` | engine only; not in `CanonicalStatusView` | Must never reach UI or default `--json` view |
| Observability loads `clientName`, `invitationId`, receipts server-side then strips | snapshot | Keep strip. Unified SQL may read them server-side; browser diagnostics must not include them |
| Semantic paths are useful; field values are forbidden | Observabilidad | Keep paths only, cap 50 |

### 6.2 Target information architecture

**Default Estado summary**

- Per-env matrix: schema lifecycle + applied/expected counts, registry attention count, operation readiness, evidence (`LIVE`/`CACHED`/`UNVERIFIED`)
- Disposable-test block (not a persistent column)
- Registry / in-sync / attention counts
- Active DB row counts labeled as not-registry
- Identity-conflict count if > 0 (currently missing)

**Publication / action queue**

- Attention cards from `CanonicalPromotionRow` only (registry slugs)
- Native `PROMOTE_*` / `BLOCKED` / `UNKNOWN`, source → destination, uncertainty notes, dry-run, OWNER APPLY for Production
- In-sync list behind `<details>`

**Advanced diagnostics (progressive disclosure on Estado)**

- Per-row canonical `reasonCode` (already in `<details>`)
- Optional diagnostic signals: draft invalid, baseline, semantic paths, asset slot issues, lifecycle metadata stale, env identity mismatch, schema pending/extra IDs
- Grouped by reason, not a second status header
- No credentials, tokens, DB URLs, secrets, content field values, invitation UUIDs, package hashes in the browser
- Technical identifiers allowed: slug, migration version IDs, `reasonCode`, env names

**`pnpm dbs` technical output only**

- `--verbose`: migration IDs, per-env states, `reasonCode`, probedAt, debugCounters
- `--json`: full `CanonicalStatusView` (and optional diagnostics object)
- `--compact`: connectivity + schema only
- Debug counters / durationMs
- Reporting fingerprint if inventory-audit still needs it

Sensitive values never surface on any path: credentials, tokens, raw DB URLs, service_role, absolute machine paths.

---

## 7. Hard-cutover dependency map for `/dashboard/observabilidad`

Disposition: `MOVE` | `REUSE` | `REPLACE` | `DELETE`

Replacement consumer is named. No silent leftover imports of the old route.

### 7.1 Routes and APIs — DELETE after replacement exists

| Dependency | Disposition | Replacement / proof |
| --- | --- | --- |
| `src/pages/dashboard/observabilidad.astro` | `DELETE` | `/dashboard/estado` |
| `src/pages/api/dashboard/observabilidad/index.ts` | `DELETE` | `GET /api/dashboard/estado` (+ optional `diagnostics=1`) |
| Nav item `{ label: 'Observabilidad', href: '/dashboard/observabilidad' }` in `src/layouts/DashboardLayout.astro` | `DELETE` | Estado item remains |
| `src/middleware.ts` `ADMIN_ONLY_PATHS` entry `/dashboard/observabilidad` | `DELETE` | `/dashboard/estado` already listed |
| `admin:observabilidad` in `src/lib/rsvp/security/admin-rate-limit.ts` | `DELETE` | `admin:estado` |
| `OBSERVABILITY_RATE_LIMIT_OPERATION` export | `DELETE` | `CANONICAL_STATUS_RATE_LIMIT_OPERATION` |

### 7.2 UI / styles

| Dependency | Disposition | Replacement / proof |
| --- | --- | --- |
| `src/components/dashboard/observability/ObservabilityPanel.tsx` | `DELETE` | Integrate grouped diagnostic list into `CanonicalStatusPanel.tsx` (`MOVE` the grouping behavior, not the page component) |
| `src/styles/dashboard/_observability.scss` | `DELETE` | Reuse/extend `_canonical-status.scss` for diagnostic disclosure. Do not keep a second page skin |
| `@use 'dashboard/observability'` in `src/styles/dashboard.scss` | `DELETE` | canonical-status remains |

### 7.3 Server snapshot builders (dashboard)

| Dependency | Disposition | Replacement / proof |
| --- | --- | --- |
| `src/lib/observability/server/snapshot.ts` | `DELETE` | `src/lib/status/server/canonical-status.ts` |
| `src/lib/observability/server/snapshot-cache.ts` | `DELETE` | canonical 60s cache; no STALE vocabulary |
| `scripts/observability/print-snapshot.ts` | `DELETE` | `scripts/provision/print-canonical-status.ts` |
| `src/lib/observability/schema.ts` (wire schema v3) | `DELETE` | `src/lib/status/schema.ts` extended for optional diagnostics |
| `src/lib/observability/types.ts` (browser snapshot v3) | `DELETE` | `src/lib/status/types.ts` + diagnostic DTO that cannot include `action` overrides |

### 7.4 Access / runtime — REUSE (shared with Estado today)

| Dependency | Disposition | Replacement / proof |
| --- | --- | --- |
| `src/lib/observability/access.ts` | `REUSE` | Already used by Estado API. Keep; do not rename for Goal 2 |
| `src/lib/observability/runtime-gate.ts` | `REUSE` | Already used by Estado page + DashboardLayout |

### 7.5 Observability scripts — split by consumer

| Dependency | Disposition | Replacement / proof |
| --- | --- | --- |
| `scripts/observability/snapshot.ts` assembly of dual-axis status + `applyNextStep` | `DELETE` as authority | `buildCanonicalStatusView` |
| Diagnostic signal helpers inside `snapshot.ts` (`evaluateAssetSignals` calls, draft/baseline/presence) | `MOVE` | New thin `scripts/status-core/` or `scripts/provision/` diagnostic enricher invoked **after** canonical decisions. Do not keep `assembleSnapshotFromEvidence` as a second composer |
| `scripts/observability/snapshot-evidence.ts` | `REPLACE` | Collect via shared `StatusProbeSession`; default = promotional-evidence; diagnostics = unified SQL |
| `scripts/observability/database-projection.ts` | `REPLACE` | Merge needed columns into promotional-evidence **or** one diagnostic SQL used only when requested. `inventory-audit.ts` must be switched to the shared collector (`MOVE` its import) |
| `scripts/observability/delivery-reconciliation.ts` | `REUSE` | Diagnostic-only 3-way. Must not export next-step policy. Strip or ignore `applyNextStep` |
| `scripts/observability/current-state-alignment.ts` | `REUSE` | Asset slot resolution + direct alignment proof for diagnostics |
| `scripts/observability/asset-signals.ts` | `REUSE` | Diagnostic signals |
| `scripts/observability/overall-status.ts` | `DELETE` | Dual-axis aggregation is redundant. `comparisonToDeliveryStatus` goes away with the axis |
| `scripts/observability/public-snapshot.ts` | `REPLACE` | Sanitizer for diagnostic DTO (paths only, no secrets). Not a second snapshot type |
| `scripts/observability/reporting-parity.ts` | `REUSE` | inventory-audit JSON / verbose CLI only |
| `scripts/observability/source-state.ts` | `REUSE` | reporting / validation evidence |
| `scripts/observability/fingerprints.ts` | `REUSE` | Local Render Corpus validation evidence — **not** dashboard |
| `scripts/observability/validation-evidence.ts` | `REUSE` | screenshot + regression CLIs |
| `scripts/observability/run-local-render-corpus-regression.ts` | `REUSE` | `pnpm test:local-render-corpus` |
| `scripts/observability/types.ts` | `REPLACE` | Split: keep validation types with validation-evidence; delete dashboard v3 types once `src/lib/observability/types.ts` is gone |

### 7.6 Tests

| Dependency | Disposition | Replacement / proof |
| --- | --- | --- |
| `tests/api/dashboard.observabilidad.test.ts` | `DELETE` | `tests/api/dashboard.estado.test.ts` covers the remaining API; extend for `diagnostics=1` if added |
| `tests/components/dashboard/ObservabilityPanel.test.tsx` | `DELETE` | Extend `CanonicalStatusPanel.test.tsx` for diagnostic disclosure |
| `tests/helpers/observability-snapshot-fixture.ts` | `DELETE` | `tests/helpers/canonical-status-fixture.ts` |
| `tests/unit/observability-snapshot-cache.test.ts` | `DELETE` | canonical-status server cache tests if missing; add there |
| `tests/unit/observability-public-snapshot.test.ts` | `REPLACE` | sanitizer tests against diagnostic DTO |
| `tests/unit/observability-v3-scenarios.test.ts` | `REPLACE` | Keep unique diagnostic cases (draft invalid, baseline, assets, sequence copy) asserting they **do not** change `decidePromotionAction` |
| `tests/unit/observability-delivery-consolidation.test.ts` | `REPLACE` | same: enrichment vs authority |
| `tests/unit/observability-batch.test.ts` | `REPLACE` | unified/diagnostic SQL budget tests |
| `tests/unit/observability-core.test.ts` | `REPLACE` | keep validation-freshness tests; drop dual-axis aggregation tests |
| `tests/unit/observability-access.test.ts` | `REUSE` | still guards access + no-mutation API; retarget file path to estado API after observabilidad deletion |
| `tests/unit/observability-runtime-gate.test.ts` | `REUSE` | gate still protects Estado |
| `tests/unit/admin-rate-limit.test.ts` observabilidad cases | `REPLACE` | `admin:estado` only |
| `tests/provision/inventory-audit.test.ts` | `REUSE` | update mocks to shared collector |

No e2e spec currently targets `/dashboard/observabilidad` or `/dashboard/estado`.

### 7.7 Documentation and rules

| Dependency | Disposition | Replacement / proof |
| --- | --- | --- |
| `docs/core/observability-dashboard.md` | `REPLACE` | Rewrite as “advanced diagnostics on `/dashboard/estado`” **or** archive after migrating durable rules into `status-diagnostics.md`. Must not keep the old route as current |
| `docs/core/architecture.md` Local Observability Boundary | `REPLACE` | Describe Estado + Local runtime gate |
| `docs/core/local-render-corpus.md` dashboard bullet | `REPLACE` | Point to Estado advanced diagnostics and/or `invitation:inventory-audit` |
| `.agent/rules/invitation-production.md` Local observability section | `REPLACE` | Same observational-only rule, new route |
| `docs/domains/database/cheatsheets/status-diagnostics.md` | `REUSE` | Already points at Estado + `pnpm dbs`; add diagnostics disclosure |
| `docs/database-workflow.md`, `docs/core/invitation-creation-contract.md`, `docs/domains/intake/production-flow.md` | `REUSE` | `pnpm dbs` remains; compact slug language must stop implying package-hash publication |

### 7.8 Internal imports that must not remain after cutover

Any import of:

- `@/pages/api/dashboard/observabilidad`
- `@/components/dashboard/observability/ObservabilityPanel`
- `@/lib/observability/server/snapshot`
- `@/lib/observability/types` (dashboard v3)
- `/dashboard/observabilidad` hrefs
- `/api/dashboard/observabilidad`

must be gone. Allowed leftovers: `access.ts`, `runtime-gate.ts`, validation-evidence/fingerprint/source-state, inventory-audit after collector swap.

`scripts/provision/inventory-audit-cli.ts` `buildObservabilitySnapshot` import: `REPLACE` with `buildCanonicalStatusView` + optional diagnostics / reporting envelope. This is a **hard cutover blocker** for deleting `snapshot.ts` assembly — not for deleting the route alone. Goal 2 must migrate this consumer in the same sequence as snapshot deletion.

---

## 8. Target architecture

```text
StatusProbeSession (execution-local memo)
        │
        ├─ connectivity + classifyDbTarget
        ├─ schema_migrations → classifySchemaLifecycle
        ├─ disposable proof (filesystem)
        ├─ content evidence (one SQL family per cycle)
        │     default: promotional-evidence (sha256)
        │     diagnostics: unified superset (sha256 + slots + baseline fields)
        └─ registry fingerprints (local FS)
                │
                ▼
        Canonical Status Core
        classifyLiveInvitation
        decidePromotionAction
        deriveSchemaOperationFields
        presentPromotionRow
                │
                ▼
        CanonicalStatusView
        (+ optional diagnostics[] enrichment)
                │
        ┌───────┴────────┐
        ▼                ▼
   pnpm dbs         /dashboard/estado
   formatters       CanonicalStatusPanel
   --compact        default summary + publication queue
   git hook         advanced diagnostics <details>
                    explicit refresh only
```

Surfaces after Goal 2:

| Surface | Role |
| --- | --- |
| Shared evidence / snapshot layer | `StatusProbeSession` + collectors above. No persistent “healthy” history. |
| Canonical status core | One classification per domain. Diagnostics cannot override. |
| `pnpm dbs` | Technical/automation interface. Same view model. Compact = connectivity+schema only. |
| `/dashboard/estado` | Only human operational UI. |
| `/dashboard/observabilidad` | Gone. |

CLI and UI keep separate presentation (`canonical-status-format.ts` vs React/SCSS). They consume the same view.

---

## 9. Ordered Goal 2 implementation sequence

Do not delete the Observabilidad route until steps 1–6 are done. Do not add probes.

1. **Stop the competing compact publication classifier**
   `--compact <slug>` / `--aggregate-content` must not emit package-hash MATCH/BEHIND as publication. Compact remains connectivity+schema (git hook unchanged). Point slug publication at default `pnpm dbs <slug>`.

2. **Extend `CanonicalStatusView` minimally**
   Add identity-conflict counts (already computed). Add optional `diagnostics[]` (reason, slug, env, semanticPaths, impact) with a Zod schema that **cannot** carry a promotion `action`. Wire `ENVIRONMENT_IDENTITY_CONFLICT` from `classifyDbTarget`.

3. **Put Observability collectors on `StatusProbeSession`**
   No raw `runPsql` content path. No new session per migration env. Prove memo hits in one cycle.

4. **Define one content SQL family**
   Default = existing promotional-evidence. Diagnostics = superset including sha256 **and** slot/baseline fields. Never run both in one cycle. Do not add Vercel. Do not add per-invitation fallback queries.

5. **Diagnostic enricher after canonical decisions**
   Move `DRAFT_INVALID`, baseline, asset signals, semantic paths, `LIFECYCLE_METADATA_STALE` behind `buildCanonicalStatusView({ diagnostics: true })`. Strip `applyNextStep` / dual-axis aggregation. Assert with tests that enrichment does not change `decidePromotionAction`.

6. **Estado UI progressive disclosure**
   Grouped diagnostic list under the existing attention queue / env matrix. Explicit refresh only. Optional `diagnostics=1` on the existing Estado API (same child, same session). No second rate-limit key required if it stays `admin:estado`.

7. **Migrate non-UI consumers**
   `inventory-audit-cli.ts` stops calling `buildObservabilitySnapshot`. Uses shared session + canonical view / reporting envelope. `inventory-audit.ts` switches off `database-projection.ts` once the shared collector exists.

8. **Delete Observabilidad human surface**
   Page, API, panel, SCSS, nav, middleware path, `admin:observabilidad`, server snapshot wrapper, print-snapshot, v3 wire types, tests listed DELETE. Keep `access.ts`, `runtime-gate.ts`, validation-evidence, fingerprints, source-state, regression runner.

9. **Docs**
   Replace route references. Observational-only + Local runtime rules now describe `/dashboard/estado`. Corpus doc no longer cites Observabilidad.

10. **Verify resource budget**
    Compare debugCounters / invocation counts: default Estado refresh ≤ current dbs; diagnostics refresh ≤ current Observabilidad detail (6) plus not more than current dbs; opening Estado does not probe remotes; no Vercel.

### Goal 2 stop conditions

- Stop if a change would make diagnostics override publication/schema/readiness.
- Stop if default refresh gains queries vs current `pnpm dbs`.
- Stop if compact/git-hook becomes slower or starts fingerprinting.
- Stop if secrets, DB URLs, or content values would enter the browser payload.

### Goal 2 verification (minimum)

- `pnpm exec jest` on estado API/panel, status-presentation, managed-promotion-status, canonical-status-format, status-core, inventory-audit, runtime-gate, access, and replaced diagnostic tests.
- Source grep: no remaining `/dashboard/observabilidad` or `/api/dashboard/observabilidad` in `src/`, `tests/`, `docs/` (except archived plans).
- Confirm `pnpm dbs --compact` still used by git hook and does not import `buildCanonicalStatusView`.

---

## Handoff

```text
AUDIT
→ AUTHORITY DECISION
→ CONSOLIDATION SPEC
→ GOAL 2 IMPLEMENTATION HANDOFF
```

| Field | Value |
| --- | --- |
| Current state | Goal 1 complete. No product mutations. |
| Completed work | End-to-end inventory, classification, authority map, probe budget, UX split, cutover map, target architecture, Goal 2 sequence. |
| Evidence | Executable paths listed in §§1–7; prior classifier SSOTs in `canonical-migration-invitation-state-goal1-audit.md` reused, not reimplemented. |
| Validation passed | Read-only code inspection of entrypoints, collectors, caches, UI, tests, nav, docs. |
| Validation intentionally not run | Live DB probes, `pnpm dbs`, dashboard HTTP — not required to establish ownership; live values would not change dispositions. |
| Unresolved uncertainty | (1) Whether legacy corpus presence appears as a collapsed Estado diagnostic or remains CLI-only — **neither keeps ObservabilidadPanel nor the route**. (2) Whether unified diagnostic SQL is a superset replacement or an on-demand replacement of the light query — **both forbid running two content families in one cycle**. |
| Residual risks | `inventory-audit-cli` blocks snapshot-assembly deletion. Compact slug still mis-teaches publication until step 1. Dual-axis copy in docs will confuse if left after cutover. |
| Authorization | Read-only. No Git, DB, or route writes in Goal 1. |
| Next responsibility | Goal 2 implements §§8–9 in order, then deletes `/dashboard/observabilidad` only after §7 dispositions are applied. |

Goal 1 acceptance: every relevant responsibility classified; every shared status domain has exactly one proposed authority; Observability capabilities marked preserve/integrate/remove; duplicate probes/caches/classifiers identified; evidence strategy does not add remote polling; every Observabilidad dependency has a disposition; no unresolved item changes reuse vs delete; target is one evidence model, one canonical status logic, one technical CLI, one human dashboard.
