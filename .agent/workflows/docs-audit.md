---
description:
    Audits project documentation (docs/plan/*) against the source code to ensure synchronization,
    archive completed plans, and track technical debt.
---

# 📚 Workflow: Documentation & Ground Truth Audit

Use this workflow to clean up the `docs/plan/` directory and ensure that the project's documentation
reflects the actual state of the code.

## Execution Steps

1. **Status Mapping (Ground Truth)**:
    - Identify all files in `docs/plan/`.
    - For each plan, perform a cross-reference with the source code (`src/`).
    - Determine if the features described are: **Implemented**, **Partial**, or **Pending**.

2. **Clean & Archive**:
    - Move all documentation files that are 100% implemented to `docs/plan/archive/`.
    - **Debt Extraction**: If a plan is mostly complete but has small pending items, move those
      items to `docs/plan/technical-debt.md` before archiving the main file.

3. **Vision Update**:
    - Update `docs/PREMIUM_UX_VISION.md` to match the current architectural and visual status of the
      project.
    - Synchronize any tables or status lists in the vision document with the audit findings.

4. **Strategic Review**:
    - Analyze if high-level documents (like `invitation-master-plan.md`) are becoming redundant due
      to atomic workflows (ADUs).
    - Propose consolidations to keep the documentation "lean".

5. **Reporting**:
    - Create or update an audit log (e.g., `docs/plan/audit-report-YYYY-MM.md`) summarizing the
      changes.

// turbo

## Agent Instruction

Execute a deep audit of the `docs/plan/` folder. Cross-reference with the `src/` directory to
identify discrepancies. Archive completed plans, extract technical debt, and update the vision
documentation. Report all findings in a new audit log file.
