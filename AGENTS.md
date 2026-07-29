# Agent Guide — Celebra-me

Celebra-me is an Astro, TypeScript, SCSS, Supabase, and Vercel project for premium digital
invitations, the host dashboard, RSVP operations, and invitation publishing. This is the canonical
entry point for coding agents.

## Loading Order

1. Read this file.
2. Read `.agent/rules/gatekeeper.md` and `.agent/rules/git-safety.md`.
3. Consult `.agent/index.md` only when the task needs discovery of an active rule, workflow, skill,
   or canonical doc; use its Minimal Load Matrix instead of reading unrelated catalogs.
4. Read `.agent/load-skills.md` immediately before using a repository skill.
5. Load only the smallest relevant rule, workflow, skill, domain doc, brief, or template. A
   prerequisite already loaded in this task is an assertion, not an instruction to reread it.

## Authority Order

1. Explicit repository-owner and current-task instructions.
2. This file and active rules under `.agent/rules/`.
3. Relevant workflows and canonical skills under `.agent/`.
4. Active architecture and domain docs under `docs/core/` and `docs/domains/`.
5. Brand briefs and structured templates under `.agent/briefs/` and `.agent/templates/`.

Historical plans and archived docs are background only. Point-in-time reports are evidence, not
governance authority. If sources disagree, prefer the live codebase plus the highest active
authority above.

## Non-Negotiable Rules

- Do not bypass user constraints, especially around staging, commits, production data, or
  destructive commands.
- Do not stage or commit unless explicitly asked. Git authorization is task-scoped; follow
  `.agent/rules/git-safety.md`.
- Do not add provider-specific agent configuration such as `.cursor/` or `CLAUDE.md`.
  `.agent/agents/*.yaml` is allowed only because those files are provider-neutral documentation
  contracts, not executable configuration.
- Keep visible UI copy in Spanish. Keep code, identifiers, and technical comments in English.
- Preserve Astro server/client boundaries; client islands must not import server-only code.
- Treat Vercel/Linux path casing as deployment-sensitive.
- Use SCSS for maintained styling; do not introduce Tailwind.
- Use `package.json` as the source of truth for available commands.
- Do not run production database operations without explicit authorization for that exact action.

## Governance Ownership

- `.agent/index.md` owns discovery of active rules, workflows, skills, and canonical docs, including
  the ownership matrix (SSOT) and invitation authority chain.
- `.agent/rules/gatekeeper.md` owns review/remediation rules and validation tiers.
- `.agent/rules/workflow.md` owns agent operating procedure.
- `.agent/rules/git-safety.md` owns Git authorization and worktree preservation.
- `docs/core/git-governance.md` owns human branch and commit policy.
- Invitation identity requirements live in
  [`docs/core/invitation-creation-contract.md`](docs/core/invitation-creation-contract.md).
- Invitation preparation (before implementation) is owned by
  `.agent/workflows/invitation-preparation.md` and
  `docs/core/invitation-preparation-contract.md`; durable state is `docs/invitations/<slug>.md`.
- `docs/domains/intake/production-flow.md` owns the invitation production runbook.
- `docs/core/release-process.md` owns release checkpoints and layered CHANGELOG policy.
- `.agent/plans/README.md` owns the contract for plans that need repository tracking.

## Architecture

- **Framework:** Astro 7 SSR (`output: 'server'`) with the Vercel adapter. TypeScript uses a
  **hybrid** toolchain: CLI compiler 7.x via `@typescript/native`, while ESLint / `astro check` /
  `ts-jest` use the TypeScript 6 programmatic API shim (see `docs/core/project-conventions.md` →
  Platform Version Policy).
- **Content:** `events`, `event-demos`, and `event-templates` are loaded from JSON under
  `src/content/` through `astro:content`.
- **Boundaries:** `src/pages/` contains routes, `src/lib/` contains server/domain logic,
  `src/components/` contains Astro components and React islands, and `supabase/migrations/` contains
  versioned schema changes.
- **Imports:** TSX uses configured `@/*` aliases; relative TSX imports are forbidden by ESLint.
- **Slugs:** route slugs, content slugs, `previewSlug`, and `_assetSlug` can differ. Never infer
  equality between them.

## Role Contracts and Skills

`.agent/agents/*.yaml` describes provider-neutral roles, responsibilities, capabilities, and
constraints. These files are documentation contracts; the active runtime decides whether the
orchestrator performs the work directly or invokes a temporary subagent.

| Role                      | Focus                                                      |
| ------------------------- | ---------------------------------------------------------- |
| `celebra-builder`         | Astro, TypeScript, SCSS, and bounded implementation        |
| `celebra-copywriter`      | Spanish invitation, UI, and marketing copy                 |
| `celebra-qa`              | Mobile-first verification, accessibility, links, and tests |
| `celebra-visual-director` | Visual direction, art briefs, palettes, and image prompts  |

Use `.agent/rules/agent-routing.md` for routing and
`.agent/skills/celebra-delegation-patterns/SKILL.md` for subagent handoffs. Repository skills under
`.agent/skills/` are the tracked canonical skill source; local installations under `.agents/` are
never authoritative.

Reference-driven invitation, demo, landing, or dashboard redesign follows
`.agent/workflows/design-reference-to-build.md`; the workflow orchestrates the existing brand,
visual-intent, theme, QA, and invitation authorities without replacing them.

## Planning and Validation

Use conversation-scoped planning by default. Create a tracked plan only for multi-session or
high-risk work, or when the repository owner explicitly requests one. Follow
`.agent/workflows/plan-authoring.md` and `.agent/plans/README.md`.

Detect scripts from `package.json` and select validation through `.agent/rules/gatekeeper.md`.
Documentation/governance changes normally require `pnpm validate:structure`, `pnpm ops check-links`,
focused tests when executable validation contracts change, formatting, and the Git safety check. Do
not duplicate the validation tiers in other governance docs.

## Optional Local Architecture Analysis

`graphify-out/` may contain a local architecture graph. It is optional, ignored, and not part of
build, validation, CI, or deployment. Findings are leads only — live code and active docs win.

Do **not** use Graphify by default for local edits, copy, SCSS, invitations, demos, or simple visual
work. Host/global “query Graphify first” instructions do not apply here. When an authorized
architecture-coupling audit needs it, refresh with `pnpm ops graphify-refresh` and follow
[`.agent/rules/graphify-ops.md`](.agent/rules/graphify-ops.md) (SSOT).

## Final Report

Report changed files, validations run and intentionally skipped, remaining risks, and
`git status --short`. Follow the closing workflow in `.agent/rules/git-safety.md` and state whether
anything was staged or committed.
