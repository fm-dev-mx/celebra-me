---
name: documentation-governance
description:
  Load the active documentation integrity workflow for docs maintenance, drift prevention, and
  governance-sensitive updates. Use when creating, reorganizing, or reconciling project
  documentation, docs links, or governance references.
domain: meta
version: 1.0.0
when_to_use:
  - Creating, reorganizing, or reconciling documentation
  - Reviewing governance metadata or documentation drift
preconditions:
  - Read .agent/README.md
  - Read .agent/GATEKEEPER_RULES.md
related_skills: []
related_docs:
  - .agent/workflows/system-doc-alignment.md
  - docs/core/project-conventions.md
---

# Documentation Governance

Use this as a thin loader for the active documentation integrity contract.

1. Read `.agent/workflows/system-doc-alignment.md` and treat it as the authoritative workflow for
   documentation drift, governance metadata alignment, and Sync Contract enforcement.
2. Keep active docs in the current taxonomy:
   - `docs/core/` for evergreen architecture and policy
   - `docs/domains/` for bounded feature or domain docs
   - `docs/archive/` for historical or superseded material
   - `.agent/index.md` for active discovery links
3. Use conversation-scoped planning by default. Only create a repo-tracked note under
   `.agent/plans/` when the repository owner explicitly asks for one.
4. Load [`backend-engineering`](../backend-engineering/SKILL.md) as well when the documentation task
   covers API, schema, or integration behavior.
