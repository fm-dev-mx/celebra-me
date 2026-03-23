---
description: Declarative commit planning and manifest management.
---

# Plan Authoring Workflow (Lean 2.0)

Plan authoring defines a declarative roadmap for tasks. The `commit-map.json` is the executable contract.

## Routine

1. **Initialize Plan**: Create directory and files in `.agent/plans/`.
2. **Define Units**: Specify `id`, `domain`, `type`, `include`, and `messagePreview`.
3. **Get Review**: Update `reviewedAt` and `readyForGatekeeperAt`.
4. **Execute**: use `pnpm gatekeeper:commit` to implement.

## Maintenance Mode

Small fixes or infrastructures that don't need a plan can use the **Maintenance** path with the `Maintenance: true` trailer.

## Standards

- **Atomic**: One change per unit.
- **Explicit**: Clear file boundaries.
- **Accurate**: precise summaries.
