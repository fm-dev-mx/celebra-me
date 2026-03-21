# Phase 03: Backlog Cleanup

## Objective

Execute the new archival rules on existing completed plans to clean up the `.agent/plans/` directory.

## Context

Currently, `theme-governance` (100% complete) and `branch-protection` (100% complete) are sitting in the root of `.agent/plans/`. They need to be archived.

## Implementation Steps

1.  Ensure `.agent/plans/archive/2026-03/` exists.
2.  Move `.agent/plans/theme-governance/` to `.agent/plans/archive/2026-03/theme-governance/`.
3.  Move `.agent/plans/branch-protection/` to `.agent/plans/archive/2026-03/branch-protection/`.
4.  (Optional) If any post-mortem is needed for them, generate a brief one. Given their scope, an empty or skipped post-mortem is acceptable for this initial cleanup round.
5.  Update the `status` in their respective `manifest.json` files to `ARCHIVED`.

## Output

A clean `.agent/plans/` root directory containing only active or planned work.
