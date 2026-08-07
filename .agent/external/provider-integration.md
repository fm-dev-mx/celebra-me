# Provider Integration Guide (Non-Authoritative)

**Status:** Operator guidance only. Not repository policy. Do not copy celebra-me rules into
provider configuration as a second source of truth. This document does not claim that any external
configuration has been applied.

Repository authority remains:

1. `AGENTS.md`
2. `.agent/rules/`, skills, workflows, plans README (Task Contract / Goals / Handoffs)
3. `docs/core/` and `docs/domains/` as routed

Provider capabilities may affect **how** contracts are executed, never **what** must be satisfied.

---

## Shared required vs optional

| Kind | What to configure |
| --- | --- |
| **Required (conceptual)** | Provider must discover and prefer repository `AGENTS.md` (and then routed `.agent/` context) over generic chat defaults when working in this repo |
| **Optional** | Global Principles from `.agent/external/global-principles.md` as provider-wide defaults for repos without local policy |
| **Forbidden** | Duplicating celebra-me Git, DB, verification, or domain policy into provider global instructions |

Safe fallback when a provider feature is unavailable: the orchestrator performs the role directly
using `.agent/agents/*.yaml` contracts and `.agent/rules/agent-routing.md`, without inventing a
parallel policy.

---

## Codex

### Where to put global / general instructions

- Use Codex **user/global instructions** (or the product’s equivalent personal instructions surface)
  only for vendor-neutral defaults such as the Global Principles text.
- Do **not** paste celebra-me `AGENTS.md` non-negotiables into global Codex instructions.

### How repository instructions are discovered

- Open the celebra-me checkout as the working project.
- Codex should load root `AGENTS.md` automatically when present.
- Additional context is resolved via `.agent/routing-matrix.yaml` / `.agent/index.md` as directed by
  `AGENTS.md` — load minimum relevant rules/skills/workflows, not the entire `.agent/` tree.

### Settings that preserve repository authority

- Prefer project/`AGENTS.md` instructions over global defaults when both apply.
- Do not enable standing Git write, auto-commit, or auto-PR behaviors for this repo unless the
  current task explicitly authorizes that exact operation.
- Treat worktree / cloud / elevated execution as **no extra authorization** (see
  `.agent/rules/git-safety.md`).

### Optional features mapping to neutral contracts

| Neutral contract | Optional Codex-shaped capability |
| --- | --- |
| Role contracts (`.agent/agents/*.yaml`) | Temporary subagents / role prompts that quote the YAML contract |
| Delegation Contract | Subagent brief containing routing + Task Contract fields |
| Independent verification | Separate review pass against gatekeeper tiers |
| Worktree isolation | External worktree tools — still bound by path≠privilege |

### Fallbacks

If subagents, worktrees, or review tools are unavailable: stay single-threaded, follow
`.agent/rules/workflow.md`, and report with the Handoff Contract fields from
`.agent/plans/README.md`.

---

## Cursor

### Where to put global / general instructions

- Use Cursor **User Rules** (or global rules) only for vendor-neutral defaults (Global Principles).
- Do **not** create a competing `.cursorrules` or root provider entry file in celebra-me.
- Project rules / `AGENTS.md` in the workspace remain the operational source for this repo.

### How repository instructions are discovered

- Workspace root `AGENTS.md` is the canonical entry (already present).
- Follow Context Discovery in `AGENTS.md`: routing matrix, gatekeeper, git-safety, then minimum
  domain context.
- Skills under `.agent/skills/` are repository-owned; do not treat Cursor-installed or user-global
  skills as overriding them.

### Settings that preserve repository authority

- Keep Git mutations user-authorized and task-scoped; Cursor modes (Agent, Plan, Cloud, etc.) do
  not grant Git, DB, or production privilege.
- Do not enable automatic commit/PR flows for this repository unless the current task explicitly
  authorizes them.
- Prefer reading `.agent/plans/README.md` for Task Contract / Goal / Handoff semantics rather than
  inventing parallel plan UIs as policy.

### Optional features mapping to neutral contracts

| Neutral contract | Optional Cursor-shaped capability |
| --- | --- |
| Role contracts | Task/subagent prompts that cite `.agent/agents/*.yaml` |
| Delegation Contract | Background/subagent tasks with explicit file bounds |
| Review / verification | Separate review agent against `.agent/rules/gatekeeper.md` |
| Plan mode | Conversation or tracked plan projection of the Task Contract — not a second SSOT |

### Fallbacks

If Cloud Agents, subagents, or Browser tools are unavailable: execute locally per
`.agent/rules/workflow.md`, verify with gatekeeper tiers A/B/C as scoped, and close with the Handoff
Contract. Skip optional tools without weakening repository invariants.

---

## Host skill discovery (any provider)

If the host supports an external skills directory list, point it at this checkout’s `.agent/skills`
directory. Do not mirror those skills into the host global catalog. Details:
`.agent/load-skills.md`.
