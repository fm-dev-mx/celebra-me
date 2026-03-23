# Changelog: Plan 013 - Lean Governance 2.0

All notable changes to the governance system will be documented in this file.

## [Unreleased]

### Added
- Unified `pnpm gatekeeper:commit` command.
- `Maintenance: true` trailer for unplanned maintenance commits.
- Recursive searching in archive for plan resolution.

### Changed
- Refactored `gatekeeper-workflow.mjs` to unify `inspect`, `stage`, and `commit`.
- Relaxed `pre-push` validation for historical and `COMPLETED` plans.
- Updated `commitlint` to support `Maintenance: true`.

### Removed
- Legacy `scaffold` command from `gatekeeper-workflow.mjs`.
- Redundant `inspect` manual step.
- Blocking metadata checks in `validate-commit-plan.mjs`.
