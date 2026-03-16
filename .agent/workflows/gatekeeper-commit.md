---
description: Lean Gatekeeper commit workflow driven by deterministic scripts and session state.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-03-15
---

# Gatekeeper Commit Routine

Execute this workflow when ready to commit changes. The workflow delegates routing, autofix, session
lifecycle, and split staging to executable scripts. Markdown describes sequence only.

## Pre-flight

Use the configured workflow pre-flight command from `.agent/governance/config/policy.json` when you
need a manual validation pass before inspecting. The current fallback resolution order is:

1. `workflow.inspect.preflightCommand`
2. `pnpm turbo-all` when the script exists
3. `pnpm ci` when the script exists
4. `pnpm lint && pnpm type-check && pnpm test`

## Routine

1. Inspect the current staged set and write a workflow session:

   ```bash
   pnpm gatekeeper:workflow:inspect
   ```

   If you are on `main` or `develop`, Gatekeeper may auto-create or auto-switch to a safe feature
   branch during this step. If you need a specific branch name, use:

   ```bash
   pnpm gatekeeper:commit-ready:create <branch-name>
   ```

2. Read `workflowRoute` from the workflow report:
   - `architectural_intervention`: stop and resolve blockers, unmapped files, or session drift.
     - If unmapped files are in `.agent/plans/`, add a new domain to
       `.agent/governance/config/domain-map.json` following the pattern
       `gov-plans-<directory-name>`.
     - Do not run `stage` or `commit` until `inspect` returns `proceed_adu`.
   - `auto_fix`: run `pnpm gatekeeper:workflow:autofix`, then inspect again.
   - `proceed_adu`: continue with deterministic domain staging.

3. For each domain returned by `adu.suggestedSplits`, stage exactly one split:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs stage --domain <domain-id>
   ```

4. Generate a commit scaffold for the staged split:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs scaffold --domain <domain-id>
   ```

   `scaffold` is non-mutating by default. It emits full relative paths in body bullets and those
   paths should not be manually shortened with `...`.

5. Commit the staged split with the workflow-owned commit command:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs commit --domain <domain-id>
   ```

   Commit messages must follow this contract:
   - Header: `type(scope): verb target`
   - The verb must describe the dominant change, not bookkeeping such as `record ... scope`
   - Multi-file bodies must use `- path: description` bullets
   - Bullet paths must use full relative paths; `...` is not allowed
   - Bullet descriptions must describe the specific file change, not generic bookkeeping
   - Bullets may cover one file or one coherent folder/prefix when the split is still atomic

6. Re-run `pnpm gatekeeper:workflow:inspect` for the remaining staged set. When no staged files
   remain, clean up any workflow artifacts:

   ```bash
   pnpm gatekeeper:workflow:cleanup
   ```

## Session Rules

- Session files under `.git/` are owned by `gatekeeper-workflow.mjs` only.
- If the workflow reports session invalidation, re-run `inspect` instead of editing `.git/`
  artifacts manually.
- `stage --domain` is the only supported way to create or refresh `.git/gatekeeper-s0.txt` and
  `.git/gatekeeper-s0-signature.json`.
- `scaffold --commit` is a compatibility path only. Prefer `commit --domain <id>` for all new
  automation and operator workflows.

## References

- [git-governance.md](../../docs/core/git-governance.md)
- [auto-fix.md](./auto-fix.md)
