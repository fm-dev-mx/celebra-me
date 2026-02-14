# Workflow Inventory Snapshot - 2026-02-13

> Superseded by `docs/audit/workflow-inventory-2026-02-14.md` after hybrid taxonomy migration.

## Summary

- Scope: `.agent/workflows/`, `.agent/workflows/docs/`, `.agent/workflows/archive/`
- Policy: Aggressive cleanup, no `.agent/workflows/tasks/`
- Total workflows: 33
- `evergreen`: 14
- `task-open`: 2
- `task-completed`: 0 (completed tasks are archived immediately)
- `archived`: 17

## Active Workflows

### evergreen (14)

- `.agent/workflows/governance/evergreen/error-remediation.md`
- `.agent/workflows/governance/evergreen/prompt-to-workflow.md`
- `.agent/workflows/sync/evergreen/skills-sync.md`
- `.agent/workflows/sync/evergreen/sync-coordinator.md`
- `.agent/workflows/governance/evergreen/theme-architecture-governance.md`
- `.agent/workflows/sync/evergreen/workflow-sync.md`
- `.agent/workflows/docs/README.md`
- `.agent/workflows/docs/docs-audit.md`
- `.agent/workflows/docs/docs-content-collections.md`
- `.agent/workflows/docs/docs-remediation.md`
- `.agent/workflows/governance/evergreen/gatekeeper-commit.md`
- `.agent/workflows/docs/landing-page-maintenance.md`
- `.agent/workflows/docs/sync-framework.md`
- `.agent/workflows/docs/tech-debt-remediation.md`

### task-open (2)

- `.agent/workflows/audits/task-open/gerardo-technical-audit.md`
- `.agent/workflows/remediation/task-open/gerardo-remediation.md`

## Archived Workflows (17)

- `.agent/workflows/archive/align-gerardo-styles.md`
- `.agent/workflows/archive/asset-management.md`
- `.agent/workflows/archive/audit-cumple-60-gerardo.md`
- `.agent/workflows/archive/color-architecture.md`
- `.agent/workflows/archive/docs-audit.md`
- `.agent/workflows/archive/hero-refinement.md`
- `.agent/workflows/archive/husky-standardization.md`
- `.agent/workflows/archive/icon-refactor.md`
- `.agent/workflows/archive/invitation-execution.md`
- `.agent/workflows/archive/invitation-verification.md`
- `.agent/workflows/archive/jewelry-box-extension.md`
- `.agent/workflows/archive/jewelry-box-remediation.md`
- `.agent/workflows/archive/landing-page-regression-recovery.md`
- `.agent/workflows/archive/landing-page-theme-abstraction.md`
- `.agent/workflows/archive/premium-dev-cycle.md`
- `.agent/workflows/archive/technical-debt-remediation.md`
- `.agent/workflows/archive/universal-asset-system.md`

## Cleanup Applied in This Cycle

- Archived:
    - `.agent/workflows/landing-page-theme-abstraction.md`
    - `.agent/workflows/align-gerardo-styles.md`
    - `.agent/workflows/jewelry-box-remediation.md`
- Legacy refs removed from active workflows:
    - `write_to_file`
    - `.agent/ARCHITECTURE.md`
    - `/safe-commit`
    - `.agent/workflows/tasks/*`
    - `archive/workflows/`

## Operational Rule

During `workflow-sync`, any task workflow with completion evidence in `docs/implementation-log.md`
must be archived in the next sync cycle.
