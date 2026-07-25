# Agent Routing Rules — Celebra-me

This file defines how an orchestrator routes work to provider-neutral roles. A runtime may perform a
role directly or use any compatible temporary-subagent capability.

## Prerequisites

Before routing, read:

- `AGENTS.md` — entry point and non-negotiables
- `.agent/rules/gatekeeper.md` — review/remediation contract
- `.agent/rules/git-safety.md` — Git write policy

---

## Route by Responsibility

| Work                                                     | Role contract             | Typical capabilities                                          |
| -------------------------------------------------------- | ------------------------- | ------------------------------------------------------------- |
| Astro, TypeScript, SCSS, refactors, bug fixes            | `celebra-builder`         | repository read/write, command execution                      |
| Invitation, UI, social, or marketing copy                | `celebra-copywriter`      | repository read/write, Spanish copy expertise                 |
| Visual direction, palettes, image prompts, design review | `celebra-visual-director` | repository read, vision; image generation only when requested |
| Tests, screenshots, links, accessibility, proofreading   | `celebra-qa`              | repository read, command execution, browser when needed       |

The orchestrator normally handles planning, decomposition, governance decisions, and result
synthesis. Documentation implementation may use the builder role when it is a bounded file-edit
task. Research stays with the orchestrator unless it forms an independent, self-contained
investigation.

## When to Delegate

Use a temporary subagent only when the work meets **all** of these criteria:

1. It has enough independent value to justify handoff overhead.
2. It is self-contained and can finish without user interaction.
3. It has explicit file or output boundaries.
4. It has clear success criteria and a verification path.

## When NOT to Delegate

- Tasks requiring tight visual coordination or owner approval.
- Tasks whose intermediate output must be reviewed before the next action.
- Small tasks the orchestrator can complete directly with less overhead.
- Tasks touching production data or requiring user approval.

## Delegation Contract

Every handoff must include:

1. Role contract and goal.
2. Allowed files or systems and explicit non-goals.
3. Required context, including `AGENTS.md` and relevant rules/docs.
4. Safety constraints and prohibited operations.
5. Required capabilities and any unavailable/restricted capabilities.
6. Validation and expected output format.

Restrictions in role contracts and handoffs are mandatory instructions unless the active runtime can
enforce them mechanically. Never claim hard tool isolation without verifying that capability.
Model/provider selection is runtime-owned and must not be encoded in repository role contracts.

## Routing Conflict Resolution

If a task spans multiple roles (e.g., "write copy AND build the component"):

1. Decompose into sub-tasks.
2. Route each to the appropriate role.
3. Run independent units in parallel only when files and decisions cannot conflict.
4. Synthesize results before reporting to the user.

If a sub-task depends on another's output, run them sequentially and pass the verified dependency
result through a structured handoff. Follow `.agent/skills/celebra-delegation-patterns/SKILL.md` for
request and synthesis patterns.
