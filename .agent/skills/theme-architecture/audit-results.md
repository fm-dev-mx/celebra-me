# Theme Architecture Audit: Noir Premiere XV & Editorial Preset

## Overview

This audit identifies hardcoded color values and stylistic debt within the `editorial` variant of Celebra-me sections and the `noir-premiere-xv.scss` event file. These values bypass the **3-Layer Color Architecture** and should be mapped to global design tokens.

## 1. Hardcoded Value Discovery

### Core Color Palette Violations

| Raw Value | Frequency | Tentative Token Mapping | Context |
| :--- | :--- | :--- | :--- |
| `#050505` | High | `tokens.$color-surface-dark` / `primitives.$base-neutral-1000` | Section backgrounds, gradients |
| `#0d0d0d` | Medium | `tokens.$color-surface-dark` / `primitives.$base-neutral-900` | Secondary dark surfaces |
| `#f9f6f2` | High | `tokens.$color-text-on-dark` / `primitives.$base-parchment-100` | Primary text on dark, button labels |
| `#d4af37` | High | `tokens.$color-action-accent` / `primitives.$base-gold-500` | Gold accents, borders |
| `#c5a059` | Low | `primitives.$base-gold-400` | Gradient mid-tones |
| `#8a6d3b` | Low | `primitives.$base-gold-700` | Gradient dark-tones |
| `#e6e2d8` | Low | `primitives.$base-parchment-300` | Specific text highlights |
| `rgb(255 255 255 / 2%)` | Medium | `rgba(tokens.$base-neutral-0, 0.02)` | Subtle overlays |

### Spacing & Typography Debt

| Raw Value | Context | Recommended Token |
| :--- | :--- | :--- |
| `5rem`, `10rem`, `12rem` | Section padding | `tokens.$spacing-XX` (clamp or fixed) |
| `2.4rem`, `4.5rem` | Font sizes | `tokens.$font-size-hX` / `clamp` |
| `0.85rem`, `0.72rem` | Label sizes | `tokens.$font-size-label` |

## 2. File-Specific Variations

### `src/styles/events/noir-premiere-xv.scss`

- **Debt:** Contains hardcoded linear/radial gradients using raw hex.
- **Action:** Move to `_editorial.scss` as custom tokens or section overrides.

### `src/styles/themes/sections/_location-theme.scss`

- **Violation:** `data-variant='editorial'` uses raw `#050505` and hardcoded `perspective`, `filter: contrast(1.1)`.
- **Mapping:** Use `var(--color-surface-dark)` and semantic filter tokens.

### `src/styles/themes/sections/_hero-theme.scss`

- **Violation:** Ad-hoc linear-gradients for overlays and sparkle animations.
- **Mapping:** Centralize overlay logic into `_variables.scss` or `_editorial.scss`.

### `src/styles/themes/sections/_countdown-theme.scss`

- **Violation:** Overridden values for `countdown__segment` using raw `rgb(255 255 255 / 4%)`.
- **Mapping:** Use `$color-glass-bg` with adjusted opacity if needed.

## 3. Architecture Debt Matrix

| Layer | Status | Issues |
| :--- | :--- | :--- |
| **1. Design Tokens** | Stable | Native tokens exist in `_primitives.scss` and `_semantic.scss`. |
| **2. Theme Presets** | Incomplete | `_editorial.scss` is missing many required section tokens (Hero, Location, etc.). |
| **3. Section Variants** | Fragile | `editorial` variants are defined ad-hoc inside theme files, often ignoring Layer 2. |

## 4. Remediation Plan

1. **Saturate Layer 2**: Populate `src/styles/themes/presets/_editorial.scss` with all missing `--section-specific-tokens`.
2. **Harmonize Layer 3**: Update all `.section[data-variant='editorial']` selectors to use CSS variables defined in Layer 2.
3. **Delete Debt**: Remove `src/styles/events/noir-premiere-xv.scss` after verifying all its unique styles are absorbed into the `editorial` preset.
