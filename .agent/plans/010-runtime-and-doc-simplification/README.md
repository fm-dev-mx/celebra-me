# Runtime and Documentation Simplification

**Completion:** `80%` | **Status:** `ACTIVE`

**Objective:** Reduce active runtime and documentation complexity without changing public routes,
API contracts, RSVP behavior, or the premium invitation/landing experience.

**Estimated Duration:** 5 phases / ~1-2 days
**Owner:** Codex
**Created:** 2026-03-22

---

## Scope

### In Scope

- Invitation route-facing assembly and owner-local behavior cleanup
- Dashboard guest runtime consolidation across active client wrappers and hooks
- Active premium style indirection pruning where visual output remains equivalent
- Evergreen documentation reconciliation with the current runtime surface
- Creation of an executable active plan under `.agent/plans/010-runtime-and-doc-simplification/`

### Out of Scope

- Public route, API, asset registry, or content-schema breaking changes
- Archive-wide plan cleanup
- Visual redesign or premium aesthetic downgrade
- Gatekeeper readiness while `node.exe` / `pnpm` remain unavailable in the local environment

---

## Risks and Constraints

| Risk / Constraint | Severity | Mitigation |
| --- | --- | --- |
| Runtime simplification accidentally changes invitation reveal flow | High | Keep route contracts and reveal conditions unchanged; simplify only single-owner behavior wrappers |
| Dashboard cleanup regresses CRUD or realtime behavior | High | Preserve `src/pages/api/**` contracts and keep guest list actions inside existing runtime boundaries |
| Docs drift persists after runtime cleanup | Medium | Update evergreen docs in the same pass as code changes |
| Node tooling unavailable in the current environment | High | Leave validation and gatekeeper readiness as the only open closeout item |

---

## Phase Index

| # | Phase | Weight | Status |
| --- | --- | --- | --- |
| 01 | [Preflight and Scope Lock](./phases/01-preflight-and-scope-lock.md) | 15% | `COMPLETED` |
| 02 | [Invitation and Behavior Simplification](./phases/02-invitation-and-behavior-simplification.md) | 25% | `COMPLETED` |
| 03 | [Dashboard Runtime Consolidation](./phases/03-dashboard-runtime-consolidation.md) | 25% | `COMPLETED` |
| 04 | [Evergreen Documentation Reconciliation](./phases/04-evergreen-documentation-reconciliation.md) | 20% | `COMPLETED` |
| 05 | [Validation and Closeout](./phases/05-validation-and-closeout.md) | 15% | `ACTIVE` |

---

## Commit Strategy

Four commit units remain the intended execution boundary for this plan:

| Unit | Phase | Intent |
| --- | --- | --- |
| `simplify-invitation-route-assembly` | 02 | remove single-owner invitation behavior indirection and keep page assembly close to the route |
| `consolidate-dashboard-runtime-boundaries` | 03 | reduce dashboard guest runtime orchestration complexity without changing API contracts |
| `prune-active-premium-style-indirection` | 02 | simplify active style ownership tied to owner-local premium interactions |
| `align-evergreen-runtime-docs` | 04 | update active docs and status surfaces to match the live architecture |

Gatekeeper readiness is intentionally deferred until validation commands can run in a healthy Node
environment.

---

> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../README.md). It is an active executable plan and must not be
> archived or marked gatekeeper-ready until validation closes.
