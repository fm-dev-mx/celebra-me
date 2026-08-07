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

| Work                                                     | Role contract                  | Typical capabilities                                          |
| -------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| Astro, TypeScript, SCSS, refactors, bug fixes            | `celebra-builder`              | repository read/write, command execution                      |
| Invitation, UI, social, or marketing copy                | `celebra-copywriter`           | repository read/write, Spanish copy expertise                 |
| Visual direction, palettes, image prompts, design review | `celebra-visual-director`      | repository read, vision; image generation only when requested |
| Tests, screenshots, links, accessibility, proofreading   | `celebra-qa`                   | repository read, command execution, browser when needed       |
| Reference-driven visual redesign                         | visual-director → builder → QA | direction, bounded implementation, evidence-based review      |

The orchestrator normally handles planning, decomposition, governance decisions, and result
synthesis. Documentation implementation may use the builder role when it is a bounded file-edit
task. Research stays with the orchestrator unless it forms an independent, self-contained
investigation.

Use `.agent/workflows/design-reference-to-build.md` when supplied or cited visual references require
interpretation before implementation. Do not impose it on a correction whose target and expected
result are already objective (for example, an exact copy replacement or spacing/token value).

## Reference-Driven Routing Decisions

| Request                                                        | Route and roles                                                                                                                             | Block or escalate when                                                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build a new real invitation from visual references             | `design-reference-to-build` + `client-invitation-audit`; visual-director → builder → QA                                                     | Block on missing baseline, critical asset, Lane A/Lane B decision, or observable criteria; ask the user when intent or client facts are materially unresolved |
| Build a new demo, landing, or dashboard from visual references | `design-reference-to-build`; visual-director → builder → QA                                                                                 | Block on an unusable reference, baseline, critical asset, or acceptance gap; ask the user when resolving it would change intent or scope                      |
| Refine part of an existing surface                             | Direct builder + focused QA when the delta is explicit; otherwise `design-reference-to-build`                                               | Block when the intended delta cannot be observed or safely bounded; escalate material design choices to the user                                              |
| Audit an already implemented invitation                        | QA using `creative-qa-report`; add `client-invitation-audit` only for pipeline, asset, or Lane A/Lane B discovery                           | Report `Blocked` when the route, environment, baseline, or evidence is unavailable; do not remediate unless the task authorizes it                            |
| Create or extend a reusable theme, token, preset, or variant   | `theme-architecture-governance`; add `design-reference-to-build` and visual-director → builder → QA when references determine visual intent | Block on an unresolved live contract, resolver fallback, or missing cross-preset evidence; ask the user before materially expanding reusable scope            |
| Implement visual work that changes copy or data                | Add copywriter for copy and the owning content/data workflow; builder implements the approved result and QA verifies it                     | Block on missing source data, invented client facts, or absent mutation authority; ask the user for the missing fact or authorization                         |
| Work from incomplete, inconsistent, or low-quality references  | Visual-director records unsupported details in the brief; continue only when the remaining criteria are observable, then builder → QA       | Block when a missing decision prevents an observable criterion or requires invented content/assets; ask the user to resolve the material choice               |

The orchestrator may perform these roles directly. The sequence names decision ownership, not a
requirement to create subagents.

## When to Delegate

Use a temporary subagent only when the work meets **all** of these criteria:

1. It has enough independent value to justify handoff overhead.
2. It is self-contained and can finish without user interaction.
3. It has explicit file or output boundaries.
4. It has clear success criteria and a verification path.

Estimated minutes, file count, or creation of a component/page do not independently justify a
handoff. If the orchestrator already performed the central investigation, it must not delegate the
same exploration again.

## When NOT to Delegate

- Tasks requiring tight visual coordination or owner approval.
- Tasks whose intermediate output must be reviewed before the next action.
- Small tasks the orchestrator can complete directly with less overhead.
- Tasks touching production data or requiring user approval.

## Delegation Contract

Every handoff must include the Delegation Contract fields in `.agent/rules/agent-routing.md` and
remain consistent with the parent Task Contract / Handoff Contract in `.agent/plans/README.md`:

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
