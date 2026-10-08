# Git Governance: Branch, Commit and Release Policy

**Status:** Active

**Last Updated:** 2026-10-06

**Change Note:** Integration into `develop` uses merge commits (`--no-ff`), so each task stays a
separate, revertible unit and published history is never rewritten. Rebase is optional and only for
branches that were never pushed. Release pull request into `main` and fast-forward back-merge are
unchanged.

## Overview

This document is the single owner of branch, lane lifecycle, commit, integration and
production-promotion policy. Validation tiers are owned by
[`.agent/rules/gatekeeper.md`](../../.agent/rules/gatekeeper.md); Git-write authorization and
`path ≠ privilege` are owned by [`.agent/rules/git-safety.md`](../../.agent/rules/git-safety.md);
release versioning and changelog policy are owned by [`release-process.md`](release-process.md).

## Branches

- `develop` is the trunk. It accepts direct pushes from Integration that only add commits (merge
  commits included); Repository CI runs on every push and is the integration gate. It blocks
  deletion and non-fast-forward (history-rewriting) updates.
- `main` is production. It changes only through the release pull request from `develop`, which
  requires `Repository Policy` and `Application Suite`. Direct commits and pushes are blocked.
- Task branches (`feat/*`, `fix/*`, `candidate/*`) are ephemeral. Persistent lane branches are
  forbidden.
- Annotated tags (`vX.Y.Z`) mark releases.

## Four-Lane Worktree Model

Persistent native Git worktrees isolate parallel work. `<worktrees-root>` is the sibling
`<repo-dir>-worktrees/` directory, derived by
[`scripts/shared/worktree-lane.ts`](../../scripts/shared/worktree-lane.ts).

| Lane          | Path                           | Purpose                                    | Runtime | Port |
| ------------- | ------------------------------ | ------------------------------------------ | ------- | ---- |
| Integration   | repository root                | Idle on `develop`: integration and release | Local   | 4321 |
| `dev-local`   | `<worktrees-root>/dev-local`   | Primary feature/fix lane                   | Local   | 4321 |
| `dev-extra`   | `<worktrees-root>/dev-extra`   | Parallel Local lane                        | Local   | 4322 |
| `dev-preview` | `<worktrees-root>/dev-preview` | Preview validation lane                    | Preview | 4323 |

Lane cards with environment-file facts live in [`docs/core/worktrees/`](worktrees/). Runtime
defaults are described in [`docs/env-workflow.md`](../env-workflow.md); runtime connectivity is not
mutation authorization.

## Task Lifecycle

1. **Start** in an idle development lane (detached HEAD on `develop`, clean):

   ```bash
   git switch -c <task-branch> develop
   ```

   One active task = one branch = one worktree. Never switch, stash, reset, clean or repurpose
   another active lane. Integration may host a task assigned to it with the same command; return it
   to `develop` before integrating ([lane card](worktrees/integration.md)). Commits are never
   authored directly on `develop` or `main`.

2. **Stay current** when needed: `pnpm lane:sync` previews and `pnpm lane:sync -- --apply` fetches
   `origin/develop` and merges it into the task branch. `--ff-only` is available; `--rebase` is
   opt-in and refused once the branch exists on `origin`. `--apply` requires an open git-safety
   baseline matching the current branch and HEAD; the preview reports whether `--apply` would be
   refused and why.

3. **Integrate** from Integration, which keeps `develop` checked out (Git does not allow the same
   branch in two worktrees):

   ```bash
   git pull --ff-only origin develop
   git merge --no-ff <task-branch>
   git push origin develop
   ```

   Keep Git's default message (`Merge branch '<task-branch>' into develop`). Each merge commit is
   one task: `git log --first-parent develop` lists tasks, and `git revert -m 1 <merge>` reverts one
   as a unit. Resolve conflicts deliberately in the merge (never automatic `ours`/`theirs`), then
   run the applicable checks before pushing. Pushing a task branch to `origin` is optional; CI does
   not run on task branches.

   History rules: never force-push or rewrite `develop`, `main` or any branch already on `origin`.
   Rebase is allowed only for a branch that was never pushed. Squash merges are not used, because
   they drop the task's commit history.

4. **Release the lane** after integration:

   ```bash
   git switch --detach develop
   git branch -d <task-branch>
   ```

