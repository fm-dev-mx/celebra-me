# Typography System

**Last Updated:** 2026-07-16

This document defines the active, route-scoped typography stack.

## Loaded Runtime Families

`Layout.astro` loads Montserrat for the shared application shell. Invitation font imports live in
the active preset entrypoints under `src/styles/invitation-presets/*.scss`, so a route downloads
only the families required by its preset. The supported family vocabulary includes Cinzel, Playfair
Display, Pinyon Script, EB Garamond, Montserrat, Cormorant Garamond, Bodoni Moda, Instrument Sans,
The Nautigal, and Special Elite.

## Core Roles

- Display Formal: Cinzel
- Display Elegant: Playfair Display
- Display Hacienda: Cormorant Garamond
- Display Editorial: Bodoni Moda
- Calligraphy: Pinyon Script and The Nautigal
- Body Narrative: EB Garamond
- UI/Functional: Montserrat and Instrument Sans
- Accent/ornamental fallbacks: Special Elite
- Celestial Blue editorial pairing: Cormorant Garamond + Instrument Sans

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

- **Shared shell cap**: keep the global layout to the UI family unless a cross-application need is
  proven.
- **Preset scope**: add invitation families to the owning preset stylesheet, not to `Layout.astro`.
- **Fallbacks**: Always provide generic fallbacks (`serif`, `sans-serif`) in the CSS variables to
  prevent invisible text during loading.

## Usage Rules

- Use the `--font-*` CSS variables in theme-sensitive component styles.
- Do not hardcode raw font-family declarations inside invitation section styles when a runtime token
  already exists.
- If the loaded font list changes, update this doc and the owning layout or preset entrypoint in the
  same task.
