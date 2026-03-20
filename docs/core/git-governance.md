# Git Governance: Plan-Aware Commit Execution

**Status:** Active  
**Last Updated:** 2026-03-20

## Overview

This document defines executable ownership for the pure plan-aware Gatekeeper commit workflow.

Commit intent is plan-owned. Execution and validation layers enforce the selected plan unit; they do
not invent it.

If a change will become a commit, it must belong to a plan. There is no direct no-plan commit path.

## Ownership

| Owner                                            | Responsibility                                            |
| ------------------------------------------------ | --------------------------------------------------------- |
| `.agent/plans/README.md`                         | Contract for executable plans and `commit-map.json`       |
| `.agent/governance/bin/validate-commit-plan.mjs` | Machine validation of active plan commit maps             |
| `.agent/governance/bin/gatekeeper-workflow.mjs`  | Inspect, stage, scaffold, commit, cleanup                 |
| `commitlint.config.cjs`                          | Local commit message validation against the selected unit |
| `scripts/validate-commits.mjs`                   | Range validation from commit trailers plus plan metadata  |
| `.husky/pre-commit`                              | Lint-staged, S0 refresh, strict Gatekeeper checks         |
| `.husky/pre-push`                                | Commit-range validation and tests                         |

## Primary Commands

```text
pnpm gatekeeper:plans:validate -- --plan <plan-id>
pnpm gatekeeper:workflow:inspect -- --plan <plan-id>
node .agent/governance/bin/gatekeeper-workflow.mjs stage --plan <plan-id> --unit <unit-id>
node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --unit <unit-id>
node .agent/governance/bin/gatekeeper-workflow.mjs commit --unit <unit-id>
pnpm gatekeeper:workflow:cleanup
```

## Validation Sequence

1. `gatekeeper:plans:validate` verifies the active plan contract before runtime execution.
2. the operator reduces the working tree to exactly one material commit unit.
3. `inspect` validates gatekeeper readiness and resolves the current working tree to one unit.
4. `stage` stages that exact unit and writes `gatekeeper-s0.json`.
5. `scaffold` revalidates the staged set and previews the planned commit message.
6. `commit` revalidates the staged set again, appends trailers, validates with commitlint, and
   commits.
7. `pre-commit` refreshes S0 after formatting and runs strict Gatekeeper checks.
8. `pre-push` and CI validate commit trailers, unit match, and tests.

## Operating Model

- planned work starts with an executable plan and a preliminary `commit-map.json`
- small new work uses a micro-plan before implementation
- already-written work uses a retroactive plan before commit
- `gatekeeper-commit` is a validator and executor, not a planner
- the working tree must represent one material unit at commit time
- completed plans move to `.agent/plans/archive/` and stop being executable

## Guarantees

- there is no commit fallback to domain heuristics
- `scope` is derived from the unit `domain`
- the commit body uses semantic summary bullets plus a dedicated `Files:` section
- every planned commit carries `Plan-Id` and `Commit-Unit` trailers
- CI reconstructs the selected unit from those trailers
- staged-set drift blocks the commit instead of being auto-healed
- plans that are not ready for gatekeeper are blocked before commit execution
- active plans with draft or locked units are not executable even if the review metadata exists
- archived plans remain available for historical validation but are blocked from new execution

## Non-Goals

- `domain-map.json` is not the owner of commit semantics
- markdown workflow docs do not redefine commit intent
- legacy `stage/scaffold/commit --domain` is not part of the commit path
- there is no fast-path bypass for small commits outside the plan system
