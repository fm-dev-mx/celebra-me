---
description:
    Deterministic, iterative execution workflow for the Digital Invitation plan. Executes exactly
    one Atomic Deployable Unit (ADU) per run.
---

# 🚀 Workflow: Invitation Execution (ADU-Based)

Use this workflow to implement the sections of the digital invitation in a strictly sequential and
documented manner.

## 📋 Pre-requisites

- An active Master Plan or Specification in `docs/plan/`.
- `Planning Mode` or `Execution Mode` active in the assistant.

## 🛠️ Execution Steps

1. **State Synchronization**:
    - Identify and read the **Active Implementation Log** (e.g., `docs/plan/invitation-*.md`).
    - Identify the first ADU marked as `Pending`.

2. **Targeted Coding**:
    - Implement ONLY the components and data specified in that ADU.
    - **Rule**: Do not add features or sections not explicitly mentioned in the current ADU.
    - **Aesthetic Alignment**: Follow the specific aesthetic style defined in the plan (e.g.,
      "Jewelry Box", "Vaquero", "Luxury Hacienda") using established design tokens.

3. **Documentation Update**:
    - Update the Implementation Log in the active plan file:
        - Change Status to `Implemented`.
        - Add any relevant technical notes (in English).

4. **Halt & Verify**:
    - Do NOT proceed to the next ADU.
    - Stop and wait for the `/invitation-verification` workflow or user confirmation.

// turbo

## Agent Instruction

Execute the next pending ADU from the active implementation plan. Follow the aesthetic guidelines
and update the progress log. Suggest a safe commit upon completion.
