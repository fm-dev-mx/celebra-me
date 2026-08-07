# Agent Plans

`.agent/plans` stores operational plans that are still useful for agents.

It is not a dumping ground for chat transcripts, logs, temporary prompts, or obsolete audits.
Planning is conversation-scoped by default. Create or update a tracked plan only when work is
multi-session, high risk, or explicitly requested by the repository owner.

## Structure

```text
.agent/plans/
  README.md           # This file — Task Contract, Goal protocol, Handoff Contract, plan governance
  active/             # Draft, active, or blocked plans with remaining work
  archived/           # Completed, deferred, superseded, final, or historical plans
```

Local-only paths (`tmp/`, `drafts/`, `local/`) are gitignored. `archived/` is the canonical archive
location. A folder named `archive/` is legacy-only and must not receive new plan files.

## Task Contract (canonical)

The **Task Contract** is the single semantic source of truth for what a task must satisfy. Conversation
context, tracked plans under `.agent/plans/`, and role delegation payloads are **projections** of the
same contract — not independent authorities.

Same source of truth does not require identical context payloads. Context may be minimized by
responsibility, but these must remain semantically consistent across projections:

- authorization
- scope
- invariants
- acceptance criteria
- safety constraints
- required evidence

When applicable, a Task Contract expresses:

| Field | Meaning |
| --- | --- |
| Objective | What success looks like |
| Authorized actions and relevant overrides | Exact gated operations allowed for this task; any explicit exception |
| Scope | Allowed files, systems, or surfaces |
| Non-goals | What is intentionally excluded |
| Applicable invariants | Non-overridable and other binding repository constraints |
| Known evidence | Facts already established (do not re-audit without cause) |
| Acceptance criteria | Observable done conditions |
| Verification strategy | Commands, inspections, or evidence proportional to risk |
| Stop conditions | When to halt and report |
| Expected handoff | What the next responsibility needs |
| Expected final report | What the closing report must include |

Current-task authorization unlocks only gated operations that repository policy permits. It must not
implicitly waive unrelated invariants. See `AGENTS.md` Exception Model.

Authoring procedure: `.agent/workflows/plan-authoring.md`. Operating steps: `.agent/rules/workflow.md`.

## Plan Status Taxonomy

Use this provider-neutral taxonomy for plans and their artifacts:

| Status        | When to use                                           |
| ------------- | ----------------------------------------------------- |
| `draft`       | Plan is being written or discussed, not yet approved  |
| `active`      | Approved and currently guiding work                   |
| `blocked`     | Active but cannot proceed until a dependency resolves |
| `implemented` | Planned changes are complete                          |
| `validated`   | All defined validation gates have passed              |
| `accepted`    | Validated and accepted by human review                |
| `deferred`    | Intentionally postponed until explicitly reactivated  |
| `superseded`  | Replaced by a newer plan or durable source of truth   |
| `final`       | Terminal state; no further action is planned          |

`archived` is a directory lifecycle, not a frontmatter status. Keep `draft`, `active`, and `blocked`
plans under `active/` while they have a real next action. Move completed or inactive plans to
`archived/` after migrating durable knowledge to `docs/`, a rule, a workflow, or a skill.

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

For high-risk tracked plans only, optionally add:

```yaml
autonomy: 2 # 0 report-only … 4 deploy with explicit human approval
type: implementation # diagnostic | documentation | implementation | validation | hotfix/P0 | production rollout | deferred/roadmap
```

Do not invent a second status vocabulary for a provider or runtime.

## Governance Rules

1. **Track only durable plans.** Routine single-session work stays in conversation context.
2. **Plans must be actionable.** If a document does not describe intent, constraints, or
   implementation guidance, it belongs elsewhere (chat log, issue, etc.).
3. **Status must be accurate.** Update status when work starts, finishes, or the plan becomes
   obsolete.
4. **No contradictions.** A plan must not contradict the current live codebase without being marked
   `superseded` or moved to `archived/`.
5. **Migrate stable knowledge.** When a plan produces durable architecture or policy, migrate that
   knowledge to `docs/` or a skill, then archive the plan.
6. **No secrets or machine-local data.** Do not store credentials, logs, raw agent outputs, or
   environment details.
7. **One canonical plan per initiative.** Avoid multiple overlapping plans for the same goal.

## Relationship to Other Directories

