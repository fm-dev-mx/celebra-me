# Phase 02: Maintenance Mode Implementation

## Objective
Provide a "Fast-Lane" for small, high-quality fixes that do not require a formal plan but must still follow project standards (lint, testing, conventional commits).

## Tasks

- [ ] Update `commitlint.config.cjs`:
    - Add a custom rule to allow `Maintenance: true` trailer.
    - Make `planned-trailers-required` skip checks if `Maintenance: true` is present.
- [ ] Update `scripts/validate-commits.mjs`:
    - Add logic to recognize maintenance commits in the push range.
    - Skip plan-unit matching for maintenance commits while ensuring they follow conventional format.
- [ ] Update `.husky/pre-push`:
    - Ensure maintenance commits are allowed to pass through the validation loop.

## Technical Notes
- The "Maintenance" signal should be explicit in the commit body as a trailer.
- It is intended for chores, documentation fixes, and small infrastructure updates.
