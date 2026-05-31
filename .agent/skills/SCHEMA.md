# Skill Frontmatter Schema

Every skill file under `.agent/skills/*/SKILL.md` must use the following frontmatter. Adherence to
this schema ensures that any agent can parse and navigate skills without provider-specific logic.

## Required Frontmatter

```yaml
---
name: kebab-case-id
description: |
  Short operational description — what this skill governs.
domain: frontend | backend | content | meta | growth | qa
version: 1.0.0
when_to_use:
  - Concrete situation 1
  - Concrete situation 2
preconditions:
  - .agent/README.md
  - .agent/GATEKEEPER_RULES.md
related_skills:
  - another-skill
related_docs:
  - docs/core/architecture.md
---
```

## Field Reference

| Field            | Required | Description                                                       |
| ---------------- | -------- | ----------------------------------------------------------------- |
| `name`           | yes      | kebab-case identifier matching the skill directory name           |
| `description`    | yes      | One-line or short paragraph describing the skill's purpose        |
| `domain`         | yes      | One of: `frontend`, `backend`, `content`, `meta`, `growth`, `qa`  |
| `version`        | yes      | Semantic version of the skill content                             |
| `when_to_use`    | yes      | List of concrete triggers for loading this skill                  |
| `preconditions`  | yes      | Files the agent must read before using this skill                 |
| `related_skills` | yes      | List of skill names that may be relevant; empty list `[]` if none |
| `related_docs`   | yes      | List of documentation files relevant to this skill                |
| `inputs`         | no       | What the agent provides to use this skill                         |
| `outputs`        | no       | What the agent produces by using this skill                       |

## Versioning

- Bump `version` when the skill's operational guidance changes significantly.
- Minor clarifications or formatting fixes do not require a version bump.
