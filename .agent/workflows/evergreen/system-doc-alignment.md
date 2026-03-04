---
description:
    Governance and synchronization of technical documentation with the current system state.
---

# Optimized Governance & Alignment Prompt

## Role & Context

You are a **Principal Governance Architect**. Your mission is to ensure absolute synchronization
between the project's technical documentation and its source code implementation. You must eliminate
"Documentation Drift" and enforce best practices across the entire project.

## Objective

Design and implement a robust, independent workflow (complementing the existing
`/gatekeeper-commit`) for **System Governance and Documentation Alignment**.

## Core Requirements

1. **Bidirectional Alignment**:
    - Ensure the code 100% reflects the architectural decisions and business logic defined in
      `docs/*.md`.
    - Ensure documentation is updated immediately to reflect physical or logical changes in the
      code.

2. **Hygiene & Pattern Audit**:
    - The workflow must scan the project for "Bad Practices" (Technical Debt, Pattern Violations,
      Logic Inconsistencies).
    - It should identify violations of established `skills` and project-specific aesthetics (Jewelry
      Box, 3-Layer Color Architecture).

3. **System-Wide Asset Pruning**:
    - Audit all `workflows/`, `skills/`, and `docs/` for redundancies or obsolete information.
    - Automatically identify and propose the deletion of orphaned files or logic that no longer
      serves the current project architecture.
    - Resolve inconsistencies between overlapping skills or fragmented documentation.

4. **Persistent Planning Layer**:
    - For every alignment or remediation task, create a dedicated folder in
      `.agent/plans/<plan_id>/`.
    - Required files in each plan folder:
        - `README.md`: Overview of the plan, current state vs. target state, and impact analysis.
        - `CHANGELOG.md`: Detailed history of modifications performed during the plan execution.
        - `PHASED_PLAN.md`: A granular, step-by-step instruction set divided into logical phases.

5. **Progress Persistence (Multi-Run Support)**:
    - Each phase and sub-task in `PHASED_PLAN.md` (and progress summaries in `README.md`) must
      include a **Percentage Completion Indicator** (e.g., `[Progress: 45%]`).
    - The workflow must be designed to be interrupted and resumed. Upon restart, it should read the
      current progress and continue from the last incomplete step.

6. **Independence & Reusability**:
    - This workflow must operate independently of the commit gatekeeper.
    - It may leverage existing utilities (like `pnpm gatekeeper:report` if applicable) but must not
      modify or break the commit workflow's deterministic contract.

## Workflow Definition (Template)

**Command**: `/system-doc-alignment`

### Execution Phases:

#### Phase 1: Deep Audit & Drift Detection

- Perform a comprehensive scan of `docs/`, `.agent/skills/`, and `.agent/workflows/`.
- **Integrity Mapping**: Map the relationships between these three layers. Identify where a skill is
  mentioned but doesn't exist, or where a workflow refers to outdated documentation.
- **Redundancy Sweep**: Detect overlapping instructions or duplicated "Sources of Truth".
- **Drift Discovery**: Compare against the physical structure and logic in `src/`.
- Identify "High Severity" alignment gaps, hygiene violations, and obsolete files.

#### Phase 2: Strategic Planning

- Initialize the `.agent/plans/` environment.
- Generate the `README.md`, `CHANGELOG.md`, and `PHASED_PLAN.md`.
- Set initial progress markers at `[0%]`.

#### Phase 3: Surgical Execution

- Execute the plan phases sequentially.
- For each code or doc update:
    - Apply the change.
    - Update the `CHANGELOG.md`.
    - Increment the percentage in `PHASED_PLAN.md` and `README.md`.

#### Phase 4: Final Verification

- Run technical checks (`pnpm astro check`, linting, etc.).
- Verify the `docs/DOC_STATUS.md` is updated and reflects "Healthy" status.

---

**Instruction for the Agent**: "When I run this workflow, start by scanning the environment. If a
plan already exists in `.agent/plans/`, ask me if you should resume it or start a new one. Provide a
summary of the current alignment health before proposing the next steps."
