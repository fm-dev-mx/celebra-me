# Agent Discovery Index

Use this file after reading `AGENTS.md`. It is the current discovery map for the repository.

## Prerequisite Knowledge

- [`AGENTS.md`](../AGENTS.md) — entry point and loading order
- `.agent/rules/gatekeeper.md` — review/remediation contract
- `.agent/load-skills.md` — skill loading protocol

## Plan Governance

- `.agent/plans/README.md`: plan governance, status taxonomy, and frontmatter schema. Plans live as
  single Markdown files under `active/` (current) or `archived/` (historical).

## Available Skills

| Skill                      | Purpose                                                                       |
| -------------------------- | ----------------------------------------------------------------------------- |
| `accessibility`            | accessibility review and implementation guidance                              |
| `agent-communication`      | clear, atomic agent-user interaction standards                                |
| `animation-motion`         | motion behavior, transitions, and reduced-motion handling                     |
| `astro-patterns`           | Astro rendering, routing, and client-boundary guidance                        |
| `backend-engineering`      | API routes, services, validation, and integrations                            |
| `commit-planner`           | executable commit partitioning and message planning                           |
| `copywriting-es`           | Spanish UI and invitation copy standards                                      |
| `documentation-governance` | loads the active documentation alignment workflow                             |
| `frontend-design`          | visual design and composition guidance                                        |
| `seo-metadata`             | metadata, sharing, and search presentation                                    |
| `testing`                  | unit, integration, and E2E testing guidance                                   |
| `theme-architecture`       | theme tokens, presets, and section-theme contracts                            |
| `supabase`                 | Supabase Auth, RLS, Edge Functions, Storage, CLI, and MCP guidance            |
| `supabase-postgres`        | Postgres query optimization, indexes, connections, schema design, and locking |

## Available Briefs

| Brief        | Status | Purpose                                        |
| ------------ | ------ | ---------------------------------------------- |
| `celebra-me` | active | Brand brief for Celebra-me digital invitations |

## Available Templates (Creative)

| Template              | Purpose                                                |
| --------------------- | ------------------------------------------------------ |
| `reel-brief`          | short-form video reel script structure                 |
| `social-image-brief`  | social post / carousel copy and image prompt structure |
| `video-frame-brief`   | initial/final video frame prompt with ComfyUI params   |
| `image-prompt-output` | generation parameter log for reproducibility           |
| `creative-qa-report`  | checklist and report for reviewing creative outputs    |

## Available Workflows

| Workflow                        | Use When                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `error-remediation`             | a command, test, or validation check is failing                                         |
| `plan-authoring`                | the task needs clarified planning guidance or an explicitly requested repo-tracked note |
| `system-doc-alignment`          | docs, governance metadata, or discovery docs may be stale                               |
| `theme-architecture-governance` | theme presets or section theming need governance review                                 |

## Canonical Docs

- `docs/core/project-conventions.md`
- `docs/core/architecture.md`
- `docs/core/content-schema.md`
- `docs/core/git-governance.md`
- `docs/domains/content/collections.md`
- `docs/domains/rsvp/architecture.md`
- `docs/domains/rsvp/database.md`
- `docs/domains/tracking/commercial-attribution.md`
- `.agent/rules/api-contracts.md`
- `.agent/rules/database.md`
- `.agent/rules/intake-publishing.md`
- `.agent/rules/invitation-production.md`
- `docs/domains/theme/architecture.md`
- `docs/domains/theme/typography.md`

Historical material lives under `docs/archive/` and must not be treated as the active source of
truth.

## Minimal Load Matrix

`.agent/rules/git-safety.md` is required for **all** task types and is omitted from individual rows
for brevity.

| Task Type                             | Minimum Context                                                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual or UI work                     | `AGENTS.md` + `.agent/rules/gatekeeper.md` + relevant design/theme skill                                                                           |
| Backend or data work                  | `AGENTS.md` + `.agent/rules/gatekeeper.md` + `backend-engineering` + relevant domain docs                                                          |
| Documentation or governance drift     | `AGENTS.md` + `.agent/rules/gatekeeper.md` + `documentation-governance` + `system-doc-alignment`                                                   |
| Testing or regression work            | `AGENTS.md` + `.agent/rules/gatekeeper.md` + `testing` + affected domain docs                                                                      |
| Supabase or database work             | `AGENTS.md` + `.agent/rules/gatekeeper.md` + `.agent/rules/database.md` + `backend-engineering` + `supabase` + `supabase-postgres` + relevant docs |
| Planning or commit governance         | `AGENTS.md` + `.agent/rules/gatekeeper.md` + `plan-authoring` or `commit-planner`                                                                  |
| Planning or implementation sequencing | `AGENTS.md` + `.agent/rules/gatekeeper.md` + `agent-communication` + `.agent/plans/README.md`                                                      |
| Creative or marketing production      | `AGENTS.md` + `.agent/rules/gatekeeper.md` + `.agent/briefs/celebra-me.md` + relevant creative template                                            |
