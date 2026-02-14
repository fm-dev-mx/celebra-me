# Workflow Inventory Snapshot - 2026-02-14

## Summary

- Scope: `.agent/workflows/`, `.agent/workflows/docs/`, `.agent/workflows/archive/`
- Strategy: Hybrid taxonomy (domain + lifecycle)
- Total workflows: 55
- Active workflows: 21
- Archived workflows: 34

## Active Workflows by Domain

### governance/evergreen (4)

- `.agent/workflows/governance/evergreen/error-remediation.md`
- `.agent/workflows/governance/evergreen/gatekeeper-commit.md`
- `.agent/workflows/governance/evergreen/prompt-to-workflow.md`
- `.agent/workflows/governance/evergreen/theme-architecture-governance.md`

### sync/evergreen (3)

- `.agent/workflows/sync/evergreen/workflow-sync.md`
- `.agent/workflows/sync/evergreen/skills-sync.md`
- `.agent/workflows/sync/evergreen/sync-coordinator.md`

### audits/task-open (2)

- `.agent/workflows/audits/task-open/gerardo-technical-audit.md`
- `.agent/workflows/audits/task-open/gerardo-premium-ux-audit.md`

### remediation/task-open (5)

- `.agent/workflows/remediation/task-open/gerardo-remediation.md`
- `.agent/workflows/remediation/task-open/gerardo-ux-remediation.md`
- `.agent/workflows/remediation/task-open/gerardo-initial-card-recovery.md`
- `.agent/workflows/remediation/task-open/itinerary-remediation.md`
- `.agent/workflows/remediation/task-open/hero-premium-audit-remediation.md`

### docs evergreen (7)

- `.agent/workflows/docs/docs-audit.md`
- `.agent/workflows/docs/docs-remediation.md`
- `.agent/workflows/docs/docs-content-collections.md`
- `.agent/workflows/docs/landing-page-maintenance.md`
- `.agent/workflows/docs/sync-framework.md`
- `.agent/workflows/docs/tech-debt-remediation.md`
- `.agent/workflows/docs/README.md`

## Archived Workflows

- All task and superseded workflows are centralized in `.agent/workflows/archive/`.
- Archive now includes former top-level premium audits/remediations and orchestrator flows.

## Critical Fixes Applied in This Cycle

- Gatekeeper canonicalized to: `.agent/workflows/governance/evergreen/gatekeeper-commit.md`
- Active workflows moved from top-level to hybrid folders.
- Frontmatter metadata normalized on active workflows:
    - `description`
    - `lifecycle`
    - `domain`
    - `owner`
    - `last_reviewed`
- New workflow created:
    - `.agent/workflows/remediation/task-open/hero-premium-audit-remediation.md`

## Next Execution Queue

See: `docs/audit/workflow-execution-queue-2026-02-14.md`
