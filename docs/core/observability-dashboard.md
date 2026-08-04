# Observability Dashboard (Local-first)

**Owns:** a read-only snapshot of operational health and managed-invitation delivery progress.

**Does not own:** writes, promotion, migration, repair, alerts, history, or remote mutation
authority. The dashboard describes evidence; it never authorizes an action.

## Route and boundary

| Item        | Contract                                                       |
| ----------- | -------------------------------------------------------------- |
| Page        | `/dashboard/observabilidad`                                    |
| API         | `GET /api/dashboard/observabilidad?mode=summary                | detail` |
| Runtime     | Persistent Local only; hosted Vercel runtimes return not-found |
| Access      | Authenticated `super_admin` with a strong session              |
| Interaction | Read-only; manual refresh, no polling                          |
| Cache       | 60 seconds; one shared in-flight detail rebuild                |
| Timeout     | 30 seconds for summary and detail                              |

The runtime gate is executable in `src/lib/observability/runtime-gate.ts`. Worktree location is not
environment authority. Server-only probes run in a child process and never enter the client island.

## Snapshot v3 status contract

Operational health and delivery progress are separate axes. Neither is derived from the other.
Aggregation is axis-scoped: operational issues never overwrite delivery status, and delivery work
never overwrites operational findings. Invitation-level evidence remains authoritative over
aggregates when both exist.

| Axis                | Values                                                    | Meaning                                                                                       |
| ------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `operationalStatus` | `HEALTHY`, `ATTENTION`, `UNVERIFIED`, `BLOCKED`           | Whether the observed system is functioning and its required evidence is trustworthy           |
| `deliveryStatus`    | `ALIGNED`, `IN_PROGRESS`, `UNVERIFIED`, `ACTION_REQUIRED` | Whether managed intent has reached Local, Preview, and Production in the allowed order        |
| `freshness`         | `FRESH`, `PARTIAL`, `STALE`                               | Whether the snapshot covers all requested environments and whether a cached fallback was used |

Operator interpretation also distinguishes these concurrent conditions without conflation:

- confirmed migration debt (`SCHEMA_BEHIND` with exact pending migration version IDs);
- migration drift (`SCHEMA_DRIFT`);
- invalid managed content (`DRAFT_INVALID` → `REPAIR_MANAGED_DRAFT`);
- unavailable evidence (`SCHEMA_UNAVAILABLE` / environment unavailable);
- invitation delivery progress (`pending_work` equivalents such as `PARTIAL_PROMOTION`).

`SCHEMA_BEHIND` is emitted only when exact missing migration version IDs are known. Those IDs appear
on the issue signal and on the environment summary. Missing IDs fail closed to `SCHEMA_UNAVAILABLE`.
Invalid managed drafts are operational defects; they do not force unrelated delivery work to
`UNVERIFIED`.

Precedence is deterministic:

- operational: `BLOCKED > UNVERIFIED > ATTENTION > HEALTHY`;
- delivery: `ACTION_REQUIRED > UNVERIFIED > IN_PROGRESS > ALIGNED`.

A valid canonical change can therefore be `HEALTHY + IN_PROGRESS`. Preview ahead of a proven Local
baseline, or Production ahead of a proven Preview baseline, is `HEALTHY + ACTION_REQUIRED`.
Unavailable evidence is `UNVERIFIED`; it is never inferred to be an ordering violation.

The detail response is anomaly-first and exposes only typed reason codes, typed next steps,
comparison outcomes, counts, lifecycle, environment, slug, bounded semantic paths, and exact
migration version IDs for schema debt/drift. It excludes field values, invitation or operation
UUIDs, content hashes, URLs, credentials, commands, raw errors, absolute paths, and unmanaged
evidence. A controlled `reporting` envelope carries only the source commit SHA, logical database
targets, snapshot ID, non-content evidence fingerprint, timestamp, and deterministic keys for the
same invitation classifications, issues, and work items consumed by the inventory CLI and
dashboard. `src/lib/observability/schema.ts` validates the complete strict schema before the
payload crosses the server boundary.

## Summary and detail

| Mode      | Probe scope                                         | Purpose                                  |
| --------- | --------------------------------------------------- | ---------------------------------------- |
| `summary` | Local only; Preview and Production are `NOT_PROBED` | Fast SSR/bootstrap status                |
| `detail`  | Local, Preview, and Production                      | Full lifecycle and reconciliation status |

Both payloads use schema version `3`. Summary is a strict subset containing the two status axes,
freshness, coverage, generation time, and aggregate counts. Unprobed environments do not contribute
to summary aggregation.

## Authoritative invitation sets

