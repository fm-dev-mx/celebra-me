---
title: Invitation Promotion Status — Goal 1 Audit
status: final
created: 2026-08-12
updated: 2026-08-12
related_docs:
  - docs/core/content-parity-rsvp-isolation.md
  - docs/domains/intake/production-flow.md
  - docs/domains/database/cheatsheets/status-diagnostics.md
---

# Goal 1 — Invitation Promotion Status Architecture Audit

Implementation contract for Goal 2. Goal 2 must not redesign this architecture unless it documents
evidence that a Goal 1 assumption is incorrect.

Read-only audit of executable paths as of 2026-08-12. Documentation and archived plans were not
treated as runtime authority.

## 1. Current executable flow

### Public entry

`package.json` → `pnpm dbs` → `scripts/provision/dbs-cli.ts`.

| Invocation | Runtime path | What it actually decides |
| --- | --- | --- |
| `pnpm dbs` | `evaluateGeneralStatus()` in `dbs-status.ts` | Connectivity, target classification, **all** active invitation row counts (not registry-only), identity-conflict counts, schema `migration_history_parity`, disposable proof, schema next action. **No per-invitation unpublished/promotion decision.** |
| `pnpm dbs --json` | same | Same payload, including `dbUrlRedacted`. |
| `pnpm dbs <slug>` | `evaluateInvitationStatus(slug)` | Builds a full canonical **packageHash** (see §5), then one per-env `readManagedInvitationMeta` + `classifyPackageHashContent`. Prints UUID, package-hash prefix, published version/timestamp, asset count. |
| `pnpm dbs --compact` | `evaluateCompactManagedStatus()` without slug | CONTENT = connectivity only (`UNVERIFIED` / `CREDENTIALS_REQUIRED` / `UNREACHABLE`). SCHEMA from general probes. Git-hook safe. |
| `pnpm dbs --compact <slug>` | compact + `evaluateInvitationStatus` | CONTENT vocabulary from package-hash classifier. |
| `pnpm dbs --compact --aggregate-content` | loop `listInvitationDefinitions()` → `evaluateInvitationStatus` per slug | Worst-of CONTENT per environment. Sequential per definition. Still no Preview-vs-Production destination. |

Git hook: `scripts/provision/managed-status-git-hook.mjs` → compact connectivity path. Must remain
fast and must not gain all-invitation content hashing.

### Content classification actually used by dbs

`scripts/status-core/classify-content.ts` → `classifyPackageHashContent`:

1. 0 rows → `NOT_PRESENT`
2. >1 active row → `IDENTITY_CONFLICT`
3. Else compare `provenance.package_hash` to locally computed `packageHash`
   - unequal → `BEHIND_CANONICAL`
   - equal **and** `draft.status === 'draft'` **and** `draft.updated_at > published_at` → `DIVERGED`
   - equal otherwise → `MATCH_CANONICAL`
4. Missing canonical or provenance hash → `UNVERIFIED` (fail-closed; not MATCH)

**Timestamps are treated as proof of divergence.** That violates the Goal 1 constraint and is
insufficient: equal clocks can hide content drift; later clocks can flag unchanged content.

**Provenance `package_hash` is treated as proof of live equality.** It is a write-time receipt. Live
published/draft JSON and live asset digests are not read. Host share-message patches and editor
edits can diverge without changing provenance.

### Canonical hash computation currently used by dbs

`evaluateInvitationStatus` → `buildNormalizedInvitationRelease({ slug })` →
`serializeInvitationPackage` → `packageHash`.

`buildNormalizedInvitationRelease` without `sourceDir` uses `getInvitationAssetSourceDir(definition)`
when that directory exists; otherwise **`loadPersistedAssets` downloads binaries from persistent-Local
Storage**. That makes Local Storage a fallback source of “canonical” evidence and is the wrong
direction for status.

`packageHash` hashes the full package **including `assets[].dataBase64`**. Status therefore pays
normalize-or-download cost for every slug.

### Adjacent executable flows (not `pnpm dbs`, but competing status)

