# Phase 01: Core Governance Restructuring

## Objective

Unify the fragmented gatekeeper-workflow commands into a single, atomic operation and improve the
robustness of plan resolution.

## Tasks

- [ ] Refactor `gatekeeper-workflow.mjs`:
  - Implement `auto-commit` logic that combines `inspect`, `stage`, and `commit`.
  - Automate the staging of exactly one matching unit.
  - Remove the redundant `scaffold` command and manual `inspect` step from the normal loop.
- [ ] Optimize Plan Resolution in `validate-commit-plan.mjs`:
  - Implement recursive search in `archive/YYYY-MM/` subdirectories.
  - Downgrade "Historical Plan in Active Root" from ERROR to WARNING in `pre-push`.
  - Cleanup legacy aliases like `minimal` vs `quick`.

## Technical Notes

- The `auto-commit` command should be accessible via `pnpm gatekeeper:commit`.
- It must ensure atomicity by aborting if multiple units match or if there is drift.
