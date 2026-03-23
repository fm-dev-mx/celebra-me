# Plan Governance & Executable Commit Maps

This directory contains the declarative roadmap for the project's evolution.

## Core Rules

1. **Single Source of Truth**: The active `commit-map.json` is the only authority.
2. **Atomic Execution**: run unit-by-unit.
3. **Archival**: Completed plans move to `archive/`.

## Workflow

### 1. Planning
Define units and messages in `commit-map.json`.

### 2. Execution
```bash
pnpm gatekeeper:commit -- --plan <plan-id> --unit <unit-id>
```

### 3. Maintenance
```bash
pnpm gatekeeper:commit -- --maintenance
```

## Archival
Move to `.agent/plans/archive/YYYY-MM/` and update manifest to `COMPLETED`.
