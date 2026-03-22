# Phase 02: Theme Engine & Semantic Layer Refactor

## Goal

Simplify the theme engine and establish the Semantic Layer as the CSS variable bridge.

## Steps

1. **Semantic Layer Mapping**:
   - Create `semantic/_color.scss` to map `$sys-` variables to `:root` CSS variables.
   - Use the pattern: `--color-[group]-[token]: #{$sys-color-xxx}`.
2. **Theme Preset Refactor**:
   - Update `src/styles/themes/presets/*.scss` to use direct CSS variable re-assignment.
   - Remove the `--*-override` pattern.
   - Example: `--color-surface-primary: var(--color-gold-50)`.
3. **Verification**:
   - Ensure the theme-preset classes still correctly apply the intended color schemes.