| Flow | Entry | Decision |
| --- | --- | --- |
| Compact managed-status | `managed-status.ts` | Composes dbs-status; no destination. |
| Release `--status` | `invitation-release-cli.ts` | Local inventory via `readFastInvitationInventory`; remotes unprobed; `syncStatus: 'UNEVALUATED'`. |
| Release wizard destination | `invitation-release-destination.ts` | Preview **approval artifact** gates Production readiness; does not compare live env content. |
| Promotion candidates | `invitation-promotion-candidates.ts` | Registry + full package + Preview approval file + **Production-only** `evaluateSingleTargetStatus`. Dispositions `ready` / `in-sync` / `attention`. Does not evaluate Preview live content; can mark Production ready from approval + Production behind. |
| Content parity | `content-parity.ts` + `content-parity-load.ts` | True semantic equality (metadata + draft + published + asset `sha256`). **5 queries per env per slug.** Diagnostic, not dbs. |
| Observability dashboard | `snapshot-evidence.ts` → `database-projection.ts` → `delivery-reconciliation.ts` | One grouped content query per env (good I/O shape) but loads full JSON + `clientName` + receipts; 3-way semantic patch; **per-env** `nextStep` (`APPLY_LOCAL` / `PROMOTE_PREVIEW` / `PROMOTE_PRODUCTION`) **without Preview-first**. Asset equality uses displayName+mime+dimensions+fileSize, not `sha256`. Snapshots are not live-authoritative (correct), but `packageHash` fallback can still emit APPLY. |
| Inventory audit | `inventory-audit.ts` | Presence/category matrix via observability projection. Not promotional equality. |
| Cross-DB reconcile | `cross-db-invitation-reconciliation.ts` | Slug presence + provenance `package_hash` string compare. Excludes `in_progress` definitions. |
| Production promote apply | `invitation-promote.ts` | Owner-only. Requires Preview approval artifact; may HTTP-download Preview Storage in `preview-live-verification.ts`. **Out of dbs scope.** |

Vercel is not on the current `pnpm dbs` path. Preview live verification HTTP-fetches Storage objects;
that must not be added to dbs.

## 2. Authoritative invitation inventory

**Single authority for “all managed invitations”:**
`scripts/provision/invitations/registry.ts` → `listInvitationDefinitions()`.

Registered definitions are the only managed promotional corpus. Current members are the five
`registerInvitation(...)` calls in that file.

Identity keys on a definition: `slug` (route), `managedIdentityId` (immutable), `previousSlugs`
(alias diagnostics only — never silent upsert).

### Competing inventories (do not become a second SSOT)

| Source | Role | Conflict with dbs promotion |
| --- | --- | --- |
| `listInvitationDefinitions()` | **KEEP as SSOT** | — |
| `countActiveManagedInvitations` in `dbs-status.ts` | Counts **every** non-archived `invitations` row | Label “Managed” is false; includes demos/legacy/fixtures |
| `classifyInvitationInventory` / `readFastInvitationInventory` | Local presence vs definition slugs | Presence/provenance boolean only; no content equality |
| `inventory-audit.ts` | Repo registries vs DB rows (includes render corpus, demos, fixtures) | Broader than managed promotions |
| `local-render-corpus/registry.ts` | Screenshot/regression corpus | Not managed promotions |
| `screenshot/inventory.ts` | Screenshot discovery | Not managed promotions |
| Observability snapshot canonical list | Rebuilds from the same registry, then persists a snapshot | Snapshot must never drive dbs decisions |
| Cross-DB reconcile expected set | Registry minus `in_progress` | Drops in-progress managed invitations |

Goal 2 must enumerate **only** `listInvitationDefinitions()`. Do not union corpus/demo/fixture
slugs into the promotion list.

## 3. Existing reusable primitives

Reuse these; do not reimplement:

