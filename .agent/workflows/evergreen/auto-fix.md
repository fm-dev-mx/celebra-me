---
description: Automated remediation for gatekeeper findings using self-healing commands.
---

# Auto-Fix (Self-Healing) Routine

Execute this when `gatekeeper:report` returns `route: "auto_fix"`.

If `route` is `architectural_intervention`, do not run this workflow.

## Remediation Loop

1.  **Extract Commands** Identify findings with `autoFixable: true` and extract their `fixCommand`
    from the report.

2.  **Execute Fixes** Run the specific `fixCommand` for each finding (e.g., `pnpm lint:fix`). If
    multiple findings share a command, run it once.

3.  **Verify & Re-route** Re-run `pnpm gatekeeper:report`.
    - If `route` is now `proceed_adu`: Proceed to commit.
    - If `route` is still `auto_fix` after 2 attempts: Notify user about the persistent issue.

> [!IMPORTANT] Do NOT attempt to fix issues manually if a `fixCommand` exists; let the tools do the
> work.
