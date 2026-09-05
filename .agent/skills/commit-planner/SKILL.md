---
name: commit-planner
description:
  Plan atomic commits from staged/unstaged changes, draft repository-compliant messages, and execute
  only exact Git operations explicitly authorized for the approved plan.
domain: meta
version: 2.6.0
absorbed_skills: [commit-staged]
when_to_use:
  - Preparing commits or evaluating atomicity
  - Drafting or reviewing commit messages
  - Committing after the user has staged the intended paths (plan → user stages → commit)
  - Recovering from common git accidents (wrong branch, bad message, pre-commit rejection)
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/templates/agent-report-contract.md
related_skills:
  - staged-code-review
  - staged-code-review-apply
  - branch-lane
  - git-stash-branch-cleanup
related_docs:
  - docs/core/git-governance.md
  - docs/core/release-process.md
  - .agent/templates/agent-report-contract.md
  - .agent/templates/agent-report-samples.md
---

# Commit Planner

## Mission

Plan commit units and execute them safely. Option A authorizes the agent to stage exact planned file
paths and execute atomic commits step-by-step according to the plan. Option B allows manual
step-by-step user staging. Treat
[`docs/core/git-governance.md`](../../../docs/core/git-governance.md) as canonical policy and
[`commitlint.config.cjs`](../../../commitlint.config.cjs) for enforced types, scopes, and length
limits.

**Report contract:**
[`.agent/templates/agent-report-contract.md`](../../templates/agent-report-contract.md) (sample:
[`agent-report-samples.md`](../../templates/agent-report-samples.md)).

**Recovery / pitfalls (on demand):**
[`references/recovery-and-pitfalls.md`](./references/recovery-and-pitfalls.md).

## Hard constraints

- Option A in decision prompts authorizes the agent to stage exact file paths
  (`git add <exact paths>`; unstage only separately authorized exact paths) and execute atomic
  commits step-by-step according to the plan.
- For Option A, staging mutations are strictly limited to the exact file paths listed in the
  approved plan. Never use directory-level globs (`git add src/components/`).
- Option B preserves manual user staging step-by-step.
- Do not run `git commit` without explicit plan approval / user authorization.
- Never present `SKIP_COMMIT_RANGE_VALIDATION` / `ALLOW_MAIN_PUSH` as routine plan options.
- Match the user’s language for report prose; commit subjects stay English per governance.
- Do not include recovery/pitfall dumps in routine plan reports.
- Recovery recipes that show `git add` / unstage are for the **user** (or only when the user
  explicitly authorizes that exact git write in the current task).

## Inspect First

1. Read [`docs/core/git-governance.md`](../../../docs/core/git-governance.md) and check
   [`commitlint.config.cjs`](../../../commitlint.config.cjs) for current enforced rules (types,
   scopes, header-max-length, forbidden vocabulary).
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
- mixing unrelated concerns in a single file (e.g. data attributes, copy refresh, exports, tests,
  comments, and line endings) — these must be split per hunk; tell the **user** to use `git add -p`
  (agent never runs it),
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
- Keep the full header (type + scope + subject) under the project's `header-max-length` limit. Check
  `commitlint.config.cjs` for the current value (as of writing: **130** characters). If the subject
  exceeds this, trim it or choose a shorter scope.
- Avoid vague language such as `misc`, `wip`, `fix stuff`, `quick fix`, `tweaks`, `improvements`,
  `changes`, `stuff`, or `things`.
- Avoid process language such as `apply changes`, `record`, or `process`. ✅ The commitlint regex
  was patched to allow `process.` (as in `process.env`), so Node.js runtime references no longer
  trigger false positives. Still avoid bare `process` as a verb (e.g. `process the data`).

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
  It is enforced at push time even in audit mode. Use `wc -c` or your editor's column ruler to check
  before committing. Each `-m` argument passed to `git commit` is a separate paragraph; lines within
  it must individually stay under the limit.

## CHANGELOG Awareness (milestones only)

Treat [`docs/core/release-process.md`](../../../docs/core/release-process.md) as the layered
changelog policy. When planning commits for a **product-visible milestone** or release checkpoint:

