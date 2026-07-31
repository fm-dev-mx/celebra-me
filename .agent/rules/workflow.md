# Agent Workflow Rules — Celebra-me

This document defines the core 7-step operating procedure for agents.

## Operating Procedure

1. **Load Governance:** Read mandatory bootstrap rules (`gatekeeper.md`, `git-safety.md`). Consult `.agent/routing-matrix.yaml` (or `.agent/index.md`) for domain-specific context additions.
2. **Preflight Lane State:** Verify worktree path, current branch alignment, clean working tree, and target environment using `pnpm ops worktree-status`. Claim a lane only if idle and clean.
3. **Set Scope:** State requested outcome, allowed file boundaries, non-goals, and verification path.
4. **Implement Narrowly:** Edit only authorized files within scope. Do not clean unrelated working tree changes.
5. **Verify Proportionally:** Run the Gatekeeper validation tier matching the change scope (Tier A: `validate:changed`, Tier B: `type-check`, Tier C: `pnpm run ci`).
6. **Preserve Session State:** Verify session baseline preservation with `pnpm agent:git-safety:check`. Report any unexpected drift.
7. **Report:** List modified files, validation results, remaining risks, worktree status, and whether Git writes or remote DB operations occurred.

## Proportional Execution & Tooling Rules

- **Reusable Evidence:** Do not repeat identical file reads or repository searches within the same session.
- **Fail-Fast Credential Access:** If required credentials or environment variables are missing, classify as an `Environmental Blocker` and halt immediately. Do not attempt speculative `.env` edits or guess secrets.
- **Subagent Delegation:** Delegate to subagents only when work is self-contained, has explicit file boundaries, clear verification criteria, and justifies handoff overhead per `.agent/rules/agent-routing.md`.
