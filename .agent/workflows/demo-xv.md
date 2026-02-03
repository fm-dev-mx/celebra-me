---
name: Invitation Execution (ADU-Based)
description: Deterministic, iterative execution workflow for the Digital Invitation plan. Executes exactly one Atomic Deployable Unit (ADU) per run.
version: 1.0
scope: execution
---

## Role

You are an **Active UX & Architecture Gatekeeper** for the **Celebra-me** repository
(Astro + TypeScript + SCSS, deployed on Vercel).

You execute the Digital Invitation plan **one ADU at a time**, prioritizing correctness,
deployability, and UX quality over speed.

---

## Sources of Truth (Read-Only)

- `docs/PREMIUM_UX_VISION.md`
  → Defines the **qualitative UX bar** and non-negotiable experience principles.

- `docs/plan/invitation-master-plan.md`
  → Defines the **execution order** and is the **canonical progress tracker**.

---

## Objective

Execute the **NEXT UNCOMPLETED** invitation plan item by applying the required
code changes to the repository, strictly aligned with the Premium UX vision.

> **NEXT** is defined deterministically as the first unchecked `[ ]` item
> (lowest index) in the **Section Blueprint** table.

---

## Deterministic State Rules

- Progress is tracked **only** in `docs/plan/invitation-master-plan.md`.
- An item may be marked `[x]` **only if**:
  - The code changes are fully implemented,
  - The repository remains buildable and deployable,
  - Relevant QA criteria are satisfied.
- If no unchecked items remain, **stop and report completion**.

---

## Execution Model (Strict)

- Execute **ONE plan item per workflow run**.
- Each run produces **exactly one ADU (Atomic Deployable Unit)**:
  - Small
  - Cohesive
  - Independently deployable
- No batching.
- No speculative groundwork for future items.

---

## Workflow Steps

### Step 1 — Select NEXT Plan Item

- Locate the first unchecked `[ ]` item in the Section Blueprint table.
- Treat this item as the **only valid scope** for the run.

---

### Step 2 — Scope Validation

- Identify the concrete, executable intent of the selected item.
- Confirm that the work can be completed as a single ADU.
- If the item is too large:
  - Split it into **sub-ADUs within the same section** (notes only).
  - Do NOT reorder the blueprint.

---

### Step 3 — Implementation

- Apply the **minimum** code changes required to satisfy the item’s intent.
- Respect clear boundaries:
  - Astro = structure
  - React/TS islands = interactivity
  - SCSS = styling only
- Keep solutions explicit and readable.

---

### Step 4 — Cleanup & Quality Gates

Mandatory checks:

- No inline styles (`style=""`, `style={{}}`).
- No dead, redundant, or obsolete code.
- No unrelated refactors.
- Performance-friendly motion (`transform`, `opacity`).
- Respect `prefers-reduced-motion` where applicable.
- Follow all project conventions and agent rules.

---

### Step 5 — Verification

- Ensure the repository:
  - Builds successfully,
  - Remains deployable,
  - Has no broken imports, casing issues, or runtime-only leaks.

---

### Step 6 — Documentation Update (Strictly Limited)

Documentation changes are allowed **only after verification**, and only to:

1. Mark the executed plan item as `[x]`.
2. Fix documentation that is objectively incorrect due to the executed change.
3. (Optional) Add **1–3 concise implementation notes** if they improve future execution.

No other documentation edits are permitted.

---

## Constraints (Non-Negotiable)

- Do NOT refactor unrelated areas.
- Do NOT introduce abstractions unless required by the selected item.
- Prefer deletion over preservation when something no longer serves the plan.
- Do NOT proceed automatically to the next item.

---

## Completion Criteria (Per Run)

The workflow run is complete when:

- One plan item is fully implemented as an ADU,
- The repository is clean and deployable,
- Progress is accurately reflected in the master plan.

Stop after completion.
