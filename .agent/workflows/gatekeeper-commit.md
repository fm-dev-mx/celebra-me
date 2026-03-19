---
description: Pure plan-aware Gatekeeper commit workflow.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-03-19
---

# Gatekeeper Commit Routine

Use this workflow when you are ready to commit implementation work.

## Preconditions

- the work belongs to an active plan under `.agent/plans/<plan-id>/`
- that plan includes a valid `commit-map.json`
- the target unit has already been defined in the plan

## Routine

1. Inspect the current working tree against the active plan:

   ```bash
   pnpm gatekeeper:workflow:inspect -- --plan <plan-id>
   ```

2. Read the result:
   - `matched_unit`: continue
   - `unit_ambiguity`: stop and narrow the working tree change set
   - `unit_mismatch`: stop and align the plan or the change set
   - `invalid_plan_contract`: stop and fix `commit-map.json`
   - `plan_not_found`: stop and create or select the correct active plan
   - `empty_change_set`: nothing to do

3. Stage the exact planned unit from the working tree:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs stage --plan <plan-id> --unit <unit-id>
   ```

4. Preview the commit message:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --unit <unit-id>
   ```

5. Create the commit:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs commit --unit <unit-id>
   ```

6. If you abort the flow or the staged set drifts, clean up and restart:

   ```bash
   pnpm gatekeeper:workflow:cleanup
   ```

## Rules

- Do not pre-stage files manually as the primary selection mechanism.
- Do not use `--domain` for commit planning.
- Do not edit `.git/gatekeeper-session.json` or `.git/gatekeeper-s0.json` by hand.
- If the working tree changes after `inspect`, rerun `inspect`.
- If the staged set changes after `stage`, rerun `cleanup`, `inspect`, and `stage`.

## Output Contract

The workflow-generated commit must contain:

- an exact planned header from the unit
- one body bullet per changed file
- these trailers:

```text
Plan-Id: <plan-id>
Commit-Unit: <unit-id>
```

## References

- [Planning Governance Framework](../plans/README.md)
- [Git Governance](../../docs/core/git-governance.md)
