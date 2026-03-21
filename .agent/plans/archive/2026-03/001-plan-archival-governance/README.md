# Archival Governance for Completed Plans

## Objective

Establish and implement a clean, date-organized archival system for completed plans and enforce a sequential numbering convention (`001-plan-name`) for all new plans to prevent clutter and maintain chronological visibility in the `.agent/plans/` directory.

## Current State

The `.agent/plans/` directory is accumulating completed plans (e.g., `theme-governance`,
`branch-protection`) which makes it harder to identify active work. The `.agent/plans/README.md`
mentions moving them to `.agent/plans/archive/` but lacks a strict naming convention or
pre-requisites (like post-mortems).

## Proposed Changes

1. **Define Nomenclatures:** 
   - Active plans must use a sequential prefix: `001-plan-name`, `002-plan-name`.
   - Establish `.agent/plans/archive/YYYY-MM/<plan-id>` as the standard archival path.
2. **Post-Mortem Requirement:** Create a lightweight `post-mortem.md` template for complex plans
   before archiving.
3. **Execute Cleanup:** Archive `theme-governance` and `branch-protection`, and any other 100%
   completed plans, using the new structure.

## Phases

- `01-archival-standardization`: Update `.agent/plans/README.md` to reflect the new `YYYY-MM`
  archival structure.
- `02-post-mortem-templates`: Create a reusable `post-mortem.md` template.
- `03-backlog-cleanup`: Move completed plans to their respective `YYYY-MM` folders in the archive.
