---
name: documentation-governance
description:
  Load the active documentation integrity workflow for docs maintenance, drift prevention, and
  governance-sensitive updates. Use when creating, reorganizing, or reconciling project
  documentation, docs links, or plan/governance references.
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
3. Follow `.agent/plans/README.md` for planning records. Do not invent `task.md`,
   `implementation_plan.md`, or `walkthrough.md`.
4. Load [`backend-engineering`](../backend-engineering/SKILL.md) as well when the documentation task
   covers API, schema, or integration behavior.
