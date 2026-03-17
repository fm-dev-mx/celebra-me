# Typography System

This document defines the active typography stack and how it is loaded.

## Loaded Fonts (Runtime)

`src/layouts/Layout.astro` loads eight families:

1. Cinzel (`@fontsource-variable/cinzel`)
2. Playfair Display (`@fontsource-variable/playfair-display`)
3. Pinyon Script (`@fontsource/pinyon-script`)
4. EB Garamond (`@fontsource-variable/eb-garamond`)
5. Montserrat (`@fontsource-variable/montserrat`)
6. Cormorant Garamond (`@fontsource-variable/cormorant-garamond`)
7. Special Elite (`@fontsource/special-elite`)
8. Rye (`@fontsource/rye`)

## Core Roles

Primary tokens still map to the Core 5 roles:

- Display Formal: Cinzel
- Display Elegant: Playfair Display
- Calligraphy: Pinyon Script
- Body Narrative: EB Garamond
- UI/Functional: Montserrat

Additional families (`Cormorant Garamond`, `Special Elite`, `Rye`) are loaded for preset-specific
accents and fallback stylization.

## Token Sources

- SCSS token source: `src/styles/tokens/_typography.scss`
- Global CSS variables: `src/styles/global.scss`

## Usage Rules

- Use token-based CSS variables (`--font-*`) in component/theme styles.
- Do not hardcode raw font family names in section styles.
- If adding/removing loaded fonts, update both this doc and `Layout.astro` in the same PR.

## Runtime Variable Surface

The runtime typography variables exposed by `src/styles/global.scss` now include:

- `--font-display`
- `--font-display-formal`
- `--font-display-elegant`
- `--font-display-hacienda`
- `--font-calligraphy`
- `--font-body`
- `--font-body-narrative`
- `--font-body-hacienda`
- `--font-ui`

Preset-sensitive invitation sections should consume these CSS variables instead of direct
`tokens.$font-*` values when the chosen preset can change the rendered font stack at runtime.

---

**Last Updated:** 2026-03-16 (Phase 03 Q1 2026 Audit Sync)
