# Agent Workflow Rules — Celebra-me

This document defines the core 7-step operating procedure for agents.

## Operating Procedure

1. **Load Governance:** Read mandatory bootstrap rules (`gatekeeper.md`, `git-safety.md`). Consult `.agent/routing-matrix.yaml` (or `.agent/index.md`) for domain-specific context additions.
2. **Preflight Lane State:** For read-only work, inspect worktree path, branch, working-tree state, and
   target environment using `pnpm ops worktree-status` without claiming the lane. For mutable work,
   claim a lane only if it is idle and clean.
3. **Set Scope:** Establish the Task Contract for this work (objective, `operation_mode`, authorized
   actions, scope, non-goals, invariants, acceptance, verification, stop conditions) per
   `.agent/plans/README.md`.
   State file boundaries explicitly. For mutable sessions, run `pnpm agent:git-safety:start`
   (interactive plumbing; see `.agent/rules/git-safety.md`).
4. **Implement Narrowly:** Edit only authorized files within scope. Keep the implementation simple,
   avoid duplicate owners and speculative legacy compatibility, and do not clean unrelated working
   tree changes.
5. **Verify Proportionally:** Run the Gatekeeper validation tier matching the change scope (Tier A: `validate:changed`, Tier B: `type-check`, Tier C: `pnpm run ci`).
6. **Finish Session:** Close the mutable session with `pnpm agent:git-safety:finish`. On failure,
   preserve evidence, report drift, and do not auto-remediate.
7. **Report:** Close with the Handoff Contract fields that apply (completed work, evidence,
   validation passed/failed/not run, risks, authorization/exceptions, git/worktree state, next
   decision) per `.agent/plans/README.md`.

## Proportional Execution & Tooling Rules

- **Reusable Evidence:** Do not repeat identical file reads or repository searches within the same session.
- **Fail-Fast Credential Access:** If required credentials or environment variables are missing, classify as an `Environmental Blocker` and halt immediately. Do not attempt speculative `.env` edits or guess secrets.
- **Subagent Delegation:** Delegate to subagents only when work is self-contained, has explicit file boundaries, clear verification criteria, and justifies handoff overhead per `.agent/rules/agent-routing.md`.
- **Stop Conditions:** Stop when acceptance criteria are supported by evidence. Do not reopen planning
  or expand scope without new evidence or an explicit task-contract change.
