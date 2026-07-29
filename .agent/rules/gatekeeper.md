# Gatekeeper Rules — Celebra-me

This document defines the provider-neutral **review/remediation and validation contract**.

It specifies:

- What must be blocked or fixed
- What can be safely auto-fixed
- What level of refactor is allowed
- When to switch to report-only mode
- How verification must be performed
- How results must be reported

These rules are **authoritative** unless explicitly overridden by the repository owner.

---

## 1) Scope of Operation

- The review/remediation process primarily operates on the current task scope and should inspect the
  actual diff that is being reviewed.
- If staged changes exist, prefer them as the clearest review boundary.
- It must prioritize keeping the repository **buildable and deployable**.

### Exception — Repository Hygiene

The agent may report files **outside the initial diff scope** when repository hygiene requires
attention, including:

- forbidden artifacts that may need removal,
- `.gitignore` updates that may prevent repeated artifacts.

Any such change outside the initial diff scope requires explicit repository-owner authorization and
must be explicitly reported as an extra action.

---

## 2) Hard Guards (Block or Fix Mandatory)

These rules are **non-negotiable**.

### 2.1 Artifacts and Accidental Files

Build outputs or scratch files must never be staged or committed.

Forbidden examples (non-exhaustive):

- `.astro/`
- `logs/`
- `dist/`
- `.vercel/`
- `coverage/`
- `*.log`
- `*.tmp`
- `diff.txt`
- `staged.diff` (outside `.git/`)

**Action:**

- If forbidden artifacts are staged or present, report them and ask for explicit authorization
  before unstaging, deleting, cleaning, or otherwise removing them.
- Do not run `git restore --staged`, `git clean`, `git reset`, or file-discard commands as automatic
  hygiene.
- Update `.gitignore` only when explicitly authorized and the artifact is repeatedly generated.
- Always report any authorized hygiene actions.

---

### 2.2 Staged Diff Handling

- Writing a diff file is allowed **only** at `.git/staged.diff`.
- Any `staged.diff` located in the repository root or tracked paths is considered an artifact and
  must be reported before removal.

---

### 2.3 Case-Sensitivity (Vercel / Linux Safety)

Casing inconsistencies are treated as bugs.

Rules:

- Block path changes that differ only by casing.
- Enforce consistent lowercase naming for folders unless a different convention is clearly
  established.

---

### 2.4 Server / Client Boundary (Astro)

Server-only code must not leak into client bundles.

Server-only indicators include:

- secrets or environment variables,
- Node.js APIs,
- external services (email, DB, queues, rate limiting).

Rules:

- Server-only code must not be imported by UI components or client islands (`client:*`).
- If violated, refactor so the UI calls a server entry point (e.g., API route).

No new features may be introduced while fixing boundary violations.

---

### 2.5 Public Assets Usage

Files under `public/**` must not be imported as modules.

**Rule:**

- Use URL paths or the project’s asset pipeline instead.

---

### 2.6 Styling System (SCSS Only)

- Tailwind must not be introduced.
- If Tailwind usage is found in the reviewed scope:
  - Remove it.
  - Replace it with an equivalent SCSS implementation.

**Constraints:**

- Preserve existing DOM structure and semantics.
- Markup may only change if required for accessibility or correctness.
- Scope SCSS changes to the affected component or feature.

---

### 2.7 Language Rules

- **Visible UI text:** Spanish only.
- **Code, types, variables, comments:** English only.

Mixed or English UI text introduced by the reviewed scope must be corrected.

---

### 2.8 Type Safety (No New `any`)

Type safety is enforced to prevent silent runtime risk and type drift.

Rules:

- Do not introduce new `any` (including `as any`).
- Prefer `unknown` + narrowing when types are not known at compile time.
- For untrusted object inputs (e.g., parsed JSON), prefer:
  - `unknown`, or
  - `Record<string, unknown>` with explicit narrowing.

`@ts-ignore` policy:

