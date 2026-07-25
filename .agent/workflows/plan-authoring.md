---
description: Lightweight planning guidance for repository work.
---

# Plan Authoring Workflow

Use this workflow when a task needs clearer sequencing, boundaries, or verification expectations.
This workflow does **not** require a manifest-based `.agent/plans/<plan-id>/` system.

## Routine

1. **Clarify Scope**: define the user goal, success criteria, and non-goals.
2. **Define Units**: split the work into coherent behavioral chunks with clear file boundaries.
3. **Define Verification**: record which commands or inspections prove each chunk is complete.
4. **Choose Persistence**: keep the plan in the conversation by default. Create a lightweight
   Markdown plan under `.agent/plans/` only when work is multi-session, high risk, or the repository
   owner explicitly requests a tracked plan.
5. **Implement**: carry out the work with the standard repository workflow and conventional commits.

## Standards

- **Atomic**: one coherent change per unit.
- **Explicit**: clear file boundaries.
- **Accurate**: precise summaries.
