# Agent Discovery Index

Use this file after reading `AGENTS.md` when the task needs discovery. It is the current map of
active repository guidance, not part of the minimum bootstrap for every task.

## Start Here

- [`AGENTS.md`](../AGENTS.md) — canonical entry point, authority order, and non-negotiables
- `.agent/rules/gatekeeper.md` — review/remediation contract and validation tiers
- `.agent/rules/git-safety.md` — task-scoped Git authorization and worktree preservation
- `.agent/rules/agent-routing.md` — provider-neutral role and subagent routing
- `.agent/load-skills.md` — runtime-neutral skill loading protocol

## Role Contracts

Role YAML files are provider-neutral documentation contracts. They describe responsibilities,
capabilities, constraints, and canonical skill references; they are not executable runtime config.

| Role Contract             | File                                         | Purpose                            |
| ------------------------- | -------------------------------------------- | ---------------------------------- |
| `celebra-builder`         | `.agent/agents/celebra-builder.yaml`         | Code implementation                |
| `celebra-copywriter`      | `.agent/agents/celebra-copywriter.yaml`      | Spanish copy and marketing text    |
| `celebra-qa`              | `.agent/agents/celebra-qa.yaml`              | Mobile-first quality review        |
| `celebra-visual-director` | `.agent/agents/celebra-visual-director.yaml` | Visual direction and image prompts |

## Active Rules

| Rule                                                | Owns                                               |
| --------------------------------------------------- | -------------------------------------------------- |
| `.agent/rules/agent-routing.md`                     | role selection, subagent boundaries, and handoffs  |
| `.agent/rules/api-contracts.md`                     | API security, CSRF, and admin route composition    |
| `.agent/rules/dashboard-styling.md`                 | dashboard SCSS guardrails                          |
| `.agent/rules/database.md`                          | agent database and production-data safety          |
| `.agent/rules/gatekeeper.md`                        | review/remediation contract and validation tiers   |
| `.agent/rules/git-safety.md`                        | Git authorization and worktree preservation        |
| `.agent/rules/intake-publishing.md`                 | intake and publication state-machine invariants    |
| `.agent/rules/invitation-preset-source-of-truth.md` | invitation preset source ownership                 |
| `.agent/rules/invitation-production.md`             | agent safety constraints for invitation production |
| `.agent/rules/manual-sql-manifest.md`               | manual production SQL manifest requirements        |
| `.agent/rules/workflow.md`                          | agent operating procedure                          |

## Available Skills

`.agent/skills/` is the tracked canonical skill source. `.agents/` is ignored local installation
state and never has authority over these definitions.

| Skill                         | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `accessibility`               | accessibility review and implementation guidance                   |
| `agent-communication`         | clear, atomic agent-user interaction standards                     |
| `animation-motion`            | motion behavior, transitions, and reduced-motion handling          |
| `astro-patterns`              | Astro rendering, routing, and client-boundary guidance             |
| `backend-engineering`         | API routes, services, validation, and integrations                 |
| `celebra-delegation-patterns` | provider-neutral subagent requests, handoffs, and synthesis        |
| `client-invitation-audit`     | preparation + pre-implementation audit for real invitations        |
| `commit-planner`              | commit partitioning and message planning                           |
| `copywriting-es`              | Spanish UI and invitation copy standards                           |
| `database-parity`             | branch-lane DB delegate; diagnosis, audits, checkpoint + clearance |
| `demo-content-consistency`    | demo/preview data transforms at adapter layer (not client JS)      |
| `documentation-governance`    | active documentation alignment workflow                            |
| `frontend-design`             | visual design and composition guidance                             |
| `branch-lane`                 | Git lane orchestrator; read-only diagnosis before auth prompts     |
| `git-stash-branch-cleanup`    | audit and clean stale stashes/branches with confirmation           |
| `production-sql-patches`      | continuation-aware manual production SQL authoring                 |
| `release-prepare`             | deprecated stub → use `branch-lane` (mode release-prepare)         |
| `seo-metadata`                | metadata, sharing, and search presentation                         |
| `staged-code-review`          | simplification-first analysis of staged git changes (read-only)    |
| `staged-code-review-apply`    | gated application of staged-code-review fixes (no stage/commit)    |
| `supabase`                    | Supabase Auth, RLS, Edge Functions, Storage, CLI, and MCP guidance |
| `supabase-postgres`           | Postgres performance, indexes, connections, schema, and locking    |
| `testing`                     | unit, integration, and E2E testing guidance                        |
| `theme-architecture`          | theme tokens, presets, section contracts, and preset extension     |

