# Project Conventions — Celebra-me

This document defines the **project-wide conventions** for the Celebra-me repository.

Its purpose is to describe **how the codebase should look and feel when healthy**, following
commonly accepted practices in Astro.js projects. These conventions are used by automated agents and
humans to maintain consistency over time.

They are not architectural mandates; they are **shared agreements**.

---

## 1) Folder Structure (Canonical)

Astro promotes the following conventional folders, though you may extend them if necessary:

- `docs/` — Permanent documentation (Architecture, Domains, UX).
- `.agent/plans/` — Operational plans for agents. Active plans live under `active/`; completed,
  superseded, and historical plans under `archived/`. See `.agent/plans/README.md` for governance.
- `.agent/skills/` — Agentic capabilities and domain-specific knowledge.
- `.agent/rules/` — Short operational rules and safety playbooks for agents.
- `src/lib/<feature>/page-data.ts` — Route-facing page assembly modules kept inside the owning
  feature.

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

- UI components: `PascalCase.astro` or `PascalCase.tsx`
- Utilities & Logic: `kebab-case.ts`
- Assets & Documentation: `kebab-case.extension` (e.g. `bg-hero.jpg`, `intro-guide.md`)
- Styles: `kebab-case.scss`

Supporting TypeScript modules such as hooks, interfaces, repositories, route-facing page assembly
modules, and shared helpers follow the `Utilities & Logic` rule even when they export `camelCase`
hooks or `PascalCase` types from inside the file.

### 2.3 Routes & URLs

- Use **kebab-case** for route segments and dynamic routes, as this matches URL conventions and
  Astro's file-based routing.

---

## 3) Utilities and Helpers

### 3.1 Shared Utilities (`src/utils/`)

- Place browser-safe, framework-agnostic logic here (e.g., formatters, pure helpers).
- Do **not** include server-only helpers here if they reference secrets or server APIs.

### 3.2 Server-Only Helpers

- Server-only logic (e.g., integrations, secrets) should live in `src/lib/`.
- This ensures clean separation between framework (Astro/Pages) and logic (Lib).
- This makes boundaries explicit without inventing unnecessary folders.

### 3.3 Route-Facing Page Assembly Modules

- Use feature-owned page assembly modules when an Astro route needs derived view state from multiple
  sources such as content, guest/session context, render plans, or theme tokens.
- The current invitation route uses `src/lib/invitation/page-data.ts` as that assembly boundary.
- These modules may compose adapters and pure helpers, but they should return page-ready props
  instead of framework-specific side effects.
- Astro page files should stay focused on routing, redirects, data fetching, and rendering.
- When an internal compatibility hook or helper loses all runtime consumers, delete it and migrate
  any surviving tests to the active surface instead of preserving a legacy API indefinitely.

---

## 4) Styling System

### 4.1 SCSS Only

- SCSS is the official styling system.
- Tailwind is not allowed in new code; legacy usage should be removed at touchpoints.

### 4.2 Styles Organization

- Conventional Astro projects use `src/styles/` for global/feature styles.
- You may group styles by feature under `styles/feature-name/` if helpful.

### 4.3 Token Usage

- Use the three-level token model: foundation SCSS variables, semantic `:root` CSS variables, and
  scoped component tokens.
- Themes are presets, not a token layer. States belong inside component token contracts.
- Astro and TSX components must consume semantic or component CSS variables instead of hardcoded hex
  values.
- Add reusable runtime intent under `src/styles/tokens/semantic/**` and surface it through
  `src/styles/global.scss`. Add component-specific contracts in the owning component/layout/section
  stylesheet.
- Runtime theme-sensitive invitation styles must read fonts, palette, glass, and shadow roles from
  CSS variables such as `var(--font-*)`, `var(--color-*)`, and `var(--shadow-*)`.
- Styling-only `define:vars` blocks are not allowed in Astro components. Pass styling values through
  inline custom properties or preset/component state classes instead.
- Runtime `define:vars` is allowed only for script-level Astro data injection when markup or data
  attributes are not sufficient.

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

## 12) Adding Real or Client Invitations

Real/client invitations are DB-published content, not new JSON files under `src/content/events`. Use
`docs/domains/content/event-governance.md` as the source of truth for real invitation governance.

When a real invitation uses local routed media:

1. **Create event assets** in `src/assets/images/events/{asset-slug}/`.
2. **Export event assets** from `src/assets/images/events/{asset-slug}/index.ts` so discovery and
   registry helpers can consume them consistently.
3. **Set `_assetSlug`** in the DB-published content per the
   [invitation production rules](../../.agent/rules/invitation-production.md).
4. **Verify the content and theme contract** with the narrow relevant commands from
   `docs/domains/content/event-governance.md`.

Static content under `src/content/events` is legacy/static fallback content only. Demos and
templates remain under `src/content/event-demos` and `src/content/event-templates`.

Conventions are agreements to reduce friction, not obstacles to progress.
