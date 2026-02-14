# Documentation Status Dashboard

**Last Updated:** 2026-02-14 **Next Review:** 2026-03-14 **Maintainer:** Workflow Governance System

---

## Quick Stats

| Metric             | Count                       | Status |
| ------------------ | --------------------------- | ------ |
| Total Workflows    | 55                          | 🟢     |
| Active Workflows   | 21                          | 🟢     |
| Archived Workflows | 34                          | 🟢     |
| Taxonomy           | Hybrid (domain + lifecycle) | 🟢     |

## Canonical Workflow Paths

- Gatekeeper: `.agent/workflows/governance/evergreen/gatekeeper-commit.md`
- Workflow sync: `.agent/workflows/sync/evergreen/workflow-sync.md`
- Skills sync: `.agent/workflows/sync/evergreen/skills-sync.md`
- Sync coordinator: `.agent/workflows/sync/evergreen/sync-coordinator.md`

## Active Workflow Registry

### Governance Evergreen

- [error-remediation.md](../.agent/workflows/governance/evergreen/error-remediation.md)
- [gatekeeper-commit.md](../.agent/workflows/governance/evergreen/gatekeeper-commit.md)
- [prompt-to-workflow.md](../.agent/workflows/governance/evergreen/prompt-to-workflow.md)
- [theme-architecture-governance.md](../.agent/workflows/governance/evergreen/theme-architecture-governance.md)

### Sync Evergreen

- [workflow-sync.md](../.agent/workflows/sync/evergreen/workflow-sync.md)
- [skills-sync.md](../.agent/workflows/sync/evergreen/skills-sync.md)
- [sync-coordinator.md](../.agent/workflows/sync/evergreen/sync-coordinator.md)

### Audits Task Open

- [gerardo-technical-audit.md](../.agent/workflows/audits/task-open/gerardo-technical-audit.md)
- [gerardo-premium-ux-audit.md](../.agent/workflows/audits/task-open/gerardo-premium-ux-audit.md)

### Remediation Task Open

- [gerardo-remediation.md](../.agent/workflows/remediation/task-open/gerardo-remediation.md)
- [gerardo-ux-remediation.md](../.agent/workflows/remediation/task-open/gerardo-ux-remediation.md)
- [gerardo-initial-card-recovery.md](../.agent/workflows/remediation/task-open/gerardo-initial-card-recovery.md)
- [itinerary-remediation.md](../.agent/workflows/remediation/task-open/itinerary-remediation.md)
- [hero-premium-audit-remediation.md](../.agent/workflows/remediation/task-open/hero-premium-audit-remediation.md)

### Docs Evergreen

- [docs-audit.md](../.agent/workflows/docs/docs-audit.md)
- [docs-remediation.md](../.agent/workflows/docs/docs-remediation.md)
- [docs-content-collections.md](../.agent/workflows/docs/docs-content-collections.md)
- [landing-page-maintenance.md](../.agent/workflows/docs/landing-page-maintenance.md)
- [sync-framework.md](../.agent/workflows/docs/sync-framework.md)
- [tech-debt-remediation.md](../.agent/workflows/docs/tech-debt-remediation.md)
- [README.md](../.agent/workflows/docs/README.md)

---

## Governance Notes

1. All active workflows must include frontmatter keys:

- `description`
- `lifecycle`
- `domain`
- `owner`
- `last_reviewed`

2. Completed tactical workflows flow:

- `task-open` -> `task-completed` -> `archive` (next `workflow-sync` cycle)

3. Inventory references:

- `docs/audit/workflow-inventory-2026-02-14.md`
- `docs/audit/workflow-execution-queue-2026-02-14.md`

---

## Next Operational Queue

1. `workflow-sync`
2. `hero-premium-audit-remediation`
3. `theme-architecture-governance`
4. `docs-remediation`
5. `skills-sync`
