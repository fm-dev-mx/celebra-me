# Git Governance: Commit Policy

**Status:** Active  
**Last Updated:** 2026-03-24  
**Change Note:** Expanded commit governance into a practical policy and moved subjective checks to
audit-only warnings.

## Overview

This document defines the commit policy and validation workflow for the repository.

The repository relies on conventional commits, branch protection, local hooks, and pull-request
validation. Planning records under `.agent/plans/` remain useful for human coordination, but commits
are no longer staged or created through a dedicated governance runner.

The goal is to keep hard gates narrow and objective while still giving developers useful feedback
about commit hygiene.

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

| Owner                                     | Responsibility                                                      |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `.agent/plans/README.md`                  | Planning contract for `commit-map.json` records                     |
| `commitlint.config.cjs`                   | Commit message validation and quality rules                         |
| `scripts/validate-commits.mjs`            | Audit-only validation and commit-hygiene warnings for commit ranges |
| `.husky/pre-commit`                       | Branch protection and staged-file checks                            |
| `.husky/pre-push`                         | Audit-only commit-range validation before push                      |
| `.github/workflows/commit-validation.yml` | Pull request commit validation and docs link checks                 |

## Active Validation Sequence

1. `pre-commit` blocks direct commits to protected branches unless explicitly bypassed and runs
   `pnpm lint-staged`.
2. `commit-msg` runs `commitlint` against the pending commit message.
3. `pre-push` validates the pushed commit range with `scripts/validate-commits.mjs` in audit-only
   mode.
4. CI re-runs commit-range validation and documentation link checks for pull requests.

## Guarantees

- Commit messages must follow conventional-commit structure.
- Subjects must describe the actual change with a concrete target.
- Commit hygiene warnings stay non-blocking so developers still get feedback without hidden
  automation side effects.
- Branch protection remains in place for `main` and `develop`.
- Atomicity is expected by policy, but enforced through warnings and review rather than a rigid
  local gate.
