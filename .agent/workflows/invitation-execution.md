---
description: Deterministic, iterative execution workflow for the Digital Invitation plan. Executes exactly one Atomic Deployable Unit (ADU) per run.
---
# 🚀 Workflow: Invitation Execution (ADU-Based)

Use this workflow to implement the sections of the digital invitation in a strictly sequential and documented manner.

## 📋 Pre-requisites

- An active Master Plan in `docs/plan/`.
- `Planning Mode` or `Execution Mode` active in the assistant.

## 🛠️ Execution Steps

1. **State Synchronization**:
    - Read the **Implementation Log** in `docs/plan/invitation-60-birthday-gerardo.md`.
    - Identify the first ADU marked as `Pending`.

2. **Targeted Coding**:
    - Implement ONLY the components and data specified in that ADU.
    - **Rule**: Do not add features or sections not explicitly mentioned in the current ADU.
    - Follow the "Luxury Hacienda" aesthetic specification (Colors, Fonts).

3. **Documentation Update**:
    - Update the Implementation Log in the Master Plan:
        - Change Status to `Implemented`.
        - Add any relevant technical notes.

4. **Halt & Verify**:
    - Do NOT proceed to the next ADU.
    - Stop and wait for the `/Invitation Verification` workflow or user confirmation.

// turbo
5. **Commit Progress** (Optional):

- Suggest a safe commit for the finished unit.
