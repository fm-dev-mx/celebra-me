---
name: staged-code-review-apply
description: |
  Apply fixes from a staged-code-review report after simplification and safety gates. Prefer
  deletion; block new abstractions. Auto-apply safe TS/JS/SCSS/JSON cleanups; never auto-apply SQL,
  production, or governance docs. Does not stage or commit.
domain: workflow
version: 1.0.0
when_to_use:
  - Immediately after a staged-code-review report when the user says proceed / apply / adelante
  - User explicitly asks to apply staged-code-review fixes
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/rules/git-safety.md
  - A staged-code-review report exists in the current conversation
  - User explicitly asked to apply fixes
related_skills:
  - staged-code-review
  - commit-planner
  - git-stash-branch-cleanup
  - celebra-delegation-patterns
related_docs:
  - docs/core/git-governance.md
  - docs/core/project-conventions.md
---

# Staged Code Review Apply

Apply concrete fixes from a `staged-code-review` report only after Gates A/B/C pass. Prefer deletion
and net reduction. Leave the working tree dirty — never stage or commit.

## Preconditions

1. A `staged-code-review` report with file:line findings and actionable fixes is in context. If
   missing, stop and ask the user to run `staged-code-review` first.
2. User explicitly authorized applying fixes in this task.
3. Optional backup stash is allowed **only** if the user also authorized git stash in this task (see
   git-safety). If not authorized, skip stash and note that in the report.

## Backup (when stash is authorized)

```sh
git stash push -m "pre-staged-code-review-apply-<timestamp>" --include-untracked
git stash apply --index
```

`--index` is required so the user's staged state is restored. Document the stash name in the final
report. Recovery of old apply stashes: `git-stash-branch-cleanup`.

## Protected paths (never auto-modify / never auto-delete)

| Path                                             | Action                                 |
| ------------------------------------------------ | -------------------------------------- |
| `src/content/**`, `src/pages/**`, `public/**`    | Skip auto-delete; mention as protected |
| `src/layouts/**`                                 | Manual review only                     |
| `.agent/rules/**`, `.agent/briefs/**`, `docs/**` | Never auto-modify                      |
| `supabase/migrations/**`                         | Never touch                            |
| `.env*`, `*.env.local`                           | Never touch                            |

Before deleting any `.scss` file, search for `@use` / `@forward` consumers. If any exist, flag for
manual review instead of deleting.

Collect all proposed file deletions into one deletion manifest and ask once for confirmation before
deleting any files. Do not interleave per-file delete prompts mid-flight.

## Mode selection

| Condition                      | Mode                                                           |
| ------------------------------ | -------------------------------------------------------------- |
| <6 findings or all in ≤2 files | Sequential                                                     |
| ≥6 findings across ≥3 files    | Parallel validation/apply groups if runtime supports subagents |

Use [`celebra-delegation-patterns`](../celebra-delegation-patterns/SKILL.md) when parallel. Fall
back to sequential otherwise.

## Phase 1 — Parse report

Extract: file, line, issue, fix, priority, inferred type (SCSS / TS-JS / SQL / content / config).
Process HIGH → MEDIUM. Skip LOW unless trivially safe (single-line deletion or comment fix).

## Phase 2 — Gates (all three must pass)

### Gate A — Simplification (aggressive)

Pass if the fix removes dead code, deletes a dead file (+ cascade import cleanup), replaces
hardcodes with existing tokens, or reduces maintenance surface with **net line reduction**.

Fail if the fix grows the codebase, adds indirection, adds unused CSS variables, or is a pure
rename/restructure without removal.

### Gate B — Over-engineering (relaxed)

Reject only if the fix introduces **new** abstractions for hypothetical reuse: generic interfaces,
factories, registries, new packages, or single-use config systems. Consolidation and deletion are
allowed.

### Gate C — Safety

| Fix type                              | Action                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `.scss` / `.css`                      | Auto-apply when gates A/B pass                                                              |
| `.ts` / `.tsx` / `.js` / `.astro`     | Auto-apply for dead code / unused imports / deprecated exports; complex logic → flag        |
| `.json` content                       | Auto-apply duplicate/dead-field cleanup                                                     |
| `.agent/**`, `docs/**`                | Never auto-apply — flag                                                                     |
| SQL / migrations / production patches | Never auto-apply — flag                                                                     |
| Config / CI / Docker                  | Never auto-apply — flag                                                                     |
| Entire file deletion                  | Auto-apply only for clearly dead tests/components with no consumers after search; else flag |

User pre-approval of a specific fix approach in this conversation satisfies Gate C's manual-review
ask for that finding (still run Gates A/B).

## Phase 3 — Apply

For each approved fix (HIGH first):

1. Re-read the target file (line drift).
2. Apply the minimal edit. Prefer deletion.
3. Do not stage or commit.
4. After line deletions, clean blank-line residue in the touched region.

## Phase 4 — Verify

Match verification to what changed (see gatekeeper / `package.json`):

| Change                       | Command                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------ |
| TypeScript                   | `pnpm type-check` (or project equivalent)                                      |
| Lint / SCSS                  | `pnpm lint` / style lint scripts                                               |
| Mixed / deletions            | `pnpm build` when appropriate                                                  |
| Content schema               | `pnpm ops validate-schema` when available                                      |
| Touched `.agent/` or `docs/` | Doc integrity: escaped backticks, broken fences, truncated operational phrases |

Triage failures: fix regressions in files you modified; do not refactor untouched files for complex
pre-existing lint. Trivial one-line pre-existing lint may be fixed; complex issues → report only.

## Phase 5 — Result report

```md
## staged-code-review-apply — Result

### Applied (<count>)

- `path:line` — description

### Skipped (<count>)

- `path:line` — reason

### Flagged for manual review (<count>)

- `path:line` — reason

### Verification

- type-check / lint / build / doc integrity — PASS/FAIL with evidence

### Backup

- Stash: <name or "skipped — stash not authorized">
```

## Hard constraints

- Never `git add`, commit, tag, or push.
- Never auto-apply SQL or production patches.
- Prefer deletion over patching when both are safe.
- Prefer net reduction as the success metric.
