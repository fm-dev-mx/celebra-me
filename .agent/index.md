# Agent Discovery Index

Use this file after reading `.agent/README.md`. It is the current discovery map for the repository.

## Mandatory Reads

- `.agent/README.md`
- `.agent/GATEKEEPER_RULES.md`

## Plan Governance

- `.agent/plans/README.md`: active plan-record contract and archive rules

## Available Skills

| Skill                      | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `accessibility`            | accessibility review and implementation guidance          |
| `animation-motion`         | motion behavior, transitions, and reduced-motion handling |
| `astro-patterns`           | Astro rendering, routing, and client-boundary guidance    |
| `backend-engineering`      | API routes, services, validation, and integrations        |
| `commit-planner`           | executable commit partitioning and message planning       |
| `copywriting-es`           | Spanish UI and invitation copy standards                  |
| `documentation-governance` | loads the active documentation alignment workflow         |
| `frontend-design`          | visual design and composition guidance                    |
| `seo-metadata`             | metadata, sharing, and search presentation                |
| `testing`                  | unit, integration, and E2E testing guidance               |
| `theme-architecture`       | theme tokens, presets, and section-theme contracts        |

## Available Workflows

| Workflow                        | Use When                                                  |
| ------------------------------- | --------------------------------------------------------- |
| `error-remediation`             | a command, test, or validation check is failing           |
| `plan-authoring`                | the task needs an executable plan record                  |
| `system-doc-alignment`          | docs, governance metadata, or discovery docs may be stale |
| `theme-architecture-governance` | theme presets or section theming need governance review   |

## Canonical Docs

- `docs/core/project-conventions.md`
- `docs/core/architecture.md`
- `docs/core/testing-strategy.md`
- `docs/domains/content/collections.md`
- `docs/domains/rsvp/architecture.md`
- `docs/domains/rsvp/database.md`
- `docs/domains/theme/architecture.md`
- `docs/domains/theme/typography.md`

Historical material lives under `docs/archive/` and must not be treated as the active source of
truth.

## Minimal Load Matrix

| Task Type                         | Minimum Context                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| Visual or UI work                 | `README` + `GATEKEEPER_RULES.md` + relevant design/theme skill                         |
| Backend or data work              | `README` + `GATEKEEPER_RULES.md` + `backend-engineering` + relevant domain docs        |
| Documentation or governance drift | `README` + `GATEKEEPER_RULES.md` + `documentation-governance` + `system-doc-alignment` |
| Testing or regression work        | `README` + `GATEKEEPER_RULES.md` + `testing` + affected domain docs                    |
| Planning or commit governance     | `README` + `GATEKEEPER_RULES.md` + `plan-authoring` + `commit-planner`                 |
