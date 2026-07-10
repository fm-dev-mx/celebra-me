---
name: commit-planner
description: Full commit lifecycle: plan atomic commits, then optionally execute them. Use when preparing commits, splitting a large diff, reviewing atomicity, grouping staged/unstaged changes into commit units, drafting messages, committing staged changes, or recovering from common git accidents. Inspect `git status`, `git diff`, and `git diff --cached`, then propose commit boundaries, excluded changes, and Conventional Commit messages matching `docs/core/git-governance.md` and `commitlint.config.cjs`. Can also execute the commit after user confirmation.
domain: meta
version: 2.2.0
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

1. Re-read [`docs/core/git-governance.md`](../../../docs/core/git-governance.md) and check
   [`commitlint.config.cjs`](../../../commitlint.config.cjs) for current enforced rules
   (types, scopes, header-max-length, forbidden vocabulary).
2. Run `git status --short`.
3. Run `git diff --stat`, `git diff`, and `git diff --cached`.
4. Distinguish unstaged, staged, and untracked work before proposing commit boundaries.
5. If the diff is large, inspect likely boundaries by path or hunk before suggesting commit groups.
6. If required governance files such as `AGENTS.md`, `.agent/rules/gatekeeper.md`,
   `docs/core/git-governance.md`, or `commitlint.config.cjs` are missing or unreadable, stop before
   providing a final commit message. Report what could not be read and provide only a provisional
   plan.

## Partition by Behavioral Intent

- Group changes by one behavioral intent, not by file count alone.
- Keep feature code with directly supporting tests and docs when they are required for the same
  shipped behavior.
- Split unrelated refactors away from feature or bug-fix work.
- Split formatting-only, rename-only, whitespace-only, line-ending normalization, comment-only
  edits, or other mechanical cleanup away from logic changes unless the mechanical change is
  inseparable from the behavior change.
- Split broad cross-area changes when `src/`, `docs/`, `tests/`, `supabase/`, or root config files
  changed for different reasons.
- Treat a commit touching `10+` files or multiple top-level areas as suspect until the single intent
  is clearly defensible.
- Prefer practical coupling judgment over rigid heuristics: keep changes together only when
  reverting one without the other would leave the repository broken, misleading, or partially
  shipped.
- For landing or content-heavy changes, treat instrumentation markers, copy/content edits,
  interface/type visibility changes, tests, comment-only fixes, and line-ending normalization as
  separate intents unless the diff proves they are inseparable. In particular, do not bundle
  `data-*` screenshot/audit markers with copy refreshes, refactors, or test rewrites by default.

## Call Out What Should Not Ship Together

For every proposed commit:

- list the included files or hunks,
- list the excluded files or hunks that belong elsewhere,
- explain the split boundary in one sentence.

Never answer `Keep out of this commit` with only `Nothing`, `N/A`, or an equivalent blanket
statement when multiple commits are proposed. For each proposed commit, list the major staged paths
or hunks that must stay out of that commit and explain why they belong to another commit. If all
files are assigned across the full plan, say that at the plan level only after per-commit exclusions
are listed.

Treat these as commit-hygiene red flags:

- mixing feature work with unrelated refactors,
- mixing formatting-only edits with logic changes,
- mixing line-ending normalization, whitespace-only, or comment-only edits with logic changes,
- bundling docs, config, schema, or app changes that are not required for the same intent,
- "while I was here" edits,
- vague or process-oriented commit language,
- mixing unrelated concerns in a single file (e.g. data attributes + copy refresh + export changes
  + test rewrite + comment fixes + line endings) — these must be split per hunk with `git add -p`,
- bundling frontend markup/attribute changes with backend interface or data-layer changes.

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
- Keep the full header (type + scope + subject) under the project's `header-max-length` limit.
  Check `commitlint.config.cjs` for the current value (as of writing: **130** characters). If
  the subject exceeds this, trim it or choose a shorter scope.
- Avoid vague language such as `misc`, `wip`, `fix stuff`, `quick fix`, `tweaks`, `improvements`,
  `changes`, `stuff`, or `things`.
- Avoid process language such as `apply changes`, `record`, or `process`.
  ✅ The commitlint regex was patched to allow `process.` (as in `process.env`), so
  Node.js runtime references no longer trigger false positives. Still avoid bare
  `process` as a verb (e.g. `process the data`).

## Apply the Body Policy

- `1-2` changed files: omit the body when the header already makes the intent clear. Exception:
  always include a body when the change touches critical infrastructure (auth, security, payments,
  data migrations, database schemas, deployment config, or git hooks), even if only 1–2 files
  changed. This ensures reviewers have context about risk without digging through the diff.
- `3-5` changed files: prefer one bullet per file.
- `6+` changed files: use bullets per coherent module or change group.
- Keep bullets concrete and path-led: `- src/path: explain the actual change`.
- **Wrap each body line at the project's `body-max-line-length` limit** (currently **140
  characters**). Break long bullets into continuation lines indented with 2 spaces. Example:

  ```
  - src/lib/tracking/commercial-presentation.ts:
    extract label maps, humanize functions,
    and technical/commercial split logic
  - src/pages/dashboard/commercial.astro:
    use shared attribution module
    with technical/commercial separation
  ```

  The commitlint rule `body-max-line-length: [2, 'always', 140]` is a **hard error** (severity 2).
  It is enforced at push time even in audit mode. Use `wc -c` or your editor's column ruler to
  check before committing. Each `-m` argument passed to `git commit` is a separate paragraph;
  lines within it must individually stay under the limit.

## Structure the Response

When helping with commit planning, answer in this order:

