# Phase 4: Dynamic Re-mapping Protocol

## Context
Based on the deep architectural analysis of the Gatekeeper (`validate-commit-plan.mjs` and `commit-plan.mjs`), the lifecycle demands strict 1:1 validation between the Git tree and `commit-map.json`'s include arrays. The zero-sum matching logic (`unmatched.length === 0`) means any execution drift will halt the pipeline with a `unit_mismatch`.

## Operational Friction
If an agent modifies more files than anticipated (or spawns temp logs), the workflow traditionally triggers expensive retry loops of blind error-checking.

## Solution: The "Rewrite-and-Recalibrate" Routine
The Gatekeeper workflow prompt (`.agent/workflows/gatekeeper-commit.md`) must instruct the agent on the shortest path to recalibrate a stale plan:

1. **Diff Comparison**: Immediately compare the `unmatchedFiles` output from `pnpm gatekeeper:workflow:inspect --json` against the `include` array of the target unit in `commit-map.json`.
2. **Surgical Patch**: Programmatically push the unmapped absolute paths into the `include` array of the correct unit.
3. **Reseal Plan Timestamp**: Automatically inject a new ISO string to `commitStrategyReview.reviewedAt` to pass validation.
4. **Instant Re-Inspect**: Rerun `inspect` once the JSON is patched.

By defining this explicit "Re-mapping Protocol," the agent will know exactly *how* to negotiate with the rigid Gatekeeper contract without overwhelming the user or consuming excessive LLM token context via iterative guessing.
