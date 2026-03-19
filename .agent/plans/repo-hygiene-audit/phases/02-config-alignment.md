# Phase 02: Configuration Alignment

## Objective

Synchronize and prune path aliases to ensure `astro.config.mjs` and `tsconfig.json` are aligned and
free of dead references.

## Tasks

- [x] Prune non-existent path aliases in `astro.config.mjs` (`src/core/*`, `src/backend/*`).
      [weight: 40%]
- [x] Synchronize `tsconfig.json` paths with `astro.config.mjs`. [weight: 40%]
- [x] Simplify redundant aliases (e.g., `@assets` vs `@images`). [weight: 20%]

## Acceptance Criteria

- `astro check` and `pnpm type-check` pass without alias-related errors.
- Every alias in `astro.config.mjs` corresponds to a real directory.
- `tsconfig.json` and `astro.config.mjs` have identical alias definitions.

## References

- Configuration File Health Check (Audit Dimensional 3)
