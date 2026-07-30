# Git Governance: Commit Policy

**Status:** Active  
**Last Updated:** 2026-07-26  
**Change Note:** Documents production-tip recovery when `main` drifts, points agents at
`branch-lane`, and notes `ALLOW_MAIN_PUSH` for local main pushes. Branch model remains develop trunk
/ main protected via fast-forward.

## Overview

This document owns the human branch, commit, release, and production-promotion policy. Validation
tiers are owned by [`.agent/rules/gatekeeper.md`](../../.agent/rules/gatekeeper.md); agent execution
rules are owned by [`.agent/rules/workflow.md`](../../.agent/rules/workflow.md).

The repository uses a **linear two-branch workflow** with annotated tags for releases and a
**four-lane worktree model**:

- `develop` is the active trunk for daily development. Direct commits are allowed.
- `main` is the protected production branch, updated only via fast-forward from `develop`.
- Persistent native Git worktrees (`celebra-me` root, `.worktrees/dev-local`,
  `.worktrees/dev-preview`, `.worktrees/dev-extra`) isolate Integration and three development lanes.
- Ephemeral task branches (`feat/*`, `fix/*`, `candidate/*`) are checked out in development lanes.
  Permanent lane branches are forbidden.
- Worktree location grants no environment privilege (`path ≠ privilege`).
- Runtime defaults: Integration / `dev-local` / `dev-extra` → Local Supabase; `dev-preview` →
  Preview Supabase via `.env.preview.local`. Runtime connectivity is not mutation authorization.
- Annotated tags (`vX.Y.Z`) mark versions/checkpoints.
- Release history is documented in `CHANGELOG.md`. Layered changelog policy (system vs invitation vs
  database) is owned by [`release-process.md`](release-process.md).

The repository relies on conventional commits, hook-based branch protection, local validation, and
CI push/PR validation. Planning records under `.agent/plans/` remain useful for human coordination,
but commits are no longer staged or created through a dedicated governance runner.

The goal is to keep hard gates narrow and objective while still giving developers useful feedback
about commit hygiene.

## Four-Lane Worktree Model

Celebra-me uses native Git worktrees to establish four persistent, reusable operational lanes:

1. **Integration** (`celebra-me` root): Canonical worktree on `develop`. Integration, release
   preparation, trunk operations. Runtime default: Local.
2. **dev-local** (`.worktrees/dev-local`): Primary feature/fix development on ephemeral task
   branches. Runtime default: Local.
3. **dev-preview** (`.worktrees/dev-preview`): Preview development and hosted-validation affinity
   lane on ephemeral task branches. Runtime default: Preview Supabase via `.env.preview.local`.
   Preferred lane for authorized Preview operations; path still grants no mutation privilege.
4. **dev-extra** (`.worktrees/dev-extra`): Additional parallel Local development lane on ephemeral
   task branches. Runtime default: Local.

Lane-specific operational cards (facts only; policy stays centralized):
[`docs/core/worktrees/`](worktrees/).

### Core Invariants

- **Worktrees are persistent**: Directory locations remain on disk. `.worktrees/` is gitignored.
- **Task branches are ephemeral**: Development lanes operate on normal task-scoped branches
  (`feat/*`, `fix/*`, `candidate/*`). Creating permanent branches like `dev-local`, `dev-preview`,
  `dev-lane`, or `val-lane` is strictly forbidden.
- **Worktree location does NOT grant environment authorization**: Being inside
  `.worktrees/dev-preview` does not give permission to mutate Preview or Production databases.
  Environment access is determined solely by explicit task scope, target environment, operation
  risk, and safety rules.
- **Runtime defaults are lane-specific**: Local lanes load `.env` / `.env.local`. The Preview lane
  overlays `.env.preview.local` and sets `CELEBRA_RUNTIME_TARGET=preview`. See
  [`docs/env-workflow.md`](../env-workflow.md).
- **Preview remains a validation environment for mutations**: Preview migrations, syncs, invitation
  updates, and E2E provision/publish still require explicit authorization and existing guards.
- **Production remains explicitly restricted**: Production mutations require explicit approval and
  must follow the fast-forward promotion workflow from `develop`.

### Canonical Lane Lifecycle

Every task assigned to a development lane (`dev-local`, `dev-preview`, `dev-extra`) follows this
lifecycle:

1. **Assign Task**: Verify that the targeted lane is idle (in `detached HEAD`) and clean. Create the
   task branch explicitly from `develop`:

   ```bash
   git switch -c <task-branch> develop
   ```

   _Never create a task branch implicitly from a lane's detached HEAD._

2. **Active Work**: Enforce the rule: `1 active task = 1 branch = 1 worktree`. An agent or developer
   must not switch, stash, reset, clean, or repurpose another active lane.

3. **Release Lane**: Once work is merged or preserved, detach the lane back to `develop`:
   ```bash
   git switch --detach develop
   ```
   Delete the task branch only after Git confirms it has been integrated:
   ```bash
   git branch -d <task-branch>
   ```

### Human Developer Ergonomics & Navigation

