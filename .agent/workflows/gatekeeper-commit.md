---
description: Pure plan-aware Gatekeeper commit workflow.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-03-22
---

# Gatekeeper Commit Routine

Use this workflow only when implementation is already planned and the active plan is gatekeeper
ready. This is the dumb and fast execution loop. It does not repair planning mistakes inline.

## Preconditions

- the work belongs to an active plan under `.agent/plans/<plan-id>/`
- `plan-authoring` has already completed the planning-side validation sequence
- the target unit is already defined in the plan
- the working tree has been reduced to exactly one material commit unit
- the git index is pristine before execution starts

## Routine

1. Confirm pre-flight git hygiene:

   ```bash
   git status --porcelain
   git diff --name-only --cached
   ```

2. Inspect the current working tree against the active plan:

   ```bash
   pnpm gatekeeper:workflow:inspect -- --plan <plan-id>
   ```

3. Read the result:
   - `matched_unit`: continue
   - anything else: stop and return to `plan-authoring`

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

7. Clean up and restart only if you abort or drift invalidates the session:

   ```bash
   pnpm gatekeeper:workflow:cleanup
   ```

## Rules

- Do not use this workflow for plan repair, lifecycle repair, or commit-map redesign.
- `inspect` is the only runtime preflight that creates session state.
- Use `pnpm gatekeeper:workflow:inspect -- --plan <plan-id> --json` for machine-friendly output.
- Use `--verbose` only when you need full file detail.
- `stage` does not run local ESLint or Stylelint by default. Use `--verify-local` only when you
  explicitly want local per-unit verification.
- Use direct `git status` or `git diff --staged` to diagnose drift instead of verbose workflow
  output.
- Do not pre-stage files manually as the primary selection mechanism.
- Do not use this workflow to invent or reinterpret the commit structure. The plan owns that
  intent.
- Do not enter the workflow with multiple material units mixed in the same working tree.
- If the working tree changes after `inspect`, rerun `inspect`.
- If the staged set changes after `stage`, rerun `cleanup`, `inspect`, and `stage`.

## Diagnose Manually Only When Needed

These commands are not part of the normal loop, but they remain valid for manual diagnosis:

```bash
git stash list
git clean -dn
```

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
