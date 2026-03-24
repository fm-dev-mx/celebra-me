# Plan Governance & Executable Commit Maps

This directory contains the declarative roadmap for the project's evolution.

## Core Rules

1. **Single Source of Truth**: the active `commit-map.json` is the current planning authority.
2. **Atomic Planning**: define work in coherent units with explicit file boundaries.
3. **Archival**: completed plans move to `archive/`.

## Workflow

### 1. Planning
Define units and message previews in `commit-map.json`.

### 2. Implementation
Execute the planned work with the repository's normal branch, hook, and commitlint workflow.

### 3. Archival
Move completed plans to `.agent/plans/archive/YYYY-MM/` and update the manifest to `COMPLETED`.