To navigate between worktrees efficiently in PowerShell, add the following function to your
PowerShell profile (`$PROFILE`):

```powershell
function lane {
  param(
    [ValidateSet('main', 'local', 'preview', 'extra')]
    [string]$Name = 'main'
  )

  $root = 'D:\code\celebra-me'
  $paths = @{
    main    = $root
    local   = "$root\.worktrees\dev-local"
    preview = "$root\.worktrees\dev-preview"
    extra   = "$root\.worktrees\dev-extra"
  }

  Set-Location $paths[$Name]
  git status -sb
}
```

Install / verify:

1. Open `$PROFILE` (`notepad $PROFILE` or your editor).
2. Paste the `lane` function above (update `$root` if your clone path differs).
3. Reload: `. $PROFILE`
4. Verify: `Get-Command lane`, then `lane preview` and confirm `pwd` / `git status -sb`.

_Note: Agents do not use shell functions and must always specify explicit working directory paths
(`cwd`)._

### Worktree Inspection Tooling

Inspect the state, active branch, detached HEAD, clean/dirty status, runtime default, and alignment
with `develop` across all four lanes at any time:

```bash
pnpm ops worktree-status
```

This command is strictly read-only and will never mutate Git history, worktrees, environment
variables, or database state.

### Concurrent Local Operations

To support concurrent work across worktrees without friction or collision:

- **Server Ports**: Astro/Vite automatically increments development server ports (e.g. `4321` for
  Integration, then the next free ports for other lanes).
- **Local Database**: Local-runtime worktrees share the persistent Local Supabase instance
  (`127.0.0.1:54322`).
- **Preview runtime**: `dev-preview` talks to the hosted Preview Supabase project by default; it
  does not share Local DB application state.
- **Disposable Test Database**: Ephemeral test operations spin up the disposable container
  (`127.0.0.1:54332`) on demand without affecting persistent local state.
- **Preview Mutations**: Concurrent Preview mutations and Vercel Preview deployments must be
  authorized per-task and coordinated to prevent environment collision.

## Commit Contract

Every commit in this repository must follow these rules:

1. Keep the commit atomic.
2. Use a conventional-commit header with a required scope.
3. Make the subject describe the most relevant change in concrete terms.
4. Keep the body concise and precise when the change spans multiple files or modules.
5. Avoid generic or process-oriented language such as `wip`, `misc`, `tmp`, `fix stuff`, or similar
   phrasing.

### What "Atomic" Means Here

An atomic commit represents one behavioral intent. It may touch multiple files, but those files must
support the same change.

Good atomic commits:

- Add one feature and its supporting tests.
- Refactor one module without mixing unrelated behavior changes.
- Update one documentation area to match one shipped code change.

Non-atomic commits:

- Mixing feature work with unrelated refactors.
- Combining formatting-only edits with logic changes unless the formatter change is inseparable.
- Bundling documentation, config, schema, and app changes that are not required for the same intent.
- Sweeping cross-domain edits that should have been split into smaller commits.

## Commit Message Format

The repository uses Conventional Commits with a required scope:

```text
type(scope): specific subject
```

Supported types are enforced by `commitlint`.

### Header Rules

- Use the commit type that best matches the main change.
- Use a concrete `scope` in `kebab-case`.
- Make the subject describe the result, not the process.
- Name the thing that changed, not vague placeholders such as `changes`, `stuff`, `messages`, or
  `work`.

Examples:

```text
feat(rsvp): add guest dietary restrictions to submission flow
fix(theme-editor): prevent duplicate palette saves
docs(git): document audit-only commit warnings
refactor(theme): split invitation token parsing from page loader
```

Anti-patterns:

```text
feat(theme): improve things
chore(repo): misc changes
fix(rsvp): quick fix
refactor(core): apply changes
```

## Commit Body Policy

The body should explain the meaningful changes, not narrate how the work was done.

- `1-2` changed files: body is optional unless the intent is not obvious from the header.
- `3-5` changed files: include one bullet per changed file.
- `6+` changed files: include one bullet per coherent file group or module.

Recommended format:

```text
feat(scope): short specific subject

- src/path: concrete change made
- tests/path: supporting coverage added
- docs/module: behavior note or usage update
```

Acceptable body examples:

```text
fix(rsvp): guard duplicate confirmation emails

- src/pages/api/rsvp.ts: skip resend when the RSVP already has a delivered receipt
- src/lib/email/rsvp-confirmation.ts: return a duplicate-send outcome instead of throwing
- tests/rsvp-confirmation.test.ts: cover duplicate confirmation requests
```

```text
docs(git): document commit body expectations

- docs/core/git-governance.md: define atomic commits and body rules for multi-file changes
- CONTRIBUTING.md: link contributors to the detailed commit policy
```

Poor body examples:

```text
feat(theme): update invitation theme files

Worked on the theme flow and cleaned up a few other areas while I was there.
```

```text
chore(repo): tweak project files

- stuff updated
- more fixes
```

## Audit-Only Warnings

Subjective quality checks remain advisory. The repository warns, but does not block, when a commit:

