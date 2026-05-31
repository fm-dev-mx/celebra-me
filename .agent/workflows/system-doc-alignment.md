---
description: Keep active docs and agent governance aligned with the live repository tree.
lifecycle: evergreen
domain: governance
owner: system-agent
last_reviewed: 2026-03-24
---

# System Doc Alignment

Use this workflow when documentation or governance metadata may be stale, or when the documentation
Sync Contract must be enforced.

## Goal

Restore a lean, truthful documentation state without inventing parallel governance structure.

## Required Checks

Validate that these paths exist before doing anything else:

- `.agent/workflows/`
- `.agent/plans/`
- `docs/`
- `src/`

If a required path is missing, stop and report it.

## Placement Rules

- `docs/core/` for evergreen architecture and cross-cutting policy docs
- `docs/domains/` for bounded domain or feature docs
- `docs/archive/` for historical reports and superseded notes
- `.agent/index.md` for active discovery links and entrypoints

## Workflow

1. Audit the current tree, live scripts, and active governance surface before editing docs.
2. Compare active docs against live source, `.agent/index.md`, `.agent/README.md`,
   `.agent/plans/README.md`, `package.json`, `scripts/cli.mjs`, and the relevant governance owner.
3. Use conversation-scoped planning by default. Only create a repo-tracked note under
   `.agent/plans/` when the repository owner explicitly requests it.
4. Prefer consolidation over adding new workflow or governance documents.
5. Enforce the Sync Contract in the same task:
   - behavior or architecture changes update `docs/core/architecture.md` and the matching
     `docs/domains/**` doc
   - workflow inventory or entrypoint changes update `.agent/index.md` and `.agent/README.md`
   - new active docs go in the correct subtree and are linked from the active discovery doc when
     they become a source of truth
   - planning contract changes update `.agent/plans/README.md` when repo-tracked planning guidance
     changes
6. Remove or archive stale active references. Archived documents may retain legacy paths only when
   clearly marked as historical.
7. After edits, detect the closest available verification scripts from `package.json` and
   `scripts/cli.mjs`, then run only the relevant checks in Gatekeeper order:
   - type checking: `pnpm type-check` or `pnpm astro check`
   - linting: `pnpm lint`
   - tests: `pnpm test` when runtime or test-facing contracts changed
   - schema validation: `pnpm ops validate-schema` when schema or theme-contract surfaces changed

## Guardrails

- Keep one source of truth per topic.
- Do not preserve stale governance or planning language for historical convenience.
- Archive or mark documents as historical when they no longer describe the active system.
- Do not invent a manifest/archive planning system unless the repository owner explicitly restores
  it.
- Do not introduce a second active documentation-governance workflow or duplicate Sync Contract.
