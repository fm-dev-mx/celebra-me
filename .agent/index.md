# Agent Discovery Index

Use this file after reading [`README.md`](./README.md). It is the neutral discovery index for any
agent working in this repository.

## Recommended Entry Sequence

1. Read [`README.md`](./README.md).
2. Read [`GATEKEEPER_RULES.md`](./GATEKEEPER_RULES.md).
3. Read [`../docs/core/project-conventions.md`](../docs/core/project-conventions.md) for the active
   repository conventions and structure.
4. Load only the relevant skill, workflow, and domain docs for the active task.

## Mandatory Rules

- [`README.md`](./README.md): universal agent entrypoint and loading protocol
- [`GATEKEEPER_RULES.md`](./GATEKEEPER_RULES.md): mandatory operating rules and hard guards

## Available Skills

| Skill                                                                    | Purpose                                                                    |
| :----------------------------------------------------------------------- | :------------------------------------------------------------------------- |
| [`accessibility`](./skills/accessibility/SKILL.md)                       | WCAG-focused accessibility review and implementation guidance              |
| [`animation-motion`](./skills/animation-motion/SKILL.md)                 | motion design, transitions, and reduced-motion handling                    |
| [`astro-patterns`](./skills/astro-patterns/SKILL.md)                     | Astro architecture, rendering, content collections, and client boundaries  |
| [`backend-engineering`](./skills/backend-engineering/SKILL.md)           | API routes, services, validation, and integrations                         |
| [`commit-planner`](./skills/commit-planner/SKILL.md)                     | atomic commit partitioning and repository-specific commit message planning |
| [`copywriting-es`](./skills/copywriting-es/SKILL.md)                     | Spanish UI and invitation copy standards                                   |
| [`documentation-governance`](./skills/documentation-governance/SKILL.md) | documentation structure, drift prevention, and governance                  |
| [`frontend-design`](./skills/frontend-design/SKILL.md)                   | premium visual design direction and composition                            |
| [`seo-metadata`](./skills/seo-metadata/SKILL.md)                         | SEO, Open Graph, and social sharing metadata                               |
| [`testing`](./skills/testing/SKILL.md)                                   | unit, integration, and E2E testing guidance                                |
| [`theme-architecture`](./skills/theme-architecture/SKILL.md)             | SCSS tokens, presets, and theme system implementation                      |

## Available Workflows

| Workflow                                                                        | Use When                                                                       |
| :------------------------------------------------------------------------------ | :----------------------------------------------------------------------------- |
| [`error-remediation`](./workflows/error-remediation.md)                         | a command, test, or validation check is failing and needs structured diagnosis |
| [`plan-authoring`](./workflows/plan-authoring.md)                               | implementation or commit units need planning and validation                    |
| [`system-doc-alignment`](./workflows/system-doc-alignment.md)                   | `.agent/`, `docs/`, or plan records may be stale                               |
| [`theme-architecture-governance`](./workflows/theme-architecture-governance.md) | theme abstraction or section-level theme consistency must be validated         |

## Canonical Docs in `docs/`

- [`../docs/core/project-conventions.md`](../docs/core/project-conventions.md): project-wide coding
  and structure conventions
- [`../docs/core/architecture.md`](../docs/core/architecture.md): high-level architecture and active
  route-facing assembly boundaries
- [`../docs/core/testing-strategy.md`](../docs/core/testing-strategy.md): testing strategy
- [`../docs/domains/theme/architecture.md`](../docs/domains/theme/architecture.md): theme system
  source of truth
- [`../docs/domains/rsvp/architecture.md`](../docs/domains/rsvp/architecture.md): RSVP architecture

## Minimal Load Matrix

| Task Type                     | Minimum Context                                                                                                                       |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| Visual or UI work             | `README` + `GATEKEEPER_RULES.md` + `frontend-design` + `theme-architecture`; add `accessibility` when interaction or contrast changes |
| Backend or data work          | `README` + `GATEKEEPER_RULES.md` + `backend-engineering` or `astro-patterns` + relevant domain docs                                   |
| Testing or regression work    | `README` + `GATEKEEPER_RULES.md` + `testing` + the feature skill involved                                                             |
| Planning or commit governance | `README` + `GATEKEEPER_RULES.md` + `plan-authoring` + `commit-planner`                                                                |
| Ambiguous task                | `README` + `GATEKEEPER_RULES.md` + `project-conventions`, then narrow                                                                 |

## Portability Rule

This repository does not require `.codex/`, provider-specific mirrors, or globally installed skills
to be understandable. Any provider-specific integration is optional and external to the repository.
