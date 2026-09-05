---
name: system-doc-alignment
description: Keep active docs and agent governance aligned with the live repository tree — audit for drift, enforce placement rules, and apply the Sync Contract.
domain: workflow
version: 1.0.0
when_to_use:
  - Auditing or aligning active documentation and agent governance with the live repository tree
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
related_skills:
  - plan-authoring
related_docs:
  - .agent/index.md
  - .agent/ownership.yaml
  - docs/core/architecture.md
---

# System Doc Alignment

Use this skill when documentation or governance metadata may be stale, or when the documentation
Sync Contract must be enforced.

## Goal

Restore a lean, truthful documentation state without inventing parallel governance structure.

## Required Context

Resolve the affected guidance and its live owners. Report missing required sources and stop only the
decisions that depend on them; a fixed directory checklist is not a prerequisite for every
documentation task.

## Placement Rules

- `docs/core/` for evergreen architecture and cross-cutting policy docs
- `docs/domains/` for bounded domain or feature docs
- `docs/archive/` for historical reports and superseded notes
- `.agent/index.md` for active discovery links and entrypoints

## Workflow

1. Audit the current tree, live scripts, and active governance surface before editing docs.
2. Compare active docs against live source, `.agent/index.md`, `AGENTS.md`,
   `.agent/plans/README.md`, `package.json`, `scripts/cli.mjs`, and the relevant governance owner.
3. Use conversation-scoped planning by default. Create a repo-tracked note under `.agent/plans/`
   only for multi-session or high-risk work, or when the repository owner explicitly requests it.
4. Prefer consolidation over adding new skill or governance documents.
5. Enforce the Sync Contract in the same task:
   - behavior or architecture changes update `docs/core/architecture.md` and the matching
     `docs/domains/**` doc
   - skill inventory or entrypoint changes update `.agent/index.md` and `AGENTS.md`
   - ownership or authority-chain changes update the Ownership Matrix in `.agent/ownership.yaml`
   - new active docs go in the correct subtree and are linked from the active discovery doc when
     they become a source of truth
   - planning contract changes update `.agent/plans/README.md` when repo-tracked planning guidance
     changes
   - release-history policy changes update `docs/core/release-process.md` and the `CHANGELOG.md`
     header pointers when needed
6. Remove or archive stale active references. Archived documents may retain legacy paths only when
   clearly marked as historical.
7. After edits, detect the closest available verification scripts from `package.json` and
   `scripts/cli.mjs`, then use the proportional tier owned by `gatekeeper.md`. Documentation-only
   governance work normally uses structure validation, link checks, formatting, and Git safety. Add
   focused tests only when an executable validation contract changed; do not default to global
   type-check, lint, test, or build for documentation-only edits.

## Guardrails

- Keep one source of truth per topic.
- Do not preserve stale governance or planning language for historical convenience.
- Archive or mark documents as historical when they no longer describe the active system.
- Do not invent a manifest/archive planning system unless the repository owner explicitly restores
  it.
- Do not introduce a second active documentation-integrity skill or duplicate Sync Contract.