## Available Briefs

| Brief        | Status | Purpose                                        |
| ------------ | ------ | ---------------------------------------------- |
| `celebra-me` | active | Brand brief for Celebra-me digital invitations |

## Available Templates (Creative)

| Template                 | Purpose                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `creative-qa-report`     | checklist and report for reviewing creative outputs         |
| `design-reference-brief` | task-scoped context and acceptance contract for visual work |
| `image-prompt-output`    | generation parameter log for reproducibility                |
| `reel-brief`             | short-form video reel script structure                      |
| `social-image-brief`     | social post or carousel copy and image prompt structure     |
| `video-frame-brief`      | initial/final video frame prompt with generation parameters |

## Available Templates (Invitation)

| Template             | File                                                  | Purpose                                              |
| -------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| `preparation-state`  | `.agent/templates/invitation/preparation-state.md`    | Canonical per-slug state under `docs/invitations/`   |

## Available Workflows

| Workflow                        | File                                                | Use when                                                         |
| ------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| `design-reference-to-build`     | `.agent/workflows/design-reference-to-build.md`     | visual work moves from references through implementation and QA  |
| `error-remediation`             | `.agent/workflows/error-remediation.md`             | a command, test, or validation check fails                       |
| `invitation-preparation`        | `.agent/workflows/invitation-preparation.md`        | prepare a new/resumed client invitation before implementation    |
| `managed-invitation-lifecycle`  | `.agent/workflows/managed-invitation-lifecycle.md`  | a managed invitation moves through local, preview, or production |
| `plan-authoring`                | `.agent/workflows/plan-authoring.md`                | work needs sequencing or a durable tracked plan                  |
| `system-doc-alignment`          | `.agent/workflows/system-doc-alignment.md`          | docs, governance metadata, or discovery links may be stale       |
| `theme-architecture-governance` | `.agent/workflows/theme-architecture-governance.md` | theme presets or section theming need governance review          |

## Planning

Planning is conversation-scoped by default. Use `.agent/plans/README.md` when work is multi-session,
high risk, or explicitly requested as a tracked plan. Files under `.agent/plans/archived/` are
historical and not active authority.

## Ownership Matrix (SSOT)

One owner per concern. Other files may link here; they must not redefine the same policy.

