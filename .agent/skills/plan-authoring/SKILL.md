---
name: plan-authoring
description: Lightweight planning guidance for repository work — clarify scope, define atomic units, choose persistence, and produce a verifiable handoff.
domain: workflow
version: 1.0.0
when_to_use:
  - Planning repository work that needs explicit sequencing, boundaries, or verification expectations
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
related_skills:
  - commit-planner
  - staged-code-review
related_docs:
  - .agent/plans/README.md
  - .agent/rules/workflow.md
---

# Plan Authoring

Use this skill when a task needs clearer sequencing, boundaries, or verification expectations.
This skill does **not** require a manifest-based `.agent/plans/<plan-id>/` system.

Canonical semantics for the Task Contract, Goal protocol, and Handoff Contract live in
`.agent/plans/README.md`. This skill is the lightweight authoring procedure only.

## Routine

1. **Clarify Scope**: define the user goal, success criteria, and non-goals (Task Contract fields).
2. **Define Units**: split the work into coherent behavioral chunks with clear file boundaries.
3. **Define Verification**: record which commands or inspections prove each chunk is complete.
4. **Choose Persistence**: keep the plan in the conversation by default. Create a lightweight
   Markdown plan under `.agent/plans/` only when work is multi-session, high risk, or the repository
   owner explicitly requests a tracked plan.
5. **Choose lifecycle**: when the work is substantial and audit-driven, follow Goal 1 → Goal 2 →
   Goal 3 in `.agent/plans/README.md`. Keep verification depth and risk as separate Task Contract /
   gatekeeper choices — do not invent Goal "tiers" from task size.
6. **Handoff**: return the Task Contract and verification plan. Implementation and commit preparation
   occur only when a later task explicitly authorizes them.

## Standards

- **Atomic**: one coherent change per unit.
- **Explicit**: clear file boundaries.
- **Accurate**: precise summaries.
- **Consistent**: authorization, scope, invariants, acceptance, safety, and required evidence stay
  aligned with the Task Contract across conversation, tracked plans, and delegation.