- touches `3+` files and has no body,
- touches `3+` files and uses a non-bulleted body,
- spans multiple top-level repository areas such as `src/`, `docs/`, `tests/`, `supabase/`, or root
  config files,
- changes `10+` files and looks too broad for a single atomic intent.

Warnings are prompts to review the commit shape before pushing. They do not replace engineering
judgment.

## Ownership

| Owner                                     | Responsibility                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `.agent/plans/README.md`                  | Contract for durable repository-tracked plans                                                    |
| `.agent/rules/gatekeeper.md`              | Validation tiers and review/remediation gates                                                    |
| `.agent/rules/workflow.md`                | Agent operating procedure and authorization handoff                                              |
| `commitlint.config.cjs`                   | Commit message validation and quality rules                                                      |
| `scripts/validate-commits.mjs`            | Audit-only validation and commit-hygiene warnings for commit ranges                              |
| `.husky/pre-commit`                       | Branch protection and staged-file checks                                                         |
| `.husky/pre-push`                         | Audit-only commit-range validation before push                                                   |
| `.github/workflows/commit-validation.yml` | Repository policy checks (commit messages, doc links) and full application suite (`pnpm run ci`) |

## Active Hooks and CI Sequence

1. `pre-commit` blocks direct commits to `main` unless explicitly bypassed and runs
   `pnpm lint-staged` on all branches. Commits to `develop` and other branches are allowed.
2. `commit-msg` runs `commitlint` against the pending commit message on all branches.
3. `pre-push` blocks direct pushes to `main` (override: `ALLOW_MAIN_PUSH=true`) and validates the
   pushed commit range with `scripts/validate-commits.mjs` in audit-only mode.
4. CI workflow `Repository CI` (`.github/workflows/commit-validation.yml`) runs on push to `develop`
   and on pull requests targeting `main`. It reports two parallel jobs with non-overlapping
   validation:
   - **Repository Policy** — commit-message range checks and `pnpm ops check-links`
   - **Application Suite** — canonical `pnpm run ci` (after Playwright Chromium install)
     Checkout/pnpm/Node/install setup is duplicated per job because GitHub Actions jobs do not share
     a workspace. Jobs are not linked with `needs`, so one job's failure does not cancel the other;
     the trade-off is duplicated setup and two runners instead of sequential short-circuiting.

## Guarantees

- Commit messages must follow conventional-commit structure.
- Subjects must describe the actual change with a concrete target.
- Commit hygiene warnings stay non-blocking so developers still get feedback without hidden
  automation side effects.
- Direct commits and pushes to `main` are blocked by local hooks (`pre-commit` / `pre-push`).
  `develop` is the active trunk — direct commits are allowed but commitlint and lint-staged still
  apply. Do not assume GitHub classic branch protection or repository rulesets are configured;
  verify live repository settings when required-check enforcement is needed.
- Atomicity is expected by policy, but enforced through warnings and review rather than a rigid
  local gate.

## Production Promotion

Agent-facing procedure (interactive orchestrator: default FF promote, optional release prep, sync
recovery, auto database-parity routing):
[`.agent/skills/branch-lane/SKILL.md`](../../.agent/skills/branch-lane/SKILL.md). Database-sensitive
ranges automatically invoke
[`.agent/skills/database-parity/SKILL.md`](../../.agent/skills/database-parity/SKILL.md) before
remote integration or promotion. This section remains the human Git policy SSOT.

### Preferred hotfix path

Land the fix on `develop`, validate, then fast-forward `main`. That keeps the invariant `main` ⊂
`develop` without a recovery merge.

### Fast-Forward Flow

When a release is ready:

```bash
# 1. Ensure develop is up to date and validated
git checkout develop
git pull --ff-only
pnpm run ci

# 2. Fast-forward main to match develop
git checkout main
git merge --ff-only develop

# 3. Tag the release
git tag -a vX.Y.Z -m "Release vX.Y.Z — summary"

# 4. Push main and the tag (local pre-push blocks main without the override)
ALLOW_MAIN_PUSH=true git push origin main
git push origin vX.Y.Z
```

Rules:

- `main` should remain a subset of `develop` — do not plan work that diverges `main` on purpose.
- `git merge --ff-only` fails if `main` has drifted; do not force-push to “fix” it.
- Tags are annotated (`-a`) to carry release metadata.
- Never rewrite or force-push `main` without explicit approval.
- Rollback: `git revert` on `develop`, then fast-forward promote again.
- Direct commits on `main` are blocked by `pre-commit`; promotion is FF-only from `develop`.

### Production tip recovery (when `main` drifted)

If `main` already contains commits that are not on `develop` (for example an emergency hotfix
committed directly to production), restore the invariant before the next FF promote:

1. Merge `main` into `develop` (no rebase, no reset-hard of trunk).
2. Resolve conflicts deliberately on `develop`.
3. Validate on `develop`, then resume the Fast-Forward Flow.

Agents use `branch-lane` mode `sync-main-into-develop` for that recovery. Prefer avoiding this path
by landing hotfixes on `develop` first.