- Call out whether `CHANGELOG.md` `[Unreleased]` should gain a bullet in the same work unit.
- Keep per-client invitation detail in `docs/invitations/<slug>.md`; do not dump ops notes into the
  system changelog.
- Keep schema history in `supabase/migrations/`; summarize product impact only in the changelog.
- Do **not** require a changelog update for every atomic commit.

## Report template

Follow the shared contract. Shape:

````md
# Commit plan

**Veredicto:** atomic | should split | ambiguous · <N> commits · CHANGELOG update Unreleased | n/a
**Árbol:** <dirty count> dirty · <staged count> staged

## Commit 1 — `type(scope): subject`

**Intent:** <one sentence> **Incluye:** <paths or hunk boundaries> **Fuera:** <exclusions + why> |
No exclusions for this commit (only after full partition confirmed) **Usuario stagea:**
`git add <exact paths>` or `git add -p <file>` (user runs these — agent does not)

```text
type(scope): subject

- path: change
```

## Decisión

**¿Cómo quiere proceder?**

- **a)** `[Recomendado]` — **Autorizar al agente a ejecutar los commits según lo planeado**
  - **Objetivo:** Permitir que el agente realice las acciones necesarias en git (stage de los paths
    exactos; unstage solamente si la operación y sus paths están incluidos expresamente en el plan y
    creación de los commits atómicos).
  - **Pasos / Ej.:** El agente prepara y ejecuta Commit 1, luego Commit 2 de forma segura.

- **b)** **Ejecución manual paso a paso (el usuario stagea)**
  - **Objetivo:** El usuario stagea manualmente cada unidad en el index antes de que el agente cree
    el commit.
  - **Pasos / Ej.:** El usuario ejecuta `git add <paths>` para cada unidad.

- **c)** **Solo generar plan**
  - **Objetivo:** Conservar la propuesta sin realizar cambios ni commits.
  - **Pasos / Ej.:** Mantener el estado actual de Git.
````

**Decision rules for this skill:**

- Option A is `[Recomendado]`: Authorizes agent to perform exact path staging
  (`git add <exact paths>`; unstage only separately authorized exact paths) and atomic commit
  execution step-by-step according to plan.
- Option B: Manual step-by-step user staging.
- Option C: Plan only / do not commit.
- Ask only for a missing material decision or exact Git authorization; use the shared report
  contract.
- Do not MCQ between commits of an already approved plan.
- Recovery content: load
  [`references/recovery-and-pitfalls.md`](./references/recovery-and-pitfalls.md) only for that
  failure mode.

## Commit Execution (Option A: Agent-managed / Option B: User-staged)

When Option A is authorized by the user (or when the user explicitly requests executing all planned
commits):

### Per-commit procedure (Option A)

1. **Partition Index** — inspect the staged set before each commit. Preserve unrelated staged paths
   and partially staged hunks. If partitioning needs unstaging, use
   `git restore --staged -- <exact authorized paths>` only when that operation and those paths are
   explicitly included in the approved plan. Never reset the whole index. If unrelated staged work
   prevents the commit, stop that commit and request a bounded decision. Then stage only the exact,
   fully assigned paths for the current unit:
   ```sh
   git add <exact path 1> <exact path 2>
   ```
2. **Verify staged set** — read-only confirmation (`git diff --cached --name-only`).
3. **Pre-validate & Commit**:
   ```sh
   echo "type(scope): subject" | pnpm exec commitlint --verbose 2>/dev/null \
     || { echo "❌ Commit message fails commitlint — fix before retrying"; exit 1; }
   git commit -m "type(scope): subject" \
     -m "- path/file: change"
   ```
4. **Repeat** — proceed to the next commit unit in sequence.
5. **Final verification**:
   ```sh
   git log --oneline -<N+1>
   git status --short
   ```

### Procedure (Option B: User-staged)

1. User stages intended paths for the commit unit.
2. Agent verifies staged set matches plan (`git diff --cached --name-only`).
3. Agent pre-validates message and executes `git commit`.
4. Agent prompts user to stage the next unit.