- The canonical managed registry is `scripts/provision/invitations/registry.ts`.
- Every managed definition declares `lifecycle: in_progress | published` and
  `deliveryScope: content-only | content-and-assets | assets-only`.
- The Local Render Corpus is `scripts/provision/local-render-corpus/registry.ts`.
- Every legacy entry explicitly declares `remoteParity: excluded | required`; classification as
  legacy alone does not imply exclusion.

The dashboard has no private slug list. Canonical build/validation failures are operational
failures. A new `in_progress` invitation absent from all environments is valid pending work; the
same state for a `published` invitation is an operational failure. An `in_progress` invitation
already aligned in Production requires lifecycle metadata correction.

## Direct alignment and baseline authority

The snapshot first attempts a direct present-state proof for each canonical invitation. It requires
one available, unique row in Local, Preview, and Production; compatible invitation/event ownership
and managed metadata; valid non-empty draft content; and a complete, unambiguous current mapping of
every required asset slot. Each current draft is rewritten to semantic asset keys in memory and
compared to the normalized canonical managed projection.

When those three current projections are equal, the invitation is `HEALTHY + ALIGNED` even if it has
no legacy provenance row or persisted asset keys. Missing historical evidence is not an issue in
that case. The row IDs used to make the in-memory association never leave the server and never
become semantic identity.

If any current projection differs, direct equality is not enough to infer delivery order or drift.
The snapshot then uses the durable baseline and three-way reconciliation below. A missing or
normalization-incompatible baseline makes delivery `UNVERIFIED`, but does not independently reduce
operational health when current availability, schema, content, identity, and asset integrity are
healthy.

The durable common ancestor is the `managed_projection` recorded in
`public.managed_invitation_release_provenance`. Its identity is accepted only when all of the
following agree:

1. definition slug;
2. `release_schema_version` (the normalization-contract version);
3. applied draft revision, operation ID, published version, and published projection hash;
4. a matching durable `managed_invitation_apply` receipt that completed `provenance_recorded`.

The baseline changes only after a completed managed apply records new provenance and its receipt.
Current timestamps are opaque concurrency tokens, not evidence that “newer is canonical.” Missing,
legacy, or version-incompatible provenance produces typed `UNVERIFIED` delivery evidence only when
there is a real current-state difference to interpret. An empty object, an empty normalized
document, or an equivalent structurally empty projection is not a baseline. Metadata-only
verification can establish only a non-empty stored projection; detailed reconciliation reuses the
same authority path and rejects an empty loaded document.

`scripts/observability/delivery-reconciliation.ts` uses the shared semantic three-way reconciler and
ownership map:

- previous canonical = authoritative managed projection;
- current canonical = repository definition normalized by the same release contract;
- current target = current environment draft, with managed asset IDs mapped back to semantic keys.

Outcomes are `APPLY`, `ALREADY_APPLIED`, `DRIFT`, `DELIVERY_SCOPE_BLOCKED`, or `UNVERIFIED`. Only
definition-managed and managed-reconciled paths are reported. RSVP, target-owned, publication-owned,
and residual infrastructure fields are excluded.

## Assets and operational impact

Only declared non-optional asset keys are required. A missing required asset on published content is
an operational defect. The same missing asset on unpublished content is delivery work in progress.
Optional assets never degrade operational health. A legacy row without a persisted semantic key is
accepted when exactly one current asset matches the known semantic slot by normalized display name,
MIME type, dimensions, and file size. Ambiguous or absent slot association remains
`ASSET_IDENTITY_UNVERIFIED`; it does not mislabel existing binaries as missing. Published evidence
of that form makes operational health `UNVERIFIED`, while unpublished evidence makes delivery
`UNVERIFIED`.

The batch projection uses only the managed asset `id` and semantic `key` for reconciliation. Storage
paths, buckets, provider URLs, content hashes, and environment-specific identifiers are neither
queried as semantic identity nor included in the public snapshot.

## Legacy administrative baseline preparation

`pnpm invitation:legacy-baseline-adoption` is the only preparation path for legacy invitations whose
historical managed baseline cannot be proved. It is deliberately separate from the prior Romina-only
content-changing maintenance command: this flow is metadata-only and stops after inspection,
manifest generation, and dry-run.

The command creates one consolidated manifest for Abril and Romina. Each entry records a Production
candidate fingerprint, the shared normalization/contract version, managed scope, semantic asset
keys, cross-environment comparison summaries, exclusions, unresolved ambiguity, and the
deterministic expected snapshot transition. It never stores raw invitation content, field values,
URLs, storage paths, UUIDs, database identifiers, credentials, or database errors in the manifest.

