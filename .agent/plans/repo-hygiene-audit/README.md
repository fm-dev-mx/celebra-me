# Plan: Repository Hygiene & Structural Analysis (Audit Remediation)

> **Plan-Id**: `repo-hygiene-audit` **Status**: `ACTIVE` **Owner**: `fm-dev-mx`

## Executive Summary

This plan addresses structural debt, "ghost" scaffolding, and configuration misalignments identified
during the comprehensive repository hygiene audit. The goal is to reduce cognitive load, synchronize
tool configurations, and eliminate obsolete artifacts without altering application logic.

## Scope

### In-Scope

- Deletion of root-level logs (`*.log`), `test_output.txt`, and orphaned `tracking/` directory.
- Consolidation of `src/lib/utils` into `src/utils`.
- Pruning of non-existent path aliases in `astro.config.mjs`.
- Synchronization of `tsconfig.json` and `astro.config.mjs` path aliases.
- Structural refactoring of the monolithic `src/lib/rsvp` into domain sub-folders.

### Out-of-Scope

- Modifications to business logic in RSVP or any other domain.
- Frontend styling or component changes.
- Database schema migrations.

## Risk Matrix

| Risk               | Impact | Probability | Mitigation                                                               |
| :----------------- | :----- | :---------- | :----------------------------------------------------------------------- |
| **Broken Imports** | High   | Medium      | Run `astro check` and `pnpm test` after every alias/move operation.      |
| **Config Drift**   | Medium | Low         | Use `tsconfig.json` as the source of truth for aliases.                  |
| **Test Failures**  | Medium | Low         | Ensure unit tests in `tests/**` are updated to match new file locations. |

## Phase Index

| Phase                                                  | Title              | Objective                                    | Weight |
| :----------------------------------------------------- | :----------------- | :------------------------------------------- | :----- |
| [01-cleanup](./phases/01-cleanup.md)                   | Initial Purge      | Remove logs and orphaned root directories.   | 15%    |
| [02-config-alignment](./phases/02-config-alignment.md) | Configuration Sync | Align aliases and prune dead config entries. | 25%    |
| [03-simplification](./phases/03-simplification.md)     | Domain Refinement  | Modularize RSVP and merge utils.             | 45%    |
| [04-validation](./phases/04-validation.md)             | Final Lockdown     | Ensure zero-drift and perfect build health.  | 15%    |
