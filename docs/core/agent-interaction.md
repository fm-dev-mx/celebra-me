# Agent Interaction Guide — Celebra-me

This guide helps human developers interact effectively with AI agents while maintaining the
repository's high standards and **Lean Governance 2.0**.

---

## 1) The Gold Standard Prompt

A high-quality prompt reduces cycles and prevents "hallucinations". Use this structure:

| Element    | Purpose                               | Example                                                                     |
| :--------- | :------------------------------------ | :-------------------------------------------------------------------------- |
| Context    | Set the stage. Why are we doing this? | "Following the theme color variants plan, we need to simplify the palette." |
| Action     | Precise technical command.            | "Remove `src/styles/themes/_legacy.scss` and merge its 2 valid cases..."    |
| Constraint | Boundary conditions.                  | "Do not use external libraries; keep it vanilla JS. Avoid overengineering." |

---

## 2) Planning First

Before executing any complex task, ensure you have an active plan under `.agent/plans/`. If you are
starting a new feature, work with the agent to create a new plan directory (e.g.,
`.agent/plans/<plan-id>/`) containing a `README.md`, `manifest.json`, and any necessary `phases/` or
`CHANGELOG.md` files.

---

## 3) Lean Communication Pointers

- **Be Atomic**: Ask for one thing at a time. If it spans multiple domains (e.g., UI and DB), it
  should probably be two prompts or a multi-step plan.
- **Refer to Docs**: If you know the change affects a specific area, mention it (e.g., "Refer to
  [`docs/domains/rsvp/architecture.md`](../domains/rsvp/architecture.md)").
- **Verify early**: Ask the agent to "analyze first" or "summarize the plan" before it writes a
  single line of code.

---

## 4) Anti-Patterns (What to Avoid)

- ❌ **"Fix it"**: Too vague. Fix what? Where?
- ❌ **"Optimize everything"**: Leads to overengineering and breaking stable code.
- ❌ **Mixing intents**: Don't ask for a feature and a refactor in the same breath.
- ❌ **Ignoring Governance**: Asking the agent to bypass gates or "skip the plan" without a valid
  maintenance reason.

---

## 5) Getting Help

If you're not sure how to prompt, you can ask: _"¿Cómo puedo estructurar este prompt siguiendo la
guía de interacción?"_ The agent will use its `agent-communication` skill to help you refine your
request.