- Avoid `@ts-ignore`.
- If it is truly unavoidable, it must include a brief reason comment on the line above:
  - `// @ts-ignore -- <why this is safe/necessary>`

Legacy `any` handling:

- Existing `any` is allowed to remain unless touched.
- If the reviewed scope touches code where `any` is used, the agent should replace it **only when
  trivial** (e.g., `any` → `unknown` + safe narrowing), and must avoid large typing refactors.

Large Change Mode note:

- In Large Change Mode, the agent must **still block new `any`**, but should avoid non-trivial
  typing refactors.

---

### 2.9 Database Safety (Agent Command Blocking)

The persistent local database (`celebra-me-rsvp`) is protected state. Agents must never execute any
of the following commands, whether through pnpm wrappers or directly in the shell:

**Blocked commands (all targets):**

- `supabase db reset --local --yes` — destroys persistent local DB
- `supabase db reset --linked` — destroys linked remote/production DB
- `supabase db push --local` — overwrites local schema (use disposable)
- `supabase db push --linked` — mutates production schema (use `pnpm db:prod:migrate`)
- `docker volume rm supabase_db_celebra-me-rsvp` — deletes persistent Docker volume
- `docker compose down -v` with the persistent Supabase project — deletes volumes

**Blocked commands (production only):**

- `supabase db push --db-url <prod_url>` — mutates production
- `supabase migration up --db-url <prod_url>` — mutates production
- Any `psql` or SQL mutation against a production host (`*.supabase.co`, `*.supabase.com`)

**Allowed commands (disposable-test only):**

- `supabase db reset --workdir <disposable_dir>` — resets disposable test env
- `docker stop` / `docker rm` `celebra-me-test-db` — manages disposable container

**Enforcement limitation:** This repository has no shell-level or process-level interceptor that can
block raw commands outside the `pnpm` wrapper system. The Supabase CLI, Docker CLI, and psql are on
PATH and can be invoked directly by a developer or agent bypassing all guards. The blocks above are
enforced through:

1. **Executable guard**: `pnpm db:*` commands run through `scripts/db/db-guard.ts`
2. **Agent policy**: this document — agents must self-enforce these blocks
3. **Code protection**: `pnpm db:local:reset` is blocked, `pnpm db:local:refresh-from-prod` and
   `pnpm db:local:refresh-from-prod-preserve-local` are blocked, and all
   `supabase db reset --local --yes` calls have been removed from project scripts

If an agent is asked to run any blocked command, it must refuse and explain the safe alternative.
Unknown or ambiguous database targets must cause an immediate abort.

---

### 2.10 Operational Security & Alert Remediation Policy

When handling security scanner findings (CodeQL, SAST, dependency alerts):

1. **Data-Flow Analysis Required**: Perform full data-flow analysis (source, controls, sanitizers,
   sink) before changing code.
2. **Scanner Evasion Prohibited**: Semantically neutral changes designed solely to defeat pattern
   matching (such as hiding hash algorithm strings behind variables, wrapping functions to interrupt
   data flow, copying process.env, or repeatedly shifting comments) are strictly prohibited.
3. **Strict Suppression Rules**: Inline or workflow suppressions are permitted only when an alert is
   demonstrably non-exploitable or an intentionally accepted risk. Every suppression must specify
   the exact query ID, target location, classification, accepted risk justification, and regression
   evidence.
4. **CI Workflow Boundary**: A passing CI workflow does not prove zero remaining security alerts.
   All new security findings must be inspected directly even when CI succeeds.
5. **No Reactive Commit Chains**: Speculative trial-and-error commit chains are not allowed.
   Validate security fixes locally before committing, and consolidate history cleanly.
6. **Behavioral Testing Required**: Any security remediation affecting executable code must include
   behavioral unit or integration tests proving correctness and preventing regressions.

---

## 3) Allowed Actions

### 3.1 Auto-Fixes

The agent may automatically fix:

- broken or unused imports,
- obvious typing issues,
- **new `any` introduced by the reviewed scope** (replace with `unknown` + narrowing when safe),
- incorrect casing,
- UI strings violating language rules,
- Tailwind removal with SCSS replacement (within limits),
- minor accessibility issues.

---

### 3.2 Refactors (Bounded)

The agent may perform **small to medium refactors** provided that they:

- stay within the same feature or module,
- improve clarity or correctness,
- do not change public APIs,
- do not introduce new abstractions.

Cross-cutting or architectural refactors are not allowed.

---

## 4) Large Change Mode (Report-Only)

The agent must switch to **Large Change Mode** when any of the following apply:

- **≥ 25 files** are in scope, or
- **≥ 800 total lines** are changed (additions + deletions), or
- changes affect structural configuration or core folders (e.g. `src/pages`, `src/styles`,
  `tsconfig`, `astro.config`, `package.json`).

### Behavior in Large Change Mode

- Fix only:
  - build or deploy breakers,
  - hard guard violations (artifacts, casing, boundary leaks),
  - **new `any` introduced by the reviewed scope** (block/must-fix), avoiding non-trivial typing
    refactors.
- Report all other findings without applying changes.

---

## 4.5) Release and CHANGELOG Checkpoints

When the reviewed work is a **release checkpoint** or a clearly product-visible milestone:

- Require an explicit `CHANGELOG note:` verdict matching commit-planner: `update Unreleased` or
  `n/a — not a product milestone` (the latter is wrong for a release cut).
- For a release cut / tag, confirm the pre-tag checklist in
  [`docs/core/release-process.md`](../../docs/core/release-process.md) (real Unreleased bullets, no
  invitation ops dump, schema summarized only, promote + reset, version + tag alignment).
- Confirm `CHANGELOG.md` `[Unreleased]` (or the versioned section being cut) matches the layered
  policy in that same doc.
- Do not demand a changelog bullet for every commit or every migration file.
- Prefer invitation ops detail under `docs/invitations/` and schema history under
  `supabase/migrations/`.

---

## 5) Verification Protocol

### 5.1 Script Detection

- Read `package.json`.
- Detect available scripts dynamically.

### 5.2 Execution Order

Run the closest available match, **scaled to the change scope**:

**A) Small localized style/copy/asset changes — fast local confidence:**

```sh
pnpm validate:changed      # Agent default when the WORKING TREE matches task scope
pnpm agent:git-safety:check
```

Agents normally cannot stage changes, so `pnpm validate:changed` is the default fast path. It
validates tracked, staged, and untracked working-tree files without modifying the Git index. When
unrelated user-owned changes are present, do not let them widen validation scope: run the
corresponding lint, format, or related-test command against the explicit task files and report the
excluded pre-existing scope.

Use `pnpm validate:staged` instead only when the requested review boundary is explicitly the staged
index, such as a human pre-commit check. It does not look at unstaged edits and no-ops successfully
when there are no staged matching files. Do not run both commands for the same file set.

Prettier is intentionally **advisory** here: the repo carries pre-existing formatting debt in
reviewed files that is not part of the workflow change. Blocking on that debt would conflate scope.
ESLint, Stylelint, and related Jest are hard gates. New or modified files in the workflow commit
must still be formatted — advisory is not a license to commit unformatted code.

**B) Shared component, schema, adapter, render-data, routing, Supabase, or content-resolution
changes — broader local feedback:**

```sh
pnpm validate:changed      # ESLint + Stylelint + Prettier + related Jest on WORKING-TREE files
pnpm type-check            # When TS/Astro contracts, types, schemas, adapters, or routing can change
pnpm validate:event-parity # when event/content parity can be affected
pnpm agent:git-safety:check
```

Use `pnpm validate:changed` when you have unstaged edits you want feedback on before staging. Use
`pnpm test:changed` only as a standalone staged-source Jest check; do not run it after
`pnpm validate:changed`, which already runs related Jest tests. The unrelated-worktree scope rule
from Tier A also applies here.