Production is marked `production_administrative_adoption`: an explicitly reviewed initial
checkpoint, never reconstructed historical truth. An entry is eligible only after schema,
client/owner, published/draft, complete-scope, and unambiguous semantic-asset validation. A valid
delivery sequence may retain canonical delivery work; unexplained or contradictory environment
evidence remains `UNVERIFIED` and blocks only that entry.

```sh
# generate the local review artifact (no remote write)
pnpm invitation:legacy-baseline-adoption -- --out .agent/tmp/adoptions/legacy-baseline-adoption-manifest.json --json

# re-inspect all sources and dry-run the exact artifact (writes: 0)
pnpm invitation:legacy-baseline-adoption -- --manifest .agent/tmp/adoptions/legacy-baseline-adoption-manifest.json --dry-run --json
```

The manifest includes the future apply command bound to its exact fingerprint. Owner apply requires
`--manifest-fingerprint`, a verified critical `--backup-manifest`, and
`requireOwnerProductionApply` (same Production owner boundary as promote/repair). Any relevant
canonical, Production, scope, normalization, or semantic-asset change changes the entry fingerprint
and makes dry-run return `STALE_MANIFEST`.

Schema signals in this dashboard use **migration_history_parity** evidence
(`scripts/status-core/migration-probe.ts`). They are not equivalent to `pnpm db:*:audit`
**object_audit_readiness**. Axis `UNVERIFIED` values remain axis-scoped (`operationalStatus` vs
`deliveryStatus`); schema unavailable evidence surfaces as `SCHEMA_UNAVAILABLE` /
`SCHEMA_UNVERIFIED` reason codes, not as a healthy claim.

## Database projection audit

Each environment uses one slug-filtered, read-only content projection and one migration-history
read. The content projection returns aggregate active-row/identity counts and the minimum
reconciliation metadata for all relevant invitations in one JSON result. Draft content, managed
projection content, and managed asset references are loaded only for rows whose revisions differ
from provenance and only within the detail budget.

No database view or materialized view is introduced. The audit found no invocation or security
benefit: the existing batch query is already one database invocation per environment, while a view
would add a separately grantable schema object and could widen access to sensitive JSON. If a view
is introduced later, it requires measured justification, explicit grants, `security_invoker` where
supported, and database-contract tests. Materialization additionally requires an owned refresh and
staleness policy.

## Resource and failure limits

- Maximum six database invocations per uncached detail snapshot: content plus migration history for
  each of three environments. The shared budget fails closed on a seventh invocation.
- No per-invitation fallback queries.
- Maximum 256 KiB combined detail content per invitation row.
- Maximum 50 public semantic paths per comparison. When exceeded, the known outcome and counts are
  preserved, `detailStatus` becomes `DETAIL_UNAVAILABLE`, and paths are omitted.
- Public issue/work arrays are capped at 200 and invitation summaries at 100 by the wire schema.
- A failed rebuild may serve the last valid snapshot for at most five minutes. It becomes `STALE`,
  gains `SNAPSHOT_REFRESH_FAILED`, and cannot remain operationally healthy.

## Operator and agent interpretation

Operators should read operational health first, then delivery progress. Typed next steps identify
the owning workflow, but the dashboard never emits executable commands.

Agents may use the snapshot for diagnosis and planning. They must still follow database, Git, and
invitation-production authorization. `HEALTHY`, `IN_PROGRESS`, or a suggested next step grants no
mutation privilege.

## Operator presentation

The panel keeps operational attention and expected delivery work in separate sections. It groups
only records with the same reason, environment, impact/classification, and remediation path. Each
group states the problem, practical impact, affected invitation scope, and next safe action; it
shows up to five slugs and progressively discloses the rest. Semantic paths are similarly hidden
until requested. Preview and Production are never grouped together.

## Implementation map

- DB evidence and budget: `scripts/observability/database-projection.ts`
- baseline reconciliation: `scripts/observability/delivery-reconciliation.ts`
- deterministic assembly: `scripts/observability/snapshot.ts`
- safe public projection: `scripts/observability/public-snapshot.ts`
- browser-safe mirror/schema: `src/lib/observability/types.ts`, `src/lib/observability/schema.ts`
- child process/cache: `src/lib/observability/server/snapshot.ts`,
  `src/lib/observability/server/snapshot-cache.ts`
- UI: `src/components/dashboard/observability/ObservabilityPanel.tsx`
- legacy-adoption inspection and manifest: `scripts/provision/legacy-baseline-adoption.ts`,
  `scripts/provision/legacy-baseline-adoption-cli.ts`
