# Workflow Execution Queue - 2026-02-14

Priority policy: UX premium first, with governance guardrails.

## Execution Status (2026-02-14)

- [x] Step 1 completed: `.agent/workflows/sync/evergreen/workflow-sync.md`
- [x] Step 2 completed: `.agent/workflows/docs/docs-remediation.md`
- [x] Step 3 completed: `.agent/workflows/governance/evergreen/theme-architecture-governance.md`
- [ ] Step 4 next: `.agent/workflows/remediation/task-open/gerardo-structural-audit.md`

## Ordered Plan

1. `.agent/workflows/sync/evergreen/workflow-sync.md`
    - Resolve residual drift, references, and lifecycle consistency.

2. `.agent/workflows/docs/docs-remediation.md`
    - Correct operational docs that contradict filesystem reality.

3. `.agent/workflows/governance/evergreen/theme-architecture-governance.md`
    - Validate preset isolation and section boundaries before section remediations.

4. `.agent/workflows/remediation/task-open/gerardo-structural-audit.md`
    - Confirm narrative sequence and section priorities.

5. `.agent/workflows/remediation/task-open/premium-invitation-orchestrator.md`
    - Discovery-only meta-check to ensure section workflows are execution-ready.

6. `.agent/workflows/remediation/task-open/generic-section-remediation.md` (Header)
7. `.agent/workflows/remediation/task-open/hero-premium-audit-remediation.md`
8. `.agent/workflows/remediation/task-open/generic-section-remediation.md` (Family)
9. `.agent/workflows/remediation/task-open/generic-section-remediation.md` (Event)
10. `.agent/workflows/remediation/task-open/generic-section-remediation.md` (Itinerary)
11. `.agent/workflows/remediation/task-open/generic-section-remediation.md` (Gallery)
12. `.agent/workflows/remediation/task-open/generic-section-remediation.md` (RSVP)
13. `.agent/workflows/remediation/task-open/gerardo-initial-card-recovery.md` (only if envelope-card
    issue remains open)

14. `.agent/workflows/governance/evergreen/gatekeeper-commit.md` after each block or controlled
    batch.
15. Move each executed remediation workflow: `task-open` -> `task-completed`.
16. Next `workflow-sync` cycle: `task-completed` -> `archive` with evidence in
    `docs/implementation-log.md`.

## Entry Criteria

- No unresolved merge markers in active workflows or discovery docs.
- Canonical gatekeeper path in all operational references.
- Active workflows must include required frontmatter metadata.
- Discovery evidence must be stored under `docs/audit/discovery/`.
