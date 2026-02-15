---
description:
    Commit workflow aligned with current Gatekeeper and Husky hooks, scoped to staged snapshot.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-02-15
---

# Gatekeeper Commit Workflow

This workflow governs commit preparation and commit execution for staged changes only. It is
authoritative for staged-snapshot ADU commits and is aligned with current project behavior.

## Source of Truth

- `.agent/GATEKEEPER_RULES.md`
- `scripts/gatekeeper.js`
- `.husky/pre-commit`
- `.husky/commit-msg`
- `.husky/pre-push`

## 1. Responsibility Matrix

`pnpm gatekeeper` (Gatekeeper script):

- Validates forbidden files in staged set.
- Lints staged `js/ts/tsx/astro` and `scss/css`.
- Runs `pnpm type-check` only in `strict` mode and only if staged files include `ts/tsx/astro`.
- For boundary blocking phases, uses AST import coverage for `import`, `export from`, `require()`,
  and `import()`.
- If AST parse fails for a file, fallback detection is report-only (warning), never silent blocking.

`.husky/pre-commit`:

- Blocks direct commits on branch `main`.
- Runs `lint-staged` autofix on currently staged files.

`.husky/commit-msg`:

- Enforces Conventional Commits using `commitlint`.

`.husky/pre-push`:

- Runs `pnpm type-check && pnpm test`.

Mode policy:

- Canonical modes: `strict` (default) and `quick`.
- Legacy compatibility: `--mode minimal` behaves as non-strict today, but prefer `--mode quick`.
- Governance rollout phase is controlled via `--enforce-phase 1|2|3` (default from
  `.agent/gatekeeper/policy.json`).
- Reporting/baseline utilities:
    - `pnpm gatekeeper:report` for machine-readable report output.
    - `pnpm gatekeeper:baseline` to regenerate grandfather baseline hashes.
- Output controls:
    - `--output compact|normal|verbose` to control report verbosity.
    - `--max-findings <n>` to cap emitted findings and reduce noisy output.
    - `--changed-doc-token \"<token>\"` to enforce explicit documentation update evidence when
      needed.
- Documentation evidence defaults:
    - Require real staged diff for mapped docs.
    - Minimum `3` changed lines and `40` non-whitespace changed characters per required doc.
    - Optional token evidence (`Last Updated`, `Changelog`) when enabled.
- Emergency controls:
    - Global kill switch: `policy.killSwitch`.
    - Per-rule kill switch: `rules.<rule>.killSwitch`.
    - Runtime override: `GATEKEEPER_RULE_<RULE_ID>=off|warn|block` (always logged for audit).

Acceptance criteria:

- Workflow uses only current hook/script names and behavior.
- Workflow does not require redundant manual reruns of checks already guaranteed by Husky hooks.
- Workflow does not use obsolete naming as normative guidance.

## 2. Strict Scope Contract (`S0`)

Define and freeze scope at workflow start:

1. At time `T0`, define `S0` as the staged file set.
2. Freeze `S0` into a file under `.git/`:

    ```bash
    git diff --name-only --cached > .git/gatekeeper-s0.txt
    ```

3. All checks and commits in this run must operate only on files listed in `.git/gatekeeper-s0.txt`.
4. Ignore any changes introduced after `T0` for this run:
    - New unstaged changes are ignored.
    - Newly staged files not present in `S0` are ignored.
5. If non-`S0` files become staged later, unstage or exclude them before committing and log them as
   ignored for this run.

Acceptance criteria:

- The workflow explicitly states: ignore changes introduced after `T0`.
- Behavior is explicit for new unstaged and newly staged files.
- Commands and language are imperative and unambiguous.

## 3. Execution Flow (Non-Redundant)

1. Capture `S0` snapshot at `T0` and freeze it in `.git/gatekeeper-s0.txt`.
2. Sanity-check `S0`:
    - Confirm `S0` is not empty.
    - Review `S0` for forbidden artifacts before proceeding.
3. Run Gatekeeper once for this run:
    - Default: `pnpm gatekeeper`
    - Docs/trivial metadata only: `pnpm gatekeeper --mode quick`
    - Optional explicit phase: `pnpm gatekeeper --enforce-phase 2`
4. Partition `S0` into independent logical ADUs.
5. Commit ADUs sequentially using only files from `S0`.
6. Let Husky hooks execute automatically on each commit attempt.
7. Do not add extra manual lint/type/test commands unless you are troubleshooting a specific
   failure.

Acceptance criteria:

- Each step has a single clear purpose.
- Workflow avoids redundant checks already covered by hooks.
- Workflow keeps scope limited to `S0`.

## 4. ADU Commit Strategy (Mandatory)

Apply these rules to all commits generated from `S0`:

- Split `S0` into multiple commits when independent logical units exist.
- Every commit must be ADU: Atomic, Descriptive, Useful.
- Commit message language must be English.
- Use Conventional Commits format.
- Subject line must describe the most relevant change.
- Body must include brief context: what changed and why.
- Never use generic messages such as `fix stuff`, `updates`, or `misc`.

Template:

```text
type(scope): concise subject

- what changed
- why this was needed
```

Good examples:

- `fix(auth): enforce MFA gate in dashboard middleware`
- `refactor(login): isolate RSVP v2 UI state transitions`
- `docs(workflows): align gatekeeper commit flow with husky hooks`

Acceptance criteria:

- Strategy is executable without interpretation.
- Includes valid and invalid examples.
- Compatible with commitlint Conventional Commits checks.

## 5. Troubleshooting by Hook

Pre-commit blocks direct commit on `main`:

- Move work to a feature branch and retry.

`lint-staged` rewrites files during pre-commit:

- Restage only the affected files that belong to `S0`.
- Re-run commit without expanding scope outside `S0`.

Commit message rejected by `commitlint`:

- Rewrite commit message in valid Conventional Commits format.
- Keep message descriptive and specific.

Pre-push fails on `pnpm type-check` or `pnpm test`:

- Treat as push-gate failure, not commit workflow expansion.
- Fix the failing issue and push again; do not broaden commit scope beyond `S0` for the active run.

Acceptance criteria:

- Every failure path maps to current hook behavior.
- Remediation steps preserve `S0` scope.

## 6. Final Verification Checklist

- [ ] `S0` snapshot captured at `T0` in `.git/gatekeeper-s0.txt`.
- [ ] No non-`S0` files were included in commits for this run.
- [ ] Gatekeeper was executed once in selected mode (`strict` or `quick`).
- [ ] Independent logical units from `S0` were split into ADU commits.
- [ ] All commit messages are descriptive Conventional Commits in English.
- [ ] Husky hooks passed for each accepted commit.

Acceptance criteria:

- Checklist is binary and auditable.
- Wording is concrete and non-ambiguous.

## 7. Validation Scenarios for This Workflow

1. Mixed staged set with two logical units (example: UI + middleware). Expected: two ADU commits,
   both scoped to `S0`, no generic messages.
2. New file staged after `T0`. Expected: file is explicitly ignored or unstaged for this run.
3. Docs-only staged set. Expected: `quick` mode is valid; no manual duplicate type-check in commit
   workflow.
4. Commit attempt on `main`. Expected: blocked by pre-commit, workflow directs to feature branch.
5. Invalid commit title (example: `updates`). Expected: commitlint failure and message rewrite.
6. `lint-staged` autofix modifies files during pre-commit. Expected: restage only `S0` files and
   retry commit without scope drift.
