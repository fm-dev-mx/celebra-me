# Commit Planner — Recovery and Pitfalls

Load this reference only when handling a git accident, hook rejection, or destructive recovery — not
during routine plan reports.

**Index ownership:** recipes below that use `git add`, `git add -p`, unstage, or `git reset` are for
the **user** to run (or for the agent only when the user explicitly authorizes that exact git write
in the current task). Agents following `commit-planner` / review / apply must not stage or unstage
by default.

## Before destructive commands

Before suggesting or executing destructive commands such as `git reset --hard`, verify the current
branch, pushed/unpushed state, working tree status, staged changes, and whether a backup branch or
stash is needed. Never execute destructive recovery commands without explicit user confirmation.
Decision prompts must use exactly three options (`a`/`b`/`c`) in relevance order, with the safe
recommended option in `a` (see
[`.agent/templates/agent-report-contract.md`](../../../templates/agent-report-contract.md)).

## Bad message or non-atomic commit

```sh
git reset --soft HEAD~1
# Fix staging, then re-commit
```

## Commit on wrong branch

**Pre-checks (run these before suggesting any destructive command):**

- Verify the wrong-branch commits have not been pushed:
  `git log --oneline origin/<branch>..<branch>`. If this returns any output, the commits have
  already been pushed — **do not use `git reset --hard`**. Use `git revert` instead.
- Confirm the working tree is clean: `git status --short` must show nothing.
- Confirm no unpushed commits on other branches would be orphaned.

Only when all pre-checks pass:

```sh
git checkout <correct-branch>
git cherry-pick <sha>
git checkout <wrong-branch>
git reset --hard HEAD~1
```

Only safe when the source branch is local-only (not pushed to origin).

## Pre-commit hook rejection (lint-staged, stylelint, eslint)

Hooks run on **staged content**, not the working tree. After the agent (or user) fixes files in the
working tree, the **user** re-stages before retry:

```sh
git add <every-file-you-fixed>
git commit  # retry
```

Verify with `git diff --cached -- <file>` to confirm the staged version carries the fix. Use
`git status --short` to confirm no unstaged modifications remain before retrying. Agents must not
run `git add` unless the user explicitly authorized staging in this task.

## One file with changes for multiple commits

The **user** stages hunks with interactive patch mode:

```sh
git add -p path/to/shared-file.ts
# 'y' for hunks belonging to this commit, 'n' for others
```

After committing the first group, the user repeats `git add -p` for the next commit. Agents never
run `git add -p`.

## Stash-pop merge conflicts

When stashing from one branch and popping onto another that modified the same files:

```sh
# Resolve by choosing the stash version
git checkout --theirs <conflicted-file>
# Or keep the branch version
git checkout --ours <conflicted-file>
git add <file>
git stash drop  # if stash was preserved
```

Verify with `git diff --cached` before committing. After stash-pop, confirm the branch with
`git branch --show-current` (husky rebase hooks can advance `develop`).

## Pitfalls

- **Non-atomic commits**: mixing unrelated concerns (production code + docs + config) in one commit.
  Split into separate logical commits. Always run the atomicity check before proposing a plan.
- **Stale commit descriptions**: when fixing a prior bad commit, use `git reset --soft HEAD~1` to
  undo it while keeping changes staged, then re-stage and re-commit.
- **Re-stage after hook rejection**: pre-commit hooks (lint-staged, etc.) run on staged content.
  The **user** `git add`s fixed files before retrying — agents leave fixes unstaged unless staging
  was explicitly authorized.
- **Hooks on the wrong branch**: `git stash` + branch switch + `git stash pop` can trigger husky
  hooks (rebase, pre-commit). Always verify which branch you're on after stash-pop with
  `git branch --show-current`.
- **Forbidden vocabulary**: avoid `wip`, `fix stuff`, `misc`, `various`, `tmp`, `temp`, `quick fix`,
  `minor changes`, `small fix`, `tweaks`, `improvements`, `adjustments`, `stuff`, `things` in commit
  messages. Also avoid process-oriented language: `record`, `scope`, `apply changes`, `process`. If
  a file path literally contains a forbidden word, describe the purpose instead of the literal path
  (e.g. "exclude generated working files" instead of "exclude .agent/tmp").
- **`git add -p` for shared files**: when a single file contains changes belonging to different
  commits, the **user** stages hunks with `git add -p`; agents only document which hunks belong
  where.
- **Branch protection**: the pre-commit hook only rejects commits to `main`. Commits to `develop`
  and other branches pass through to commitlint + lint-staged normally. The override variables
  `SKIP_COMMIT_RANGE_VALIDATION=true` and `ALLOW_MAIN_PUSH=true` are emergency escape hatches — never
  present them as a routine staging or planning option in the commit plan. Only mention them when
  the user explicitly asks how to bypass protection or when documenting an already-approved
  exception. Every use must be flagged with a caution: "This bypasses branch protection — confirm
  with the team before running."
- **Stash-pop / branch drift**: see “Stash-pop merge conflicts” above; if `develop` advanced via
  husky, recover with `git reflog show develop` then
  `git checkout develop && git reset --hard <prior-commit>`.
- **`body-max-line-length` (hard error with `--no-verify`)**: commitlint enforces
  `body-max-line-length: [2, 'always', 140]`. The `--no-verify` flag bypasses the commit-msg hook
  that normally catches this at commit time, so the error only surfaces during pre-push validation.
  Always pre-validate the message with `echo <message> | pnpm exec commitlint` when using
  `--no-verify`. Split any body line that exceeds 140 characters into continuation lines (see body
  policy in `SKILL.md`).
- **`process.env` false positive in `no-process-language`**: the subject rule previously flagged
  `process` in `process.env` because the regex `\bprocess\b` matched any standalone occurrence. The
  regex was patched in `commitlint.config.cjs` to exclude `process.` with a negative lookahead
  `(?!\.)`. Avoid re-introducing this issue — if a new subject uses `process` as a verb, it's still
  correctly flagged.
- **SCSS pre-commit hooks (stylelint)**: lint-staged runs stylelint on staged SCSS files. Common
  rejections and fixes:

  - `no-invalid-position-at-import-rule` when adding CSS font imports to files with existing `@use`
    rules. **Fix**: use Sass `@use` with explicit `as` namespaces instead of `@import`:

    ```scss
    @use '@fontsource-variable/cormorant-garamond/index.css' as cormorant-garamond;
    @use '@fontsource/pinyon-script/400.css' as pinyon-script;
    ```

    The `as` namespace is required because `index.css` generates a colliding namespace and numeric
    segments like `400.css` generate an invalid Sass namespace. **Test first** with
    `pnpm build && pnpm lint` to catch these before the hook rejects.

  - `scss/comment-no-empty` — empty `//` lines as visual separators. **Fix**: remove empty comment
    lines or append text so every `//` line carries content.

  - `no-duplicate-selectors` — adding new properties to an existing selector by writing a new block
    instead of merging. **Fix**: merge new properties into the existing block and remove the
    duplicate block.

  - `max-nesting-depth` — exceeding the project limit (typically 3). Common pattern:
    `&::placeholder`, `&:hover`, or `option` inside `input` inside a class (depth 4+). **Fix**:
    extract to a sibling level-3 rule — e.g., `input::placeholder` instead of `&::placeholder`
    nested inside `input`. For `&:hover`, extract to `.parent:hover`. For `option`, extract to
    `.parent option`.
