# Plan 015: Project-Wide Dead Weight Audit

Objective: Prune all code, documentation, and assets that no longer contribute to the project's
value.

## Context

The project has undergone several architectural shifts (Lean Governance 2.0, SCSS Optimization).
These shifts have left behind "dead weight" that increases cognitive load and slows down
development.

## Implementation Strategy

- **Recursive Audit**: Use file search and import analysis to find orphans.
- **Categorized Pruning**: Group deletions by domain (Governance, UI, Data, etc.).
- **Surgical Removal**: Ensure no functional regressions occur during pruning.

## Success Criteria

- 0 redundant governance scripts in `.agent/`.
- 0 obsolete architecture documents in `docs/`.
- All `tests/` suites pass (or are intentionally removed if obsolete).
- Clean `scripts/` folder containing only active utilities.
- Reduction in total project file count.
