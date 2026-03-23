---
description: Pure plan-aware Gatekeeper commit workflow.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-03-20
---

# Gatekeeper Commit Routine

<<<<<<< Updated upstream
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
=======
Use this workflow only when implementation is already planned and the active plan is gatekeeper ready. For small, unplanned fixes, use **Maintenance Mode** instead.

## Preconditions

- The work belongs to an active plan under `.agent/plans/<plan-id>/`.
- `plans:doctor` has been run and all findings resolved.
- The working tree represents exactly one material commit unit.
>>>>>>> Stashed changes

## Routine (Standard Path)

<<<<<<< Updated upstream
1. **Pre-Flight Git Hygiene**: Ensure the Git index is pristine to avoid `unit_mismatch` errors.

   ```bash
   git stash list; git clean -dn; git status --porcelain
   ```

2. Validate the plan contract:

   ```bash
   pnpm gatekeeper:plans:validate -- --plan <plan-id>
   ```

3. Inspect the current working tree against the active plan:
=======
1. Execute the unified commit command:

   ```bash
   pnpm gatekeeper:commit -- --plan <plan-id> [--unit <unit-id>]
   ```

   This command automatically:
   - **Inspects** the working tree to find a matching unit.
   - **Stages** exactly that unit.
   - **Commits** with the planned header, summary, and trailers.
>>>>>>> Stashed changes

2. If the command fails due to drift or ambiguity:
   - Run `pnpm gatekeeper:workflow:cleanup`.
   - Update the plan or fix the working tree.
   - Restart the routine.

## Routine (Maintenance Path)

For small fixes (chore, docs, fix) that don't need a plan:

1. Create a conventional commit manually or via CLI.
2. Add the following trailer to the body:

   ```text
   Maintenance: true
   ```

<<<<<<< Updated upstream
4. Read the result:
   - `matched_unit`: continue
   - `unit_ambiguity`: stop, use `git diff --staged --name-only` to locate overlaps, update the plan, then rerun `inspect`
   - `unit_mismatch`: stop and **recalibrate**. Run `pnpm gatekeeper:workflow:inspect --json` or `git diff --staged --name-only` to pinpoint unmapped files. Surgically add these absolute paths to the target unit's `include` array in `commit-map.json`. Refresh `commitStrategyReview.reviewedAt`, then rerun `inspect`.
   - `invalid_plan_contract`: stop and fix `commit-map.json`
   - `commit_strategy_not_ready`: stop and complete the final commit review in the plan
   - `plan_archived`: stop and create or select an active plan; archived plans are historical only
   - `plan_not_found`: stop and create or select the correct active plan
   - `empty_change_set`: nothing to do

5. Stage the exact planned unit from the working tree:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs stage --plan <plan-id> --unit <unit-id>
   ```

6. Preview the commit message:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --unit <unit-id>
   ```

7. Create the commit:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs commit --unit <unit-id>
   ```

8. Clean up and restart (if you abort or the staged set drifts):

   ```bash
   pnpm gatekeeper:workflow:cleanup
   ```

## Rules

- **CRITICAL - Tool Hangs**: Always use non-interactive flags (e.g., `--yes`) for `npx` calls. If `stage`, `scaffold` or `commit` hangs indefinitely, DO NOT retry blindly. Cancel the execution and use an explicit fallback: assemble the full message dynamically from `commit-map.json` and use `git commit -F <temp-file>`.
- **Match Diagnostics**: Use direct `git status` or `git diff --staged` to diagnose file drift instantly instead of token-heavy verbose logging.
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

## Output Contract

The workflow-generated commit must contain:

- an exact planned header from the unit when `messagePreview.header` is provided
- that header must still equal the canonical unit subject: `type(domain): verb target`
- one to four semantic summary bullets from `messagePreview.summary`
- a `Files:` section with one exact changed file path per bullet
- these trailers:

```text
Plan-Id: <plan-id>
Commit-Unit: <unit-id>
```

## References

- [Planning Governance Framework](../plans/README.md)
- [Git Governance](../../docs/core/git-governance.md)
=======
## Output Contract

The workflow-generated commit must contain:
- A header matching the plan: `type(domain): verb target`.
- Precise semantic summary bullets.
- A `Files:` section for traceability.
- Trailers: `Plan-Id` and `Commit-Unit` (or `Maintenance: true`).
>>>>>>> Stashed changes