`pnpm ops worktree-status` reports every lane read-only. Astro uses the lane port with `strictPort`;
override it with `ASTRO_PORT`. Local-runtime lanes share the persistent Local Supabase database.

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
- Do not reference internal task numbers, phase identifiers, or project goals (e.g., `Goal 1`,
  `Goal 2`, `Phase 1`, `Sprint 3`). Commits must focus strictly on technical behavioral changes to
  the code.

Examples:

```text
feat(rsvp): add guest dietary restrictions to submission flow
fix(theme-editor): prevent duplicate palette saves
docs(git): document advisory commit warnings
refactor(theme): split invitation token parsing from page loader
```

Anti-patterns:

```text
feat(theme): improve things
chore(repo): misc changes
fix(rsvp): quick fix
refactor(core): apply changes
feat(observability): close Goal 1 contracts
fix(db): resolve Goal 2 audit findings
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

## Advisory Warnings

Subjective quality checks remain advisory. The repository warns, but does not block, when a commit:

- touches `3+` files and has no body,
- touches `3+` files and uses a non-bulleted body,
- spans multiple top-level repository areas such as `src/`, `docs/`, `tests/`, `supabase/`, or root
  config files,
- changes `10+` files and looks too broad for a single atomic intent.

Warnings are prompts to review the commit shape before pushing. They do not replace engineering
judgment.

## Ownership

| Owner                                     | Responsibility                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `.agent/plans/README.md`                  | Task Contract, Goal protocol, Handoff Contract, durable tracked plans               |
| `.agent/rules/gatekeeper.md`              | Validation tiers and review/remediation gates                                       |
| `.agent/rules/git-safety.md`              | Git-write authorization and `path ≠ privilege`                                      |
| `commitlint.config.cjs`                   | Commit message validation and quality rules                                         |
| `scripts/validate-commits.mjs`            | Commit-range commitlint replay plus advisory hygiene warnings                       |
| `.husky/pre-commit`                       | Detached-HEAD and `main` guard, staged-file checks                                  |
| `.husky/pre-push`                         | Commit-range validation and Git LFS handoff                                         |
| `.github/workflows/commit-validation.yml` | Policy, static/build, unit, database and browser jobs, aggregate result and metrics |

## Active Hooks and CI Sequence

1. `pre-commit` blocks detached HEAD and direct commits to `main`, then runs `pnpm lint-staged` and
   `pnpm test:changed`.
2. `commit-msg` runs `commitlint` against the pending commit message on all branches.
3. `pre-push` replays commitlint over the pushed range in one process with
   `scripts/validate-commits.mjs` (hygiene warnings stay advisory), then hands the ref updates to
   Git LFS. New task branches use the common ancestor with `origin/develop` as the range base.
   Exact-SHA visual certification belongs to Repository CI on the `develop` push;
   `pnpm validate:prepush` is an optional local preview.
4. `Repository CI` (`.github/workflows/commit-validation.yml`) runs on pushes to `develop`, on pull
   requests targeting `main`, and by manual dispatch. See the
   [validation procedure](validation-procedures.md#remote-ci-coverage-and-efficiency) for scope and
   the distinction from `pnpm run ci`.

Hooks never query database status; use `pnpm dbs` manually.

## Production Promotion

Agents use [`.agent/skills/branch-lane/SKILL.md`](../../.agent/skills/branch-lane/SKILL.md);
database-sensitive ranges route through
[`.agent/skills/database-parity/SKILL.md`](../../.agent/skills/database-parity/SKILL.md). Run every
step from Integration:

```bash
# 1. Open the release PR from a current develop and wait for the required checks
git pull --ff-only origin develop
gh pr create --base main --head develop --title "release: <primary outcome>"

# 2. Merge it in GitHub (merge commit), verify the deployment, then back-merge
git pull --ff-only origin develop
git merge --ff-only origin/main
git push origin develop

# 3. Tag the deployed main SHA
git tag -a vX.Y.Z -m "Release vX.Y.Z — summary"
git push origin vX.Y.Z
```

Rules:

- The back-merge is a fast-forward because `develop` already contains everything except the release
  merge commit. If it is refused, `develop` and `main` diverged: merge `origin/main` into `develop`
  (no rebase, no reset), resolve deliberately, validate, and push (`branch-lane` mode
  `sync-main-into-develop`).
- Release PR titles describe the primary shipped outcome. Bodies list included changes, material
  risks, visual/schema/content impact and separately authorized operations.
- Never rewrite or force-push `main` or `develop`; never use a bypass.
- Land hotfixes on `develop` first, then release.
- Rollback: revert on a task branch, integrate into `develop`, and release normally.
