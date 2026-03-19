# Project Simplification & De-engineering

**Completion:** `95%` | **Status:** `IN-PROGRESS`

**Objective:** Reduce overengineering, remove dead assets/code, and simplify governance without
changing current user-facing behavior.

**Estimated Duration:** 7 phases / ~3-4 days
**Owner:** fm-dev-mx
**Created:** 2026-03-19

---

## 🎯 Scope

### In Scope

- Collapse single-hop invitation and RSVP abstraction layers.
- Remove confirmed dead components, styles, and duplicate assets.
- Normalize plan metadata drift and simplify workflow/docs overlap.
- Create a durable implementation record under `.agent/plans/project-simplification/`.

### Out of Scope

- Route, API, or content-schema breaking changes.
- Supabase schema migrations.
- Visual redesign beyond parity-preserving style cleanup.

---

## 🔴 Blockers & Risks

| Risk / Blocker | Severity | Mitigation |
| --- | --- | --- |
| Pre-existing ThemeContract drift blocks full closeout | High | Keep plan `IN-PROGRESS` until `pnpm ops validate-schema` is repaired in a follow-up theme-contract alignment pass. |
| Hidden dependency on removed wrappers/assets | Low | Repo-wide reference scans, asset audit, and automated checks passed after cleanup. |
| Manual route smoke coverage not executed in this turn | Medium | Run browser smoke on landing, invitation, and dashboard routes before marking `COMPLETED`. |

---

## 🗺️ Phase Index

| # | Phase | Weight | Status |
| --- | --- | --- | --- |
| 01 | [Baseline and Safety Net](./phases/01-baseline-and-safety-net.md) | 15% | `COMPLETED` |
| 02 | [Invitation Surface Simplification](./phases/02-invitation-surface-simplification.md) | 15% | `COMPLETED` |
| 03 | [RSVP Module Consolidation](./phases/03-rsvp-module-consolidation.md) | 20% | `COMPLETED` |
| 04 | [Style and Theme Pruning](./phases/04-style-and-theme-pruning.md) | 20% | `COMPLETED` |
| 05 | [Dead Code, Assets, and Dependencies](./phases/05-dead-code-assets-and-dependencies.md) | 10% | `COMPLETED` |
| 06 | [Governance and Docs Simplification](./phases/06-governance-and-docs-simplification.md) | 10% | `COMPLETED` |
| 07 | [Verification and Closeout](./phases/07-verification-and-closeout.md) | 10% | `IN-PROGRESS` |

---

## Verification Snapshot

| Check | Result | Notes |
| --- | --- | --- |
| `pnpm astro check` | `PASS` | 0 errors, 0 warnings |
| `pnpm lint` | `PASS WITH WARNINGS` | 2 pre-existing `no-console` warnings in `src/lib/adapters/event-helpers.ts` |
| `pnpm test` | `PASS` | 60 suites passed, 1 skipped |
| `pnpm assets:check-registry` | `PASS` | Event asset registry audit passed |
| `pnpm ops check-links` | `PASS` | 70 links checked, 0 errors |
| `pnpm ops validate-schema` | `FAIL` | 26 pre-existing ThemeContract/CSS variant mismatches outside this simplification change set |

## Residual Intentional Holds

- `src/lib/adapters/event.ts` remains the normalization boundary for event content.
- `src/lib/rsvp/service.ts` remains the top-level compatibility export surface for RSVP routes.
- Final plan closure is intentionally blocked by existing schema drift and missing manual browser smoke evidence.

---

> **Governance Note:** This plan follows the rules defined in [Planning Governance Framework](../README.md). No phase may be committed without owner approval.
