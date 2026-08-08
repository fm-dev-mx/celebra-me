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

### 9.1 Markdown table readability

Use Markdown tables for compact, comparative data rather than paragraphs or implementation
narratives. The repository validator applies to active Markdown documentation and reports:

- a warning when a table has more than four columns;
- a warning when a visible cell exceeds 120 characters;
- a blocking error when a visible cell exceeds 240 characters.

Move long explanations into paragraphs, lists, or subsections. Compact matrices may keep more than
four columns when their cells remain short; the column rule is advisory because several active
templates intentionally use wider matrices. Changed and staged Markdown files are checked through
`pnpm validate:markdown-tables`; historical, generated, temporary, and fixture Markdown is outside
this rule.

For an explicit VS Code save, the recommended `DavidAnson.vscode-markdownlint` extension applies the
structural correction first and Prettier formats the resulting Markdown afterward. A table with a
cell over 120 visible characters is converted into ordered field/value records; a cell over 240
characters remains a blocking validation error until it is reorganized. The workspace recommends the
extension and keeps Prettier as the Markdown formatter. The command
`pnpm format:markdown-tables -- --files <path...>` applies the same correction outside VS Code;
`pnpm validate:markdown-tables -- --all-active` checks all active Markdown without editing it.

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

### Invitation copy in automated tests

Do not couple schema, mapper, publish, or provision **contract** tests to editable invitation
wording. Those suites must be **editor-resilient**; the anti-pattern is **brittle / fragile**
(content-coupled) asserts that fail when a host edits copy in the editor. Prefer shape,
presence/absence, enums, numeric ranges, and value propagation from the test’s own fixture
constants. Exact Spanish (or soft-match) belongs only in named content-golden suites under
`tests/content/<slug>-payload.test.ts`. Full rules and author checklist:
[`.agent/skills/testing/SKILL.md`](../../.agent/skills/testing/SKILL.md) → **Invitation Copy
Assertions**.

## 12) Platform Version Policy

`package.json` is the source of truth for installed versions. As of 2026-07-25:

- **Package:** Astro
  - **Repo baseline:** 7.x (e.g. `7.1.3`) with `@astrojs/vercel` 11.x / `@astrojs/react` 6.x
  - **Upgrade stance:** Patch/minor within Astro 7; majors need a dedicated window
- **Package:** TypeScript
  - **Repo baseline:** **Hybrid:** CLI compiler **7.0.2** (`@typescript/native` → `tsc`);
    programmatic tooling API via package name `typescript` → `@typescript/typescript6@6.0.2`
  - **Upgrade stance:** Keep dual-install until typescript-eslint / `@astrojs/check` / `ts-jest`
    support the TS ≥7.1 programmatic API
- **Package:** React
  - **Repo baseline:** 19.x
  - **Upgrade stance:** Patch updates OK within 19.x
- **Package:** Other deps
  - **Repo baseline:** pinned/caret in `package.json`
  - **Upgrade stance:** Patch/minor when needed for bugs or security

### TypeScript hybrid arrangement (verified)

| Command / consumer                   | Resolves                      | Effective version                         |
| ------------------------------------ | ----------------------------- | ----------------------------------------- |
| `tsc` (via `pnpm type-check`)        | `@typescript/native` bin      | **7.0.2**                                 |
| `astro check`                        | `require('typescript')`       | **6.0.x API** (`@typescript/typescript6`) |
| ESLint `typescript-eslint`           | `require('typescript')`       | **6.0.x API**                             |
| Jest `ts-jest`                       | `require('typescript')`       | **6.0.x API**                             |
| `scripts/validate-ui-governance.mjs` | `import ts from 'typescript'` | **6.0.x API**                             |

`scripts/validate-ui-governance.mjs` is the only repository script that imports `typescript`
directly. `pnpm type-check` runs `astro check && tsc --noEmit -p tsconfig.json` so both the Astro
language service and the TypeScript **7** CLI compile-check run. Do **not** describe the repo as
“fully on TypeScript 7” for ESLint/Jest/astro-check — only the CLI compiler is 7.x until upstream
ships a stable TS 7 programmatic API (expected with TypeScript ≥7.1). **Removal condition:** when
`typescript-eslint`, `@astrojs/check`, `ts-jest`, and `scripts/validate-ui-governance.mjs` work
against TypeScript ≥7.1 and pass `pnpm lint` + `pnpm type-check` + `pnpm validate:ui-governance` +
`pnpm test` with `"typescript": "7.x"` and no `@typescript/typescript6` shim.

### `sanitize-html` ESM compatibility

`sanitize-html@2.17.6` intentionally resolves its production parser to `htmlparser2@12`; do not
override that security update to an older parser. Vercel's serverless loader cannot load the
CommonJS `sanitize-html` entry when it synchronously requires the ESM-only parser, and the Vercel
function tracer can leave its `escape-string-regexp` require unresolved. The bounded
`vite.ssr.noExternal` list in `astro.config.mjs` therefore bundles only this runtime graph:

- `sanitize-html` sanitizes indication markup and requires the rest of this bounded graph;
- `escape-string-regexp` safely converts wildcard attribute and class patterns into regular
  expressions;
- `is-plain-object` and `deepmerge` normalize and merge sanitizer options;
- `parse-srcset` validates responsive image source sets;
- `postcss` parses inline style attributes when that sanitizer option is enabled and uses
  `picocolors`, `source-map-js`, and `nanoid`;
- `launder` rejects unsafe URL schemes and uses `dayjs` for date normalization;
- `htmlparser2` parses markup and depends on `entities`, `domhandler`, and `domutils`;
- `entities` decodes and encodes HTML entities;
- `domhandler` builds the DOM tree and uses `domelementtype` for node classification;
- `domutils` traverses/manipulates the tree and uses `dom-serializer` for output.

Jest uses the same six-package ESM graph through `scripts/jest-esm-to-cjs-transform.cjs`, scoped by
`jest.config.cjs`; that transform is test-only and is not imported into production code. Remove the
Jest exception when the repository Jest pipeline consumes the graph directly. Remove the Vite SSR
exception when the Vercel runtime can load the upstream CommonJS-to-ESM boundary directly (or
`sanitize-html` ships a compatible entry), and only after local handler invocation, the full local
suite, and an authenticated Preview smoke test pass without it.

Prefer Context7 (or equivalent) against the pinned versions when API details are uncertain. Major
framework upgrades should not mix with invitation production work.

## 13) Adding Real or Client Invitations

Real/client invitations are DB-published content. Use `docs/domains/content/event-governance.md` as
the source of truth for real invitation governance.

When a real invitation uses local routed media:

1. **Create event assets** in `src/assets/images/events/{asset-slug}/`.
2. **Export event assets** from `src/assets/images/events/{asset-slug}/index.ts` so discovery and
   registry helpers can consume them consistently.
3. **Set `_assetSlug`** in the DB-published content per the
   [invitation production rules](../../.agent/rules/invitation-production.md).
4. **Verify the content and theme contract** with the narrow relevant commands from
   `docs/domains/content/event-governance.md`.

Demos and templates remain under `src/content/event-demos` and `src/content/event-templates`.

Conventions are agreements to reduce friction, not obstacles to progress.