`pnpm type-check` is required when executable TypeScript or Astro changes can affect shared
contracts, type flow, schemas, adapters, render assembly, or routing. It is not required for
documentation, copy-only, asset-only, or SCSS-only changes. Prefer focused domain validation when it
proves the changed contract more directly.

**C) Final pre-push / pre-deploy confidence (full validation, do not skip):**

```sh
pnpm type-check
pnpm validate:structure
pnpm lint
pnpm lint:styles
pnpm validate:ui-governance
pnpm validate:event-parity
pnpm validate:no-pii
pnpm test
pnpm test:e2e:ci
pnpm build
pnpm agent:git-safety:check
```

`pnpm ci` is the canonical full-pipeline equivalent of tier C. It runs `pnpm build:app`
(`astro build`) after its earlier type-check to avoid duplicating the check. `pnpm ci:quick` runs
`astro check`, deterministic structure validation, and a scoped ESLint pass and is for fast feedback
only; it is **safe in CI** (it does not depend on local Git staging state) but **must not** replace
tier C for production-sensitive changes.

The pre-push hook intentionally remains lean (commit-message validation only); do not move tests or
type-checks into pre-push.

### 5.3 Visual evidence (screenshots and browser proof)

Choose the evidence class **before** launching screenshot or browser tools. This section owns
proportional visual validation; [`scripts/screenshot/README.md`](../../scripts/screenshot/README.md)
owns tool mechanics and flags.

| Change class | Evidence class | Minimum sufficient proof |
| --- | --- | --- |
| Material layout, reveal, hero, or section composition | **Required** | Same route; primary viewport (`mobile-standard` unless desktop-only); smallest target (`--sections=<id>`, `--set=reveal-only`, or a single affected step); reuse an already-running `pnpm dev` |
| Reference-driven redesign closing an approved brief | **Required** (scoped) | Viewports listed in the brief — not an automatic five-viewport or full interactive default |
| Work under [`docs/domains/theme/section-intersections.md`](../../docs/domains/theme/section-intersections.md) | **Required** | Follow that domain matrix only for intersection work; **do not** generalize it to all UI |
| Copy-only, token/color without layout, docs, backend | **Unnecessary** | Skip screenshots |
| Selector presence, overflow, or simple DOM checks | **Replaceable** | Browser snapshot, CDP/`getBoundingClientRect`, or a focused Playwright assert |
| Habitual `full-qa` / `all-sections` / full profile / all invitations | **Reducible** | Prefer one viewport; widen only after a failed or inconclusive minimum pass, or when the owner asks for a full audit |

Rules:

- Default capture when screenshots are justified: **one route × one viewport × smallest target**.
  Use full `critical-qa` / multi-viewport / `all-sections` only when reveal+open composition is in
  scope, a brief/domain doc requires it, or the minimum pass failed.
- Do not `Read` screenshot binaries en masse. Cite artifact paths; open only images needed for a
  Pass/Fail call. Prefer `report.json` for coverage metadata.
- Reuse an existing server; do not start parallel full screenshot batches against a cold Vite
  optimize-dep without need.
- Preserve full visual proof when risk justifies it (invitation ship QA, section-intersection
  acceptance, reference-driven acceptance). Do not weaken required coverage for those cases.
- Name the validation tier (A/B/C) and any visual-evidence skips in the closing report.

---

## 6) Output Contract

### 6.1 Clean Changes

If no issues are found:

- Reply with: `✅ **LGTM** — <one short reason>`
- Output **one** Conventional Commit message (English, present tense).

---

### 6.2 Fixed Issues

If fixes were applied:

- List corrected files.
- For each file: violation + fix (brief).
- End with **one** Conventional Commit message:

```bash
type(scope): summary
```

Prefer `fix` or `refactor` when acting as Gatekeeper.

---

## 7) Non-Goals

The Gatekeeper must not:

- invent new architectural rules,
- introduce new features,
- perform large rewrites,
- optimize prematurely,
- override these rules silently.

When in doubt, **report instead of acting**.
