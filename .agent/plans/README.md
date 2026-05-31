# Agent Plans

`.agent/plans` stores operational plans that are still useful for agents.

It is not a dumping ground for chat transcripts, logs, temporary prompts, or obsolete audits.

## Structure

```text
.agent/plans/
  README.md           # This file — plan governance
  active/             # Plans that are approved, pending, or partially implemented
  archived/           # Plans that are implemented, superseded, or historical
```

Local-only paths (`tmp/`, `drafts/`, `local/`) are gitignored.

## Plan Status Taxonomy

| Status        | Meaning                                     |
| ------------- | ------------------------------------------- |
| `draft`       | Being discussed, not yet approved           |
| `active`      | Approved and currently guiding work         |
| `implemented` | Work completed, plan retained for reference |
| `superseded`  | Replaced by a newer plan                    |
| `archived`    | Historical — no longer actionable           |

## Standard Frontmatter

Every plan file should include frontmatter:

```yaml
---
title: Short Plan Title
status: active
created: YYYY-MM-DD
updated: YYYY-MM-DD
related_skills:
  - backend-engineering
related_docs:
  - docs/core/architecture.md
supersedes:
  - old-plan.md
superseded_by:
  - new-plan.md
---
```

## Governance Rules

1. **Plans must be actionable.** If a document does not describe intent, constraints, or
   implementation guidance, it belongs elsewhere (chat log, issue, etc.).
2. **Status must be accurate.** Update status when work starts, finishes, or the plan becomes
   obsolete.
3. **No contradictions.** A plan must not contradict the current live codebase without being marked
   `superseded` or `archived`.
4. **Migrate stable knowledge.** When a plan produces durable architecture or policy, migrate that
   knowledge to `docs/` or a skill, then archive the plan.
5. **No secrets or machine-local data.** Do not store credentials, logs, raw agent outputs, or
   environment details.
6. **One canonical plan per initiative.** Avoid multiple overlapping plans for the same goal.

## Relationship to Other Directories

| Directory           | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `.agent/plans/`     | Operational intent, implementation sequencing, agent memory |
| `docs/`             | Stable product and system documentation                     |
| `.agent/skills/`    | Reusable agent execution guidance                           |
| `.agent/workflows/` | Repeatable procedures                                       |
