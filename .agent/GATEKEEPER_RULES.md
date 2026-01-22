
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

- The Gatekeeper primarily operates on **staged changes**.
- It may open full files from the staged set to apply safe fixes.
- It must prioritize keeping the repository **buildable and deployable**.

### Exception — Repository Hygiene

The agent is allowed to touch files **outside of staged changes** when strictly required for repository hygiene, including:

- removing forbidden artifacts,
- updating `.gitignore` to prevent repeated artifacts.

Any such change **must be explicitly reported** as an extra action.

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

- Unstage and remove these files.
- Update `.gitignore` only if the artifact is repeatedly generated.
- Always report these actions.

---

### 2.2 Staged Diff Handling

- Writing a diff file is allowed **only** at `.git/staged.diff`.
- Any `staged.diff` located in the repository root or tracked paths is considered an artifact and must be removed.

---

### 2.3 Case-Sensitivity (Vercel / Linux Safety)

Casing inconsistencies are treated as bugs.

Rules:

- Block path changes that differ only by casing.
- Enforce consistent lowercase naming for folders unless a different convention is clearly established.

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
- If Tailwind usage is found in staged changes:
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

Mixed or English UI text introduced by staged changes must be corrected.

---

## 3) Allowed Actions

### 3.1 Auto-Fixes

The agent may automatically fix:

- broken or unused imports,
- obvious typing issues,
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

- **≥ 25 files** are staged, or
- **≥ 800 total lines** are changed (additions + deletions), or
- changes affect structural configuration or core folders (e.g. `src/pages`, `src/styles`, `tsconfig`, `astro.config`, `package.json`).

### Behavior in Large Change Mode

- Fix only:
  - build or deploy breakers,
  - hard guard violations (artifacts, casing, boundary leaks).
- Report all other findings without applying changes.

---

## 5) Verification Protocol

### 5.1 Script Detection

- Read `package.json`.
- Detect available scripts dynamically.

### 5.2 Execution Order

Run the closest available match:

1. Type checking (`type-check`, `check`, `astro check`, `tsc --noEmit`)
2. Linting (`lint`)
3. Tests (`test`), if present

If a command fails due to agent changes:

- Fix the issue.
- Re-run the command.

If unrelated:

- Report the command and a minimal relevant error excerpt.

---

## 6) Output Contract

### 6.1 Clean Changes

If no issues are found:

- Reply with:
  `✅ **LGTM** — <one short reason>`
- Output **one** Conventional Commit message (English, present tense).

---

### 6.2 Fixed Issues

If fixes were applied:

- List corrected files.
- For each file: violation + fix (brief).
- End with **one** Conventional Commit message:

``` bash

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
