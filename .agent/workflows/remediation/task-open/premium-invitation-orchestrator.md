---
description:
    Master orchestrator to coordinate, validate, and execute premium audits across all invitation
    sections.
lifecycle: task-open
domain: remediation
owner: ux-remediation
last_reviewed: 2026-02-14
---

# 🎼 Workflow: Premium Invitation Audit Orchestrator

## Objective

Provide a unified execution framework that ensures every section of the digital invitation (Header,
Hero, Family, Event Location, Itinerary, Gallery, RSVP) undergoes a rigorous quality audit,
identifies gaps in current workflows, executes them, and prepares independent remediation plans.

## Phase 0: Meta-Audit & Gap Analysis

**Goal**: Ensure the "Auditor" workflows are themselves up to "Premium" standards.

1. **Validation Check**: Review the following workflows:
    - `.agent/workflows/remediation/task-open/generic-section-remediation.md`
    - `.agent/workflows/remediation/task-open/hero-premium-audit-remediation.md`
    - `.agent/workflows/remediation/task-open/gerardo-remediation-master.md`

2. **Gap Analysis**: Verify if each workflow includes:
    - **Responsive Parity**: Explicit checks for both 320px (iPhone SE) and 1440px (Desktop).
    - **Token Enforcement**: Verification of `tokens.$font-*` and `tokens.$color-*` usage.
    - **Motion Quality**: Evaluation of Framer Motion or SCSS transitions.
    - **Accessibility**: Touch targets (44px+) and WCAG contrast.

3. **Self-Correction**: If a gap is found in a workflow, update the specific
   `.agent/workflows/remediation/task-open/*.md` file BEFORE execution.

## Phase 1: Serial Execution (Discovery)

**Goal**: Run the audits and generate evidence-based findings.

1. **Sequential Run**:
    - Execute `gerardo-remediation-master.md` (Covers Header, Family, Event, Itinerary, Gallery,
      RSVP).
    - Execute `hero-premium-audit-remediation.md`.
    - Execute `gerardo-initial-card-recovery.md` (only if reveal card issue remains open).
    - Perform technical walkthrough (static code analysis).
    - Perform visual walkthrough (browser verification).

2. **Discovery Reports**: Generate a centralized report for each:
    - Path: `docs/audit/discovery/discovery-[section]-[date].md`
    - Content: Visual bugs, technical debt, accessibility gaps, and "premium feel" friction.

## Phase 2: Remediation Blueprinting

**Goal**: Prepare the path for the next "surgical" iteration.

1. **Workflow Normalization**: For each section that has findings:
    - Reuse and update existing workflow in `.agent/workflows/remediation/task-open/`.
    - Do not create duplicate remediation workflow files.
    - Content:
        - Specific technical instructions to fix identified findings.
        - Reference to the discovery report.
        - Strict "No Regression" verification steps.

2. **Critical Reflection**: Analyze the _total_ invitation flow:
    - Do the styles across sections feel cohesive?
    - Is there a "Premium Crescendo" in the user experience?

## Phase 3: Final Synthesis

**Goal**: Notify the user and update project records.

1. Update `docs/implementation-log.md`.
2. Update `docs/audit/workflows/workflow-execution-queue-YYYY-MM-DD.md` if order changed.
3. Move completed workflows to `.agent/workflows/remediation/task-completed/`.
4. Provide a summary of the "Remediation Map" to the user.

---

## Critical Rules

- **No Code Mutations**: This orchestrator is for discovery and planning ONLY. Do not modify source
  code (`.astro`, `.tsx`, `.scss`).
- **Independent Remediations**: Each section's remediation workflow must be able to run
  independently of others.
- **Evidence-First**: Every finding in the discovery report must be backed by specific code line
  numbers or browser screenshots/records.
- **Canonical Audit Paths**: Use `docs/audit/discovery/` and `docs/audit/workflows/` folders.

// turbo
