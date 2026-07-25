---
name: documentation-governance
description:
  Load the active documentation integrity workflow for docs maintenance, drift prevention, and
  governance-sensitive updates. Use when creating, reorganizing, or reconciling project
  documentation, docs links, or governance references.
domain: meta
version: 1.1.0
when_to_use:
  - Creating, reorganizing, or reconciling documentation
  - Reviewing governance metadata or documentation drift
  - Auditing, archiving, or repairing `.agent/plans/` hygiene
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
related_skills: []
related_docs:
  - .agent/workflows/system-doc-alignment.md
  - .agent/index.md
  - .agent/plans/README.md
  - docs/core/project-conventions.md
  - docs/core/release-process.md
---

# Documentation Governance

Use this as a thin loader for the active documentation integrity contract.

1. Read `.agent/workflows/system-doc-alignment.md` and treat it as the authoritative workflow for
   documentation drift, governance metadata alignment, and Sync Contract enforcement.
2. Treat the Ownership Matrix and invitation authority chain in `.agent/index.md` as the SSOT map;
   do not invent a second ownership table elsewhere.
3. Keep active docs in the current taxonomy:
   - `docs/core/` for evergreen architecture and policy
   - `docs/domains/` for bounded feature or domain docs
   - `docs/archive/` for historical or superseded material
   - `.agent/index.md` for active discovery links
4. Use conversation-scoped planning by default. Create a repo-tracked note under `.agent/plans/`
   only for multi-session or high-risk work, or when the repository owner explicitly asks for one.
5. For `.agent/plans/` hygiene (status survey, archive moves, frontmatter repair, cross-reference
   fixes), follow [`.agent/plans/README.md`](../../plans/README.md) as the sole plan-governance
   authority — do not invent a parallel status taxonomy.
6. Load [`backend-engineering`](../backend-engineering/SKILL.md) as well when the documentation task
   covers API, schema, or integration behavior.
7. Git moves/archives under `.agent/plans/` require current-task git-write authorization
   (`.agent/rules/git-safety.md`).
