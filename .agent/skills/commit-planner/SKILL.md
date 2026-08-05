---
name: commit-planner
description: Full commit lifecycle: plan atomic commits, then optionally execute them after the user stages each unit. Use when preparing commits, splitting a large diff, reviewing atomicity, grouping staged/unstaged changes into commit units, drafting messages, committing what the user already staged, or recovering from common git accidents. Inspect `git status`, `git diff`, and `git diff --cached`, then propose commit boundaries, excluded changes, and Conventional Commit messages matching `docs/core/git-governance.md` and `commitlint.config.cjs`. Never stages or unstages — the user owns the index for visualization. Can commit after user confirmation when the staged set matches the plan.
domain: meta
version: 2.4.0
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

Plan commit units without creating commits automatically. Optionally execute commits **only after**
the user has staged each unit themselves and explicitly approved the plan. Treat
[`docs/core/git-governance.md`](../../../docs/core/git-governance.md) as canonical policy and
[`commitlint.config.cjs`](../../../commitlint.config.cjs) for enforced types, scopes, and length
limits.

**Report contract:** [`.agent/templates/agent-report-contract.md`](../../templates/agent-report-contract.md)
(sample: [`agent-report-samples.md`](../../templates/agent-report-samples.md)).

**Recovery / pitfalls (on demand):** [`references/recovery-and-pitfalls.md`](./references/recovery-and-pitfalls.md).

## Hard constraints

- Never mutate the index: no `git add`, `git add -p`, `git restore --staged`, `git reset` /
  `git reset HEAD` for staging/unstaging. Staging is **user-owned** so the owner can visualize
  changes before commit.
- Do not run `git commit` unless the user explicitly asks for commit creation / approves the plan
  **and** the intended paths are already staged by the user.
- In plans, suggest exact file paths for the **user** to stage — never directory-level globs; never
  imply the agent will run those commands.
- Never present `SKIP_BRANCH_PROTECTION` / `ALLOW_MAIN_PUSH` as routine plan options.
- Match the user’s language for report prose; commit subjects stay English per governance.
- Do not include recovery/pitfall dumps in routine plan reports.
- Recovery recipes that show `git add` / unstage are for the **user** (or only when the user
  explicitly authorizes that exact git write in the current task).

## Inspect First

1. Re-read [`docs/core/git-governance.md`](../../../docs/core/git-governance.md) and check
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
- mixing unrelated concerns in a single file (e.g. data attributes + copy refresh + export changes
  + test rewrite + comment fixes + line endings) — these must be split per hunk; tell the **user**
  to use `git add -p` (agent never runs it),
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

```md
# Commit plan

**Veredicto:** atomic | should split | ambiguous · <N> commits · CHANGELOG update Unreleased | n/a
**Árbol:** <dirty count> dirty · <staged count> staged

## Commit 1 — `type(scope): subject`

**Intent:** <one sentence>
**Incluye:** <paths or hunk boundaries>
**Fuera:** <exclusions + why> | No exclusions for this commit (only after full partition confirmed)
**Usuario stagea:** `git add <exact paths>` or `git add -p <file>` (user runs these — agent does not)

\`\`\`
type(scope): subject

- path: change
\`\`\`

## Decisión

<CTA once the user has staged Commit 1 (or asks to commit what’s already staged), OR one MCQ when
ambiguous / execute-scope / destructive recovery>
```

**Decision rules for this skill:**

- Unambiguous plan → CTA: user stages the listed paths, then ask the agent to commit (or stop).
- MCQ when atomicity is **ambiguous**, execute scope must be chosen, or recovery is destructive.
- Every MCQ: exactly `a` / `b` / `c` in relevance order; `a` = recomendado / safe. See contract.
- Do not MCQ between commits of an already approved plan.
- Never offer agent-run `git add` / unstage as an option.
- Recovery content: load [`references/recovery-and-pitfalls.md`](./references/recovery-and-pitfalls.md)
  only for that failure mode.

When proposing multi-commit sequencing, show for each commit: **user stages → inspect → ask agent
to commit → verify**. Do not list several `git add` groups as if the agent will run them in a batch.

## Commit Execution (plan → user stages → commit)

After the user approves the plan, the agent commits **only** what the user has already staged.
Between commits, wait for the user to stage the next unit — **do not** stage or unstage for them.

### Preconditions

- The user has explicitly approved the commit plan (said "si", "yes", "adelante", "do it").
- For the current commit unit, the user has staged exactly the intended paths (agent verifies with
  `git diff --cached --name-only` / `git status --short`). If staging is wrong or empty, **stop**
  and ask the user to stage — never `git add` / `git reset HEAD` to “fix” it.

### Per-commit procedure

1. **Verify staged set** — read-only. Confirm staged paths match this commit’s **Incluye**. If not,
   report the mismatch and wait.

2. **Commit** — only after the staged set is correct:

   ```sh
   # Pre-validate the message with commitlint (especially when using
   # --no-verify, which skips the commit-msg hook):
   echo "type(scope): subject" | pnpm exec commitlint --verbose 2>/dev/null \
     || { echo "❌ Commit message fails commitlint — fix before retrying"; exit 1; }
   git commit -m "type(scope): subject" \
     -m "- path/file: change" \
     -m "- path/other: other"
   ```

   - Use `--no-verify` only when the user authorized skipping hooks or a known infrastructure
     failure requires it (e.g. pnpm path crash on git-bash). On healthy hook environments, omit it.
   - Do NOT ask the user to confirm each commit message again — the plan was already approved.
   - Do NOT run `git add`, `git add -p`, `git add --renormalize`, or unstage between commits.
   - After each commit, CTA: user stages the next unit (paste the **Usuario stagea** lines), then
     say when to continue. Stop on hook rejection, merge conflict, or staging mismatch.

3. **Exact paths in user guidance** — never directory globs:

   ```
   ✅ git add src/components/home/Hero.astro src/components/home/Contact.astro
   ❌ git add src/components/home/
   ```

4. **Line-ending normalization** — tell the **user** to run when CRLF noise appears:

   ```sh
   git add --renormalize <file>
   git add <file>
   ```

5. **Final verification** — after the last commit (read-only + build as appropriate):

   ```sh
   git log --oneline -<N+1>
   git status --short
   pnpm run build
   ```
