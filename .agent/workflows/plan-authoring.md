---
description: Code analysis and declarative commit-map planning
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-03-21
---

# Plan Authoring Workflow

Use this workflow exclusively for analyzing code, identifying the dominant intent, writing
`.agent/plans/<plan-id>/commit-map.json`, and doing the heavy architectural lifting. This acts as
the "think" phase, entirely separate from the "do/commit" phase.

## Preconditions

- You are handling a feature, fix, or architectural change that needs properly structured commits.
- All code changes are actively in the working directory (or you are about to map intent before
  starting small work).

## Strict Rule: Code Quality Before Planning

**Key Rule:** This workflow strictly requires the codebase to pass all static analysis checks
_before_ the intent is mapped. Ensure code architecture stabilizes before commit boundaries are
defined.

Run:

```bash
pnpm lint
```

If the linter fails (e.g., God objects, inline styles, coupling, missing English docs/code), fix the
code first. Do NOT proceed to write the `commit-map.json` until `pnpm lint` passes 100%.

## Routine

1. **Analyze Code/Requirements:** Review the feature request or the currently modified files.
2. **Identify Intent:** Determine the domain, verb, and purpose for each logical unit of work.
3. **Map Units (`commit-map.json`):** Create or update the `.agent/plans/<plan-id>/commit-map.json`
   file. Each unit must map precisely to files (using absolute paths or globs in the `include`
   array).
4. **Enforce Constraints:** Ensure the code and documentation adhere to architectural rules:
   - All code (variables, components, props) and internal documentation MUST be in English.
   - Spanish is strictly reserved for the UI / copywriting.
5. **Finalize:** Refresh `commitStrategyReview.reviewedAt` to the current UTC timestamp when the
   plan is finalized.

## Output

A valid, structured `.agent/plans/<plan-id>/commit-map.json` that is strictly compliant with the
codebase constraints.

Once the plan is created and code passes static analysis, proceed to the Gatekeeper Commit workflow
to securely commit changes.
