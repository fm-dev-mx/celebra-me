# Phase 04: Visual Regression Protocol

## Objective

Perform structured visual and functional regression testing to guarantee UI integrity before the massive CSS commit is locked into the repository.

## Context

Refactoring 1,600 lines of CSS in an Astro application is highly volatile. The `top-premium-floral` layout is a live production demo and cannot warp.

## Implementation Steps

1. **Local Build Check:** Run `pnpm build` to guarantee the Astro compiler accepts the relocated SCSS rules without hitting undefined mixin errors.
2. **Visual Checklist:** 
    - Launch `pnpm dev`.
    - Manually inspect route `/events/noir-premiere-xv`: Ensure the typography hierarchy, glassmorphism, and color contrasting are identical to pre-refactor states.
    - Manually inspect route `/events/top-premium-floral`: Ensure buttons, spacing, and floral SVGs have not shifted.
3. **Sign-off:** The developer must explicitly approve the regressions in the UI sandbox before the agent is permitted to execute `pnpm gatekeeper:workflow:inspect`.

## Output

A verified, risk-free staging environment ready to be passed to the Gatekeeper commit workflow.
