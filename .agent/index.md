# Agent Discovery Index

Use this file after reading `.agent/README.md`. It is the current discovery map for the repository.

## Mandatory Reads

- `.agent/README.md`
- `.agent/GATEKEEPER_RULES.md`
- `.agent/load-skills.md`

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
- `docs/domains/theme/architecture.md`
- `docs/domains/theme/typography.md`

Historical material lives under `docs/archive/` and must not be treated as the active source of
truth.

## Minimal Load Matrix

| Task Type                             | Minimum Context                                                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual or UI work                     | `README` + `GATEKEEPER_RULES.md` + relevant design/theme skill                                                                               |
| Backend or data work                  | `README` + `GATEKEEPER_RULES.md` + `backend-engineering` + relevant domain docs                                                              |
| Documentation or governance drift     | `README` + `GATEKEEPER_RULES.md` + `documentation-governance` + `system-doc-alignment`                                                       |
| Testing or regression work            | `README` + `GATEKEEPER_RULES.md` + `testing` + affected domain docs                                                                          |
| Supabase or database work             | `README` + `GATEKEEPER_RULES.md` + `backend-engineering` + `supabase` + `supabase-postgres` + relevant domain docs                           |
| Planning or commit governance         | `README` + `GATEKEEPER_RULES.md` + `plan-authoring` or `commit-planner`, depending on whether the user wants planning or commit partitioning |
| Planning or implementation sequencing | `README` + `GATEKEEPER_RULES.md` + `agent-communication` + `.agent/plans/README.md`                                                          |
