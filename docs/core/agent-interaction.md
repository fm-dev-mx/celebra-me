# Agent Interaction Guide — Celebra-me

This is a task-prompt reference, not a second governance layer. Repository invariants, routing,
validation, Git safety, and handoff semantics are inherited from `AGENTS.md` and `.agent/`.

## Task prompt fields

Include only the fields that are not already guaranteed by repository infrastructure:

| Field | What to provide |
| --- | --- |
| Objective | Observable outcome and relevant business context |
| Operation mode | `audit`, `plan`, `implement`, `remediate`, `validate`, or `release-ops` |
| Scope / non-goals | Files, surfaces, environments, and explicit exclusions |
| Task-specific authority | Any exact Git, database, deploy, external-service, or human-approval grant |
| Acceptance evidence | What must be true and how it will be demonstrated |
| Required output | Report, patch, plan, review, handoff, or other deliverable |

## Planning and execution

Use conversation-scoped planning by default. Persist one plan under `.agent/plans/active/` only when
continuity, risk, or the repository owner justifies it. The Task Contract remains the semantic source
of truth across conversation, plans, workflows, skills, and handoffs.

The selected operation mode controls mutability. Workflows and skills provide reusable procedure or
specialized judgment; they never grant permissions. Git, database, deployment, and provider actions
still require their owning rules and explicit current-task authorization.

## Good prompt boundaries

- State the objective and acceptance evidence instead of repeating repository rules.
- Declare a non-goal when a nearby surface is intentionally excluded.
- Split unrelated intents unless a single acceptance criterion genuinely joins them.
- Provide new evidence before asking to reopen a completed plan.
- Name a human decision when the repository cannot determine it mechanically.

## Help

When a prompt is underspecified, the agent should use the least-privileged interpretation and ask only
when the missing information would materially change scope, authority, or acceptance.
