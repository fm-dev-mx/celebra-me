---
name: commit-planner
description:
  Analyze repository Git changes and plan atomic commits that follow this repository's commit
  policy. Use when preparing commits, splitting a large diff, reviewing whether a change is atomic,
  grouping staged or unstaged changes into commit units, drafting or improving commit messages, or
  deciding which edits should not be committed together. Inspect `git status`, `git diff`, and `git
  diff --cached`, then propose commit boundaries, excluded changes, and Conventional Commit messages
  with required scopes that match `docs/core/git-governance.md` and `commitlint.config.cjs`.
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
