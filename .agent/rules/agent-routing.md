# Agent Routing Rules — Celebra-me

This file defines the decision tree for routing tasks to the appropriate agent role.
Jeremías (the orchestrator) uses this to decide: which agent, which model configuration,
whether to delegate, and what constraints to pass.

## Prerequisites

Before routing, read:
- `AGENTS.md` — entry point and non-negotiables
- `.agent/rules/gatekeeper.md` — review/remediation contract
- `.agent/rules/git-safety.md` — Git write policy

---

## Decision Tree

```
Task request received
│
├─ Is it a file edit / code change?
│   → celebra-builder
│   └─ Model: primary model (gpt-5.5 via opencode-go)
│      Use delegate_task for: refactors, new components, style changes, bug fixes
│      Do NOT delegate: single-line fixes (<2 min), file reads for analysis
│
├─ Is it copy / text / messaging content?
│   → celebra-copywriter
│   └─ Model: primary model (gpt-5.5 via opencode-go)
│      Use delegate_task for: invitation copy, social captions, WhatsApp messages
│      Do NOT delegate: quick proofreading of visible text (<3 lines)
│
├─ Is it visual direction / image prompts / design review?
│   → celebra-visual-director
│   └─ Model: primary model (gpt-5.5 via opencode-go)
│      Use delegate_task for: image prompt generation, palette selection, visual QA
│      Do NOT delegate: one-line prompt tweaks
│
├─ Is it quality review / verification / testing?
│   → celebra-qa
│   └─ Model: primary model (gpt-5.5 via opencode-go)
│      Use delegate_task for: Playwright screenshots, link checking, proofreading,
│      visual consistency checks, accessibility review
│      Do NOT delegate: simple `pnpm test` sanity checks
│
├─ Is it planning / task decomposition / scoping?
│   → Handle directly (Jeremías). No delegation.
│
├─ Is it documentation / governance?
│   → Handle directly or delegate to celebra-builder if file edits needed.
│
└─ Is it research / web lookup?
    → Handle directly via web tools. No delegation.
```

## When to Delegate

Delegate only when the task meets **all** of these criteria:

1. **Is expected to take more than 2 minutes** — delegation overhead (~2 tool calls + context setup) is only worthwhile for bounded work.
2. **Is self-contained** — the subagent can complete the task without asking clarifying questions (subagents cannot use `clarify`).
3. **Does not require user interaction** — subagents cannot ask the user anything.
4. **Has clear success criteria** — the subagent can report "done" or "blocked" unambiguously.

## When NOT to Delegate

- Tasks requiring tight visual coordination (the orchestrator should see and adjust).
- Tasks whose intermediate output the orchestrator needs to review before proceeding.
- Tasks the orchestrator can complete in a single or double tool call.
- Tasks touching production data or requiring user approval.

## Constraint Passing

When delegating, pass explicit constraints via the `context` field:

```text
context="
You are acting as celebra-builder for Celebra-me.
Rules:
- Bound by gatekeeper rules (no new `any`, no Tailwind, Spanish UI text)
- Bound by git-safety (no staging/committing unless authorized)
- Read project AGENTS.md before starting.
- Use @/* imports, not relative imports.
- Run `pnpm type-check` after making changes.
- Avoid refactoring files outside your task scope.
"
```

### Tool restrictions (instruction-based — not hard-enforced)

Include tool restrictions in the context when they matter:

```text
context="
You have access to: file read/write, terminal (build commands only).
Do NOT use: browser, git write operations, web search, image generation.
"
```

The subagent **should** follow these instructions, but there is no system-level
enforcement yet. If a subagent violates instructions, report it and re-route.

## Parallel Delegation Limits

| Pattern | Max concurrent | Notes |
|---|---|---|
| Independent analysis tasks | 3 | Read-only: code audit, doc review |
| Independent implementation | 2-3 | Different files, no conflicts |
| QA after changes | 2 | Screenshots + test run concurrently |
| Copy + visual direction | 2 | Can run in parallel |

The system limits concurrent children to 3 (`delegation.max_concurrent_children`).
If a batch has more than 3 items, split into sequential groups.

## Model Notes

Currently all agents use the same model (`gpt-5.5` via `opencode-go`) because
no additional API keys are configured. Once other providers are available, this
file should be updated with model-per-role assignments.

## Routing Conflict Resolution

If a task spans multiple roles (e.g., "write copy AND build the component"):
1. Decompose into sub-tasks.
2. Route each to the appropriate role.
3. Run them sequentially or in parallel (respecting the limits above).
4. Synthesize results before reporting to the user.

If a sub-task depends on another's output, run them sequentially and pass
the dependency result in the dependent's `context`.

---

_This file is a living document. Update it when new provider credentials are
configured or when tool-gating becomes system-enforced._
