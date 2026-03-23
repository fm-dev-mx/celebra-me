# Runtime and Documentation Simplification

**Completion:** `85%` | **Status:** `ACTIVE`

**Objective:** Retire provably dead active-runtime surface, repair plan/documentation drift, and
leave the live invitation/dashboard architecture simpler without changing public routes, API
contracts, or the premium experience.

**Estimated Duration:** 6 phases / ~1-2 days
**Owner:** Codex
**Created:** 2026-03-22

---

## Scope

### In Scope

- Rebase of the active `010` plan so its lifecycle and commit strategy match the real repository
  state
- Safe retirement of dashboard guest hooks with no runtime consumers
- Test migration away from legacy hook APIs toward active dashboard hooks
- Evergreen documentation reconciliation with the current `src/lib/invitation/page-data.ts`
  boundary and the live active-plan inventory
- Safe runtime pruning only when a file or helper has no real runtime consumer or has become a
  dangling dependency

### Out of Scope

- Public route, API, asset registry, or content-schema breaking changes
- Archive-wide cleanup outside of active-reference drift
- Premium visual redesign or motion-quality downgrade
- Gatekeeper readiness while `node.exe` / `pnpm` remain unavailable in the local environment

---

## Risks and Constraints

| Risk / Constraint | Severity | Mitigation |
| --- | --- | --- |
| Dead-code cleanup accidentally removes live dashboard behavior | High | Retire only files with no runtime consumers and migrate tests to active hooks in the same pass |
| Docs remain misleading after runtime cleanup | High | Update evergreen architecture, conventions, index, and status dashboard together |
| Plan governance drifts from implementation reality | High | Rebase `manifest.json`, `commit-map.json`, phase files, and changelog before any gatekeeper step |
| Node tooling unavailable in the current environment | High | Keep validation and readiness as the only remaining closeout item |

---

## Phase Index

| # | Phase | Weight | Status |
| --- | --- | --- | --- |
| 01 | [Rebase and Scope Lock](./phases/01-rebase-and-scope-lock.md) | 10% | `COMPLETED` |
| 02 | [Dead Surface Inventory](./phases/02-dead-surface-inventory.md) | 10% | `COMPLETED` |
| 03 | [Dashboard Legacy Retirement](./phases/03-dashboard-legacy-retirement.md) | 25% | `COMPLETED` |
| 04 | [Safe Runtime Pruning](./phases/04-safe-runtime-pruning.md) | 10% | `COMPLETED` |
| 05 | [Evergreen Documentation Reconciliation](./phases/05-evergreen-doc-reconciliation.md) | 25% | `COMPLETED` |
| 06 | [Validation and Gatekeeper Closeout](./phases/06-validation-and-gatekeeper-closeout.md) | 20% | `ACTIVE` |

---

## Commit Strategy

Four commit units remain the intended execution boundary for this plan:

| Unit | Phase | Intent |
| --- | --- | --- |
| `rebase-plan-governance` | 01 | correct the active plan lifecycle, phase model, and gatekeeper readiness to reflect the real repo state |
| `retire-dashboard-legacy-hooks` | 03 | remove guest hooks that survive only through a legacy test surface and migrate coverage to active hooks |
| `prune-safe-dead-runtime-surface` | 04 | repair dangling runtime surface and retire only objectively unused or broken internal dependencies |
| `align-evergreen-runtime-docs` | 05 | update active docs and status surfaces to match the live architecture and active plan inventory |

All units remain below gatekeeper-ready state until the Node toolchain can run the required
validation commands successfully.

---

> **Governance Note:** This plan follows the rules defined in
> [Planning Governance Framework](../README.md). It is an active executable plan and must not be
> archived or marked gatekeeper-ready until validation closes.
