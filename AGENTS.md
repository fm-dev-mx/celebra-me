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
- Do not stage or commit files unless explicitly asked.
- Do not introduce provider-specific agent files such as `.cursor/`, `CLAUDE.md`, or
  `.agent/agents/*` without a concrete repository need.
- Keep visible UI copy in Spanish; keep code, identifiers, and technical comments in English.
- Preserve Astro server/client boundaries: UI and client islands must not import server-only code.
- Treat Vercel/Linux path casing as deployment-sensitive.
- Use SCSS for maintained styling; do not introduce Tailwind.
- Use `package.json` as the source of truth for available commands.

## Domain Rules

- Gatekeeper/review contract: `.agent/rules/gatekeeper.md`
- Database and production safety: `.agent/rules/database.md`
- Manual production SQL patch manifest: `.agent/rules/manual-sql-manifest.md`
- Real/client invitation publishing and `_assetSlug`: `.agent/rules/invitation-production.md`
- Dashboard SCSS guardrails: `.agent/rules/dashboard-styling.md`
- Plan governance: `.agent/plans/README.md`

Human-facing architecture and domain sources live under `docs/core/**` and `docs/domains/**`.

## Validation Selection

Detect available scripts from `package.json` before running validation. Prefer the narrowest command
that proves the change:

- Documentation-only changes: `pnpm ops check-links`
- Type or Astro boundary changes: `pnpm type-check`
- JavaScript/TypeScript lint risk: `pnpm lint`
- Content/schema/theme changes: `pnpm ops validate-schema`, `pnpm validate:event-parity`, or
  `pnpm validate:no-pii` as relevant
- Broad runtime or route changes: `pnpm build`

Do not run production database commands unless the user explicitly asks for that exact production
operation.

## Final Report

When finishing work, report: files changed, validations run and intentionally skipped (with
reasons), remaining risks or second-pass cleanup candidates, and `git status --short`. Do not stage
files unless explicitly asked.
