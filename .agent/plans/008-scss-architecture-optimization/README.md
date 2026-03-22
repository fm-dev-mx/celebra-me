# Plan 008: SCSS Architecture Optimization

## Objective

Split the current SCSS and governance work into atomic commits that satisfy the project's
gatekeeper and documentation rules without mixing unrelated intent.

## Scope

- planning artifacts under `.agent/plans/`
- governance preflight tooling and workflow docs
- theme-layer SCSS ownership under `src/styles/themes/**` and shared token contracts
- consumer-facing SCSS modules under `common`, `components`, `dashboard`, `home`, `invitation`,
  and `layout`

## Commit Units

1. `reconcile-scss-plan-documents`
2. `add-plan-doctor-preflight`
3. `thin-theme-surface`
4. `migrate-style-consumers`
