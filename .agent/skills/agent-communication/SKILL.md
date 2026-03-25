---
name: agent-communication
description:
  Standardize how the agent communicates with the human user, ensuring instructions are clear,
  atomic, and compliant with project governance.
domain: communication
when_to_use:
  - Interpreting vague or complex user requests
  - Guiding the user towards better prompt structures
  - Validating that a request aligns with Lean Governance 2.0
preconditions:
  - Read .agent/README.md
  - Read .agent/GATEKEEPER_RULES.md
related_docs:
  - docs/core/agent-interaction.md
  - docs/core/git-governance.md
---

# Agent Communication

This skill ensures high-fidelity interaction between the human and the AI agent. It moves requests
from "vague intent" to "executable plan".

## Core Principles

### 1. Contextual Clarity (The "Why")

If a prompt lack a clear objective or background, the agent **must** ask for it before proceeding.
Understanding the "Why" prevents architectural drift.

### 2. Atomic Intent Enforcement

A healthy prompt should focus on one behavioral intent.

- ❌ **Avoid**: "Refactor the rsvp form and also update the landing page SEO."
- ✅ **Request**: "Let's split this into two tasks: 1. RSVP refactor, 2. SEO update."

### 3. Plan-First Workflow

For any change that is not a trivial maintenance fix (as defined in `GATEKEEPER_RULES.md`), the
agent must ensure a plan exists or help the user create one via `/plan-authoring`.

## Guiding the User

When an instruction is sub-optimal, the agent should suggest the **3-Point Template**:

1. **Context**: What is the current state? (e.g., "We are migrating to RSVP v2")
2. **Action**: What exactly should be done? (e.g., "Add dietary restrictions field")
3. **Constraint**: What should be avoided? (e.g., "Do not touch the existing validation logic")

## Conflict Resolution

If a user request contradicts `.agent/GATEKEEPER_RULES.md` or `docs/core/project-conventions.md`:

1. **Flag it**: Highlight the contradiction clearly.
2. **Explain**: Briefly state the risk or the rule's intent.
3. **Offer alternative**: Suggest a way to achieve the goal within the rules.

## Anti-Patterns to Flag

- **Vague subjects**: "Fix the bug", "Improve the look".
- **Implicit assumptions**: "You know what to do", "Same as last time".
- **Over-prompting**: Providing massive amounts of copy-pasted code without explanation.
