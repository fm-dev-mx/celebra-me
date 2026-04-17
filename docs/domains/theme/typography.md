# Typography System

**Last Updated:** 2026-04-17

This document defines the active typography stack loaded by `src/layouts/Layout.astro`.

## Loaded Runtime Families

`Layout.astro` currently loads nine font families:

1. Cinzel
2. Playfair Display
3. Pinyon Script
4. EB Garamond
5. Montserrat
6. Cormorant Garamond
7. Bodoni Moda
8. The Nautigal
9. Special Elite

## Core Roles

- Display Formal: Cinzel
- Display Elegant: Playfair Display
- Display Hacienda: Cormorant Garamond
- Display Editorial: Bodoni Moda
- Calligraphy: Pinyon Script and The Nautigal
- Body Narrative: EB Garamond
- UI/Functional: Montserrat
- Accent/ornamental fallbacks: Special Elite

## Token Sources

- Authoring aliases: `src/styles/tokens/_typography.scss`
- Semantic/runtime type tokens: `src/styles/tokens/semantic/_type.scss`
- Runtime CSS variables consumed by components: `src/styles/global.scss`

## Runtime Variable Surface

Current runtime typography variables include:

- `--font-display`
- `--font-display-formal`
- `--font-display-elegant`
- `--font-display-hacienda`
- `--font-calligraphy`
- `--font-body`
- `--font-body-narrative`
- `--font-body-hacienda`
- `--font-ui`

## Performance & Budget

Loading multiple font families impacts page load performance and Cumulative Layout Shift (CLS).

- **Family Cap**: The current stack is limited to **9 families**.
- **Audit Requirement**: Any new family added to `Layout.astro` must be justified by a premium theme
  (e.g., Jewelry Box, Luxury Hacienda).
- **Follow-up**: Font families are still imported globally today; reduce or route-scope them only
  after a preset-by-preset typography audit to avoid regressions.
- **Fallbacks**: Always provide generic fallbacks (`serif`, `sans-serif`) in the CSS variables to
  prevent invisible text during loading.

## Usage Rules

- Use the `--font-*` CSS variables in theme-sensitive component styles.
- Do not hardcode raw font-family declarations inside invitation section styles when a runtime token
  already exists.
- If the loaded font list changes, update this doc and `src/layouts/Layout.astro` in the same task.
