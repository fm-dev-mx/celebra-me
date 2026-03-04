# Documentation Status Dashboard

**Last Updated:** 2026-03-03 **Next Review:** 2026-04-03 **Maintainer:** Workflow Governance System

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

- [error-remediation.md](../.agent/workflows/evergreen/error-remediation.md) - 🟢
- [gatekeeper-commit.md](../.agent/workflows/evergreen/gatekeeper-commit.md) - 🟢
- [prompt-to-workflow.md](../.agent/workflows/evergreen/prompt-to-workflow.md) - 🟢
- [system-doc-alignment.md](../.agent/workflows/evergreen/system-doc-alignment.md) - 🟢
- [theme-architecture-governance.md](../.agent/workflows/evergreen/theme-architecture-governance.md) -
  🟢

### Tasks Open

- [generic-section-remediation.md](../.agent/workflows/task-open/generic-section-remediation.md) -
  🟡 (Inherited)

### Core Technical Docs

- [GIT_GOVERNANCE.md](./GIT_GOVERNANCE.md) - 🟢 (Established 2026-03-03)
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 🟢 (Updated 2026-02-15)
- [THEME_SYSTEM.md](./THEME_SYSTEM.md) - 🟢
- [ASSET_MANAGEMENT.md](./ASSET_MANAGEMENT.md) - 🟢
- [DB_RSVP.md](./DB_RSVP.md) - 🟢
- [rsvp-module.md](./architecture/rsvp-module.md) - 🟢 (Updated 2026-02-15)
- [TESTING.md](./TESTING.md) - 🟢 (Updated 2026-03-03)

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

1. Gatekeeper governance rollout (staged-only):
    1. Policy file: `.agent/gatekeeper/policy.json`
    2. Baseline file: `.agent/gatekeeper/baseline.json`
    3. CLI supports `--mode strict|quick`, `--enforce-phase 1|2|3`, `--report-json`, and `--s0-file`

---

## Next Operational Queue

1. `system-doc-alignment`
2. `theme-architecture-governance`
3. `gatekeeper-commit`
