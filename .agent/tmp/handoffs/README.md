# `.agent/tmp/handoffs/` — Ephemeral Role Artifacts

Each subdirectory here represents one task's role-chain artifacts (copy → builder → QA, etc.).
Semantic handoff fields follow the Handoff Contract in `.agent/plans/README.md`. This directory is
not a policy SSOT.

See `.agent/tmp/README.md`, `.agent/rules/agent-routing.md`, and `.agent/plans/README.md` for
conventions.

## Active handoffs (if any)

_This directory is populated dynamically during task execution.
It should be empty when no task is in progress._