| Primitive | Path | Reuse how |
| --- | --- | --- |
| Registry | `invitations/registry.ts` `listInvitationDefinitions` / `getInvitationDefinition` | Inventory SSOT |
| Semantic asset refs | `normalized-invitation-release.ts` `buildSemanticAssetMap` / `semanticAssetRef` / `ASSET_KEY_PREFIX` | Canonical published JSON without env UUIDs |
| Publication hash | `src/lib/intake/services/publication-diff.service.ts` `hashPublicationProjection` | Structured promotional content digest after `preparePublicationProjection` + `canonicalizePublicationValue` (strips uploaded `src`, `photoNotes`, empty optional collections) |
| Storage-URL canonicalize | `promotion-comparison.ts` `canonicalizeValue` | Metadata `snapshot` equality; URL hosts are not content |
| Asset digest column | `invitation_assets.managed_sha256` if present else `sha256` | Live binary identity **without** Storage download |
| Semantic snapshot shape | `content-parity.ts` `SemanticInvitationSnapshot` / `SemanticAssetDigest` | Equality fields: metadata + draft + published + assets by key+sha256. Do not copy the 5-query loader. |
| Asset-id rewrite | `observability/delivery-reconciliation.ts` `normalizeManagedAssetReferences` (logic only) | Live JSON uses env UUIDs; rewrite to `__INVITATION_ASSET_KEY__:<key>` via `managed_source_key` before hashing |
| Probe I/O | `status-core/probe-runner.ts` `StatusProbeSession` | Execution-local memoization; never persistent cache |
| Env URL resolve | `dbs-status.ts` `resolveDbUrlForEnv` | Same Local/Preview/Production credential resolution |
| Redaction | `status-core/evidence.ts` `redactProbeError`; `db-guard.ts` `redactDbUrl` | Stderr/errors only |
| Schema matrix | `evaluateGeneralStatus` | Keep as the dbs header; do not mix into promotion actions |
| Grouped-query *shape* | `observability/database-projection.ts` (one SELECT per env for a slug list) | Copy the I/O pattern, **not** the payload (too wide, includes PII/receipts/full managed_projection) |

Do **not** reuse as promotional equality:

- `packageHash` / `serializeInvitationPackage` (embeds `dataBase64`)
- `classifyPackageHashContent` timestamp `DIVERGED`
- Observability `resolveCurrentAssetSlots` dimension/fileSize fallback
- Observability `applyNextStep` (per-env, violates Preview-first)
- `preview-live-verification.ts` HTTP re-hash
- Dashboard snapshots (`scripts/observability/snapshot-evidence.ts`)
- Preview approval files (`preview-approval-store.ts`) — apply-time gate, not dbs evidence

## 4. Duplication / overengineering / dependency problems

| Problem | Evidence | Treatment |
| --- | --- | --- |
| Three next-action calculators | Observability `applyNextStep`; release `resolveDestinationReadiness` (approval-based); promotion-candidates (Production-only) | Goal 2 adds **one** pure cross-env decision used by dbs. Do not extend the other two. Goal 3 may later consume the dbs function. |
| Two equality models | dbs: provenance `packageHash` + timestamps. Parity: live JSON + asset sha256 | dbs promotion must switch to the parity *fields*, hashed, with one grouped read |
| Per-slug remote fan-out | `readManagedInvitationMeta` one slug; compact `--aggregate-content` loops slugs; content-parity 5 queries × 3 envs × N | Replace with **one grouped query per environment** |
| Canonical hash downloads Local Storage | `loadPersistedAssets` in `normalized-invitation-release.ts` | Status must pass `sourceDir` from `getInvitationAssetSourceDir`; never Storage download |
| `packageHash` as status key | Includes binaries; expensive; stale vs live content | Do not use for dbs promotion |
| Observability payload too wide | `clientName`, `createdBy`, owner user id, full draft/published/managed_projection, receipts | Do not call `readEnvironmentDatabaseProjection` from dbs |
| Observability asset signature | dimensions/fileSize, not digest | Wrong equality; do not reuse |
| Observability Preview-first hole | Production `APPLY` → `PROMOTE_PRODUCTION` even if Preview is not aligned | Do not reuse `nextStep` |
| dbs “Managed” count | All active rows | Keep for header only or relabel in Goal 3; not the promotion inventory |
| `invitation-promotion-candidates.ts` | Rebuilds full packages; ignores Preview live state | `DO_NOT_EXTEND` for dbs |
| Wrapper layers | `managed-status.ts` is a formatter/composer over dbs-status — keep for `--compact` | Do not add another manager/service/repository |
| Dual sync/async probes | `evaluateSingleTargetStatus` and `*Async` | Keep; Goal 2 grouped reader should be async-parallel across 3 envs only |

## 5. Canonical comparison evidence / minimal fingerprint

### Verdict on existing hashes