1. `Atomicity verdict`: atomic, should split, or ambiguous.
2. `Proposed commit plan`: one entry per commit with included paths or hunk-level boundaries.
3. `Keep out of this commit` (per commit entry): list excluded files, hunks, or patterns for
   each commit in the plan, with a one-sentence rationale per exclusion. If a proposed commit
   has zero exclusions, state "No exclusions for this commit" only after confirming the entire
   diff was partitioned across the plan's commits. Never answer with a bare "Nothing" — every
   commit boundary implies something was left behind; name it.
4. `Suggested messages`: header, optional body, and a brief rationale for the chosen type, scope,
   and subject.
5. `Staging guidance`: suggest exact file paths (e.g. `git add src/lib/auth.ts src/pages/login.tsx`),
   never directory-level globs like `git add src/data/ tests/unit/`. If staging spans multiple files,
   list each path explicitly. Where hunks within a single file belong to different commits, suggest
   `git add -p path/to/file.ts` with hunk-by-hunk guidance. Do not run `git commit` unless the user
   explicitly asks for commit creation.

   When proposing staged sequencing after `git reset HEAD`, show a complete stage → inspect →
   commit → verify boundary for each commit. Do not list several `git add` groups in a row without
   the intervening commit commands or explicit user-confirmation checkpoints. Prefer exact file
   paths over broad directory adds. Use `git add -p` when a file contains hunks for more than one
   commit.

## Commit Execution (plan → commit)

Execute multi-commit plans silently once the user approves the plan. Do NOT ask for
confirmation between commits — the plan IS the approval.

### Preconditions

- The user has explicitly approved the commit plan (said "si", "yes", "adelante", "do it").
- The working tree has all changes unstaged (`git reset HEAD` first if everything was staged).

### Batch Execution Procedure

1. **Reset staging** — unstage everything so each commit stages only its own files:

   ```sh
   git reset HEAD
   ```

2. **Step through each commit** — for each commit in the plan, in order:

   ```sh
   # Stage only the files belonging to this commit
   git add <file1> <file2> ...
   # If line-ending normalization is needed first:
   git add --renormalize <file-with-crlf>
   git add <file-with-crlf>
   # Pre-validate the message with commitlint (especially when using
   # --no-verify, which skips the commit-msg hook):
   echo "type(scope): subject" | pnpm exec commitlint --verbose 2>/dev/null \
     || { echo "❌ Commit message fails commitlint — fix before retrying"; exit 1; }
   # Commit with the pre-approved message
   git commit --no-verify -m "type(scope): subject" \
     -m "- path/file: change" \
     -m "- path/other: other"
   ```

   - Use `--no-verify` when the pre-commit hook has a known infrastructure failure
     (e.g. pnpm path crash on git-bash). On healthy hook environments, omit it.
   - Do NOT ask the user to confirm each commit — the plan was already approved.
   - Do NOT stop between commits unless a commit fails (build error, hook rejection,
     merge conflict). In that case, report the failure and stop.

3. **Use exact file paths** — never directory globs:

   ```
   ✅ git add src/components/home/Hero.astro src/components/home/Contact.astro
   ❌ git add src/components/home/
   ```

4. **Line-ending normalization** — when a file has CRLF mixed with content changes:

   ```sh
   git add --renormalize <file>  # applies .gitattributes clean filter
   git add <file>               # stage the now-normalized file
   ```

   This prevents the full-file CRLF noise from appearing in the diff.

5. **Final verification** — after the last commit:

   ```sh
   git log --oneline -<N+1>   # show all commits plus the previous tip
   git status --short          # confirm clean working tree
   pnpm run build              # or equivalent — confirm build passes
   ```

## Common Recovery Workflows

### Before destructive commands

Before suggesting or executing destructive commands such as `git reset --hard`, verify the current
branch, pushed/unpushed state, working tree status, staged changes, and whether a backup branch or
stash is needed. Never execute destructive recovery commands without explicit user confirmation.

### Bad message or non-atomic commit

```sh
git reset --soft HEAD~1
# Fix staging, then re-commit
```

### Commit on wrong branch

**Pre-checks (run these before suggesting any destructive command):**

- Verify the wrong-branch commits have not been pushed: `git log --oneline origin/<branch>..<branch>`.
  If this returns any output, the commits have already been pushed — **do not use `git reset --hard`**.
  Use `git revert` instead.
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
  `develop` and other branches pass through to commitlint + lint-staged normally. The override
  variables `SKIP_BRANCH_PROTECTION=true` and `ALLOW_MAIN_PUSH=true` are emergency escape hatches
  — never present them as a routine staging or planning option in the commit plan. Only mention
  them when the user explicitly asks how to bypass protection or when documenting an already-approved
  exception. Every use must be flagged with a caution: "This bypasses branch protection — confirm
  with the team before running."
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
- **`body-max-line-length` (hard error with `--no-verify`)**: commitlint enforces
  `body-max-line-length: [2, 'always', 140]`. The `--no-verify` flag bypasses the commit-msg hook
  that normally catches this at commit time, so the error only surfaces during pre-push validation.
  Always pre-validate the message with `echo <message> | pnpm exec commitlint` when using
  `--no-verify`. Split any body line that exceeds 140 characters into continuation lines (see
  "Apply the Body Policy" above).
- **`process.env` false positive in `no-process-language`**: the subject rule previously flagged
  `process` in `process.env` because the regex `\bprocess\b` matched any standalone occurrence. The
  regex was patched in `commitlint.config.cjs` to exclude `process.` with a negative lookahead
  `(?!\.)`. Avoid re-introducing this issue — if a new subject uses `process` as a verb, it's still
  correctly flagged.
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
