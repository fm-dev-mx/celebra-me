---
title: Observability Goal 2 Implementation Report
status: final
created: 2026-08-03
updated: 2026-08-03
related_docs:
  - docs/core/observability-dashboard.md
  - .agent/plans/archived/managed-observability.md
supersedes:
  - observability-audit-report.md (deleted; pre-correction evidence)
  - observability-implementation-brief.md (deleted; superseded handoff)
superseded_by:
  - docs/core/observability-dashboard.md
---

# Observability Goal 2 Implementation Report

> **Historical evidence only (archived 2026-08-03).** Not policy or live contract SSOT.
> Canonical operator contract: `docs/core/observability-dashboard.md`.
> Shipped code: `9fe44246` (observability), `88392de9` (Romina draft-reset / migrate prep).
> Parent snapshot when this report was drafted: `2c20ca747e2127d16c37229babf929fd9c004107`.

**Generated:** 2026-08-03  
**Git safety:** `pnpm agent:git-safety:check` → PASSED

---

## Executive status

| Phase | Status | Result |
| --- | --- | --- |
| 1 — Observability correction | **Completed** | Code, contract, UI, docs, tests shipped; live snapshot proves axis separation |
| 2 — Production migration `20260802090000` | **Blocked** | Prerequisites confirmed; missing hosted authorization materials |
| 3 — Romina full draft reset | **Prepared / blocked** | New full-reset dry-run tooling ready; apply blocked on Phase 2 + separate approval |
| 4 — Perla delivery | **Not started** | Intentionally not combined with migration/Romina; awaits independent authorization |

No Production mutation, Preview mutation, or invitation write was executed.

---

## Phase 1 — Observability (completed)

### Files changed

- `scripts/observability/database-projection.ts` — `pendingMigrations` / `extraMigrations`; fail closed without IDs
- `scripts/observability/delivery-reconciliation.ts` — `DRAFT_INVALID` → `REPAIR_MANAGED_DRAFT`, delivery axis neutral (`ALIGNED`)
- `scripts/observability/snapshot.ts` — axis-scoped aggregation; exact migration IDs on signals/summaries
- `scripts/observability/types.ts` / `src/lib/observability/types.ts` — contract fields + `REPAIR_MANAGED_DRAFT`
- `src/lib/observability/schema.ts` — wire validation; `SCHEMA_BEHIND` requires IDs
- `src/components/dashboard/observability/ObservabilityPanel.tsx` — Spanish labels + migration ID display
- `docs/core/observability-dashboard.md` — axis-scoped contract documentation
- Tests updated/added under `tests/unit/observability-*.test.ts`, `tests/components/dashboard/ObservabilityPanel.test.tsx`

### Supporting migrate/reset prep (not Phase 1 mutations)

- `scripts/db/push-prod-migrations.ts` — allow `BEHIND` + `Errors: 0` as pre-apply state
- `supabase/migration-rollout-registry.json` — register `20260802090000` as `expand`
- `scripts/provision/romina-draft-reset*.ts` — full draft←published reset planner/CLI/service
- `package.json` — `invitation:romina-draft-reset`
- `tests/provision/romina-draft-reset.test.ts`

### Tests / commands executed

```text
pnpm exec jest tests/unit/observability-core.test.ts \
  tests/unit/observability-delivery-consolidation.test.ts \
  tests/unit/observability-public-snapshot.test.ts \
  tests/unit/observability-v3-scenarios.test.ts \
  tests/components/dashboard/ObservabilityPanel.test.tsx
→ 5 suites, 47 tests passed

pnpm exec jest tests/api/dashboard.observabilidad.test.ts \
  tests/unit/observability-batch.test.ts \
  tests/unit/observability-access.test.ts \
  tests/unit/observability-runtime-gate.test.ts \
  tests/unit/observability-snapshot-cache.test.ts
→ 5 suites, 21 tests passed

pnpm exec jest tests/provision/romina-draft-reset.test.ts \
  tests/scripts/push-prod-migrations.test.ts
→ 2 suites, 5 tests passed
```

### Observability before-and-after (live detail)

**After Phase 1** (`.tmp/goal2/observability-before-phase2.json`, `2026-08-03T23:54:24.653Z`):

| Signal | Evidence |
| --- | --- |
| Global operational | `BLOCKED` (Romina invalid draft) |
| Global delivery | `IN_PROGRESS` (Perla remains visible — was `UNVERIFIED` before Phase 1) |
| Production migration debt | `SCHEMA_BEHIND` + `pendingMigrations: ["20260802090000"]` |
| Romina | `DRAFT_INVALID` → next `REPAIR_MANAGED_DRAFT`; invitation delivery `ALIGNED` |
| Perla | `PARTIAL_PROMOTION` @ preview → `PROMOTE_PREVIEW` |

Concurrent conditions are independently visible. No write path was introduced.

---

## Phase 2 — Production migration (blocked)

### Preflight evidence

`.tmp/goal2/prod-audit-before.txt`:

- Applied: 71; Expected: 72
- Missing exactly: `20260802090000_production_authorization_receipts.sql`
- Latest applied: `20260730220544`
- Extra / unknown / reordered: none
- Lifecycle: `BEHIND`, Errors: 0
- Local / Preview: previously verified aligned (Goal 1 + unchanged repo head)

### Why blocked

