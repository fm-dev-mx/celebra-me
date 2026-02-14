# Audit Taxonomy (Canonical)

This folder now uses a typed structure for audit artifacts:

- `docs/audit/discovery/`: section discovery reports (`discovery-*.md`)
- `docs/audit/workflows/`: workflow inventory and execution queue
- `docs/audit/docs-governance/`: documentation governance audit reports
- `docs/audit/tech-debt/`: technical debt audit reports
- `docs/audit/remediation/`: remediation checklists and execution tracking

## Legacy Root Files

Root-level files under `docs/audit/` are kept for backward compatibility while references are
updated. New artifacts should be created in the typed subfolders above.

Historical snapshots are centralized in `docs/audit/archive/2026-02/`.

When filesystem constraints prevent hard deletes, legacy duplicates are converted into pointer stubs
that reference their canonical/historical location.

## Naming Convention

- Discovery: `discovery-<section>-YYYY-MM-DD.md`
- Inventory: `workflow-inventory-YYYY-MM-DD.md`
- Queue: `workflow-execution-queue-YYYY-MM-DD.md`
- Docs governance: `audit-report-YYYY-MM-DD.md`
- Technical debt: `technical-debt-audit-YYYY-MM-DD.md`

// turbo
