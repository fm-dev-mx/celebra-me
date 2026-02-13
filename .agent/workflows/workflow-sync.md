---
description: Workflow maintenance and drift detection.
---

# 💎 Workflow: Workflow Sync (Maintenance)

1. **Environmental Sync**
    - Phase: 2 (Expansion).
    - Cross-Ref: Align with `GATEKEEPER_RULES.md` and `PROJECT_CONVENTIONS.md`.
    - Paths: Verify all `docs/` references exist.

2. **Categorization & Pruning**
    - **Execution**: `jewelry-box-remediation`, `align-gerardo-styles`,
      `landing-page-theme-abstraction`.
    - **Gatekeeper**: `gatekeeper-commit` (consolidated from atomic-ui-commit + safe-commit).
    - **Asset/Design**: `asset-management`.
    - **Sync/Support**: `workflow-sync`, `skills-sync`, `./docs/docs-audit.md`,
      `./docs/docs-remediation.md`, `prompt-to-workflow`.
    - **Documentation**: `./docs/docs-content-collections.md`, `./docs/landing-page-maintenance.md`.
    - **Archived**: Check `archive/` folder for obsolete workflows (atomic-ui-commit, safe-commit,
      landing-page-remediation, docs-audit-old).
    - **Pruning**: Propose deletion for obsolete logic or engines.
    - **Terminology**: Enforce ADU, Jewelry Box, Hacienda, Asset Registry.
    - **Links**: Repo-relative `./name.md` or `./docs/name.md` only. No `file://`.

3. **Ability Integration**
    - Cross-ref with `.agent/skills/` (a11y, animation-motion).

4. **Quality & Performance**
    - Gatekeeper: Enforce JSDoc in English.
    - Anti-Noise: Remove redundant instructions.
    - `// turbo`: Verify placement for safe automation.

// turbo
