---
name: plan-authoring
description: Code analysis and declarative commit-map planning
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-03-22
when_to_use:
    - A change needs commit planning before or after implementation
    - An active plan must be updated to match the current implementation reality
preconditions:
    - Read .agent/README.md
    - Read .agent/GATEKEEPER_RULES.md
inputs:
    - Requirements, code changes, active plan files, and commit-map boundaries
outputs:
    - Executable active plan with validated commit strategy metadata
related_docs:
    - docs/core/git-governance.md
    - docs/DOC_STATUS.md
---

# Plan Authoring Workflow

Use this workflow for the thinking and authoring side of commit planning. It owns code analysis,
intent mapping, `commit-map.json`, lifecycle readiness, and preflight validation before
`gatekeeper-commit` runs.

## Preconditions

- You are handling a feature, fix, or architectural change that needs properly structured commits.
- You are either drafting the commit strategy before implementation, or stabilizing the final
  strategy after implementation.

## Strict Rule: Code Quality Before Planning

`pnpm lint` must pass before finalizing the commit strategy. Do not freeze boundaries around code
that is still failing architecture or static analysis rules.

Run:

```bash
pnpm lint
```

If lint fails, fix the code first. Do not finalize `commit-map.json` while architecture is still
unstable.

## Three Authoring Moments

### 1. Draft the Commit Strategy Before Implementation

Create or refresh `.agent/plans/<plan-id>/commit-map.json` before implementation begins.

This draft must define:

- the dominant intent per unit
- expected `include` boundaries
- any justified `allowRelated` files
- canonical planned headers and semantic summaries

### 2. Run the Final Strategy Review After Implementation

After implementation, update the plan to reflect reality.

The final review must confirm:

- actual files still match the intended units
- headers and purposes still describe the dominant intent
- unit boundaries still reflect the implemented architecture
- internal documentation and code remain in English

Record the final review in `commitStrategyReview`:

- set `reviewedAt`
- set `notes`

### 3. Mark the Plan Gatekeeper-Ready Before Commit Execution

Before `gatekeeper-commit`, the plan must be executable without reinterpretation.

This means:

- `commitStrategyReview.readyForGatekeeperAt` is set
- executable units use `ready` or `revised-after-gatekeeper`
- active executable plans do not keep units marked `completed`
- active plans under `.agent/plans/<plan-id>/` do not use historical manifest statuses

`COMPLETED` and `ARCHIVED` are historical-only manifest states. If the plan is still under
`.agent/plans/<plan-id>/`, it remains active and non-historical until all planned commits are
finished and the directory is archived.

## Routine

1. Analyze the code or requirements and identify dominant implementation intents.
2. Create or update `.agent/plans/<plan-id>/commit-map.json`.
3. Map each unit precisely using `include` globs and narrowly scoped `allowRelated` patterns.
4. Enforce authoring constraints:
   - all code and internal documentation must remain in English
   - Spanish is reserved for user-facing copy
   - do not introduce extra units or wrappers unless they reduce real ambiguity
5. Run the planning-side validation sequence:

```bash
pnpm lint
pnpm gatekeeper:plans:validate -- --plan <plan-id>
pnpm gatekeeper:plans:doctor -- --plan <plan-id>
```

6. Resolve every `plans:doctor` finding before using `gatekeeper-commit`.

## Doctor Expectations

`pnpm gatekeeper:plans:doctor -- --plan <plan-id>` is the last required step of this workflow.

It checks:

- structural plan validity
- active vs historical lifecycle misuse
- commit strategy readiness
- working-tree coverage against the plan
- dirty index and mixed staged/unstaged drift

Default output is compact. Use:

- `--json` for machine consumption
- `--verbose` for full file detail

## Output

A valid and executable active plan:

- `commit-map.json` matches the implemented intent
- `commitStrategyReview.reviewedAt`, `notes`, and `readyForGatekeeperAt` are coherent
- the current worktree passes `plans:doctor`

## Close-Out Rule

Archival is a separate close-out step after commit execution. Do not mark active plans as
`COMPLETED` or `ARCHIVED` before the gatekeeper execution sequence is finished.
