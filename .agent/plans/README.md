# Plan Governance & Executable Commit Maps

This directory holds the active executable plan record, if one exists, plus the plan archive.

## Active Plan Contract

An active plan lives at `.agent/plans/<plan-id>/` and should contain:

- `README.md`: intent, scope, and success criteria
- `manifest.json`: lifecycle and phase status
- `commit-map.json`: commit unit source of truth
- `CHANGELOG.md`: audit trail for the plan
- `phases/*.md`: short phase notes when the work benefits from explicit sequencing

`commit-map.json` is the planning authority. Do not invent `task.md`, `implementation_plan.md`, or
parallel planning structures.

## Lifecycle

1. Create the active plan record under `.agent/plans/<plan-id>/`.
2. Execute the work while updating the plan record as needed.
3. When complete, move the full record to `.agent/plans/archive/YYYY-MM/<plan-id>/` and mark the
   manifest as `COMPLETED`.

## Archive Rule

Completed plans remain available only under `.agent/plans/archive/`. The root of `.agent/plans/`
should stay lean so discovery reflects the currently active work.
