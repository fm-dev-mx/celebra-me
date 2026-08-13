---
title: Canonical Migration & Invitation-State — Goal 2 Implementation
status: implemented
created: 2026-08-12
updated: 2026-08-12
related_docs:
  - .agent/plans/archived/canonical-migration-invitation-state-goal1-audit.md
  - docs/domains/database/cheatsheets/status-diagnostics.md
---

# Goal 2 — Unified status UX and safe handoffs

Goal 1 contract: `.agent/plans/archived/canonical-migration-invitation-state-goal1-audit.md`.
No classifier redesign. `decidePromotionAction` and `classifySchemaLifecycle` are unchanged
in behavior (the decision function moved to `src/lib/status/decision.ts` so CLI and UI import
the same module).

## Files changed

| File | Change |
| --- | --- |
| `src/lib/status/types.ts` | Shared CanonicalStatusView + classifier tokens |
| `src/lib/status/decision.ts` | SSOT `decidePromotionAction` (moved, not rewritten) |
| `src/lib/status/presentation.ts` | Source/destination, handoff, labels — no new rules |
| `src/lib/status/merge.ts` | Partial-refresh merge that reuses `decidePromotionAction` |
| `src/lib/status/schema.ts` | Zod for the dashboard API |
| `src/lib/status/labels.ts` | Spanish operator labels |
| `src/lib/status/server/canonical-status.ts` | Local-first cache, explicit child-process refresh |
| `scripts/provision/promotion-decision.ts` | Re-export of the shared decision |
| `scripts/provision/managed-promotion-status.ts` | Env states, source/dest, in-sync list |
| `scripts/provision/canonical-status.ts` | Compose schema + publication + readiness |
| `scripts/provision/canonical-status-format.ts` | CLI text |
| `scripts/provision/print-canonical-status.ts` | Isolated printer for the API |
| `scripts/provision/dbs-cli.ts` | Canonical view; slug view no longer uses package-hash |
| `scripts/provision/managed-status.ts` | `--compact` labeled connectivity-only |
| `src/pages/dashboard/estado.astro` | Local dashboard page |
| `src/pages/api/dashboard/estado/index.ts` | Read-only GET, `refresh=1` |
| `src/components/dashboard/status/CanonicalStatusPanel.tsx` | Attention queue + OWNER APPLY |
| `src/styles/dashboard/_canonical-status.scss` | Dashboard SCSS |
| `docs/domains/database/cheatsheets/status-diagnostics.md` | Operator card |

## Misleading logic removed / retired from the primary path

- `PROMOTIONS` / `CURRENT` empty-list label → `PUBLICATION` / `Attention: 0`
- Header `Managed` (all active DB rows) → `Active DB rows (not registry)` plus registry counts
- `pnpm dbs <slug>` package-hash / UUID / timestamp view → fingerprint promotion row only
- `--compact` implied publication authority → explicit “connectivity only; not publication state”
- Dual next-action calculators were **not** extended (observability `applyNextStep` and
  `invitation-promotion-candidates.ts` remain unused by this UX)

## Final UX states

CLI (`pnpm dbs`) and UI (`/dashboard/estado`) render the same `CanonicalStatusView`:

- Schema: `Schema migrations: CURRENT 75/75` (scoped)
- Invitations: registry attention count per env
- Readiness: `NEEDS_DISPOSABLE_PROOF` etc.
- Evidence: `LIVE` / `CACHED` / `UNVERIFIED`
- Disposable-test: separate block, not a persistent schema column
- Attention cards: title, source → destination, native `PROMOTE_*` / `BLOCKED` / `UNKNOWN`,
  `reasonCode` in details, `PRODUCTION UNVERIFIED` notes, dry-run command, **OWNER / HITL REQUIRED**
  for Production

Handoff is observe → dry-run → authorized apply → verify. The UI/CLI never apply.

## Probe / query behavior

| Path | Remote I/O |
| --- | --- |
| `pnpm dbs --compact` | Unchanged connectivity + schema (no fingerprint) |
| `pnpm dbs` / `--json` / `<slug>` | Same session as Goal 1: 3 connectivity + 3 `schema_migrations` + 3 counts + 3 grouped content reads; memoized |
| Dashboard GET (no refresh) | Local/repo or in-memory cache labeled `CACHED` — no remote |
| Dashboard `?refresh=1` | Child process full probe (same as `pnpm dbs`) |
| `?refresh=1&env=` | Partial probe merged; other envs stay `CACHED`/`UNVERIFIED`; decisions re-run via `decidePromotionAction` |
| Vercel | Not queried |

No write path. Production `--apply` is displayed, not executed.

## Tests (classification parity)

```text
pnpm exec tsc --noEmit -p tsconfig.json
  exit 0

pnpm exec jest tests/unit/status-presentation.test.ts \
  tests/provision/promotion-decision.test.ts \
  tests/provision/managed-promotion-status.test.ts \
  tests/provision/canonical-status-format.test.ts \
  tests/provision/managed-status.test.ts \
  tests/api/dashboard.estado.test.ts \
  tests/components/dashboard/CanonicalStatusPanel.test.tsx \
  tests/provision/promotional-fingerprint.test.ts --no-coverage
  Test Suites: 8 passed
  Tests: 45 passed
```

`status-presentation.test.ts` exhausts `decidePromotionAction` × presentation source/destination
and keeps `BLOCKED` reason codes / `PRODUCTION UNVERIFIED` without converting them to a promotion.

## Goal 1 assumptions

None found false. Payload now includes `environments`, `source`, `destination`, and handoff
commands as specified.
