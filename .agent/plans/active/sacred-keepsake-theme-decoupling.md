---
title: Sacred Keepsake Theme Decoupling
status: active
created: unknown
updated: 2026-05-31
---

# Sacred Keepsake Theme Decoupling

## Intent

Promote the former `cesar-ramses` theme implementation into the reusable `sacred-keepsake`
invitation preset, keeping `cesar-ramses` only as the real event slug and content identity.

## Constraints

- Register the theme through `src/lib/theme/theme-contract.ts`.
- Keep preset files limited to CSS custom properties.
- Put reusable section composition in `src/styles/themes/sections/*/_sacred-keepsake.scss`.
- Do not keep a `cesar-ramses` theme alias or event override placeholder.
- Keep `angelic-presence` available for the reusable baptism demo.

## Step-by-Step Roadmap

1. Update tests to require `sacred-keepsake` as the theme preset while preserving the `cesar-ramses`
   event slug.
2. Rename preset and section partials from `cesar-ramses` to `sacred-keepsake`.
3. Replace event-named selectors, tokens, and comments with reusable sacred keepsake language.
4. Remove the empty event override and the global invitation import for it.
5. Update content, docs, and validation fallbacks so live code and documentation agree.

## Verification Plan

- `pnpm test -- tests/content/cesar-ramses-baptism-invitation.test.ts --runInBand`
- `pnpm test -- tests/unit/theme-presets.test.ts --runInBand`
- `pnpm test -- tests/content/schema.test.ts --runInBand`
- `pnpm ops validate-schema`
- `pnpm lint:styles`
- `pnpm type-check`
- `pnpm validate:event-parity`
- `pnpm build`
- Search reusable theme files for `cesar-ramses`, `Cesar Ramses`, `César Ramses`,
  `angelic-presence`, `color-angelic`, and `angelic-`.