| Hash | Stored where | Proves live promotional equality? |
| --- | --- | --- |
| `packageHash` | provenance | **No.** Apply receipt; includes binaries; may match while live JSON drifted. |
| `sourceHash` | provenance | **No** for live equality. Useful as definition identity only. Includes `definition.createdAt` (definition identity, not a content-change clock). |
| `metadataHash` | provenance | Apply-time metadata only. |
| `projectionHash` | provenance | Hash of **canonical** published JSON (semantic asset refs). Not live JSON (live uses UUIDs). |
| `assetManifestHash` | provenance | Apply-time asset metadata including local sha256. Not live rows. |
| `applied_published_projection_hash` | provenance | Hash of what was published at apply. Stale after share-message / editor publish. |
| `hashPublicationProjection(live JSON)` without rewrite | — | **No** vs canonical: live `assetId`s are UUIDs. |
| `invitation_assets.sha256` / `managed_sha256` | live rows | **Yes** for binaries, if present. Do not download Storage. |
| `draft.updated_at` / `published_at` | live rows | **Never** equality or difference proof. |

**No existing single stored hash is sufficient.** The smallest deterministic fingerprint is a
hash of the existing canonical promotional representation already used by content-parity, after
semantic rewrite.

### Fingerprint specification (Goal 2 must implement this)

Name: `promotionalFingerprint` (SHA-256 hex of canonicalized JSON).

**Canonical input** (from definition, no DB, no Storage):

1. `definition = getInvitationDefinition(slug)`
2. `publishedProjection = definition.buildPublishedContent(buildSemanticAssetMap(definition))`
3. `contentDigest = hashPublicationProjection(publishedProjection)`
4. For each `definition.assets` entry, normalize the **local** file under
   `getInvitationAssetSourceDir(definition)` with the existing
   `normalizeInvitationImage` path used by `buildNormalizedInvitationRelease`. Record
   `{ key, sha256 }` only. Do not keep `bytes` / `dataBase64`. Do not call
   `serializeInvitationPackage`. If the source directory is missing, fail that slug `UNKNOWN`
   (do not fall back to `loadPersistedAssets`).
5. Metadata: `{ eventType, baseDemoId, themeId, kind: 'client', snapshot }` with
   `snapshot` passed through `canonicalizeValue` (no target storage URL).

**Live input** (from the grouped query, in-process only):

1. Identity: exactly one non-archived row for `slug`. Else conflict / absent (no fingerprint).
2. Rewrite `published.content` and `draft.content`: every `{ type: 'uploaded', assetId }` whose
   `assetId` maps through `invitation_assets.managed_source_key` (or already has
   `ASSET_KEY_PREFIX`) becomes `semanticAssetRef(key)`. If any uploaded ref cannot be mapped to a
   unique managed key → that environment is `UNKNOWN` (fail closed). **Do not** fall back to
   displayName/mime/dimensions.
3. `publishedDigest = hashPublicationProjection(rewrittenPublished)`
   `draftDigest = hashPublicationProjection(rewrittenDraft)` (null if no draft row)
4. Assets: for each non-deleted asset with a `managed_source_key`, digest =
   `managed_sha256` if it matches `^[a-f0-9]{64}$`, else `sha256` if it matches that pattern.
   Missing digest for a canonical key → `UNKNOWN`.
5. Metadata from the invitation row, `snapshot` via `canonicalizeValue`.

**Fingerprint object** (sorted keys, then SHA-256 of `canonicalize(...)` from
`normalized-invitation-release.ts`):

```text
{
  eventType,
  baseDemoId,
  themeId,
  kind,
  snapshot,          // canonicalizeValue
  contentDigest,     // hashPublicationProjection of rewritten published JSON
  assets: [{ key, sha256 }]  // sorted by key
}
```

Draft is **not** part of the fingerprint used for cross-environment promotion equality. Draft is a
separate unpublished/divergence signal (§7).

Timestamps, versions, invitation UUIDs, storage URLs, asset UUIDs, provenance receipts, owner FKs,
RSVP/events children, and `packageHash` are excluded.

**Equality:** `canonicalFingerprint === liveFingerprint` (hex string compare).

**Unpublished-in-environment (divergence, not promotion):**
`draftDigest` present AND `draftDigest !== publishedDigest`. This is content-hash proof, not
clocks.

Share-message patches change published JSON and therefore `contentDigest`. That is a real live
difference vs canonical. Goal 2 must report it as not-matching (typically `BLOCKED` /
`MANAGED_DIVERGENCE` if Preview/Production published drifted from canonical without a definition
change — see matrix). Do not special-case sharing in dbs; `invitation:content-parity` remains the
diff tool.

## 6. Minimal Local / Preview / Production read strategy

### Local canonical (no remote)

