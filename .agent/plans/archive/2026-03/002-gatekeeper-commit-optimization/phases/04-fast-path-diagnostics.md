# Phase 04: Fast-Path Mismatch Diagnostics

## Objective

Improve the Developer/Agent Experience (DX) when a `unit_mismatch` occurs by providing an immediate, legible diff.

## Context

When `inspect` detects a mismatch, it outputs a generic error. The agent then wastes tokens discovering the actual drift.

## Implementation Steps

1. **Enhance Output:** Modify `validate-commit-plan.mjs` to output a clear table of files "In Git but not in Plan" and "In Plan but not in Git" upon a mismatch.
2. **Short-circuiting:** This allows the agent (or human) to instantly identify the delta without running manual bash commands.

## Output

High-signal validation error logs in the terminal.
