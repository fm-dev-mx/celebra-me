---
description:
    Master orchestrator to coordinate, validate, and execute premium audits across all invitation
    sections.
---

# 🎼 Workflow: Premium Invitation Audit Orchestrator

## Objective

Provide a unified execution framework that ensures every section of the digital invitation (Header,
Family, Event Location, Itinerary, RSVP) undergoes a rigorous quality audit, identifies gaps in
current workflows, executes them, and prepares independent remediation plans.

## Phase 0: Meta-Audit & Gap Analysis

**Goal**: Ensure the "Auditor" workflows are themselves up to "Premium" standards.

1. **Validation Check**: Review the following workflows:
    - `@/header-premium-audit`
    - `@/family-premium-audit`
    - `@/event-section-premium-audit`
    - `@/itinerary-premium-audit`
    - `@/rsvp-premium-audit`
    - `@/gallery-premium-audit`

2. **Gap Analysis**: Verify if each workflow includes:
    - **Responsive Parity**: Explicit checks for both 320px (iPhone SE) and 1440px (Desktop).
    - **Token Enforcement**: Verification of `tokens.$font-*` and `tokens.$color-*` usage.
    - **Motion Quality**: Evaluation of Framer Motion or SCSS transitions.
    - **Accessibility**: Touch targets (44px+) and WCAG contrast.

3. **Self-Correction**: If a gap is found in a workflow, update the `.agent/workflows/[name].md`
   file BEFORE execution.

## Phase 1: Serial Execution (Discovery)

**Goal**: Run the audits and generate evidence-based findings.

1. **Sequential Run**: For each section (Header → Family → Event → Itinerary → Gallery → RSVP):
    - Execute the audited workflow.
    - Perform technical walkthrough (static code analysis).
    - Perform technical walkthrough (static code analysis).
    - Perform visual walkthrough (browser verification).

2. **Discovery Reports**: Generate a centralized report for each:
    - Path: `docs/audit/discovery-[section]-[date].md`
    - Content: Visual bugs, technical debt, accessibility gaps, and "premium feel" friction.

## Phase 2: Remediation Blueprinting

**Goal**: Prepare the path for the next "surgical" iteration.

1.  **Workflow Generation**: For each section that has findings, create a NEW workflow:
    - Path: `.agent/workflows/[section]-remediation.md`
    - Content:
        - Specific technical instructions to fix identified findings.
        - Reference to the discovery report.
        - Strict "No Regression" verification steps.

2.  **Critical Reflection**: Analyze the _total_ invitation flow:
    - Do the styles across sections feel cohesive?
    - Is there a "Premium Crescendo" in the user experience?

## Phase 3: Final Synthesis

**Goal**: Notify the user and update project records.

1.  Update `docs/implementation-log.md`.
2.  Update `task.md`.
3.  Provide a summary of the "Remediation Map" to the user.

---

## Critical Rules

- **No Code Mutations**: This orchestrator is for discovery and planning ONLY. Do not modify source
  code (`.astro`, `.tsx`, `.scss`).
- **Independent Remediations**: Each section's remediation workflow must be able to run
  independently of others.
- **Evidence-First**: Every finding in the discovery report must be backed by specific code line
  numbers or browser screenshots/records.

// turbo
