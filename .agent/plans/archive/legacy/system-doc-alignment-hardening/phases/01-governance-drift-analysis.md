# Phase 01: Governance Drift Analysis & Templating

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Audit the existing `/system-doc-alignment` workflow against the centralized Planning
Governance Framework and compile an action plan with an updated template.

**Weight:** 50% of total plan

---

## 🎯 Analysis / Findings (Governance Drift Report)

### 1. Discovery & Mapping

The primary assets related to documentation and systemic alignment are:

- **Workflow:** `.agent/workflows/system-doc-alignment.md` (The primary subject of this audit)
- **Skill:** `.agent/skills/documentation-governance/SKILL.md` (Governs broader documentation
  metadata and lifecycle rules)
- **Framework:** `.agent/plans/README.md` (The newly established Planning Governance Framework)

### 2. Structural Audit Conflicts

When mapping the "Persistent Planning Layer" of the current workflow against the mandatory
`README.md` schema, the following critical conflicts emerge:

- **Missing `manifest.json`:** The current workflow ignores the mandatory `manifest.json` required
  for programmatic tracking.
- **Deprecated File Structure:** It assumes a monolithic `PHASED_PLAN.md` file rather than using the
  strict `phases/` directory containing individual `01-{phase-name}.md` files.
- **Incorrect Progress Tokens:** It instructs the agent to use `[Progress: 45%]` instead of the
  mandatory progress header: `**Completion:** 0% | **Status:** PENDING`.
- **Missing Frontmatter:** The workflow itself lacks the standardized YAML frontmatter defined by
  the `documentation-governance` skill (`lifecycle`, `domain`, `owner`).

### 3. Drift Analysis (Architectural Layers)

While the workflow correctly enforces sweeps for "Jewelry Box" and "3-Layer Color Architecture", it
has drifted from recent architectural expansions:

- **Missing Specialized Skills:** It fails to explicitly scan for compliance with newer foundational
  skills such as `copywriting-es`, `seo-metadata`, and modern `astro-patterns`.
- **Incomplete Granularity:** The workflow's drift detection doesn't mandate verifying GFM checkbox
  granularity and timestamp implementations `(Completed: YYYY-MM-DD HH:MM)` within planning
  documents.

---

## 🛠️ Proposed Workflow Template [STATUS: COMPLETED]

The proposed, fully compliant version of `.agent/workflows/system-doc-alignment.md` is provided
below. Do NOT apply changes to the live file until user approval is granted.

### Updated Template

```markdown
---
description:
    Governance and synchronization of technical documentation with the current system state.
lifecycle: 'evergreen'
domain: 'governance'
owner: 'system-agent'
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
    - It should identify violations of established `skills` (`copywriting-es`, `seo-metadata`,
      `astro-patterns`, etc.) and project-specific aesthetics (Jewelry Box, 3-Layer Color
      Architecture).

3. **System-Wide Asset Pruning**:
    - Audit all `workflows/`, `skills/`, and `docs/` for redundancies or obsolete information.
    - Automatically identify and propose the deletion of orphaned files or logic that no longer
      serves the current project architecture.
    - Resolve inconsistencies between overlapping skills or fragmented documentation.

4. **Persistent Planning Layer**:
    - For every alignment or remediation task, create a dedicated folder under
      `.agent/plans/{plan-name}/` using strict `kebab-case`.
    - Adhere 100% to the **Planning Governance Framework**. Required files must include:
        - `README.md`: Executive overview, duration estimate, blockers, risk matrix, and Phase
          Index.
        - `CHANGELOG.md`: Chronological audit trail of all milestones, deviations, and pivots with
          detailed timestamps.
        - `manifest.json`: Machine-readable metadata describing plan and phase status.
        - `phases/`: A directory containing one Markdown file per execution phase (e.g.,
          `01-{phase-name}.md`).

5. **Progress Persistence (Multi-Run Support)**:
    - Each phase file in `phases/*.md` and the root `README.md` must include the standard
      progression header: `**Completion:** 0% | **Status:** PENDING`.
    - Use GitHub Flavored Markdown (GFM) checkboxes for task granularity and timestamp completions
      using `(Completed: YYYY-MM-DD HH:MM)`.
    - `manifest.json` must be explicitly updated after every phase status change to allow for
      seamless interruption and resumption.

6. **Independence & Reusability**:
    - This workflow must operate independently of the commit gatekeeper.
    - It may leverage existing utilities but must not modify or break the commit workflow's
      deterministic contract.

## Workflow Definition (Template)

**Command**: `/system-doc-alignment`

### Execution Phases:

#### Phase 1: Deep Audit & Drift Detection

- Perform a comprehensive scan of `docs/`, `.agent/skills/`, and `.agent/workflows/`.
- **Integrity Mapping**: Map out the architectural landscape and ensure sweeping compliance across
  recent skills.
- **Redundancy Sweep**: Detect overlapping instructions or duplicated "Sources of Truth".
- **Drift Discovery**: Compare against the physical structure and logic in `src/`.
- Identify "High Severity" alignment gaps, hygiene violations, and obsolete files.

#### Phase 2: Strategic Planning

- Initialize the `.agent/plans/{plan-name}/` environment.
- Generate `README.md`, `CHANGELOG.md`, `manifest.json`, and the `phases/` directory.
- Set initial progress markers to `0%` and statuses to `PENDING` across all planning documents.

#### Phase 3: Surgical Execution

- Execute the plan phases sequentially.
- For each code or doc update:
    - Apply the change.
    - Append an explicit timestamp in the `CHANGELOG.md` and the appropriate `phases/*.md` document.
    - Update progress tracking variables in `README.md` and `manifest.json`.

#### Phase 4: Final Verification

- Run technical checks (`pnpm astro check`, linting, etc.).
- Verify the `docs/DOC_STATUS.md` is updated and reflects "Healthy" status.

---

**Instruction for the Agent**: "When I run this workflow, start by scanning the environment. If a
plan already exists in `.agent/plans/`, ask me if you should resume it or start a new one. Provide a
summary of the current alignment health before proposing the next steps."
```

---

## 🛠️ Execution Tasks [STATUS: COMPLETED]

### Audit & Discovery

- [x] Analyze `system-doc-alignment.md` workflow. (Completed: 2026-03-10 11:41)
- [x] Compare against Planning Governance Framework `README.md`. (Completed: 2026-03-10 11:41)
- [x] Perform Drift Analysis against architectural boundaries. (Completed: 2026-03-10 11:41)

### Templating

- [x] Draft updated Governance Drift Report. (Completed: 2026-03-10 11:41)
- [x] Produce completely compliant `system-doc-alignment` replacement template. (Completed:
      2026-03-10 11:41)

---

## ✅ Acceptance Criteria

- [x] Governance Drift Report is comprehensive and explicitly maps structural conflicts with
      `manifest.json` and the `phases/` hierarchy.
- [x] Updated template corrects `PHASED_PLAN.md` references.
- [x] The completed plan phase aligns entirely with the new Planning Governance Framework itself.

---

## 📎 References

- [.agent/plans/README.md](../../../README.md)
- [.agent/workflows/system-doc-alignment.md](../../../workflows/system-doc-alignment.md)
