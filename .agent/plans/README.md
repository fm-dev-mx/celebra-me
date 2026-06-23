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

Local-only paths (`tmp/`, `drafts/`, `local/`) are gitignored. `archived/` is the canonical archive
location. A folder named `archive/` is legacy-only and must not receive new plan files.

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

## Loop Engineering

Plans should be written as executable loops, not static documents.

### Loop Model

```text
context → current state → gates → allowed actions → stop conditions → validation → report → next decision
```

Each loop produces a decision: continue the current phase, advance to the next gate, roll back, or
stop entirely.

### Plan Types

Every plan must declare its type in the frontmatter:

| Type               | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| diagnostic         | Measurement, inspection, or investigation only — no changes        |
| documentation      | Writing or updating plan files, docs, or agent guidance only       |
| implementation     | Code or configuration changes                                      |
| validation         | Testing, measurement, or gate verification after implementation    |
| hotfix/P0          | Emergency production fix — overrides normal gate sequencing        |
| production rollout | Staged deploy, feature flag toggling, or production config changes |
| deferred/roadmap   | Acknowledged but intentionally postponed — no active work          |

### Autonomy Levels

Plans must state their autonomy level in the frontmatter:

```text
Level 0 — Report only. No changes of any kind.
Level 1 — Documentation changes only.
Level 2 — Local code changes allowed, no staging/commit/deploy.
Level 3 — Stage/commit allowed after validation.
Level 4 — Deploy/production actions allowed only with explicit human approval.
```

### Gates

Each loop or phase must define gates. A gate is a checkpoint that must pass before the next step may
begin.

| Gate type                 | Purpose                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| Repo state gate           | Correct branch, clean working tree, no unintended modifications    |
| Evidence gate             | Measurement or data required before proceeding                     |
| Implementation gate       | Code change is complete and compiles                               |
| Validation gate           | Tests, lint, type-check, build, visual QA pass                     |
| Production-readiness gate | Deploy preview verified, cache headers validated, rollback defined |
| Stop/rollback gate        | Condition that triggers revert or abort                            |

Every gate must specify:

- Required commands (e.g. `pnpm build`, `pnpm test`, curl checks)
- Allowed file scope (which files may be touched)
- Expected outputs (pass/fail criteria, measured values)
- Whether the agent may continue autonomously or needs human approval

If a gate fails, the agent must stop and report before proceeding.

### Stop Conditions

Every implementation loop must have explicit stop conditions. When any stop condition triggers, the
agent must halt, produce a final report, and request human review.

Examples of stop conditions:

- Unexpected files modified outside the declared scope
- Build or test failure not locally explainable
- Visual regression (unstyled section, layout shift, missing element)
- Production route returns empty 200 OK body (P0)
- Cache privacy ambiguity (guest-specific HTML could become public-cacheable)
- Required change exceeds declared scope (scope creep)
- Data patch or migration required
- Schema change required
- Broad refactor required (more than 3 files outside scope)

### Output Contracts

Every loop must produce a final report with these fields:

| Field                 | Description                                              |
| --------------------- | -------------------------------------------------------- |
| branch                | Current git branch                                       |
| git status            | Working tree state (clean, dirty, staged)                |
| files changed         | List of files modified in this loop                      |
| commands run          | Every command executed, with outputs                     |
| validation results    | Pass/fail per validation step                            |
| evidence collected    | Measurements, screenshots, logs                          |
| decisions made        | What was decided and why                                 |
| risks                 | New risks introduced or discovered                       |
| stop conditions hit   | Any stop conditions that triggered (or "none")           |
| next recommended step | Continue, advance gate, roll back, stop                  |
| human approval needed | Yes/No — whether the agent requires approval to continue |

### Production Safety

- P0 regressions override all performance or refactor work. Stop and report immediately.
- A blank 200 OK body on any public route is P0. Stop and report immediately.
- Cache-related changes must preserve privacy invariants: no guest-specific HTML may be
  public-cacheable.
- If cache safety is ambiguous for any request variant, fall back to `no-store, private`.
- Production deploys require explicit approval unless the user states otherwise.

### Artifact Lifecycle

Plans and their artifacts use the following status values:

| Status        | When to use                                           |
| ------------- | ----------------------------------------------------- |
| `draft`       | Plan is being written or discussed, not yet approved  |
| `active`      | Approved and currently guiding work                   |
| `blocked`     | Active but cannot proceed until a dependency resolves |
| `implemented` | Code changes complete, awaiting validation            |
| `validated`   | All gates have passed, results documented             |
| `accepted`    | Validated and accepted by human review                |
| `deferred`    | Intentionally postponed — may be revisited            |
| `superseded`  | Replaced by a newer plan that covers the same goal    |
| `final`       | Terminal state — no further action planned            |

When to update each artifact type:

| Artifact            | When to create or update                                       |
| ------------------- | -------------------------------------------------------------- |
| Master plan         | Once, when scope is approved; update only if scope changes     |
| Measurement result  | After each measurement gate; archive when superseded           |
| Implementation plan | Before each implementation loop; update as gates progress      |
| Final report        | At loop end or when stop condition triggers                    |
| Follow-up/deferred  | When a phase is deferred — document why and what would unblock |

### Plan Quality Checklist

A plan must satisfy every item below before execution may begin:

- [ ] Scope is explicit (which files, which routes, which themes)
- [ ] Non-goals are explicit (what is intentionally excluded)
- [ ] Autonomy level is stated
- [ ] File boundaries are explicit (which files may change)
- [ ] Validation is executable (commands are listed and known to work)
- [ ] Rollback is defined (what to revert and how)
- [ ] Stop conditions exist (at least one per implementation loop)
- [ ] Final output format exists (report shape is defined)
- [ ] Handoff to the next loop is clear (what decision follows the report)
