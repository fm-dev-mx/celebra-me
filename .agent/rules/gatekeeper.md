# Gatekeeper Rules — Celebra-me

This document defines the **operational contract** for the Gatekeeper agent.

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

- The Gatekeeper primarily operates on the current task scope and should inspect the actual diff
  that is being reviewed.
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

## 5) Verification Protocol

### 5.1 Script Detection

- Read `package.json`.
- Detect available scripts dynamically.

### 5.2 Execution Order

Run the closest available match, **scaled to the change scope**:

**A) Small localized style/copy/asset changes — fast pre-commit confidence:**

```sh
pnpm validate:staged       # ESLint + Stylelint + Prettier + related Jest on STAGED files only
pnpm agent:git-safety:check
```

`pnpm validate:staged` is **strictly staged** (the Git index). It does not
look at unstaged working-tree edits and does not auto-format anything. It
no-ops successfully when there are no staged matching files.

Prettier is intentionally **advisory** here: the repo carries pre-existing
formatting debt in staged files that is not part of the workflow change.
Blocking on that debt would conflate scope. ESLint, Stylelint, and related
Jest are hard gates. New or modified files in the workflow commit must
still be formatted — advisory is not a license to commit unformatted code.

**B) Shared component, schema, adapter, render-data, routing, Supabase, or
content-resolution changes — broader local feedback:**

```sh
pnpm validate:changed      # ESLint + Stylelint + Prettier + related Jest on WORKING-TREE files
pnpm type-check            # astro check (whole repo)
pnpm test:changed          # Jest for staged source files via --findRelatedTests
pnpm validate:event-parity # when event/content parity can be affected
pnpm agent:git-safety:check
```

Use `pnpm validate:changed` when you have unstaged edits you want feedback
on before staging. Use `pnpm test:changed` to run only the tests that
cover the files you have staged.

**C) Final pre-push / pre-deploy confidence (full validation, do not skip):**

```sh
pnpm type-check
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

`pnpm ci` is the canonical full-pipeline equivalent of tier C. It runs `pnpm build:app` (`astro build`)
after its earlier type-check to avoid duplicating the check. `pnpm ci:quick`
runs `astro check` plus a scoped ESLint pass and is for fast feedback only;
it is **safe in CI** (it does not depend on local Git staging state) but
**must not** replace tier C for production-sensitive changes.

The pre-push hook intentionally remains lean (commit-message validation only);
do not move tests or type-checks into pre-push.

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
