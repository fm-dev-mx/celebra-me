---
title: Enforce Production Mutation Boundaries — Goal 2
status: validated
created: 2026-08-12
updated: 2026-08-12
type: implementation
autonomy: 2
related_docs:
  - docs/database-workflow.md
  - .agent/rules/database.md
  - .agent/plans/archived/production-migration-path-forensics-goal1-audit.md
related_skills:
  - database-parity
  - production-sql-patches
---

# Goal 2 — Enforce Production Mutation Boundaries

Implements only the Goal 1 §7 minimum: close MCP/raw-CLI Production writes, make agent
context default-on, persist owner-apply evidence, and surface authorization integrity
separately from schema parity.

## Non-goals

- Do not revert or reapply `20260804170000`, `20260805143000`, or `20260806120000`.
- No Production mutation while implementing or validating.
- Do not add a parallel authorization mechanism or weaken TTY / release-check / backup / identity.
- Dashboard SQL editor remains out of repository control.

## Grandfather

Owner-apply ledger starts after Production head `20260806120000` (Goal 1 AUTHORIZED).
Versions at or before that timestamp do not require ledger rows.
