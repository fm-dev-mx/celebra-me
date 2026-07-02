---
name: commit-planner
description: Full commit lifecycle: plan atomic commits, then optionally execute them. Use when preparing commits, splitting a large diff, reviewing atomicity, grouping staged/unstaged changes into commit units, drafting messages, committing staged changes, or recovering from common git accidents. Inspect `git status`, `git diff`, and `git diff --cached`, then propose commit boundaries, excluded changes, and Conventional Commit messages matching `docs/core/git-governance.md` and `commitlint.config.cjs`. Can also execute the commit after user confirmation.
domain: meta
version: 2.1.0
absorbed_skills: [commit-staged]
when_to_use:
  - Preparing commits or evaluating atomicity
  - Drafting or reviewing commit messages
  - Committing staged changes (plan → execute)
  - Recovering from common git accidents (wrong branch, bad message, pre-commit rejection)
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
related_skills: []
related_docs:
  - docs/core/git-governance.md
---

# Commit Planner

## Overview

Plan commit units for this repository without creating commits automatically. Treat
[`docs/core/git-governance.md`](../../../docs/core/git-governance.md) as the canonical policy and
use [`commitlint.config.cjs`](../../../commitlint.config.cjs) to avoid forbidden wording, missing
scopes, and generic subjects.

## Inspect First

1. Run `git status --short`.
2. Run `git diff --stat`, `git diff`, and `git diff --cached`.
3. Distinguish unstaged, staged, and untracked work before proposing commit boundaries.
4. If the diff is large, inspect likely boundaries by path or hunk before suggesting commit groups.

## Partition by Behavioral Intent

- Group changes by one behavioral intent, not by file count alone.
- Keep feature code with directly supporting tests and docs when they are required for the same
  shipped behavior.
- Split unrelated refactors away from feature or bug-fix work.
- Split formatting-only, rename-only, or mechanical cleanup edits away from logic changes unless the
  mechanical change is inseparable from the behavior change.
- Split broad cross-area changes when `src/`, `docs/`, `tests/`, `supabase/`, or root config files
  changed for different reasons.
- Treat a commit touching `10+` files or multiple top-level areas as suspect until the single intent
  is clearly defensible.
- Prefer practical coupling judgment over rigid heuristics: keep changes together only when
  reverting one without the other would leave the repository broken, misleading, or partially
  shipped.

## Call Out What Should Not Ship Together

For every proposed commit:

- list the included files or hunks,
- list the excluded files or hunks that belong elsewhere,
- explain the split boundary in one sentence.

Treat these as commit-hygiene red flags:

- mixing feature work with unrelated refactors,
- mixing formatting-only edits with logic changes,
- bundling docs, config, schema, or app changes that are not required for the same intent,
- "while I was here" edits,
- vague or process-oriented commit language.

Treat audit-only warnings as review prompts, not hard gates: `3+` files with no body, non-bulleted
bodies on multi-file commits, commits spanning multiple top-level areas, and very broad `10+` file
changes all deserve an explicit atomicity check.

## Draft Repository-Compliant Messages

Use `type(scope): specific subject`.

