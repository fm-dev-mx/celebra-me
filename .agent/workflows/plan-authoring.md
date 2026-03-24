---
description: Declarative commit planning and manifest management.
---

# Plan Authoring Workflow

Plan authoring defines a declarative roadmap for tasks. The `commit-map.json` is the executable contract for planning and traceability, not an automated commit runner.

## Routine

1. **Initialize Plan**: create the directory and files in `.agent/plans/`.
2. **Define Units**: specify `id`, `domain`, `type`, `include`, and `messagePreview`.
3. **Review**: update `draftedAt`, `reviewedAt`, and notes as the plan matures.
4. **Implement**: carry out the work with the standard repository workflow and conventional commits.

## Standards

- **Atomic**: one coherent change per unit.
- **Explicit**: clear file boundaries.
- **Accurate**: precise summaries.