For each registry definition, compute canonical `promotionalFingerprint` from source files as in §5.
Parallelize CPU work in-process. Zero Supabase/Vercel calls.

### Remote: exactly three grouped queries

One query per environment `{ local, preview, production }`, in parallel (existing `mapPool`
concurrency 3), via `StatusProbeSession` (read-only `psql`, execution-local memo).

Slug list = `listInvitationDefinitions().map(d => d.slug)` (SQL-literal escaped).

**Required columns only:**

- `invitations`: `id` (join only; **do not print**), `slug`, `event_type`, `kind`, `base_demo_id`,
  `theme_id`, `snapshot`, `managed_identity_id`, `archived_at` filter
- `invitation_content_drafts`: `content`, `status` (latest non-deleted)
- `published_invitation_content`: `content` (latest non-deleted version)
- `invitation_assets`: `managed_source_key`, `managed_sha256`, `sha256` (non-deleted)
- Aggregate: `COUNT(*)` of non-archived rows **per requested slug** (identity conflict)

**Do not select:** `client_name`, emails, whatsapp, `created_by`, owner ids, events/RSVP,
mutation receipts, `managed_projection`, storage paths, `secure_url`, full provenance JSON.

Provenance hashes are **optional** in the same query (`package_hash`, `projection_hash`,
`asset_manifest_hash`, `definition_slug`) only as diagnostic correlation. They must **not** decide
MATCH or PROMOTE. If the live fingerprint cannot be computed, result is `UNKNOWN` even if
provenance `package_hash` matches.

Connectivity: reuse `session.probeConnectivity` once per env URL (already memoized). If
unconfigured → all slugs `UNKNOWN`/`CREDENTIALS_REQUIRED`. If unreachable → `UNKNOWN`/`UNREACHABLE`.
Do not skip the other environments; decide per slug with the evidence that exists, fail closed for
Production when Preview evidence is missing.

**Call pattern (steady state):**

```text
3 × connectivity probe (memoized)
3 × grouped invitation query
0 × Vercel
0 × Storage HTTP
0 × per-slug psql
0 × dashboard snapshot reads
```

Schema header (existing `evaluateGeneralStatus`, `includeManagedCounts` optional) may add the
current migration-history probes. That is separate from promotion evidence.

**Bodies:** hash in process; drop JSON before formatting. If a row’s draft+published+assets payload
cannot be parsed, that slug/env is `UNKNOWN`.

**Stale data rule:** `StatusProbeSession` memo is valid only within the current `pnpm dbs`
invocation. Observability snapshots, approval files, and provenance receipts cannot produce
`PROMOTE_*` or “in sync / omit”.

## 7. Deterministic promotion-decision matrix

Per slug, after fingerprints:

Let `L`, `Pv`, `Pd` ∈ `{ match, behind, absent, diverged, conflict, unknown }`

- `match` — live published fingerprint === canonical; draft absent or `draftDigest === publishedDigest`
- `behind` — present, unique, published fingerprint ≠ canonical, and not diverged/conflict/unknown
- `absent` — zero active rows
- `diverged` — unique row, published fingerprint === canonical, but `draftDigest !== publishedDigest`
- `conflict` — `activeMatchCount > 1` OR `provenance.definition_slug` present and ≠ registry slug OR
  `managed_identity_id` present and ≠ definition.managedIdentityId
- `unknown` — credentials, unreachable, query fail, timeout-degraded, missing asset digest, unmapped
  uploaded ref, canonical build failure, unparseable JSON

**Preview-first invariant:** `PROMOTE_PRODUCTION` is legal only when `Pv === match`.

**Omit from normal `pnpm dbs`:** `L, Pv, Pd` all `match`.

