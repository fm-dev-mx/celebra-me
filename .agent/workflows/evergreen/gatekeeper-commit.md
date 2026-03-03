---
description: Deterministic Gatekeeper commit workflow with Domain Mapping and ADU splits.
---

# Gatekeeper Commit Routine

Execute this workflow when ready to commit changes. It ensures deterministic governance and ADU-safe
splits.

## Routine

1.  **Analyze Staged Changes** Run the deterministic report to receive the complete route, check
    matrix, and suggested splits:

    ```bash
    pnpm gatekeeper:report
    ```

2.  **Evaluate Route** Based on the JSON `route` property:
    - **`route: "architectural_intervention"`**: Manual fix required for `severity: "block"`
      findings.
    - **`route: "auto_fix"`**: Jump to `.agent/workflows/evergreen/auto-fix.md`.
    - **`route: "proceed_adu"`**: Proceed using `adu.suggestedSplits` when
      `adu.splitConfidence >= 0.6`.

3.  **Atomic Commit Preparation** Validate `adu.unmappedFiles` and avoid scope drift:
    - If `s0Drift.hasDrift` is true, stop and restage intentionally.
    - If `adu.unmappedFiles` is non-empty, treat as architectural intervention.
    - Use one split at a time and keep commit messages Conventional Commit compliant.

> [!TIP] `gatekeeper:report` now includes governance, lint, type-check, security, and ADU sections
> in one JSON output.
