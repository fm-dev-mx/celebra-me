# Agent Guide — Celebra-me

Celebra-me is an Astro, TypeScript, SCSS, Supabase, and Vercel project for premium digital
invitations, the host dashboard, RSVP operations, and invitation publishing.

This is the canonical entry point for coding agents working in this repository.

## Loading Order

1. Read this file.
2. Read `.agent/index.md` for the current discovery map.
3. Read `.agent/load-skills.md` before using repo-local skills.
4. Read `.agent/rules/gatekeeper.md` before changing files.
5. Load only the smallest relevant rule, workflow, skill, or domain doc for the task.

## Authority Order

1. Explicit repository-owner and current-task instructions.
2. Active repository governance in this file, `.agent/rules/gatekeeper.md` (review/remediation
   contract), and `.agent/**`.
3. Active architecture and domain docs in `docs/core/**` and `docs/domains/**`.
4. Historical material in `docs/archive/**` and `.agent/plans/archived/**` for background only.

If sources disagree, prefer the live codebase plus the highest-priority active source above.

## Non-Negotiable Rules

- Do not bypass user constraints, especially around staging, commits, production data, and
  destructive commands.
- Do not stage or commit files unless explicitly asked. Git write permissions are task-scoped; see
  `.agent/rules/git-safety.md` for the full policy and harness.
- Do not introduce provider-specific agent files such as `.cursor/`, `CLAUDE.md`, or
  `.agent/agents/*` without a concrete repository need.
- Keep visible UI copy in Spanish; keep code, identifiers, and technical comments in English.
- Preserve Astro server/client boundaries: UI and client islands must not import server-only code.
- Treat Vercel/Linux path casing as deployment-sensitive.
- Use SCSS for maintained styling; do not introduce Tailwind.
- Use `package.json` as the source of truth for available commands.
- Commits must use scoped Conventional Commits, e.g. `feat(editor): ...`, `fix(invitation): ...`,
  `chore(agent): ...`. Work directly on `develop` by default. Do not commit directly to `main`. Use
  short-lived branches only when complexity or the task explicitly requires it.

## Domain Rules

- Git safety policy and harness: `.agent/rules/git-safety.md`
- Gatekeeper/review contract: `.agent/rules/gatekeeper.md`
- API security, CSRF, admin route composition: `.agent/rules/api-contracts.md`
- Database and production safety: `.agent/rules/database.md`
- Manual production SQL patch manifest: `.agent/rules/manual-sql-manifest.md`
- Intake/publish state machine and editor flow: `.agent/rules/intake-publishing.md`
- Real/client invitation publishing and `_assetSlug`: `.agent/rules/invitation-production.md`
- Dashboard SCSS guardrails: `.agent/rules/dashboard-styling.md`
- Plan governance: `.agent/plans/README.md`

Human-facing architecture and domain sources live under `docs/core/**` and `docs/domains/**`.

## Architecture

- **Framework**: Astro 6 SSR (`output: 'server'`) with Vercel adapter.
- **Content collections**: `events`, `event-demos`, `event-templates` loaded from JSON files under
  `src/content/` via `astro:content`.
- **Path aliases** (both tsconfig and Vite): `@/*` → `src/*`, plus `@components/`, `@lib/`,
  `@utils/`, `@styles/`, `@api/`, `@assets/`, `@content/`, `@data/`, `@hooks/`, `@images/`,
  `@interfaces/`, `@layouts/`. TSX imports must use `@/*` (relative imports are forbidden by
  ESLint).
- **Key directories**:
  - `src/pages/` — all routes (public, dashboard, API)
  - `src/lib/` — domain logic, services, adapters, schemas (server-side)
  - `src/components/` — Astro components and React islands (`client:*`)
  - `supabase/migrations/` — versioned SQL schema changes
- **UI copy**: Spanish. Code, identifiers, and technical comments: English. (See Non-Negotiable
  Rules above.)
- **Server/client boundary**: Keep server-only logic in `src/lib/` or API routes; client islands
  must not import server-only modules. (See Non-Negotiable Rules above.)
- **Slug distinction**: Content slugs, route slugs, and `_assetSlug` may differ. Do not assume
  `_assetSlug === slug`. See `.agent/rules/invitation-production.md`.

## Validation Selection

Detect available scripts from `package.json` before running validation. Prefer the narrowest command
that proves the change:

- Documentation-only changes: `pnpm ops check-links`
- Type or Astro boundary changes: `pnpm type-check`
- JavaScript/TypeScript lint risk: `pnpm lint`
- Content/schema/theme changes: `pnpm ops validate-schema`, `pnpm validate:event-parity`, or
  `pnpm validate:no-pii` as relevant
- Broad runtime or route changes: `pnpm build`
- Git safety check (required after file modifications): `pnpm agent:git-safety:check`

Do not run production database commands unless the user explicitly asks for that exact production
operation.

## Key Commands

| Command                                | Purpose                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                             | start Astro dev server                                                              |
| `pnpm build`                           | `astro check && astro build` — type-check then build                                |
| `pnpm type-check`                      | `astro check`                                                                       |
| `pnpm lint`                            | ESLint across the repo                                                              |
| `pnpm test`                            | Jest suite                                                                          |
| `pnpm test -- tests/path/file.test.ts` | single Jest test file                                                               |
| `pnpm test -- --coverage`              | Jest with coverage                                                                  |
| `pnpm test:e2e`                        | Playwright E2E suite                                                                |
| `pnpm run ci`                          | full pre-PR gate (type-check → lint → stylelint → governance → parity → unit → e2e) |
| `pnpm ops <command>`                   | repo ops dispatcher (`check-links`, `validate-schema`, etc.)                        |

`pnpm db:push` is intentionally blocked. See README.md and `docs/database-workflow.md` for DB
commands.

## Optional Local Architecture Analysis

Local development may generate `graphify-out/`, a Graphify knowledge graph for architecture
exploration.

- Graphify is optional and is not part of build, lint, test, CI, or deployment.
- Do not commit `graphify-out/` or local `.graphifyignore` files.
- Graphify findings are leads, not authority.

## Final Report

When finishing work, report: files changed, validations run and intentionally skipped (with
reasons), remaining risks or second-pass cleanup candidates, and `git status --short`. Do not stage
files unless explicitly asked.

Before the final report, follow the session workflow in `.agent/rules/git-safety.md` (run
`pnpm agent:git-safety:check`, then `pnpm agent:git-safety:end`). Explicitly state whether you
staged or committed anything.