- Choose from the repository's enforced commit types: `feat`, `fix`, `docs`, `style`, `refactor`,
  `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Require a concrete `scope` in `kebab-case`.
- Make the subject describe the result, not the process.
- Name the most relevant changed thing concretely.
- Avoid vague language such as `misc`, `wip`, `fix stuff`, `quick fix`, `tweaks`, `improvements`,
  `changes`, `stuff`, or `things`.
- Avoid process language such as `apply changes`, `record`, or `process`.

## Apply the Body Policy

- `1-2` changed files: omit the body when the header already makes the intent clear.
- `3-5` changed files: prefer one bullet per file.
- `6+` changed files: use bullets per coherent module or change group.
- Keep bullets concrete and path-led: `- src/path: explain the actual change`.

## Structure the Response

When helping with commit planning, answer in this order:

1. `Atomicity verdict`: atomic, should split, or ambiguous.
2. `Proposed commit plan`: one entry per commit with included paths or hunk-level boundaries.
3. `Keep out of this commit`: explicit exclusions and why they belong elsewhere.
4. `Suggested messages`: header, optional body, and a brief rationale for the chosen type, scope,
   and subject.
5. `Staging guidance`: suggest partial staging or sequencing only; do not run `git commit` unless
   the user explicitly asks for commit creation.

## Optional: Commit Execution (plan → commit)

Only when the user explicitly asks to commit. Never auto-commit.

1. **Check staged state**

   ```sh
   git diff --staged --stat
   ```

   If nothing staged, tell the user and stop.

2. **Summarise and propose** — show a summary and propose a full message (subject + body bullets).
   Use multiple `-m` arguments to avoid shell quoting issues:

   ```sh
   git commit -m "type(scope): subject" -m "- path/file.ts: change" -m "- path/other.ts: other"
   ```

3. **Ask the user** to confirm or edit the proposed message.

4. **Execute the commit** with the final message. One `-m` per bullet line.

5. **Verify**
   ```sh
   git log --oneline -3
   ```

## Common Recovery Workflows

### Bad message or non-atomic commit

```sh
git reset --soft HEAD~1
# Fix staging, then re-commit
```

### Commit on wrong branch

```sh
git checkout <correct-branch>
git cherry-pick <sha>
git checkout <wrong-branch>
git reset --hard HEAD~1
```

Only safe when the source branch is local-only (not pushed to origin).

### Pre-commit hook rejection (lint-staged, stylelint, eslint)

Hooks run on **staged content**, not the working tree. After fixing files:

```sh
git add <every-file-you-fixed>
git commit  # retry
```

Verify with `git diff --cached -- <file>` to confirm the staged version carries the fix. Use
`git status --short` to confirm no unstaged modifications remain before retrying.

### One file with changes for multiple commits

Use interactive patch mode to stage only relevant hunks per commit:

```sh
git add -p path/to/shared-file.ts
# 'y' for hunks belonging to this commit, 'n' for others
```

After committing the first group, repeat `git add -p` for the next commit.

### Stash-pop merge conflicts

When stashing from one branch and popping onto another that modified the same files:

```sh
# Resolve by choosing the stash version
git checkout --theirs <conflicted-file>
# Or keep the branch version
git checkout --ours <conflicted-file>
git add <file>
git stash drop  # if stash was preserved
```

Verify with `git diff --cached` before committing.

## Pitfalls

- **Non-atomic commits**: mixing unrelated concerns (production code + docs + config) in one commit.
  Split into separate logical commits. Always run the atomicity check before proposing a plan.
- **Stale commit descriptions**: when fixing a prior bad commit, use `git reset --soft HEAD~1` to
  undo it while keeping changes staged, then re-stage and re-commit.
- **Re-stage after hook rejection**: pre-commit hooks (lint-staged, etc.) run on staged content.
  Always `git add` files after fixing hook-reported issues before retrying — never assume a
  working-tree fix alone will pass.
- **Hooks on the wrong branch**: `git stash` + branch switch + `git stash pop` can trigger husky
  hooks (rebase, pre-commit). Always verify which branch you're on after stash-pop with
  `git branch --show-current`.
- **Forbidden vocabulary**: avoid `wip`, `fix stuff`, `misc`, `various`, `tmp`, `temp`, `quick fix`,
  `minor changes`, `small fix`, `tweaks`, `improvements`, `adjustments`, `stuff`, `things` in commit
  messages. Also avoid process-oriented language: `record`, `scope`, `apply changes`, `process`. If
  a file path literally contains a forbidden word, describe the purpose instead of the literal path
  (e.g. "exclude generated working files" instead of "exclude .agent/tmp").
- **`git add -p` for shared files**: when a single file contains changes belonging to different
  commits, stage hunks separately with `git add -p` rather than staging the whole file.
- **Branch protection**: the pre-commit hook only rejects commits to `main`. Commits to
  `develop` and other branches pass through to commitlint + lint-staged normally. For approved
  exceptions to `main`, use `SKIP_BRANCH_PROTECTION=true git commit`. The pre-push hook also
  rejects pushes to `main` (override: `ALLOW_MAIN_PUSH=true git push origin main`).
- **Stash-pop merge conflicts**: when stashing from one branch and popping onto another that
  modified the same files, `git stash pop` reports merge conflicts (`UU` in `git status`).
  Resolve with `git checkout --theirs <file>` (stash version) or `git checkout --ours <file>`
  (branch version). Then `git add <file>` to mark resolved and `git stash drop` if preserved.
  Verify with `git diff --cached` before committing.
- **Stash across branches may advance develop**: the stash + branch switch + stash-pop cycle
  can trigger husky rebase hooks that fast-forward `develop`. Always verify the current branch
  after stash-pop with `git branch --show-current`. If `develop` was advanced accidentally, use
  `git reflog show develop` to find its prior position, then reset with
  `git checkout develop && git reset --hard <prior-commit>`.
- **SCSS pre-commit hooks (stylelint)**: lint-staged runs stylelint on staged SCSS files. Common
  rejections and fixes:

  * `no-invalid-position-at-import-rule` when adding CSS font imports to files with existing
    `@use` rules. **Fix**: use Sass `@use` with explicit `as` namespaces instead of `@import`:
    ```scss
    @use "@fontsource-variable/cormorant-garamond/index.css" as cormorant-garamond;
    @use "@fontsource/pinyon-script/400.css" as pinyon-script;
    ```
    The `as` namespace is required because `index.css` generates a colliding namespace and
    numeric segments like `400.css` generate an invalid Sass namespace. **Test first** with
    `pnpm build && pnpm lint` to catch these before the hook rejects.

  * `scss/comment-no-empty` — empty `//` lines as visual separators.
    **Fix**: remove empty comment lines or append text so every `//` line carries content.

  * `no-duplicate-selectors` — adding new properties to an existing selector by writing a new
    block instead of merging.
    **Fix**: merge new properties into the existing block and remove the duplicate block.

  * `max-nesting-depth` — exceeding the project limit (typically 3). Common pattern:
    `&::placeholder`, `&:hover`, or `option` inside `input` inside a class (depth 4+).
    **Fix**: extract to a sibling level-3 rule — e.g., `input::placeholder` instead of
    `&::placeholder` nested inside `input`. For `&:hover`, extract to `.parent:hover`.
    For `option`, extract to `.parent option`.
