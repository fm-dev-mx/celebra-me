---
description:
    Audits the entire project documentation ecosystem (Root, docs/**) against the source code to ensure synchronization, prevent drift, and maintain a single source of truth.
---

# 📚 Workflow: Holistic Documentation Audit & Synchronization

Use this workflow to govern the entire project documentation ecosystem. It safeguards against "documentation drift" in critical entry points like `README.md`, `CONTRIBUTING.md`, and recursively audits `docs/` to ensure the documentation reflects the actual state of the code.

## Execution Steps

1. **Pre-Audit & Vision Alignment (Gatekeeper)**:
    - **Vision Check**: Ensure `docs/PREMIUM_UX_VISION.md` reflects recent architectural shifts (e.g., "Aesthetic Presets", "Typography System"). If missing, update it first.
    - **Changelog**: If `CHANGELOG.md` is missing, propose its creation based on git history.

2. **Status Mapping (Holistic Scope)**:
    - **Root Files**: Audit `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md` (if exists).
    - **Full Docs Tree**: Recursively audit `docs/**/*.md` (expanding beyond `plan/`).
    - **Cross-Reference**: For each document, verify its claims against the current source code (`src/`) and configuration.

3. **Lifecycle Management**:
    - **Project Files (Root)**:
        - **Do NOT archive**.
        - **Update in place**: Rewrite sections that have drifted from the `src/` reality (e.g., install steps, project structure).
    - **Plans (`docs/plan/*`)**:
        - **Archive**: Move to `docs/plan/archive/` ONLY if 100% implemented.
        - **Debt Extraction**: If mostly complete, move pending items to `docs/plan/technical-debt.md` before archiving.
    - **General Docs**:
        - **Flag**: Identify if redundant or obsolete. Update or propose for archiving.

4. **Reporting & Categorization**:
    - Categorize findings in the audit log (e.g., `docs/audit-report-YYYY-MM.md`) using the following status indicators:
        - 🔴 **Critical Drift**: Setup instructions, commands, or architecture claims that effectively fail or mislead.
        - 🟡 **Stale Content**: Operational but uses outdated phrasing, version numbers, or deprecated patterns.
        - 🟢 **Synced**: Verified against strictly current code and acting as a true Source of Truth.

5. **Vision Synchronization**:
    - Update `docs/PREMIUM_UX_VISION.md` to match the current architectural and visual status of the project.
    - Synchronize any tables or status lists in the vision document with the audit findings.

// turbo

## Agent Instruction

Execute a holistic audit of the project documentation.

1. **Gatekeeper**: Check `docs/PREMIUM_UX_VISION.md` for major architectural gaps (Presets, Typography). Update if needed.
2. **Scan**: Audit Root files (`README.md`, `CONTRIBUTING.md`) and the full `docs/` tree.
3. **Drift Detection**: Verify against `src/`.
4. **Update**: Update Root files in place and Archive completed plans.
5. **Report**: Report findings using the 🔴/🟡/🟢 status indicators in a new audit log.
6. **Review**: Explicitly ask the user to review the `git diff` for any unintended large-scale changes.
