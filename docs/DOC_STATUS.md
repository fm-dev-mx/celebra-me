# Documentation Status Dashboard

**Last Updated:** 2026-02-15 **Next Review:** 2026-03-15 **Maintainer:** Workflow Governance System

---

## Quick Stats

| Metric             | Count                       | Status |
| ------------------ | --------------------------- | ------ |
| Total Workflows    | 6                           | 🟢     |
| Active Workflows   | 6                           | 🟢     |
| Archived Workflows | 0                           | 🟢     |
| Taxonomy           | Hybrid (domain + lifecycle) | 🟢     |

## Canonical Workflow Paths

- Gatekeeper: `.agent/workflows/evergreen/gatekeeper-commit.md`
- Error Remediation: `.agent/workflows/evergreen/error-remediation.md`
- Prompt to Workflow: `.agent/workflows/evergreen/prompt-to-workflow.md`
- Theme Architecture: `.agent/workflows/evergreen/theme-architecture-governance.md`

## Active Workflow Registry

### Governance Evergreen

- [error-remediation.md](../.agent/workflows/evergreen/error-remediation.md)
- [gatekeeper-commit.md](../.agent/workflows/evergreen/gatekeeper-commit.md)
- [prompt-to-workflow.md](../.agent/workflows/evergreen/prompt-to-workflow.md)
- [theme-architecture-governance.md](../.agent/workflows/evergreen/theme-architecture-governance.md)

### Tasks Open

- [generic-section-remediation.md](../.agent/workflows/task-open/generic-section-remediation.md)
- [system-doc-alignment.md](../.agent/workflows/task-open/system-doc-alignment.md)

---

## Governance Notes

1. All active workflows must include frontmatter keys:
    1. `description`
    2. `lifecycle`
    3. `domain`
    4. `owner`
    5. `last_reviewed`

1. Completed tactical workflows flow:
    1. `task-open` -> `task-completed` -> `archive` (next manual cycle)

1. Inventory references:
    1. `docs/audit/full-system-audit-2026-02-15.md`

---

## Next Operational Queue

1. `system-doc-alignment`
2. `theme-architecture-governance`
3. `gatekeeper-commit`
