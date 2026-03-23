# Plan 013: Lean Governance 2.0 Overhaul

This plan implements a complete restructuring of the governance workflows to reduce complexity, execution time, and token consumption.

## Objectives

- **Unify fragmented commands** (`inspect`, `stage`, `commit`) into a single step.
- **Introduce Maintenance Mode** for unplanned fixes using the `Maintenance: true` trailer.
- **Simplify plan resolution** to look recursively in the archive.
- **Relax metadata blocks** in push and commit validation (e.g., `COMPLETED` plans in root).
- **Remove legacy and dead code** from the governance codebase.

## Phases

- **01: Core Restructuring**: Implement the unified command and smarter plan resolution.
- **02: Maintenance Mode**: Support for unplanned commits.
- **03: Documentation Alignment**: Update all project documentation.

## Success Criteria

1.  `pnpm gatekeeper:commit` works in one go for planned units.
2.  Commits with `Maintenance: true` pass `commitlint` and `pre-push` without a plan.
3.  All legacy commands and metadata blocks are removed.
4.  Commit messages are atomic, accurate, and in English.
