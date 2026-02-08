# Project Conventions — Celebra-me

This document defines the **project-wide conventions** for the Celebra-me repository.

Its purpose is to describe **how the codebase should look and feel when healthy**, following
commonly accepted practices in Astro.js projects. These conventions are used by automated agents and
humans to maintain consistency over time.

They are not architectural mandates; they are **shared agreements**.

---

## 1) Folder Structure (Canonical)

Astro promotes the following conventional folders, though you may extend them if necessary:

- `src/pages/` — Routes and API endpoints (file-based routing, required).
- `src/components/` — Reusable UI components (presentation-only).
- `src/layouts/` — Page layouts that structure pages.
- `src/styles/` — Global and feature-level SCSS styles.
- `src/content/` — Astro content collections and structured content.
- `src/utils/` — Shared utilities (pure logic, browser-safe).
- `public/` — Static assets (images, icons, fonts).
- `docs/plan/` — Modular implementation plans and detailed specifications for each section/feature.

These conventions help align the repo with widely used Astro layouts without enforcing unnecessary
rigidity.

---

## 2) Naming & Casing

### 2.1 Folders

- Follow conventional Astro practice: **lowercase** folder names.
- Use hyphens (kebab-case) when helpful for readability.

This minimizes risk in case-sensitive environments (like Vercel). (`/src/pages` and
`/src/components` are conventional according to Astro docs).

### 2.2 Files

- UI components: `PascalCase.astro` or `PascalCase.ts`
- Utilities: `camelCase.ts`
- Styles: `kebab-case.scss` or `feature-name.scss` when scoped to a feature

### 2.3 Routes & URLs

- Use **kebab-case** for route segments and dynamic routes, as this matches URL conventions and
  Astro's file-based routing.

---

## 3) Utilities and Helpers

### 3.1 Shared Utilities (`src/utils/`)

- Place browser-safe, framework-agnostic logic here (e.g., formatters, pure helpers).
- Do **not** include server-only helpers here if they reference secrets or server APIs.

### 3.2 Server-Only Helpers

- Server-only logic (e.g., integrations, secrets) should live alongside API routes:
  `src/pages/api/_lib/` or `src/utils/server/`.
- This makes boundaries explicit without inventing unnecessary folders.

---

## 4) Styling System

### 4.1 SCSS Only

- SCSS is the official styling system.
- Tailwind is not allowed in new code; legacy usage should be removed at touchpoints.

### 4.2 Styles Organization

- Conventional Astro projects use `src/styles/` for global/feature styles.
- You may group styles by feature under `styles/feature-name/` if helpful.

---

## 5) Imports & Aliases

### 5.1 Aliases

- Use the `@/*` alias to reference `src/*` (cleaner imports).
- Avoid deep relative imports when an alias is available.

### 5.2 Import Discipline

- UI components should not import server-only code.
- Shared utilities should remain dependency-light.

---

## 6) Public Assets

- Use `public/` for truly static assets.
- Do not import them as modules; use direct paths (`src="/icons/...svg"`).

---

## 7) Language Rules

- **Visible UI text:** Spanish only.
- **Code, types, variables, comments:** English only.
- Fix mixed-language UI copy during review.

---

## 8) Accessibility & Semantics

- Use semantic HTML (`<main>`, `<header>`, `<footer>`).
- Always provide:
    - `alt` attributes for images
    - associated `label` for form controls
    - explicit `type` on `<button>`

---

## 9) Comments & Documentation

- Comments explain **why**, not **what**.
- Keep comments concise and in English.

---

## 10) Deviations

Not all situations fit the conventions. If a change requires deviating:

- Document the reason in code or PR.
- Avoid pattern repetition without discussion.

---

## 11) Logging and Test Outputs

- All transient logs and test output files (e.g., `test_output.txt`) MUST be placed in the `logs/`
  directory.
- This directory is ignored by git to keep the repository clean.
- When running tests or capturing output, use: `npm test > logs/test_output.txt 2>&1`.

Conventions are agreements to reduce friction, not obstacles to progress.
