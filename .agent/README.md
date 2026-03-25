# Agent Entry Point — Celebra-me

This file is the universal starting point for agents working in this repository.

## Loading Order

1. Read this file.
2. Read `.agent/index.md` for the current discovery map.
3. Read `.agent/GATEKEEPER_RULES.md` before making changes.
4. Load only the smallest relevant skill, workflow, and domain docs for the task.

## Authority Order

1. `.agent/*` documents
2. Explicit repository-owner instructions in the current conversation
3. `docs/*` architecture and domain docs

Generic best practices never override local repository rules.

## Current Active Surfaces

- Discovery index: `.agent/index.md`
- Mandatory operating contract: `.agent/GATEKEEPER_RULES.md`
- Plan governance: `.agent/plans/README.md`
- Workflows: `.agent/workflows/*.md`
- Domain and evergreen docs: `docs/core/**`, `docs/domains/**`
- Historical docs: `docs/archive/**`

## Current Workflows

- `error-remediation`: diagnose and remediate failing checks
- `plan-authoring`: define and validate executable plan records
- `system-doc-alignment`: reconcile active docs and governance metadata with the live tree
- `theme-architecture-governance`: validate theme-system contracts and section theming boundaries

## Plan Record Contract

Active plan work lives under `.agent/plans/<plan-id>/` while it is in progress. Each active plan
record should contain:

- `README.md`
- `manifest.json`
- `commit-map.json`
- `CHANGELOG.md`
- `phases/*.md`

Completed plans move to `.agent/plans/archive/YYYY-MM/<plan-id>/`.

## Documentation Drift Rule

When the implementation no longer matches the active docs:

- update the active doc surface first,
- archive historical material under `docs/archive/` when it no longer describes the live system,
- keep one source of truth per topic.

## Portability Rule

The repository contract is self-contained in `.agent/` plus the in-repo docs. Agents must not
require `.codex/`, provider-specific mirrors, or globally installed skills to understand the
project.