| Aspect                              | Owner                                                | Not the owner                                  |
| ----------------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| Agent discovery / active inventory  | `.agent/index.md`                                    | Archived plans, point-in-time reports          |
| Validation tiers / review contract  | `.agent/rules/gatekeeper.md`                         | `docs/core/git-governance.md`, workflows       |
| Agent operating procedure           | `.agent/rules/workflow.md`                           | Human branch/release policy docs               |
| Git authorization / worktree safety | `.agent/rules/git-safety.md`                         | Commit-message style docs                      |
| Human branch, commit, promotion     | `docs/core/git-governance.md`                        | Agent workflow rules                           |
| Release checkpoints / version tags  | `docs/core/release-process.md`                       | Per-invitation notes                           |
| Product release history             | `CHANGELOG.md` (`[Unreleased]` → versioned)          | Migrations, invitation ops notes               |
| Invitation identity requirements    | `docs/core/invitation-creation-contract.md`          | Runbook, agent workflow, safety rule           |
| Invitation preparation semantics    | `docs/core/invitation-preparation-contract.md`       | Per-invite Markdown, publication readiness     |
| Invitation preparation procedure    | `.agent/workflows/invitation-preparation.md`         | Creation contract, managed lifecycle           |
| Event-type prep completeness (exec) | `src/lib/invitation-preparation/`                    | Narrative docs alone                           |
| Invitation production runbook       | `docs/domains/intake/production-flow.md`             | Creation contract, agent workflow              |
| Agent invitation procedure          | `.agent/workflows/managed-invitation-lifecycle.md`   | Runbook semantics, CLI flag copies             |
| Invitation agent safety constraints | `.agent/rules/invitation-production.md`              | Runbook steps, creation field lists            |
| Reveal-gate automation / bypass     | `docs/domains/invitations/reveal-gate-automation.md` | Screenshot README, motion tokens doc           |
| Theme/preset runtime authority      | `.agent/rules/invitation-preset-source-of-truth.md`  | Snapshots, published JSON alone                |
| Schema / content shape              | `docs/core/content-schema.md` + live Zod             | Invitation ops notes                           |
| Database operations                 | `docs/database-workflow.md`                          | Schema overview ERD                            |
| Branch↔DB parity handoff            | `.agent/skills/database-parity`                      | `branch-lane` (orchestrates; no DB ops logic)  |
| Database schema overview            | `docs/domains/database/overview.md`                  | Ops runbooks                                   |
| Environment variable hierarchy      | `docs/env-workflow.md`                               | Database workflow                              |
| Brand / voice                       | `.agent/briefs/celebra-me.md`                        | Root PRODUCT/DESIGN markdown files (forbidden) |
| Visual design intent                | `.agent/skills/frontend-design`                      | External design installs as SSOT               |
| Theme tokens / SCSS architecture    | `docs/domains/theme/` + `theme-architecture` skill   | Brand brief alone                              |
| Per-client invitation state         | `docs/invitations/` (one Markdown file per slug)     | `.agent/plans/`, system CHANGELOG dumps        |
| Schema history                      | `supabase/migrations/` (+ manual SQL manifest)       | Full migration lists in CHANGELOG              |
| Canonical skills                    | `.agent/skills/` (each skill SKILL file)             | `.agents/`, global Hermes skills               |
| Available commands                  | `package.json`                                       | Copied command tables in stale docs            |

### Invitation authority chain

Conceptual lifecycle: **Preparation → Implementation → Managed lifecycle / publication**.

#### Preparation (before payloads / invite SCSS)

Load in this order; do not copy semantics across layers:

1. **Preparation workflow** — `.agent/workflows/invitation-preparation.md` (orchestration).
2. **Preparation contract** — `docs/core/invitation-preparation-contract.md` (classifications,
   placeholders, readiness, Markdown schema).
3. **Analysis skill** — `.agent/skills/client-invitation-audit` (extraction, completeness, assets,
   two-lane audit).
4. **Executable evaluation** — `src/lib/invitation-preparation/` (deterministic completeness and
   readiness).
5. **Durable state** — `docs/invitations/` per-slug Markdown (canonical preparation SoT).

#### Publication / managed updates (after preparation readiness allows implementation)

Load in this order for managed invitation work; do not copy semantics across layers:

1. **Contract** — `docs/core/invitation-creation-contract.md` (what every invitation must define).
2. **Runbook** — `docs/domains/intake/production-flow.md` (how production/lifecycle works).
3. **Agent workflow** — `.agent/workflows/managed-invitation-lifecycle.md` (thin procedure).
4. **Safety rule** — `.agent/rules/invitation-production.md` (agent hard constraints).
5. **Executable CLI** — `pnpm invitation:update -- --help` and live provision scripts
   (flags/behavior).

Technical Local/Preview/Production readiness remains owned by the CLI/`invitation-readiness.ts`
and is independent from preparation readiness.

## Canonical Docs

### Core

- `docs/core/project-conventions.md`
- `docs/core/architecture.md`
- `docs/core/content-schema.md`
- `docs/core/git-governance.md`
- `docs/core/agent-interaction.md`
- `docs/core/invitation-creation-contract.md`
- `docs/core/invitation-preparation-contract.md`
- `docs/core/release-process.md`
- `docs/core/sensitive-data-guide.md`

### Environment and Database

- `docs/env-workflow.md`
- `docs/database-workflow.md`
- `docs/domains/database/overview.md`

### Intake and Invitations

- `docs/domains/intake/internal-invitation-editor.md`
- `docs/domains/intake/production-flow.md`
- `docs/domains/invitations/public-response-cache-policy.md`
- `docs/domains/invitations/reveal-gate-automation.md`

