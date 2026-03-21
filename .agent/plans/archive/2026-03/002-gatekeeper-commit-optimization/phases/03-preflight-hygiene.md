# Phase 03: Pre-Flight Git & Linter Hygiene Automation

## Objective

Automate Git hygiene checks and mandate early static analysis (dry-run linters) to ensure the working tree is pristine and structurally valid before allowing the workflow to proceed.

## Context

A major source of `unit_mismatch` errors is unrelated modified files or untracked trash in the working directory.

## Implementation Steps

1. **Script Guard:** Add a pre-flight check in `gatekeeper-workflow.mjs` that instantly aborts if it detects an unclean working directory that isn't part of the `commit-map.json` targeted unit.
2. **Shift-Left Validation (Dry-Run Linter):** Update the slimmed down `gatekeeper-commit.md` runner workflow to instruct the agent/developer to explicitly run `pnpm lint` or `npx lint-staged` on their code **before** invoking the `gatekeeper:workflow:inspect` script.
3. **Early Resolution:** This instruction will mandate that any architectural violations (God objects, inline styles) caught by the linter MUST be fixed manually in the implementation phase, entirely avoiding surprise rejections during the commit phase.

## Output

Frictionless starting state for every commit process.
