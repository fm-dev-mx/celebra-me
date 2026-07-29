# Agent Workflow Rules — Celebra-me

**Status:** Active **Last Updated:** 2026-07-25

This document owns the operating procedure for agents. Human branch, commit, release, and promotion
policy lives in [`docs/core/git-governance.md`](../../docs/core/git-governance.md). Git
authorization and worktree preservation live in [`git-safety.md`](git-safety.md).

## Operating Procedure

1. **Load governance:** read `AGENTS.md`, `gatekeeper.md`, and `git-safety.md`. Consult
   `.agent/index.md` only when discovery is needed, then load only the relevant domain rule,
   workflow, skill, and canonical doc. Do not reread prerequisites already loaded for the task.
2. **Inspect state:** identify the current branch and distinguish staged, unstaged, and untracked
   work. Treat all pre-existing worktree and index state as user-owned.
3. **Set scope:** state the requested outcome, allowed files, non-goals, safety boundaries, and
   verification path. Use conversation-scoped planning unless the tracked-plan threshold is met.
4. **Implement narrowly:** edit only authorized files. Do not opportunistically clean unrelated
   changes or alter the index.
5. **Verify proportionally:** use the validation tier owned by `gatekeeper.md`; run narrower domain
   checks when they provide stronger evidence.
6. **Check preservation:** compare HEAD and staged state with the session baseline. Unexpected drift
   is a blocker; report it instead of repairing it automatically.
7. **Report:** list files changed, validations and skips, remaining risks, worktree status, and
   whether any Git write or production action occurred.

## Proportional Execution

- Reuse evidence gathered earlier in the task. Do not repeat the same repository scan, diff audit,
  or central-file read unless state changed or the prior result is insufficient.
- Before retrying a project CLI with different flags, inspect its documented contract or `--help`.
- Discover an external tool or MCP server once per session, then reuse its schema. Batch independent
  reads and browser inspections when the runtime supports it.
- For a bounded visual refinement, implement one explicit hypothesis, verify one representative
  mobile viewport immediately, then broaden QA. Run focused checks during iteration and the complete
  required validation tier once when the milestone closes. Follow gatekeeper §5.3 for screenshot
  scope; do not generalize section-intersection five-viewport proof to unrelated UI.
- Prefer direct file reads and `rg` for known modules or invitation paths before launching a broad
  explore/subagent sweep.
- In the final report, name the Gatekeeper tier used (A/B/C), visual-evidence choices or skips, and
  whether Graphify was unused (default) or authorized under `graphify-ops`.
- Do not launch a subagent after already performing the same central investigation. Delegate only
  independent work that meets every criterion in `agent-routing.md`.

## Agent-Specific Git Rules

- Operate within the designated persistent worktree lane (`celebra-me` root for Integration, `.worktrees/dev-lane` for Development, `.worktrees/val-lane` for Validation) on ephemeral task branches.
- Worktree path location grants no environment privileges (`path ≠ privilege`).
- Work on the current branch. Do not create, switch, merge, rebase, delete, or clean branches unless
  the user explicitly requests that exact operation.
- Do not stage, commit, stash, discard, or rewrite worktree/history state without current-task
  authorization under `git-safety.md`.

- Never force-push or rewrite shared history autonomously.
- Branch cleanup, release tagging, production promotion, and rollback are separate tasks requiring
  explicit authorization.
- A documented command, environment override, rollback snippet, or plan does not grant permission to
  execute it.

## Planning Boundary

Use conversation-scoped planning by default. Create or update a repository-tracked plan only when
the work is multi-session, high risk, or explicitly requested by the repository owner. The tracked
plan contract lives in `.agent/plans/README.md`.

## Ownership Boundaries

| Owner                         | Responsibility                                      |
| ----------------------------- | --------------------------------------------------- |
| `AGENTS.md`                   | entry point, authority order, and non-negotiables   |
| `.agent/rules/git-safety.md`  | Git authorization and baseline workflow             |
| `.agent/rules/gatekeeper.md`  | review/remediation rules and validation tiers       |
| `docs/core/git-governance.md` | human branch, commit, release, and promotion policy |
| `.agent/plans/README.md`      | durable tracked-plan format and lifecycle           |