`docs/invitations/` contains canonical per-slug preparation state (one Markdown file per slug) plus
optional companion evidence (asset reports, copy audits). See `docs/invitations/README.md`. Those
files may guide their named invitation but do not replace cross-cutting architecture or runbooks.

- `docs/invitations/README.md`
- `docs/invitations/valentina-hernandez.md`
- `docs/invitations/xareni-iyarit-asset-report.md`
- `docs/invitations/america-johana-asset-report.md`
- `docs/invitations/abril-michelle-becerra-rea.md`
- `docs/invitations/romina-rios-chaparro-finalization.md`

### Product Domains

- `docs/domains/content/collections.md`
- `docs/domains/content/enchanted-rose-photography-crops.md`
- `docs/domains/content/event-governance.md`
- `docs/domains/content/section-contracts.md`
- `docs/domains/rsvp/architecture.md`
- `docs/domains/rsvp/database.md`
- `docs/domains/theme/architecture.md`
- `docs/domains/theme/gallery-variants.md`
- `docs/domains/theme/motion.md`
- `docs/domains/theme/section-intersections.md`
- `docs/domains/theme/typography.md`
- `docs/domains/tracking/commercial-attribution.md`

## Reports and Historical Material

Invitation-specific operational evidence belongs under `docs/invitations/`. Historical audits and
point-in-time reports belong under `docs/archive/reports/`. Reports can support a decision but never
define current policy. Historical material under `docs/archive/` and `.agent/plans/archived/` is
background only.

## Minimal Load Matrix

Every task loads `AGENTS.md`, `.agent/rules/gatekeeper.md`, and `.agent/rules/git-safety.md`.
Consult this matrix to choose only the additions required by the task; do not reread base
prerequisites that are already loaded.

| Task type                         | Add                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| Visual or UI work                 | `.agent/rules/agent-routing.md` plus the relevant design or theme skill                       |
| Reference-driven visual redesign  | `design-reference-to-build`, `frontend-design`, and the design-reference brief                |
| Backend or data work              | `backend-engineering`, relevant domain docs, and API/database rules                           |
| Documentation or governance drift | `documentation-governance` and `.agent/workflows/system-doc-alignment.md`                     |
| Testing or regression work        | `testing` and affected domain docs                                                            |
| Browser automation on invitations | `docs/domains/invitations/reveal-gate-automation.md` before scripting any reveal interaction  |
| Supabase or database work         | `.agent/rules/database.md`, `supabase`, `supabase-postgres`, and `docs/database-workflow.md`  |
| Planning                          | `.agent/workflows/plan-authoring.md`; add `.agent/plans/README.md` only for tracked plans     |
| Commit governance                 | `commit-planner` and `docs/core/git-governance.md`                                            |
| Staged review before commit       | `staged-code-review` then `staged-code-review-apply`                                          |
| Release / branch lane             | `branch-lane` (orchestrator) + `docs/core/release-process.md` / `docs/core/git-governance.md` |
| Branch-lane DB-sensitive routing  | `database-parity` (auto-invoked) + `docs/database-workflow.md` / `.agent/rules/database.md`   |
| Stash / branch housekeeping       | `git-stash-branch-cleanup`                                                                    |
| Real invitation preparation       | `invitation-preparation` workflow + `client-invitation-audit`                             |
| Real invitation implementation    | `client-invitation-audit` two-lane spec, then `managed-invitation-lifecycle` to apply     |
| Demo date / transform consistency | `demo-content-consistency`                                                                    |
| Manual production SQL authoring   | `production-sql-patches` and `.agent/rules/manual-sql-manifest.md`                            |
| Creative or marketing production  | `.agent/briefs/celebra-me.md` and the relevant creative template                              |
| Framework API uncertainty         | Relevant skill plus Context7/docs MCP against `package.json` versions                         |
| Visual polish / anti-slop review  | `frontend-design` registers + structural bans + critique checklist (not external SSOT)        |
| Invitation hero composition       | `frontend-design` Hero Composition Contract + Lane A profile essence / focals                 |
