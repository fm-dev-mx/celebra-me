# Git Governance: Plan-Aware Commit Execution

**Status:** Active  
**Last Updated:** 2026-03-19

## Overview

This document defines executable ownership for the pure plan-aware Gatekeeper commit workflow.

Commit intent is plan-owned. Execution and validation layers enforce the selected plan unit; they do not invent it.

## Ownership

| Owner | Responsibility |
| --- | --- |
| `.agent/plans/README.md` | Contract for executable plans and `commit-map.json` |
| `.agent/governance/bin/validate-commit-plan.mjs` | Machine validation of active plan commit maps |
| `.agent/governance/bin/gatekeeper-workflow.mjs` | Inspect, stage, scaffold, commit, cleanup |
| `commitlint.config.cjs` | Local commit message validation against the selected unit |
| `scripts/validate-commits.mjs` | Range validation from commit trailers plus plan metadata |
| `.husky/pre-commit` | Lint-staged, S0 refresh, strict Gatekeeper checks |
| `.husky/pre-push` | Commit-range validation and tests |

## Primary Commands

```text
pnpm gatekeeper:workflow:inspect -- --plan <plan-id>
node .agent/governance/bin/gatekeeper-workflow.mjs stage --plan <plan-id> --unit <unit-id>
node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --unit <unit-id>
node .agent/governance/bin/gatekeeper-workflow.mjs commit --unit <unit-id>
pnpm gatekeeper:workflow:cleanup
pnpm gatekeeper:plans:validate -- --plan <plan-id>
```

## Validation Sequence

1. `inspect` validates the active plan and resolves the current working tree to one unit.
2. `stage` stages that exact unit and writes `gatekeeper-s0.json`.
3. `scaffold` revalidates the staged set and previews the planned commit message.
4. `commit` revalidates the staged set again, appends trailers, validates with commitlint, and commits.
5. `pre-commit` refreshes S0 after formatting and runs strict Gatekeeper checks.
6. `pre-push` and CI validate commit trailers, unit match, and tests.

## Guarantees

- there is no commit fallback to domain heuristics
- `scope` is derived from the unit `domain`
- every planned commit carries `Plan-Id` and `Commit-Unit` trailers
- CI reconstructs the selected unit from those trailers
- staged-set drift blocks the commit instead of being auto-healed

## Non-Goals

- `domain-map.json` is not the owner of commit semantics
- markdown workflow docs do not redefine commit intent
- legacy `stage/scaffold/commit --domain` is not part of the commit path
