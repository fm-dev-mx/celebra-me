# Phase 01: Token-Efficient Workflow Splitting

## Objective

Split the monolith `.agent/workflows/gatekeeper-commit.md` into two highly specialized, isolated workflows to save LLM context tokens and improve execution speed.

## Context

Currently, the Gatekeeper routine forces the LLM to load instructions about planning, architectural constraints, and operational git commands all at once. By splitting them, we can use a "dumb/fast" agent loop just for committing and a "smart/slow" agent loop for planning.

## Implementation Steps

1. **Create `plan-authoring.md`:** A workflow designed exclusively for analyzing code, identifying the dominant intent, writing `commit-map.json`, and doing the heavy architectural lifting. **Key Rule:** This workflow strictly requires the codebase to pass all `pnpm lint` and static analysis checks *before* the intent is mapped, ensuring code architecture stabilizes before commit boundaries are defined.
2. **Trim `gatekeeper-commit.md`:** Strip out all the planning rules. Restrict this workflow ONLY to: `inspect` -> `stage` -> `scaffold` -> `commit`. If `unit_mismatch` happens, the fallback rule should be "Abort and run the plan-authoring workflow to fix the constraints", rather than trying to fix it inline.

## Output

Two separate, highly cohesive markdown files in `.agent/workflows/`.