| Directory           | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `.agent/plans/`     | Operational intent, Goal sequencing, agent memory           |
| `docs/`             | Stable product and system documentation                     |
| `.agent/skills/`    | Reusable agent execution guidance                           |
| `.agent/workflows/` | Repeatable procedures                                       |
| `.agent/tmp/handoffs/` | Ephemeral role-chain artifacts (not policy SSOT)         |

## Goal lifecycle (canonical for substantial audit-driven remediation)

Lifecycle phases are not a scale or risk ladder. Do not couple task size, autonomy, severity, or
verification depth to how many Goals exist.

For **substantial audit-driven remediation**, the canonical progression is:

```text
Goal 1 — Audit + Specification
  → Goal 2 — Implementation + Verification
  → Goal 3 — Cleanup + Final Verification
```

| Goal | Must establish or do |
| --- | --- |
| Goal 1 — Audit + Specification | Findings, invariants, scope, risks, acceptance criteria, regression conditions, verification strategy, authorization boundaries — the evidence that governs Goal 2 |
| Goal 2 — Implementation + Verification | Implement only what Goal 1 established; verify against Goal 1 acceptance and strategy |
| Goal 3 — Cleanup + Final Verification | Residual cleanup, consistency, documentation, and final verification — not another implementation phase |

Goal 2 must not assume what Goal 1 has not established. Goal 3 is not “more implementation.” Never
put Goal or Phase identifiers in commit messages (`AGENTS.md`).

### Separate dimensions (do not conflate)

| Dimension | Selects | Does not select |
| --- | --- | --- |
| Lifecycle phase | Whether the next responsibility is audit/spec, implement/verify, or cleanup/final verify | Gatekeeper tier, autonomy, or plan tracking |
| Continuity / persistence | Conversation vs tracked plan under `.agent/plans/` | Lifecycle phase names or count |
| Risk / verification depth | Task Contract verification strategy; gatekeeper A/B/C | Inventing extra Goals as a substitute for deeper checks |
| Autonomy | Optional frontmatter autonomy when high-risk writes may occur | Lifecycle length |

Routine work may finish in one Goal (direct execution). Work that needs a design baseline before
coding may use Goal 1 → Goal 2 without a separate Goal 3 when cleanup is not a distinct phase. Those
choices are continuity and scope decisions — not a “Tier” taxonomy that maps simple/moderate/hard
onto Goal counts.

## Handoff Contract (canonical)

One provider-neutral **Handoff Contract** applies whenever work crosses an execution boundary (next
Goal, next session, or next role). Include fields when relevant:

| Field | Meaning |
| --- | --- |
| Current state | Where work stands |
| Completed work | What was done |
| Evidence | Facts, paths, measurements, links |
| Validation passed | Checks that passed |
| Validation failed | Checks that failed |
| Validation intentionally not run | Checks skipped and why |
| Unresolved uncertainty | Open questions |
| Residual risks | Remaining hazards |
| Applicable authorization or exception | Task-scoped grants and reported exceptions |
| Branch / commit reference | When Git identity matters |
| Next responsibility or decision | Who acts next and what they need |

### Persistence

- **Default:** keep the handoff in conversation / Task Contract context.
- **Persist** only when continuity genuinely requires it: multi-agent execution, multi-session work,
  separate mutable worktrees, long-running tasks, or context that must survive the current execution
  boundary.
- Multi-session Goal continuity: `.agent/plans/active/` when a tracked plan is justified.
- Role-chain artifacts: `.agent/tmp/handoffs/<task-id>/` (ephemeral; see
  `celebra-delegation-patterns`). Not a second policy authority.
- Do not generate mandatory handoff files for trivial work.

Human-facing report **layout** for named review/apply/commit skills remains
`.agent/templates/agent-report-contract.md` — presentation only, not Task Contract authority.

## High-risk plan quality checklist

Before executing a high-risk tracked plan, confirm:

- [ ] Task Contract fields above are explicit (scope, non-goals, acceptance, verification, stops)
- [ ] Autonomy level is stated when Git writes, deploy, or production mutation may be involved
- [ ] File boundaries are explicit
- [ ] Rollback or stop path is defined
- [ ] Handoff to the next Goal or decision is clear

Domain performance / cache contracts live under `docs/domains/` and domain plans (for example
`docs/domains/invitations/public-response-cache-policy.md` and
`.agent/plans/active/section-architecture-refactor-plan.md`) — not in this governance file.
