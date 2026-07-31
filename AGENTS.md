# Agent Guide — Celebra-me

Celebra-me is an Astro, TypeScript, SCSS, Supabase, and Vercel project for digital invitations, host dashboard, RSVP operations, and publishing. This is the canonical entry point for coding agents.

## Authority Hierarchy

1. Explicit repository-owner and current-task instructions.
2. This file and active rules under `.agent/rules/`.
3. Canonical skills under `.agent/skills/` and workflows under `.agent/workflows/`.
4. Active architecture and domain docs under `docs/core/` and `docs/domains/`.
5. Brand briefs under `.agent/briefs/` and templates under `.agent/templates/`.

Historical plans (`.agent/plans/archived/`) and point-in-time reports are evidence only, not policy authority.

## Non-Negotiable Boundaries

- **Git Safety:** Task-scoped Git authorization (`.agent/rules/git-safety.md`). Do not stage/commit/reset without explicit authorization.
- **Path ≠ Privilege:** Worktree lane location (`dev-local`, `dev-preview`, `dev-extra`, `Integration`) grants no database or environment mutation privileges.
- **Database Safety:** Operations on persistent local (`celebra-me-rsvp`), Preview, and Production DBs require guarded workflows (`.agent/rules/database.md`). Resets allowed only on `disposable-test`.
- **UI / Code Language:** Visible UI copy in Spanish ("usted" register); code, identifiers, and technical comments in English.
- **Styling System:** SCSS only (`src/**/*.scss`). Tailwind is forbidden.
- **Server/Client Boundary:** Astro server-only code (DB, secrets, Node APIs) must never leak into client islands (`client:*`).
- **Command Authority:** `package.json` is the SSOT for available scripts.

## Context Discovery & Routing

- Consult `.agent/routing-matrix.yaml` (or `.agent/index.md`) to resolve the minimum required context for a task.
- Read `.agent/rules/gatekeeper.md` for review/remediation tiers and `.agent/rules/git-safety.md` for Git rules.
- Load only the smallest relevant rule, workflow, skill, or domain doc.

## Planning & Validation

- Use conversation-scoped planning by default. Tracked plans belong under `.agent/plans/active/` per `.agent/plans/README.md`.
- Validation tiers are defined in `.agent/rules/gatekeeper.md` using `package.json` script aliases (`validate:changed`, `type-check`, `pnpm run ci`).
- Verify session preservation with `pnpm agent:git-safety:check` before final reporting.

