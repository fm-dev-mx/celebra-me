# Phase 01: Archival Standardization

## Objective

Update the root `.agent/plans/README.md` to define explicit nomenclature and rules for archiving
completed plans, and enforce sequential numbering (`001-`) for active plans.

## Context

The current `README.md` states: "Archived plans move to `.agent/plans/archive/`". However, to
prevent `archive/` from becoming a dumping ground, we need internal organization.

## Implementation Steps

1. **Update Rule:** Modify the "Archiving" and "Mandatory Structure" sections in `.agent/plans/README.md`.
2. **Define Active Plan Naming:** Establish that every new plan must start with a 3-digit sequential prefix (e.g., `001-plan-name`) in both its directory name and its `manifest.json` `id`.
3. **Define Archival Convention:** Specify that completed plans should be moved to
   `.agent/plans/archive/YYYY-MM/<plan-id>/`.
   - `YYYY-MM` refers to the month the plan was completed/archived.
4. **Define Prerequisites:** Add a new rule requiring the completion of a `post-mortem.md` for any
   plan that has taken more than 1 week or faced significant technical challenges before it can be
   archived.

## Output

A modified `.agent/plans/README.md` file with the updated "Archiving" section.
