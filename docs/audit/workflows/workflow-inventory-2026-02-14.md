# Workflow Inventory Snapshot - 2026-02-14

## Summary

- Scope: `.agent/workflows/`
- Strategy: Hybrid taxonomy (domain + lifecycle)
- Total workflows: 32
- Active workflows: 32
- Archived workflows: 0
- Note: `archive/` is currently empty in filesystem.

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

- `.agent/workflows/remediation/task-open/gerardo-initial-card-recovery.md`
- `.agent/workflows/remediation/task-open/gerardo-structural-audit.md`
- `.agent/workflows/remediation/task-open/hero-premium-audit-remediation.md`
- `.agent/workflows/remediation/task-open/premium-invitation-orchestrator.md`
- `.agent/workflows/remediation/task-open/generic-section-remediation.md`

### docs evergreen (7)

- `.agent/workflows/docs/docs-audit.md`
- `.agent/workflows/docs/docs-remediation.md`
- `.agent/workflows/docs/docs-content-collections.md`
- `.agent/workflows/docs/landing-page-maintenance.md`
- `.agent/workflows/docs/sync-framework.md`
- `.agent/workflows/docs/tech-debt-remediation.md`
- `.agent/workflows/docs/README.md`

## Archived Workflows

- `.agent/workflows/archive/` exists but currently has no files.
- Prior inventory statements about archived workflow counts are stale and superseded.

## Critical Fixes Applied in This Cycle

- Gatekeeper canonicalized to: `.agent/workflows/governance/evergreen/gatekeeper-commit.md`
- Frontmatter lifecycle/domain normalized for remediation workflows in `task-open`.
- Frontmatter metadata normalized on active workflows:
    - `description`
    - `lifecycle`
    - `domain`
    - `owner`
    - `last_reviewed`
- Canonical audit taxonomy introduced in
  `docs/audit/{discovery,workflows,docs-governance,tech-debt,remediation}/`.

## Next Execution Queue

See: `docs/audit/workflows/workflow-execution-queue-2026-02-14.md`
