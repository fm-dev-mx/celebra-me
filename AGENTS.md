# Agent Guide — Celebra-me

Celebra-me is an Astro, TypeScript, SCSS, Supabase, and Vercel project for digital invitations, host
dashboard, RSVP operations, and publishing. This is the canonical entry point for coding agents.

## Authority Hierarchy

Apply this order when instructions conflict:

1. Non-overridable platform and organization safeguards.
2. Repository policies and invariants explicitly marked as non-overridable (this file’s Non-Negotiable
   Boundaries and their owning rules).
3. Explicit current-task authorization, within repository-defined boundaries.
4. Other repository safety, domain, workflow, and operational policy (`.agent/rules/`, skills,
   workflows, `docs/core/`, `docs/domains/`, briefs, templates).
5. Provider-specific defaults.
6. General external principles (operator/provider defaults configured outside this repository —
   never a substitute for repository policy).

Historical plans (`.agent/plans/archived/`) and point-in-time reports are evidence only — never
policy authority.

## Exception Model

A repository rule may be temporarily overridden only when **all** of the following hold:

- the owning rule marks the constraint as overridable;
- the user explicitly authorizes the specific exception in the current task;
- scope and duration are limited to the current task;
- the exception does not weaken non-overridable safeguards;
- unrelated permissions are not inferred from it;
- the exception and its operational effect are reported in the final handoff.

Current-task authorization may unlock gated operations where repository policy permits it. It must
not implicitly waive unrelated constraints. Do not create or rely on a generic bypass mechanism or
any persistent filesystem marker for Git-write authority.

## Non-Negotiable Boundaries

These are **non-overridable** unless a cited owning rule explicitly marks a narrower exception path:

- **Git Safety:** Task-scoped Git authorization (`.agent/rules/git-safety.md`). Do not
  stage/commit/reset/push/create PRs or otherwise mutate Git state without explicit current-task
  authorization.
- **Path ≠ Privilege:** Worktree lane location (`dev-local`, `dev-preview`, `dev-extra`,
  `Integration`) grants no database or environment mutation privileges.
- **Database Safety:** Operations on persistent local (`celebra-me-rsvp`), Preview, and Production
  DBs require guarded workflows (`.agent/rules/database.md`). Resets allowed only on
  `disposable-test`.
- **UI / Code Language:** Visible UI copy in Spanish ("usted" register); code, identifiers, and
  technical comments in English.
- **Technical Commit Messages:** Never mention internal process/goal identifiers (e.g., `Goal 1`,
  `Goal 2`, `Phase X`) in commit headers or bodies. Focus strictly on code behavioral changes.
- **Relative Paths Only:** Never hardcode absolute machine paths (e.g., drive letters `D:\`, user
  paths `C:\Users\`, or local `file:///` URIs) in committed code, tests, or active documentation.
  Always resolve paths relative to the repository root.
- **Styling System:** SCSS only (`src/**/*.scss`). Tailwind is forbidden.
- **Server/Client Boundary:** Astro server-only code (DB, secrets, Node APIs) must never leak into
  client islands (`client:*`).
- **Command Authority:** `package.json` is the SSOT for available scripts.
- **Invitation Slug:** Never prefix `slug` with `eventType`. Routes are `/{eventType}/{slug}`
  (e.g. `/boda/daniela-y-martin`). See `docs/core/invitation-creation-contract.md`.

## Context Discovery & Routing

- Consult `.agent/routing-matrix.yaml` (or `.agent/index.md`) to resolve the minimum required
  context for a task.
- Read `.agent/rules/gatekeeper.md` for review/remediation tiers and `.agent/rules/git-safety.md`
  for Git rules.
- Load only the smallest relevant rule, workflow, skill, or domain doc.

## Planning & Validation

- Task Contract, Goal protocol, and Handoff Contract live in `.agent/plans/README.md`. Conversation,
  tracked plans, and role delegation are projections of the same Task Contract.
- Use conversation-scoped planning by default. Tracked plans belong under `.agent/plans/active/` per
  `.agent/plans/README.md`.
- Validation tiers are defined in `.agent/rules/gatekeeper.md` using `package.json` script aliases
  (`validate:changed`, `type-check`, `pnpm run ci`).
- Close mutable sessions with `pnpm agent:git-safety:finish` (see `.agent/rules/git-safety.md`).
