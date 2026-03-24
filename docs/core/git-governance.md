# Git Governance: Commit Validation

**Status:** Active  
**Last Updated:** 2026-03-24  
**Change Note:** Removed the plan-aware commit runner and standardized the repository on generic commit validation.

## Overview

This document defines the active commit-validation workflow for the repository.

The repository relies on conventional commits, branch protection, local hooks, and PR validation. Planning records under `.agent/plans/` remain useful for human coordination, but commits are no longer staged or created through a dedicated governance runner.

## Ownership

| Owner | Responsibility |
| --- | --- |
| `.agent/plans/README.md` | Planning contract for `commit-map.json` records |
| `commitlint.config.cjs` | Commit message validation and quality rules |
| `scripts/validate-commits.mjs` | Audit-only validation for commit ranges |
| `.husky/pre-commit` | Branch protection and local linting |
| `.husky/pre-push` | Audit-only commit-range validation before push |
| `.github/workflows/commit-validation.yml` | Pull request commit validation and docs link checks |

## Active Validation Sequence

1. `pre-commit` blocks direct commits to protected branches unless explicitly bypassed and runs `pnpm lint`.
2. `commit-msg` runs `commitlint` against the pending commit message.
3. `pre-push` validates the pushed commit range with `scripts/validate-commits.mjs` in audit-only mode.
4. CI re-runs commit-range validation and documentation link checks for pull requests.

## Guarantees

- Commit messages must follow conventional-commit structure.
- Subjects must describe the actual change with a concrete target.
- Push-time range validation stays non-blocking so developers still get feedback without hidden automation side effects.
- Branch protection remains in place for `main` and `develop`.
