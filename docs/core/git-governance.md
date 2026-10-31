# Git Governance: Branch, Commit and Release Policy

**Status:** Active

**Last Updated:** 2026-10-16

## Overview

This document is the single owner of branch, lane lifecycle, commit, integration and
production-promotion policy. Validation tiers are owned by
[`.agent/rules/gatekeeper.md`](../../.agent/rules/gatekeeper.md); Git-write authorization and
`path ≠ privilege` are owned by [`.agent/rules/git-safety.md`](../../.agent/rules/git-safety.md);
release versioning and changelog policy are owned by [`release-process.md`](release-process.md).

## Branches

- `develop` is the trunk. It accepts direct pushes from Integration that only add commits (merge
  commits included); Repository CI runs on every push and is the integration gate. It blocks
  deletion and non-fast-forward (history-rewriting) updates. Pull requests into `develop` (task
  branches and Dependabot updates) also run Repository CI before they are merged.
- `main` is production. It changes only through the release pull request from a fixed
  `candidate/vX.Y.Z` branch (a `develop` SHA, see [Production Promotion](#production-promotion)),
  which requires `Repository Policy` and `Application Suite`. Direct commits and pushes are blocked.
- Task branches (`feat/*`, `fix/*`, `docs/*`, `chore/*`) and release candidates (`candidate/*`) are
  ephemeral. `docs/*` is for changes to documentation, plans or agent guidance only; `chore/*` is
  for repository maintenance with no runtime effect (audits, retirements, dependency work, and
  changes that only add or adjust tests, fixtures or CI test jobs). No other prefix is allowed:
  `test/*`, `refactor/*` or `ci/*` branches are not used, even when the commits inside use those
  [types](#types) (for example, a branch that adds a CI job for the memories end-to-end tests is
  `chore/memories-e2e-ci`, and a branch that fixes a broken test is `fix/*`). Dependabot's own
  `dependabot/*` branches are the only exception. Persistent lane branches are forbidden.
- Annotated tags (`vX.Y.Z`) mark releases. The release session creates and pushes them within the
  release authorization once the promoted `main` SHA is verified.

## Lane model (Win + F5–F12)

Nine persistent native Git lanes isolate tasks. The executable source for lane ids, paths, runtime
defaults and ports is [worktree-lane.ts](../../scripts/shared/worktree-lane.ts). See the
[lane guide](worktrees/README.md) for the map and environment-specific cards.

Integration stays on `develop` for integration and authorized operations. External lanes host task
branches, including release checkpoint preparation. Lane roles are scheduling defaults, never access
privileges or domain restrictions. Do not create ad hoc lane directories. Unknown and temporary
checkouts, including app-managed checkouts, are read-only under the lane guard.

Runtime connectivity never authorizes database, publication or release mutations.

## Task Lifecycle

1. **Start** in an idle development lane (detached HEAD on `develop`, clean):

   ```bash
   git switch -c <task-branch> develop
   ```

   One active task = one branch = one worktree. Never switch, stash, reset, clean or repurpose
   another active lane. Integration never hosts ordinary task branches; use an explicitly assigned
   external lane, including for release checkpoint preparation. Commits are never authored directly
   on `develop` or `main`; Integration accepts merge completion on `develop` only.

2. **Stay current** when needed: `pnpm lane:sync` previews and `pnpm lane:sync -- --apply` fetches
   `origin/develop` and merges it into the task branch. `--ff-only` is available; `--rebase` is
   opt-in and refused once the branch exists on `origin`. `--apply` requires an open git-safety
   baseline matching the current branch and HEAD; the preview reports whether `--apply` would be
   refused and why.

3. **Integrate** through a GitHub pull request into `develop`, the standard path for every task:
   - The author pushes the task branch, opens the pull request and records it on the board task.
   - An agent other than the author reviews it at its exact head SHA (d183; the reviewer and the
     risk rule are in the [board rule](../../.agent/rules/board.md#working-rules-every-agent)).
     Under d282 a low-risk pull request by Claude (board, tooling, documentation or tests, nothing
     in invitations, the database, migrations, payments, secrets or Production) is reviewed by a
     Claude subagent with a clean context; medium and high risk keep Codex or Gemini. A new commit
     makes the review stale and needs a new round at the new SHA.
   - The coordinator merges with a merge commit (the only method the repository allows), pinned to
     the reviewed SHA, once the review is approved at that SHA, CI is green and the pull request is
     clean against `develop` (d100). A release in progress does not hold merges: it leaves from a
     fixed candidate, and what merges after the cut joins the next release (d289).

   The merge header, `Merge pull request #<n> from <owner>/<task-branch>`, names the branch, so
   every task has one merge commit named after its branch and reverts the same way:
   `git revert -m 1 <merge>`. Group a multi-step program into one task branch per step with several
   commits rather than one task per commit. Resolve conflicts deliberately by merging
   `origin/develop` into the task branch (never automatic `ours`/`theirs`), then run the applicable
   checks before pushing. CI runs on a task branch only through its pull request.

   A local merge from Integration, which keeps `develop` checked out (Git does not allow the same
   branch in two worktrees), is the exception for an urgent change the owner explicitly authorizes
   in the current task ([Git safety](../../.agent/rules/git-safety.md)); the coordinator lands it
   and CI then runs only after the push:

   ```bash
   git pull --ff-only origin develop
   git merge --no-ff <task-branch>
   git push origin develop
   ```

   It keeps Git's default message (`Merge branch '<task-branch>' into develop`). A task lands once:
   never both a pull request and a local merge for the same branch.

   To list the tasks that reached `develop`, filter the merge commits by header. Do not use
   `git log --first-parent develop` for this: until d289 each release fast-forwarded `develop` to
   the release merge on `main`, so older first-parent lines follow `main` and skip the task merges
   of those releases.

   ```bash
   git log --merges --format='%h %s' <since-tag>..origin/develop \
     | grep -E "into develop$|from [^ ]+/(feat|fix|docs|chore|dependabot)/"
   ```

   `<since-tag>` is the release tag to count from (for example `v0.26.0-beta.1`). The two patterns
   match a local merge (`Merge branch 'fix/x' into develop`) and a pull request merge
   (`Merge pull request #12 from <owner>/fix/x`). Sync merges into task branches, release pull
   requests (`from <owner>/candidate/vX.Y.Z`, formerly `from <owner>/develop`) and back-merges
   (`from <owner>/main`) drop out.

   Merge rules:
   - A branch name is used once. After its pull request or local merge, follow-up work starts a new
     branch from `develop` with its own name (`fix/platform-snapshot-reads`, not another push to
     `feat/platform-dashboard-ui`), even when GitHub already deleted the old remote branch.
   - A branch starts from `develop`, never from another task branch. When a task needs unmerged
     work, that work lands first; a pull request whose diff repeats another open pull request's
     commits is not opened.
   - Merge task branches only into `develop`. Never merge one task branch into another: when a task
     needs another task's work, integrate that task first and bring it in with `pnpm lane:sync`.
   - A sync merge (`origin/develop` into a task branch) that resolved conflicts replaces Git's
     `# Conflicts:` list with one line per file saying how the conflict was resolved.
   - Each Dependabot pull request lands as its own task (its `dependabot/*` branch, merged on its
     own), never inside an unrelated task branch.

   History rules: never force-push or rewrite `develop`, `main` or any branch already on `origin`.
   Rebase is allowed only for a branch that was never pushed. Squash merges are not used, because
   they drop the task's commit history.

4. **Release the lane** after integration:

   ```bash
   git switch --detach develop
   git branch -d <task-branch>
   ```

`pnpm ops worktree-status` reports every lane read-only; `--layout` prints only the lane table as
JSON, without inspecting other checkouts. Astro uses the lane port with `strictPort`; override it
with `ASTRO_PORT`. Local-runtime lanes share the persistent Local Supabase database.

## Branch and Worktree Hygiene

A branch is obsolete when it is merged into `origin/develop`, has no open pull request and no
worktree has it checked out. Obsolete branches are deleted, locally and on `origin`, by the session
that integrated them:

```bash
git branch -d <task-branch>                # never -D: -d refuses unmerged work
git push origin --delete <task-branch>     # only when the branch was pushed
```

A task merged through a GitHub pull request leaves its remote branch behind unless the repository
deletes head branches on merge; delete it in the same session. A pull request into `develop` or
`main` merges with a merge commit, never with squash or rebase.

Periodic sweep, read-only until each deletion is confirmed:

```bash
git fetch --all --prune --tags
git branch --merged origin/develop          # local candidates
git branch -r --merged origin/develop       # remote candidates
git worktree list                           # exclude branches checked out here
gh pr list --state open                     # exclude branches with an open pull request
```

Rules:

- A release uses two branches ([release process](release-process.md)): `chore/release-vX.Y.Z`
  carries the version and CHANGELOG into `develop` like any task, and `candidate/vX.Y.Z` points at
  the resulting `develop` SHA and never receives commits. GitHub deletes the candidate when its
  release pull request merges; a closed, unmerged candidate is deleted once a newer one replaced it.
- A task branch never tracks `origin/develop` as its upstream; `git status` then reports the trunk
  as the branch's remote and `git push` targets the wrong ref. Push with
  `git push -u origin <branch>`.
- Temporary agent checkouts are not lanes and are read-only. Existing branches, work and sessions
  remain user-owned; removal or migration needs explicit scoped authorization. Never create or
  repurpose a checkout automatically.
- Before treating a worktree as dirty, compare the modified files with their committed content. A
  worktree whose Git LFS filter is not active lists every LFS image as modified even when the
  content is identical (`sha256sum <file>` equals the `oid` in `git show HEAD:<file>`).
- Bringing a task branch up to date (`pnpm lane:sync`) is for a real need: a conflict, or work the
  task depends on. GitHub's "Update branch" button creates the same sync merge; do not use it only
  to make a pull request look current.
- Dependabot commits land through their own pull request or task branch, never inside an unrelated
  task branch (see the merge rules above).
- Only the nine lanes in the executable table host mutable work. Any additional lane requires an
  explicitly approved table and policy change, not an ad hoc directory.
- The session that merges a task releases its worktree in the same turn:
  `git switch --detach develop` in a lane, or the desktop app's clean-up for `.claude/worktrees/*`.
  Then it deletes the local branch with `git branch -d`.
- Integration runs `git pull --ff-only origin develop` after each merge it observes, so
  `git branch -d` can verify merged branches.

## Commit Contract

Every commit in this repository must follow these rules:

1. Keep the commit atomic.
2. Keep the commit within the [size limits](#commit-size).
3. Use a conventional-commit header with a required scope from the [scope list](#scopes).
4. Make the subject describe the most relevant change in concrete terms.
5. Explain what changes and why in the body when the change spans multiple files or modules.
6. Avoid generic or process-oriented language such as `wip`, `misc`, `tmp`, `fix stuff`, or similar
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

Signals that a commit must be split before it is pushed:

- The subject joins two outcomes with `and`, or lists three or more things:
  `retire past invitations and decouple definitions from demos` is two commits.
- A `refactor` also changes what guests, hosts, the database or the build see, such as dropping an
  environment variable fallback or making an optional schema field required.
- A configuration or security change rides inside a documentation commit, such as a `.gitignore`
  entry inside `docs(plans)`.
- A later commit of the same task undoes part of an earlier one. Fold it into the earlier commit
  while the branch was never pushed; otherwise write it as a `revert` that names the original commit
  (see [Revert commits](#revert-commits)).

## Commit Size

Size counts reviewable files and lines. `pnpm-lock.yaml`, binary files, images, visual snapshot
folders (`*-snapshots/`) and exact renames are not counted.

| Limit   | Reviewable files | Changed lines | Effect                                            |
| ------- | ---------------- | ------------- | ------------------------------------------------- |
| Warning | more than 15     | more than 600 | `validate-commits.mjs` warns; review the shape    |
| Hard    | more than 40     | —             | `pre-push` refuses the push; CI reports a warning |

The limits come from the commits between `v0.23.1-beta.1` and `v0.24.0-beta.1`: the median commit
changes 6 files and 123 lines, the 75th percentile 14 files and about 570 lines, and the 90th
percentile 42 files. Every commit above 40 files in that range mixed several intents or was a
mechanical sweep. Lines have no hard limit because a feature with its tests can be one intent at
2,000 lines; above 600 lines, prefer splitting by layer (data, API, UI).

A commit that must stay above the hard limit declares why with one trailer:

```text
Large-Change: rename
```

| Category    | Use it for                                                              |
| ----------- | ----------------------------------------------------------------------- |
| `rename`    | Moves or renames with only the import and path edits they require       |
| `format`    | An automatic formatter run with no logic change                         |
| `sweep`     | One mechanical replacement across many files (for example fixture data) |
| `retire`    | Deleting retired content and its tests, with no other change            |
| `generated` | Generated output that the tool rewrites as a whole (types, baselines)   |

The trailer only lifts the hard limit; the warning stays. Supabase migrations are written by hand in
this repository, so they always count.

## Commit Message Format

The repository uses Conventional Commits with a required scope:

```text
type(scope): specific subject
type(scope)!: specific subject      # breaking change
```

Supported types are enforced by `commitlint`.

### Header Rules

- At most 100 characters (`commitlint` blocks longer headers); aim for 72 so `git log --oneline`
  stays readable.
- Use the [type](#types) that matches the main change and a [scope](#scopes) from the list.
- Write the subject in the imperative with a lowercase first word and no final period: `add`,
  `drop`, `reject`, not `added`, `adds` or `Adding`.
- Name the concrete thing that changed and, when it fits, the effect:
  `fail closed when a deployment does not declare its identity`.
- Mark a breaking change with `!` before the colon and a `BREAKING CHANGE:` footer.
- Do not reference internal task numbers, phase identifiers, plan decision or step codes, or project
  goals (e.g., `Goal 1`, `Phase 2.1`, `Sprint 3`, `D5`, `F7`, `T0`) in the header, the body or the
  footers. Name what the code does instead: `mark the Workers migration decisions as taken`, not
  `Mark D1-D19 as decided`. `commitlint` blocks a process word followed by a number and warns on
  plan codes.

Examples:

```text
feat(rsvp): add guest dietary restrictions to submission flow
fix(dashboard): prevent duplicate palette saves
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

### Types

| Type       | Use it when the commit…                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| `feat`     | adds a capability guests, hosts, the owner or a script user can see or call    |
| `fix`      | corrects behavior that was wrong, including security and data-safety defects   |
| `refactor` | changes code structure with no behavior change anyone can observe              |
| `perf`     | makes something faster or lighter with no other behavior change                |
| `style`    | changes only the look: SCSS, tokens or profiles, no logic, copy or content     |
| `test`     | changes only tests, fixtures or accepted visual baselines                      |
| `docs`     | changes only documentation, plans or agent guidance                            |
| `build`    | changes the build output or toolchain: Astro/Vite config, adapters, `tsconfig` |
| `ci`       | changes the gates: workflows, hooks, `scripts/validate-*` and their wiring     |
| `chore`    | maintains the repository with no runtime effect: dependency bumps, retirements |
| `revert`   | undoes an earlier commit, fully or in part                                     |

`style` here means visual design changes, which is how this repository has always used it. A
formatter-only run is `chore(tooling)` with a `Large-Change: format` trailer when it is large.

Frequent ambiguous cases:

- **Database migrations:** `feat(db)` when the migration adds something the application reads,
  `fix(db)` when it corrects a grant, policy or routine, and `refactor(db)` when it drops objects
  nothing reads. Add `!` and a `BREAKING CHANGE:` footer when any deployed version or external
  caller still uses the dropped or renamed object. Name the migration and its rollout phase (expand
  or contract) in the body. A pgTAP-only change is `test(db)`.
- **Invitation presets and profiles:** a new preset is `feat(theme)`; a visual adjustment is
  `style(theme)`; a preset or profile that a published invitation still uses is never deleted
  without checking its validity window.
- **Invitation content:** a new or corrected invitation definition is `feat(content)` or
  `fix(content)` with the slug in the subject; retiring past invitations is `chore(content)`.
- **Agent guidance and plans:** `.agent/**` and `AGENTS.md` are `docs(agent)` or `docs(plans)`, even
  when the text changes how agents work.
- **CI workflows and validators:** `.github/workflows/**`, `.husky/**` and `scripts/validate-*` are
  `ci(<area>)`; a contract test that pins a workflow is `test(ci)`.
- **Dependencies:** routine bumps are `chore(deps)` or `chore(deps-dev)`; a bump that fixes a
  production defect is `fix(deps)` and its body names the defect.
- **Behavior removed on purpose:** removing a user-visible capability is `feat!` or `fix`, not
  `refactor`; renaming public URLs with redirects is `fix` or `feat`, not `refactor`.

### Scopes

Use one scope from this list. `commitlint` warns on any other scope.

| Scope                    | Covers                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| `invitation`             | Public invitation rendering: routes, sections, components         |
| `invitation-access`      | Validity window, disabled invitations, access gates               |
| `invitation-preparation` | Preparation contracts, readiness and owner decision packs         |
| `content`                | Invitation definitions and per-invitation data (slug in subject)  |
| `demos`                  | Demo catalog and demo routes                                      |
| `theme`                  | Presets, tokens, profiles and shared SCSS                         |
| `rsvp`                   | RSVP flow and confirmation                                        |
| `guests`                 | Guest lists and guest management                                  |
| `memories`               | Event memories add-on (application side)                          |
| `dashboard`              | Host and admin dashboard                                          |
| `engagement`             | Engagement analytics and ranking                                  |
| `tracking`               | Event capture, GA4 and CAPI delivery                              |
| `intake`                 | Client intake and invitation status workflow                      |
| `landing`                | Public marketing site                                             |
| `commercial`             | Orders, leads and payments                                        |
| `auth`                   | Sessions, login and CSRF                                          |
| `security`               | Headers, secrets, PII guards and owner identity                   |
| `seo`                    | Metadata, sitemap, robots and social previews                     |
| `runtime`                | Deploy identity, middleware, server platform helpers              |
| `images`                 | Image processing and transformers under `src/lib/images/`         |
| `hosting`                | Cloudflare adapter and platform configuration                     |
| `workers`                | Cloudflare Workers under `workers/`                               |
| `db`                     | Migrations, policies, routines, pgTAP and the rollout registry    |
| `env`                    | Environment variables and their documentation                     |
| `provisioning`           | Definition-to-database publishing: release, apply, hash baselines |
| `release`                | Version, CHANGELOG and release checks                             |
| `ops`                    | Operations CLI, runbooks under `docs/operations/`, cutovers       |
| `board`                  | Task board wrapper, configuration and the pinned board core       |
| `git`                    | Hooks, `commitlint`, lane sync and git-safety tooling             |
| `ci`                     | Workflows and their contract tests                                |
| `validation`             | Static validators (`scripts/validate-*`)                          |
| `testing`                | Jest and Playwright configuration, fixtures and helpers           |
| `visual`                 | Visual parity, screenshot tooling and accepted baselines          |
| `tooling`                | Shared scripts and developer tooling not covered above            |
| `deps`, `deps-dev`       | Dependency updates (Dependabot uses these)                        |
| `agent`                  | `AGENTS.md`, `.agent/rules`, skills and templates                 |
| `plans`                  | `.agent/plans/**`                                                 |
| `governance`             | Policy documents under `docs/core/`                               |

Avoid the synonyms the history accumulated: `invitations` (use `content` or `invitation`),
`provision` (`provisioning`), `database` or `supabase` (`db`), `plan` (`plans`), `styles` or
`themes` (`theme`), `playwright` or `fixtures` (`testing`), `visual-parity` (`visual`), `server`,
`platform` or `middleware` (`runtime`), `cloudflare` (`hosting`), `operations` (`ops`), `core`
(`governance`), `screenshot` (`visual`), and client names such as `america` (`content`). Add a scope
to this list and to `commitlint.config.cjs` in the same commit when a new domain appears.

## Commit Body Policy

The body explains what changes and why, compared with the parent commit, not how the work was done.
Prose paragraphs and bullets are both fine; wrap lines at 72 characters (`commitlint` blocks lines
above 100) and leave one blank line after the header.

- `1-2` changed files: body is optional unless the intent is not obvious from the header.
- `3+` changed files: body is required.

Include these when they apply:

| Situation                   | The body says                                                         |
| --------------------------- | --------------------------------------------------------------------- |
| Runtime or environment      | Which behavior or variable changes and where it must now be declared  |
| Database                    | The migration file, its rollout phase (expand or contract) and grants |
| UI or visual                | What guests or hosts now see differently and which baselines changed  |
| Breaking change             | `BREAKING CHANGE:` footer: what breaks and what callers do instead    |
| Change to an earlier commit | `Refs: <sha>` footer and what part of it changes                      |
| Pull request or issue       | Optional `Refs: #<number>` footer                                     |

Footers go last, one per line: `BREAKING CHANGE:`, `Refs:`, `Large-Change:`, `Co-Authored-By:`.

Good example, from this repository's history:

```text
fix(security): read the owner review identity from SUPER_ADMIN_EMAILS

The owner allowed to confirm or clear owner review was a personal email
literal in application code and in the local DB scripts. The first
SUPER_ADMIN_EMAILS entry is now that owner: the runtime reads it on the
server, an unset list lets nobody record owner review, and the local
bootstrap only requires the list to be configured.

SUPER_ADMIN_EMAILS moves from the script-only category to typed server
runtime, so Preview and Production must declare it.
```

Poor example, from this repository's history: the type says `refactor`, but the commit undoes the
Family fix its own task had added twelve minutes earlier, and "nothing renders differently" is true
only against production, not against its parent:

```text
refactor(invitation): always print family roles and drop the unused hiding helper

The role-hiding helper never received the group title, so every delivered
invitation shows Madre, Padre, Madrina and Padrino under their group titles
and the owner keeps that. The helper and its call sites are removed instead
of fixing the call, so nothing renders differently.
```

The same change written correctly:

```text
revert(invitation): print family roles under their group titles again

The owner keeps "Padrino" under "Padrinos", as every delivered invitation
shows it, so the role-hiding call, its helper and its test are removed. The
itinerary and reply-card fixes of the same commit stay.

Refs: 18932b3cb
```

Acceptable bulleted body:

```text
fix(rsvp): guard duplicate confirmation emails

- src/pages/api/rsvp.ts: skip resend when the RSVP already has a delivered receipt
- src/lib/email/rsvp-confirmation.ts: return a duplicate-send outcome instead of throwing
- tests/rsvp-confirmation.test.ts: cover duplicate confirmation requests
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

## Merge, Release and Revert Commits

### Merge commits

Integration and sync merges keep Git's default header (`commitlint` ignores merge commits); see the
merge rules in [Task Lifecycle](#task-lifecycle). The release pull request is titled
`release: vX.Y.Z - <primary outcome>`, and GitHub keeps that title as the body of its
`Merge pull request #<n>` commit.

### Release commits

The checkpoint commit is `chore(release): publish vX.Y.Z checkpoint`, with one bullet for
`package.json` and one for `CHANGELOG.md`. Before writing it, complete the
[pre-tag checklist](release-process.md#release-checkpoint-discipline), which also checks every
CHANGELOG line against the final code of the range.

### Revert commits

Write reverts as `revert(<scope>): <what the code does again>` with the reverted commit in a
`Refs: <sha>` footer and the reason in the body. A partial revert says which part of the original
commit goes and which part stays. Reverting a task as a whole stays `git revert -m 1 <merge>` on a
new task branch; its header may keep Git's default `Revert "<original header>"`, followed by the
reason.

## Advisory Warnings

Subjective quality checks remain advisory. `scripts/validate-commits.mjs` warns, but does not block,
when a commit:

- touches `3+` files and has no body other than footers,
- spans three or more primary areas such as `src/`, `scripts/`, `supabase/`, `.agent/` or root
  config files (`tests/` and `docs/` accompany a change and are not counted),
- goes above the warning [size limit](#commit-size).

The hard size limit is the only shape rule that blocks, and only in `pre-push`, while the commits
can still be split. Repository CI reports it as a warning because pushed history is never rewritten.
Warnings are prompts to review the commit shape before pushing. They do not replace engineering
judgment.

## Ownership

| Owner                                     | Responsibility                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `.agent/plans/README.md`                  | Task Contract, Goal protocol, Handoff Contract, durable tracked plans               |
| `.agent/rules/gatekeeper.md`              | Validation tiers and review/remediation gates                                       |
| `.agent/rules/git-safety.md`              | Git-write authorization and `path ≠ privilege`                                      |
| `commitlint.config.cjs`                   | Commit message validation and quality rules                                         |
| `scripts/validate-commits.mjs`            | Commit-range commitlint replay, size limits and advisory hygiene warnings           |
| `.husky/pre-commit`                       | Detached-HEAD and `main` guard, staged-file checks                                  |
| `.husky/pre-push`                         | Commit-range validation with the hard size limit and Git LFS handoff                |
| `.github/workflows/commit-validation.yml` | Policy, static/build, unit, database and browser jobs, aggregate result and metrics |

## Active Hooks and CI Sequence

1. `pre-commit` blocks detached HEAD and direct commits to `main`, then runs the lane guard: unknown
   checkouts and direct commits on `develop` are refused, except a merge concluded in Integration.
   It then runs `pnpm lint-staged` and `pnpm test:changed`.
2. `commit-msg` runs `commitlint` against the pending commit message on all branches.
3. `pre-push` replays commitlint over the pushed range in one process with
   `scripts/validate-commits.mjs --strict-size` (the hard size limit blocks; other hygiene warnings
   stay advisory), then hands the ref updates to Git LFS. New task branches use the common ancestor
   with `origin/develop` as the range base. Exact-SHA visual certification belongs to Repository CI
   on the `develop` push; `pnpm validate:prepush` is an optional local preview.
4. `Repository CI` (`.github/workflows/commit-validation.yml`) runs on pushes to `develop`, on pull
   requests targeting `develop` or `main`, and by manual dispatch. See the
   [validation procedure](validation-procedures.md#remote-ci-coverage-and-efficiency) for scope and
   the distinction from `pnpm run ci`.

Hooks never query database status; use `pnpm dbs` manually.

## Production Promotion

Agents use [`.agent/skills/branch-lane/SKILL.md`](../../.agent/skills/branch-lane/SKILL.md);
database-sensitive ranges route through
[`.agent/skills/database-parity/SKILL.md`](../../.agent/skills/database-parity/SKILL.md). Run every
step from Integration:

```bash
# 1. Cut the candidate at the release SHA (a develop merge commit) and open the release PR
git fetch origin
git push origin <release-sha>:refs/heads/candidate/vX.Y.Z
git fetch origin
pnpm ops:release-checks <release-sha> --candidate candidate/vX.Y.Z
gh pr create --base main --head candidate/vX.Y.Z --title "release: vX.Y.Z - <primary outcome>"

# 2. Merge it in GitHub (merge commit, pinned to the release SHA), verify the deployment, then
#    merge main back into develop through a pull request
gh pr create --base develop --head main --title "chore(release): merge vX.Y.Z back into develop"
git pull --ff-only origin develop   # after the back-merge pull request merges
```

3. In the same turn that `pnpm ops:release-status` reports `VERIFIED` for the deployed `main` SHA,
   the release session tags it and pushes the tag following
   [Create and push the annotated tag](release-process.md#7-create-and-push-the-annotated-tag). The
   release authorization already covers this step; it is not a separate owner step.

Rules:

- `develop` is never frozen for a release (d289). The candidate is fixed on one `develop` SHA;
  merges into `develop` continue and reach `main` with the next release.
- The back-merge is an ordinary pull request from `main` into `develop`, merged with a merge commit
  pinned to its head and reviewed like a low-risk task: its only new commit is the release merge,
  whose tree equals the candidate. It never rewrites history and it lands before the next candidate
  is cut (`ops:release-checks --candidate` refuses a SHA that does not contain `origin/main`). If it
  conflicts, `main` received something outside a release: resolve it on a task branch through
  `branch-lane` mode `sync-main-into-develop` (no rebase, no reset).
- A release pull request into `main` exists only for a checkpoint: the candidate carries a new
  `package.json` version and its CHANGELOG entry. Without one, the pull request is not opened. A
  title without a version (`release: promote candidate <sha> to main`) is refused in review.
- Release PR titles name the version and the primary shipped outcome. Bodies list included changes,
  material risks, visual/schema/content impact and separately authorized operations.
- Never rewrite or force-push `main` or `develop`; never use a bypass.
- Every release merge on `main` gets its version tag, created and pushed to `origin` by the release
  session within the release authorization. `git ls-remote --tags origin` must list each local
  `vX.Y.Z` tag.
- `archive/<topic>-<YYYY-MM-DD>` annotated tags keep recovery points for history that no branch
  holds any more (for example a stash or a retired lane state). Push them when the history must
  survive this machine; never reuse the `v` prefix for them.
- Land hotfixes on `develop` first, then release.
- Rollback: revert on a task branch, integrate into `develop`, and release normally.
