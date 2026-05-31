---
title: Cesar Ramses Theme Decoupling
status: superseded
created: unknown
updated: 2026-05-31
superseded_by: sacred-keepsake-theme-decoupling
---

# Cesar Ramses Theme Decoupling

> Superseded by `.agent/plans/sacred-keepsake-theme-decoupling.md`. This note remains only as
> historical context for the first decoupling pass.

## Intent

Make `cesar-ramses` a standalone invitation theme with no runtime or stylesheet dependency on
`angelic-presence`, while preserving the current premium baptism direction.

## Constraints

- Register the theme through `src/lib/theme/theme-contract.ts`.
- Keep preset files limited to CSS custom properties.
- Put reusable section composition in `src/styles/themes/sections/*/_cesar-ramses.scss`.
- Keep `src/styles/events/_cesar-ramses.scss` only for slug-scoped exceptions.
- Keep the `angelic-presence` preset available for the reusable baptism demo.

## Step-by-Step Roadmap

1. Add contract tests proving the content preset, preset import, and migrated section partials use
   `cesar-ramses`.
2. Add `cesar-ramses` to the theme contract and invitation preset barrel.
3. Create `src/styles/themes/presets/_cesar-ramses.scss` with the standalone palette, typography,
   glass, shadow, and cross-section variables.
4. Move the current event-level section architecture into `src/styles/themes/sections/**`
   `cesar-ramses` partials.
5. Reduce `src/styles/events/_cesar-ramses.scss` to a small slug namespace placeholder for future
   media-only exceptions.
6. Update content and documentation so the live system, docs, and validation script agree.

## Verification Plan

- `pnpm test -- tests/content/cesar-ramses-baptism-invitation.test.ts --runInBand`
- `pnpm test -- tests/unit/theme-presets.test.ts --runInBand`
- `pnpm test -- tests/content/schema.test.ts --runInBand`
- `pnpm ops validate-schema`
- `pnpm lint:styles`
- `pnpm type-check`
- `pnpm validate:event-parity`
- `pnpm build`
- Search César-specific files for `angelic-presence`, `color-angelic`, and `angelic-`.
