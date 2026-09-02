---
title: Agent Infrastructure Consolidation
status: active
created: 2026-09-01
updated: 2026-09-01
type: implementation
related_docs:
  - AGENTS.md
  - .agent/plans/README.md
  - .agent/rules/workflow.md
  - .agent/rules/gatekeeper.md
  - .agent/rules/git-safety.md
  - .agent/ownership.yaml
  - .agent/routing-matrix.yaml
---

# Task Contract

**Operation mode:** implement

**Objective:** consolidate the repository-owned agent-support infrastructure so that recurring
governance has one authoritative owner, reusable execution remains provider-neutral, and mechanical
checks protect the contract.

**Authorized:** edit tracked agent-support files in this branch, delete the three explicitly
identified redundant skills, add focused tests, and run repository validation. Git commits, merges,
remote operations, database operations, deployments, local provider-state cleanup, and changes to
other worktrees are out of scope.

**Scope:** `.agent/`, `AGENTS.md` only where required by the contract, `scripts/agent/`,
`scripts/validate-structure.mjs`, package scripts, Husky hooks, Cursor adapter metadata, and focused
tests.

**Non-goals:** application behavior, archived plans, Preview/Production, databases, deployment
automation, local `.opencode`/`.agents`/`.codex` cleanup, and branch retirement.

**Acceptance criteria:**

- Operation modes and precedence are explicit without redefining plan `type`.
- Redundant guidance is removed without active references or compatibility shims.
- Worktree inspection is fail-closed and has a stable JSON contract.
- Mutating agent commands require explicit apply flags and preconditions.
- Workflow, role, skill, plan-reference, ownership, routing, and adapter contracts are validated.
- Relevant unit tests, `validate:structure`, `validate:changed`, `type-check`, and full CI pass.

**Stop conditions:** unexpected HEAD/index/working-tree drift, missing required owner evidence,
unrelated CI failures, or any need to touch another worktree or external environment.

**Handoff:** report changed files, validation evidence, intentionally skipped checks, residual risks,
and the fact that no commit or merge was performed.
