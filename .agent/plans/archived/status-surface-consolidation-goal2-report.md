---
title: Status Surface Consolidation — Goal 2 Implementation
status: implemented
created: 2026-08-12
updated: 2026-08-12
related_docs:
  - docs/domains/database/cheatsheets/status-diagnostics.md
  - docs/core/architecture.md
  - .agent/plans/archived/status-surface-consolidation-goal1-audit.md
supersedes:
  - status-surface-consolidation-goal1-audit.md
---

# Goal 2 — Canonical Status, Diagnostics, and Status Surfaces

Implemented the Goal 1 architecture: one evidence pipeline, one canonical decision model,
`pnpm dbs` as the technical CLI, and `/dashboard/estado` as the only human status dashboard.

## Architecture (live)

```text
StatusProbeSession
        ↓
Shared Environment Evidence
        ↓
CanonicalStatusView
   ├── schema: classifySchemaLifecycle
   ├── publication: classifyLiveInvitation
   ├── promotion: decidePromotionAction
   ├── readiness: deriveSchemaOperationFields
   └── diagnostics[]   ← enrichment only
        ↓
   ┌───────────────┐
pnpm dbs    /dashboard/estado
```

## What changed

- `--compact` / `--compact <slug>` remain connectivity + schema only. Publication is `pnpm dbs` /
  `pnpm dbs <slug>` via `decidePromotionAction`.
- `CanonicalStatusView` carries identity-conflict counts, exact migration IDs, `diagnostics[]`, and
  freshness `LIVE | CACHED | UNVERIFIED`. Diagnostic DTOs are schema-strict and cannot carry `action`
  or `nextStep`.
- One `StatusProbeSession` per refresh. One content SQL family per environment (light default;
  diagnostic superset when requested). No Vercel probes. Estado remains local-first until
  `refresh=1`.
- Observability collectors now run as `enrichCanonicalDiagnostics` after canonical decisions.
- `/dashboard/estado` discloses advanced diagnostics behind a checkbox + `<details>`. Production
  handoffs still terminate at OWNER / HITL REQUIRED. The dashboard does not write.
- `invitation:inventory-audit` uses `StatusProbeSession` + `readGroupedPromotionalEvidence`. It no
  longer calls `buildObservabilitySnapshot`.
- `/dashboard/observabilidad`, its API, panel, SCSS, nav entry, middleware path,
  `admin:observabilidad`, snapshot assembly, and obsolete tests/docs were removed. No redirect.

## Preserved reusable infrastructure

- `src/lib/observability/access.ts`
- `src/lib/observability/runtime-gate.ts`
- `scripts/observability/validation-evidence.ts`
- `scripts/observability/fingerprints.ts`
- `scripts/observability/source-state.ts`
- `scripts/observability/run-local-render-corpus-regression.ts`

## Verification

```bash
pnpm exec jest tests/api/dashboard.estado.test.ts \
  tests/components/dashboard/CanonicalStatusPanel.test.tsx \
  tests/provision/canonical-diagnostics.test.ts \
  tests/provision/canonical-status-format.test.ts \
  tests/provision/inventory-audit.test.ts \
  tests/unit/observability-access.test.ts \
  tests/unit/observability-core.test.ts \
  tests/unit/admin-rate-limit.test.ts \
  tests/unit/observability-runtime-gate.test.ts
```

## Residual / Goal 3

- Historical plans under `.agent/plans/` still mention the removed route (evidence only).
- `docs/invitations/observability-reconciliation-2026-08-01.md` is a point-in-time report, not an
  operational surface.
- Graphify caches under `scripts/observability/graphify-out/` and `src/lib/observability/graphify-out/`
  are generated artifacts.

No Production mutation was performed.
