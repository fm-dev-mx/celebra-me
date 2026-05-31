# Agent Entry Point — Celebra-me

This file is the universal starting point for agents working in this repository.

## Loading Order

1. Read this file.
2. Read `.agent/index.md` for the current discovery map.
3. Read `.agent/load-skills.md` for the provider-agnostic skill loading protocol.
4. Read `.agent/GATEKEEPER_RULES.md` before making changes.
5. Load only the smallest relevant skill, workflow, and domain docs for the task.

## Authority Order

1. Explicit repository-owner and current-task instructions
2. Active repository governance in `.agent/*`
3. Active architecture and domain docs in `docs/core/**` and `docs/domains/**`
4. Historical material in `docs/archive/**` for background only

If sources disagree, prefer the live codebase plus the highest-priority active source above.

## Current Active Surfaces

- Discovery index: `.agent/index.md`
- Skill loading protocol: `.agent/load-skills.md`
- Mandatory operating contract: `.agent/GATEKEEPER_RULES.md`
- Plan governance: `.agent/plans/README.md`
- Workflows: `.agent/workflows/*.md`
- Domain and evergreen docs: `docs/core/**`, `docs/domains/**`
- Historical docs: `docs/archive/**` (never canonical on their own)

## Current Workflows

- `error-remediation`: diagnose and remediate failing checks
- `plan-authoring`: capture lightweight planning expectations when repo-tracked notes are explicitly
  requested
- `system-doc-alignment`: reconcile active docs and governance metadata with the live tree
- `theme-architecture-governance`: validate theme-system contracts and section theming boundaries

## Planning Contract

This repository does not require a manifest-based planning system. Plans live as single Markdown
files under `.agent/plans/active/`. Use conversation-scoped plans unless the repository owner
explicitly asks for a repo-tracked planning note. See `.agent/plans/README.md` for governance.

## Documentation Drift Rule

When the implementation no longer matches the active docs:

- update the active doc surface first,
- archive historical material under `docs/archive/` when it no longer describes the live system,
- keep one source of truth per topic.

## Portability Rule

The repository contract is self-contained in `.agent/` plus the in-repo docs. Agents must not
require provider-specific config, globally installed skills, or remote lock files to understand the
project. Use `.agent/load-skills.md` and `.agent/index.md` as the universal discovery surface.