| L | Pv | Pd | Action | Reason code |
| --- | --- | --- | --- | --- |
| match | match | match | *(omit)* | `IN_SYNC` |
| * | unknown | * | `UNKNOWN` | `EVIDENCE_INCOMPLETE` (if that unknown env is required for the would-be action) |
| * | * | unknown | `UNKNOWN` | `EVIDENCE_INCOMPLETE` when considering Production; if Preview already not match, Production unknown does not block `PROMOTE_PREVIEW` |
| conflict on any env | | | `BLOCKED` | `IDENTITY_CONFLICT` |
| diverged on any env | | | `BLOCKED` | `MANAGED_DIVERGENCE` |
| * | behind or absent | match | `BLOCKED` | `PRODUCTION_AHEAD_OF_PREVIEW` |
| match | match | behind or absent | `PROMOTE_PRODUCTION` | `PREVIEW_ALIGNED_PRODUCTION_BEHIND` |
| behind or absent | match | behind or absent | `PROMOTE_PRODUCTION` | `PREVIEW_ALIGNED_PRODUCTION_BEHIND` (Local lag is not a Production blocker) |
| behind or absent | match | match | `BLOCKED` | `LOCAL_BEHIND_PREVIEW_ALIGNED` (not a Preview/Production promotion; operator uses Local update) |
| * | behind or absent | behind or absent | `PROMOTE_PREVIEW` | `PREVIEW_BEHIND_CANONICAL` |
| * | behind or absent | match | `BLOCKED` | `PRODUCTION_AHEAD_OF_PREVIEW` |
| match | behind or absent | * | `PROMOTE_PREVIEW` unless Pd is match → `BLOCKED` as above | |

Unknown handling (fail closed):

- Canonical build failed → `UNKNOWN` (`CANONICAL_UNAVAILABLE`); never omit, never PROMOTE
- Preview `unknown` → cannot emit `PROMOTE_PRODUCTION`; if Local/Preview promotion would otherwise
  apply, emit `UNKNOWN` not `PROMOTE_PREVIEW` (cannot prove Preview state)
- Local `unknown` but Preview `match` and Production `behind` → `PROMOTE_PRODUCTION` (Preview-first
  satisfied; Local evidence not required)
- Timeout-degraded → treat as `unknown`

Schema `BEHIND` / `SCHEMA_DRIFT` does **not** change these content actions. Keep schema on the
existing dbs header. Apply-time schema gates stay in `invitation:release` / `invitation-promote.ts`.

Preview approval artifacts, `pnpm release-check`, backups, and TTY owner confirmation do **not**
participate. dbs reports the next **valid content destination**, not apply-readiness.

## 8. Safe `pnpm dbs` output contract

### Default text (`pnpm dbs`)

Keep the existing environment header (connection / identity / schema / op readiness / next schema
action). Relabeling the “Managed” count is Goal 3.

Then a **PROMOTIONS** section listing **only** registry invitations whose action ≠ omit:

```text
PROMOTIONS
  <slug>  <eventType>  PROMOTE_PREVIEW|PROMOTE_PRODUCTION|BLOCKED|UNKNOWN  <reasonCode>
```

If the list is empty: `PROMOTIONS (none)` — meaning every managed invitation is in sync **or** none
are registered. Do not print “all healthy” from missing evidence.

Do not print: UUIDs, full hashes, hash prefixes, published timestamps, asset counts, client names,
emails, WhatsApp, connection strings, private URLs, tokens, service-role, draft/published JSON,
storage paths, approval file paths, Vercel deployment ids.

### `pnpm dbs --json` (default / no slug)

Existing general-status object **plus**:

```json
{
  "promotions": [
    {
      "slug": "…",
      "eventType": "…",
      "title": "…",
      "action": "PROMOTE_PREVIEW",
      "reasonCode": "PREVIEW_BEHIND_CANONICAL",
      "environments": {
        "local": "match",
        "preview": "behind",
        "production": "behind"
      }
    }
  ]
}
```

`title` is the definition title (already public in the registry). No fingerprints, no UUIDs, no
content bodies. `environments` values are the enum in §7 only.

Errors go to stderr through `redactProbeError`. Exit 0 on timeout-degraded UNKNOWN rows (read-only
operator tool); non-zero only on unexpected throw. Match current compact behavior: unavailable
remotes must not crash Git hooks. Default (non-compact) dbs may exit 0 with UNKNOWN rows.

### `pnpm dbs <slug>`

Add one line `Promotion: ACTION (reasonCode)` or `Promotion: (none)`. Stop printing invitation UUID
and full package-hash prefix in this path (Goal 2). Keep status vocabulary for the three envs if
still computed; prefer the new env enum over `MATCH_CANONICAL` for the promotion line.

### `pnpm dbs --compact`

**Unchanged.** Git hook must not run grouped content hashing. `DO_NOT_EXTEND` compact connectivity
mode.

`--compact --aggregate-content` may keep current worst-of package-hash behavior for this Goal, or
thin-wrap the new fingerprints if cheap; must not become the default.

