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
need a manual validation pass before inspecting. Resolve commands by existence, not by guesswork:
each `pnpm <script>` candidate is valid only when that script exists in `package.json`. The current
fallback resolution order is:

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
     - Do not run `stage`, `scaffold`, or `commit` until `inspect` returns `proceed_adu`.
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

   `scaffold` is non-mutating by default. It is only valid after `workflowRoute=proceed_adu`. It
   emits full relative paths in body bullets and those paths should not be manually shortened with
   `...`.

5. Commit the staged split with the workflow-owned commit command:

   ```bash
   node .agent/governance/bin/gatekeeper-workflow.mjs commit --domain <domain-id>
   ```

   **CRITICAL: Atomicity & Precision Protocol** Commit messages must strictly follow this
   mathematical contract. Before proceeding to commit, the AI agent MUST perform this Chain of
   Thought:

   **1. Atomicity Verification ("Split or Die")**
   - Read the staged diff for the current domain.
   - Count the isolated logical intents. If `Intents > 1` (e.g., mixing a bugfix with a refactor),
     you MUST ABORT the commit phase. Inform the user of the atomicity violation and request a
     manual breakdown (`git reset` and `git add -p`).

   **2. Strategic Title Dominance**
   - Rank the architectural impact of the staged files (Core Logic > UI > Tests > Docs). The commit
     title (`type(scope): subject`) MUST reflect ONLY the #1 ranked intent.
   - **Stoplist (Banned Verbs)**: `update`, `fix`, `change`, `modify`, `improve`, `add`.
   - **Required Verbs**: `decouple`, `inject`, `extract`, `isolate`, `unify`, `normalize`,
     `deprecate`, `align`, `harden`.

   **3. Rigid File Formula (1:1 Mapping)**
   - The body MUST have exactly `Total_Bullets == Total_Changed_Files`.
   - Paths MUST be full relative paths (`...` is forbidden).
   - Bullet descriptions MUST strictly follow this syntactic formula:
     `[Technical Action Verb] [Specific Entity Modified] to/for [Architectural Purpose]`
   - _Example_:
     `- src/utils/email.ts: Inject nodemailer wrapper to decouple transport from UI layer.`
   - No generic filler text or bookkeeping descriptions allowed. Shorten descriptions if needed to
     satisfy line-length limits, but never shorten the path or omit the architectural purpose.
   - Deleted files use the deleted path; renamed files use the new path and mention the old path.

   Quick validation pass before executing `commit`:
   - [ ] Is it a single logical intent?
   - [ ] Does the title use a precision architectural verb from the allowed list?
   - [ ] Does every single file have exactly one bullet following the
         `[Action] [Entity] to [Purpose]` formula?
   - [ ] Are all lines under the length limit?

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