Hosted migrate requires materials not present in this session:

| Required input | Status |
| --- | --- |
| Explicit Production schema authorization | Goal 2 issued; still need operator confirmation phrase / token |
| `CELEBRA_TARGET_RELEASE_SHA` | **missing** |
| `EXPECTED_MIGRATIONS=20260802090000` | ready to supply |
| `CELEBRA_PROD_APPROVAL_TOKEN` + `CELEBRA_PROD_APPROVAL_PUBLIC_KEY` | **missing** |
| `CONFIRM_PROD_MIGRATION` / interactive `MIGRATE <hostname>` | **missing** |
| Critical backup step inside `pnpm db:prod:migrate` | not reached |

### Exact command to run when authorized

```bash
CELEBRA_TARGET_RELEASE_SHA=<authorized-sha> \
EXPECTED_MIGRATIONS=20260802090000 \
CELEBRA_PROD_APPROVAL_TOKEN=<token> \
CELEBRA_PROD_APPROVAL_PUBLIC_KEY=<pubkey> \
pnpm db:prod:migrate
```

Workflow now accepts a clean `BEHIND` audit (Errors: 0) before allowlisted apply.

### Post-verification checklist (pending execution)

- [ ] 72/72 migrations; lifecycle `CURRENT`
- [ ] `production_authorization_receipts` exists; `pnpm db:contract:verify --target production`
- [ ] Fresh observability has no `SCHEMA_BEHIND`
- [ ] Retain pre/post critical backup manifests and approval receipt IDs

---

## Phase 3 — Romina draft reset (prepared / blocked)

### Decision (per Goal 2)

Published Production content is the sole source of truth. Unpublished draft differences are disposable. The three-field preservation repair is **not** the final operation.

### Dry-run evidence

Command: `pnpm invitation:romina-draft-reset -- --json`  
Artifact: `.tmp/goal2/romina-draft-reset-dryrun.json`  
`writes: 0`

| Field | Value |
| --- | --- |
| Published version | 10 |
| Published hash | `4c59dec4568de266eb4608634384a3e6f92560a7fd82b2b5ff5ddba9555c1892` |
| Draft before hash | `fdc154dac2f1a4d62708df2a605b53138142fa6bde3f1adf750059fb9d599a65` |
| Planned draft after hash | `4c59dec4568de266eb4608634384a3e6f92560a7fd82b2b5ff5ddba9555c1892` (= published) |
| Changed paths | 23 (full discard of unpublished draft differences) |
| Operation fingerprint | `92ff0c0818707891e40b3a4c7a4bd3d67ff17a361239de8bc76fff7737c512e6` |
| Acknowledgement token | `DISCARD_UNPUBLISHED_DRAFT_DIFFERENCES` |
| Published mutation | none (`publishedContent: unchanged`) |

### Why apply is blocked

1. Phase 2 incomplete (`production_authorization_receipts` missing).
2. Separate Production draft-mutation authorization materials not supplied.
3. Requires `--acknowledge-discard-unpublished-draft`, `--backup-manifest`, approval token/pubkey, and confirmation phrase `RESET romina-rios-chaparro <fingerprint>`.

### Apply command (when authorized after Phase 2)

```bash
pnpm invitation:romina-draft-reset -- --json   # refresh dry-run; confirm hashes
pnpm invitation:romina-draft-reset -- --apply \
  --acknowledge-discard-unpublished-draft \
  --backup-manifest <critical-backup-manifest> \
  --operation-fingerprint <dry-run-fingerprint> \
  --json
```

---

## Phase 4 — Perla delivery (skipped)

**Exact reason:** Phase 4 requires independent Preview then Production promotion authorizations and must not be combined with migration or Romina mutation. Those authorizations were not supplied in this session, and Phases 2–3 remain incomplete.

Current invitation-level evidence (post Phase 1):

- Local: `ALREADY_APPLIED`
- Next: `PROMOTE_PREVIEW`
- Operational: `HEALTHY`
- No blocker on Perla itself

---

## Backup / authorization receipt identifiers

| Kind | Identifier |
| --- | --- |
| Phase 2 pre/post backups | not created (migrate not reached) |
| Phase 2 approval receipt | not consumed |
| Phase 3 backup / approval | not consumed |
| Phase 4 promote receipts | not created |

---

## Overall acceptance against Goal 2

| Criterion | Met? |
| --- | --- |
| Observability independently represents migration debt, drift, invalid content, unavailable evidence, delivery progress | **Yes** |
| Production aligned through `20260802090000` | **No** — blocked on auth materials |
| Romina draft = published semantic copy | **No** — dry-run ready; apply blocked |
| Romina published unchanged | **Yes** (no mutation attempted) |
| Perla Local → Preview → Production complete | **No** — not authorized / not started |
| No dashboard write path | **Yes** |
| Relevant tests + git-safety | **Yes** for completed work |

---

## Required operator inputs to resume

1. **Phase 2:** `CELEBRA_TARGET_RELEASE_SHA`, Ed25519 approval token/pubkey for `production_migration` with allowlist `20260802090000`, and confirmation.
2. **Phase 3:** Separate approval for `romina_draft_reset`, fresh critical backup manifest, and `--acknowledge-discard-unpublished-draft`.
3. **Phase 4:** Separate Preview promotion authorization, then separate Production promotion authorization for the canonical wedding invitation.