## 9. Component classification

| Component | Treatment | Why |
| --- | --- | --- |
| `invitations/registry.ts` | **KEEP** | Inventory SSOT |
| `dbs-cli.ts` | **REUSE** + modify | Public surface; add PROMOTIONS; tighten slug output |
| `dbs-status.ts` `evaluateGeneralStatus` | **KEEP** | Schema/connectivity header |
| `dbs-status.ts` `evaluateInvitationStatus` | **DO_NOT_EXTEND** | packageHash + per-slug meta; replace for promotion path |
| `status-core/probe-runner.ts` | **KEEP** | Live memoized I/O |
| `status-core/invitation-meta.ts` | **DO_NOT_EXTEND** | Per-slug; missing live content/assets |
| `status-core/classify-content.ts` | **DO_NOT_EXTEND** | Timestamp DIVERGED; packageHash equality. Goal 3 may simplify/remove from dbs |
| `managed-status.ts` | **KEEP** | Compact/Git-hook composer |
| `managed-status-git-hook.mjs` | **KEEP** | Must stay compact/connectivity |
| `promotion-comparison.ts` `canonicalizeValue` | **REUSE** | Snapshot canonicalize |
| `hashPublicationProjection` | **REUSE** | Content digest |
| `normalized-invitation-release.ts` semantic map + canonicalize + local normalize | **REUSE** | Canonical fingerprint. **Do not** call `loadPersistedAssets` from dbs |
| `serializeInvitationPackage` / `computePackageHash` | **DO_NOT_EXTEND** for dbs | Binary package identity for apply, not status |
| `content-parity.ts` field set | **REUSE** | Equality scope |
| `content-parity-load.ts` | **DO_NOT_EXTEND** | 5 queries/slug; stdout warnings |
| `observability/database-projection.ts` | **DO_NOT_EXTEND** | I/O shape inspiration only; payload unsafe/too wide |
| `observability/delivery-reconciliation.ts` | **DO_NOT_EXTEND** | 3-way patch + illegal Production nextStep |
| `observability/current-state-alignment.ts` | **DO_NOT_EXTEND** | Non-digest asset matching |
| `observability/snapshot-evidence.ts` | **KEEP** for dashboard | Never authoritative for dbs |
| `invitation-promotion-candidates.ts` | **DO_NOT_EXTEND** | Approval + Production-only |
| `invitation-release-destination.ts` | **KEEP** | Wizard apply-readiness (approval) |
| `invitation-promote.ts` / preview live HTTP | **KEEP** | Owner apply path; not dbs |
| `invitation-status-inventory.ts` | **KEEP** | Local `--status` presence |
| `inventory-audit.ts` | **KEEP** | Broader inventory report |
| `cross-db-invitation-reconciliation.ts` | **KEEP** | Different question (presence) |
| New table / cache / API / state machine / manager | **DO NOT INTRODUCE** | — |

`REMOVE` is not recommended in Goal 2. Timestamp classifier and per-slug meta remain required for
`--compact <slug>` compatibility until Goal 3.

`SIMPLIFY` (Goal 3, not Goal 2): `classifyPackageHashContent` clock rule; dbs “Managed” count;
optional later consumption of the new decision function by promotion-candidates / observability
nextStep.

## 10. Implementation recommendations (dependency order)

1. **Pure fingerprint helpers** in a small provision module (e.g.
   `scripts/provision/promotional-fingerprint.ts`): rewrite uploaded refs; build canonical
   fingerprint from a definition + local normalized `{key,sha256}`; build live fingerprint from a
   query row; no I/O besides local files for canonical assets.
2. **Grouped reader** in status-core or provision (e.g. `readManagedPromotionalEvidence(session,
   dbUrl, slugs)`): one SQL, parse, no logging of bodies.
3. **Pure decision** `decidePromotionAction({ canonical, local, preview, production })` implementing
   §7. No I/O. No approval store. No schema.
4. **Orchestrator** `evaluateManagedPromotionStatus()`: registry → canonical fingerprints → 3 env
   queries → per-slug decide. Reuse `StatusProbeSession` + `mapPool`. Reset session at start like
   compact status.
5. **Wire `dbs-cli.ts`** default and `--json` (no slug) to print PROMOTIONS. Add promotion line to
   slug view; drop UUID/hash prefix from that view.
