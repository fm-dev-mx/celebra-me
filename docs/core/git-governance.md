# Git Governance: Lean Commit Execution

**Status:** Active  
<<<<<<< Updated upstream
**Last Updated:** 2026-03-20
=======
**Last Updated:** 2026-03-23  
**Change Note:** Lean Governance 2.0 overhaul. Unified commit commands, introduced Maintenance Mode, and recursive plan resolution.
>>>>>>> Stashed changes

## Overview

This document defines executable ownership for the Lean Gatekeeper commit workflow.

Commit intent is primary. Execution and validation layers automate the process of adhering to that intent while reducing operational friction and token consumption.

## Ownership

| Owner                                            | Responsibility                                            |
| ------------------------------------------------ | --------------------------------------------------------- |
| `.agent/plans/README.md`                         | Contract for executable plans and `commit-map.json`       |
| `.agent/governance/bin/validate-commit-plan.mjs` | Machine validation of active plan commit maps             |
| `.agent/governance/bin/gatekeeper-workflow.mjs`  | Unified commit execution (inspect + stage + commit)       |
| `commitlint.config.cjs`                          | Message validation (Planned or Maintenance)               |
| `scripts/validate-commits.mjs`                   | Range validation from commit trailers                     |
| `.husky/pre-commit`                              | Lint-staged, quality enforcement                          |
| `.husky/pre-push`                                | Smart range validation and tests                         |

## Primary Commands

```text
<<<<<<< Updated upstream
pnpm gatekeeper:plans:validate -- --plan <plan-id>
pnpm gatekeeper:workflow:inspect -- --plan <plan-id>
node .agent/governance/bin/gatekeeper-workflow.mjs stage --plan <plan-id> --unit <unit-id>
node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --unit <unit-id>
node .agent/governance/bin/gatekeeper-workflow.mjs commit --unit <unit-id>
=======
pnpm gatekeeper:plans:doctor -- --plan <plan-id>
pnpm gatekeeper:commit -- --plan <plan-id> [--unit <unit-id>]
pnpm gatekeeper:commit -- --maintenance
>>>>>>> Stashed changes
pnpm gatekeeper:workflow:cleanup
```

## Validation Sequence

<<<<<<< Updated upstream
1. `gatekeeper:plans:validate` verifies the active plan contract before runtime execution.
2. the operator reduces the working tree to exactly one material commit unit.
3. `inspect` validates gatekeeper readiness and resolves the current working tree to one unit.
4. `stage` stages that exact unit and writes `gatekeeper-s0.json`.
5. `scaffold` revalidates the staged set and previews the planned commit message.
6. `commit` revalidates the staged set again, appends trailers, validates with commitlint, and
   commits.
7. `pre-commit` refreshes S0 after formatting and runs strict Gatekeeper checks.
8. `pre-push` and CI validate commit trailers, unit match, and tests.
=======
1. `pnpm lint` stabilizes code quality.
2. `gatekeeper:plans:doctor` verifies lifecycle readiness and coverage.
3. `gatekeeper:commit` resolves the unit, stages it, and commits it in one atomic step.
4. `pre-push` validates the push range against trailers and runs tests.
>>>>>>> Stashed changes

## Maintenance Mode (Unplanned)

<<<<<<< Updated upstream
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
=======
Small, high-quality fixes (chore, docs, fix) can be committed without a formal plan by adding the following trailer to the commit body:

```text
Maintenance: true
```

These commits still undergo full linting, type-checking, and conventional commit validation but skip the plan-unit matching requirement.

## Guarantees

- **Atomicity**: `gatekeeper:commit` aborts if the staged set drifts from the plan.
- **Trazabilidad**: Every commit carries either `Plan-Id` or `Maintenance: true`.
- **Quality**: No branch-protection bypass (quality is never sacrificed for speed).
- **Graceful Archival**: Recursive search ensures archived plans don't break validation.

## Non-Goals

- There is no direct "trail-less" commit path.
- `gatekeeper:commit` is not for fix-on-the-fly loops.
>>>>>>> Stashed changes
