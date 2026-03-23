---
name: plan-authoring
description: Code analysis and declarative commit-map planning
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-03-22
when_to_use:
    - A change needs commit planning before or after implementation
    - An active plan must be updated to match the current implementation reality
preconditions:
    - Read .agent/README.md
    - Read .agent/GATEKEEPER_RULES.md
inputs:
    - Requirements, code changes, active plan files, and commit-map boundaries
outputs:
    - Executable active plan with validated commit strategy metadata
related_docs:
    - docs/core/git-governance.md
    - docs/DOC_STATUS.md
---

# Plan Authoring Workflow

Use this workflow for the thinking and authoring side of commit planning. It owns code analysis, intent mapping, `commit-map.json`, and preflight validation.

## Planned vs. Unplanned Work

- **Planned Path**: Use for features, refactors, and complex fixes. Requires an active plan under `.agent/plans/`.
- **Maintenance Path (Unplanned)**: Use for chores, small documentation fixes, or infra updates. Use the `Maintenance: true` trailer.

## Strict Rule: Code Quality Before Planning

`pnpm lint` must pass before finalizing any commit strategy.

## Routine (Planned Path)

1. Draft the strategy in `commit-map.json` before or during implementation.
2. After implementation, run the planning-side doctor:

   ```bash
   pnpm gatekeeper:plans:doctor -- --plan <plan-id>
   ```

3. Resolve all findings.
4. Transition to **gatekeeper-commit** for execution.

## Lifecycle & Archival

- Active plans remain under `.agent/plans/`.
- Once all units are committed, move the plan to `archive/YYYY-MM/`.
- Recursive search enables validation of archived plans during push.