6. **Tests** (§12) before considering the Goal done.
7. **Do not** change `--compact` default, Git hook, apply/promote, observability dashboard, or
   provenance writers.

Extract local asset `{key,sha256}` by factoring a helper out of `buildNormalizedInvitationRelease`
if that is smaller than duplicating normalize calls. Do not add a new “release manager”.

## 11. Non-goals

- Changing promotion apply semantics, Preview approval, owner TTY, backups, or `release-check`
- Reporting Local-only update as `PROMOTE_PREVIEW` when Preview is already `match`
- Using dbs to authorize Preview/Production mutation
- Vercel, Cloudinary HTTP, or Storage downloads in the dbs path
- New DB columns/tables, persistent caches, snapshot authority, APIs, state machines
- Merging schema next-action into `PROMOTE_*`
- Enumerating demos, render-corpus, or editor-native invitations
- Printing content diffs (that remains `invitation:content-parity`)
- Fixing observability Preview-first (Goal 3 candidate)
- Removing `classifyPackageHashContent` or compact slug package-hash mode
- Relabeling the general “Managed” count (Goal 3 candidate)

## 12. Acceptance evidence required from Goal 2

Goal 2 is done only with all of the following:

### Tests (unit, no live hosted DBs required)

- Fingerprint: semantic rewrite makes live UUID assetIds compare equal to canonical semantic refs
  when `managed_source_key` + sha256 match.
- Fingerprint: changing published copy, asset sha256, eventType/theme/snapshot changes the digest;
  changing timestamps/version/UUID/storage URL does not.
- Fingerprint: unmapped uploaded ref or missing sha256 → environment `unknown`, never `match`.
- Decision table: every row in §7, including omit, Preview-first, `PRODUCTION_AHEAD_OF_PREVIEW`,
  `LOCAL_BEHIND_PREVIEW_ALIGNED`, identity conflict, draft divergence, Preview unknown blocking
  Production, Production unknown not blocking `PROMOTE_PREVIEW`.
- Orchestrator mock: **exactly one** SQL per configured environment for N>1 slugs; zero `fetch`;
  zero `loadPersistedAssets`; canonical uses `sourceDir`.
- Output: in-sync slug absent from `promotions`; BLOCKED/UNKNOWN present; JSON has no UUID, no
  content JSON, no `postgres://`, no service-role, no email/whatsapp/clientName from DB.
- Compact `--compact` without slug still does not query invitation content bodies.

### Failure cases Goal 2 must implement

- Missing Preview/Production credentials → UNKNOWN, not omit, not PROMOTE_PRODUCTION
- Query failure / timeout-degraded → UNKNOWN
- Canonical asset directory missing → UNKNOWN (no Local Storage fallback)
- Duplicate active slugs → BLOCKED IDENTITY_CONFLICT
- Production match + Preview behind → BLOCKED, never PROMOTE_PRODUCTION
- Provenance packageHash matches canonical but live published digest differs → not match (live wins)
- Observability snapshot files present and stale → ignored

### Commands

- `pnpm exec jest tests/provision/promotional-fingerprint.test.ts tests/provision/promotion-decision.test.ts` (names indicative)
- Existing `tests/provision/managed-status.test.ts` still passes (compact unchanged)
- `pnpm dbs --compact` still suitable for the Git hook (no all-invitation hashing)

### Known limitations (carry into Goal 2)

- `hashPublicationProjection` is MD5 by product contract (optimistic lock). Collision risk is
  accepted for publication; fingerprint wraps it plus asset sha256. Do not invent a second
  publication canonicalizer.
- `invitation_assets.sha256` comment says “original binary”; managed apply also writes normalized
  digest to `managed_sha256`. Prefer `managed_sha256` then `sha256`. Rows with neither cannot MATCH.
- Share-message published patches appear as live ≠ canonical. dbs will not omit those invitations.
- dbs `PROMOTE_PRODUCTION` is not apply-ready (approval/schema/backup still required at release).
- `--compact` remains a different evidence class (connectivity / package-hash slug).

### Must not be introduced unless this audit is invalidated

- New fingerprint table, cache, snapshot store, or memo directory
- New service / manager / repository / state machine / public API
- Vercel or other non-Supabase/local calls
- A second invitation inventory
- Using provenance or dashboard snapshots as MATCH/PROMOTE authority
- Per-invitation remote queries in the default dbs path
- Downloading or re-hashing remote asset bytes during status
