---
description: Keep `.agent/`, `docs/`, and active plan records aligned with the live repository tree.
lifecycle: evergreen
domain: governance
owner: system-agent
last_reviewed: 2026-03-19
---

# System Doc Alignment

Use this workflow when documentation, governance metadata, or active plan records may be stale.

## Goal

Restore a lean, truthful documentation state without inventing new governance structure.

## Required Checks

Validate that these paths exist before doing anything else:

- `.agent/workflows/`
- `.agent/plans/`
- `docs/`
- `src/`

If a required path is missing, stop and report it.

## Workflow

1. Audit the current tree, not old assumptions.
2. Compare active docs against live source, active plans, and executable owners.
3. Create or update a dedicated plan under `.agent/plans/` when the work is more than a trivial doc fix.
4. Prefer consolidation over adding new workflow documents.
5. Update `docs/DOC_STATUS.md` whenever active plan inventory changes.
6. After edits, run the relevant verification commands:
   - `pnpm astro check`
   - `pnpm lint`
   - `pnpm ops validate-schema`
   - `pnpm ops check-links`

## Guardrails

- Keep one source of truth per topic.
- Do not preserve stale plan inventory for historical convenience.
- Archive or mark documents as historical when they no longer describe the active system.
- Reuse the planning framework in `.agent/plans/README.md`; do not invent a parallel structure.
