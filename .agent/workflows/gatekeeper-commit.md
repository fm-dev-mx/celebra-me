---
description: Pure plan-aware Gatekeeper commit workflow.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-03-20
---

# Gatekeeper Commit Routine

Use this workflow when you are ready to commit implementation work.

## Preconditions

- the work belongs to an active plan under `.agent/plans/<plan-id>/`
- that plan includes a valid `commit-map.json`
- `pnpm gatekeeper:plans:validate -- --plan <plan-id>` passes
- that plan has already completed its final commit-strategy review
- that plan is marked ready for gatekeeper execution
- the target unit has already been defined in the plan
- the working tree has been reduced to exactly one material commit unit

If no plan exists yet:

- create a micro-plan before implementation for small new work
- create a retroactive plan before commit for work that already exists in the working tree

## Routine

1. Validate the plan contract:

   ```bash
   pnpm gatekeeper:plans:validate -- --plan <plan-id>
   ```

2. Inspect the current working tree against the active plan:

   ```bash
   pnpm gatekeeper:workflow:inspect -- --plan <plan-id>
   ```

3. Read the result:
   - `matched_unit`: continue
   - `unit_ambiguity`: stop, update the plan or narrow the working tree change set, then rerun
     `inspect`
   - `unit_mismatch`: stop, update the plan or align the change set, then rerun `inspect`
   - `invalid_plan_contract`: stop and fix `commit-map.json`
   - `commit_strategy_not_ready`: stop and complete the final commit review in the plan
   - `plan_not_found`: stop and create or select the correct active plan
   - `empty_change_set`: nothing to do

4. Stage the exact planned unit from the working tree:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs stage --plan <plan-id> --unit <unit-id>
   ```

5. Preview the commit message:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --unit <unit-id>
   ```

6. Create the commit:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs commit --unit <unit-id>
   ```

7. If you abort the flow or the staged set drifts, clean up and restart:

   ```bash
   pnpm gatekeeper:workflow:cleanup
   ```

## Rules

- Do not pre-stage files manually as the primary selection mechanism.
- Do not use `--domain` for commit planning.
- Do not edit `.git/gatekeeper-session.json` or `.git/gatekeeper-s0.json` by hand.
- Do not use this workflow to invent or reinterpret the commit structure. The plan owns that intent.
- Do not enter the workflow with multiple material units mixed in the same working tree.
- If the working tree changes after `inspect`, rerun `inspect`.
- If the staged set changes after `stage`, rerun `cleanup`, `inspect`, and `stage`.
- If `inspect` reports drift or ambiguity, update the plan and `commit-map.json` before continuing
  whenever the finding changes intent, file boundaries, or commit purpose.
- If a workflow finding is purely operational and does not change the unit’s intent, file
  boundaries, or explanation, fix the issue and rerun `inspect` without redesigning the plan.
- Treat `pnpm gatekeeper:commit-ready` only as a convenience wrapper around `inspect`, not as a
  separate planning flow.

## Output Contract

The workflow-generated commit must contain:

- an exact planned header from the unit when `messagePreview.header` is provided
- that header must still equal the canonical unit subject: `type(domain): verb target`
- one body bullet per changed file
- these trailers:

```text
Plan-Id: <plan-id>
Commit-Unit: <unit-id>
```

## References

- [Planning Governance Framework](../plans/README.md)
- [Git Governance](../../docs/core/git-governance.md)
