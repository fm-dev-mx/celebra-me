---
title: Color Architecture Audit
status: archived
created: unknown
updated: 2026-05-31
---

# Color Architecture Audit

## 1. Audit Report

### Critical: Invalid CSS Alpha Syntax

- **Problem**: The helper function `tools.rgb-channels()` in `_functions.scss` returns
  comma-separated values (e.g. `255, 255, 255`). However, almost every single theme and component
  file attempts to compose alpha using the modern slash syntax:
  `rgb(var(--color-something-rgb) / 50%)`. This evaluates to `rgb(255, 255, 255 / 50%)` which is
  **invalid CSS** and breaks rendering across the site.
- **Affected Areas**: `_base-theme.scss`, `_auth-theme.scss`, `ui/_status-pages.scss`, and every
  single theme present in `themes/sections/thank-you`, `rsvp`, etc.
- **Missing alpha percentages**: Some cases use `/ 50%`, while others use `/ 0.5`. Some tokens use
  numbers where percentages are expected depending on browser support for slash syntax mixed with
  legacy variables.

### High: Undefined Variables and Fragile Fallbacks

- **Problem**: Many components rely on extremely deep fallback chains involving variables that are
  not consistently defined outside their localized theme scope.
- **Example**: `var(--rsvp-error-field, var(--color-state-danger, rgb(166 46 46)))` in
  `rsvp/_luxury-hacienda.scss`. If the theme fails to provide `--color-state-danger`, it falls back
  to a hardcoded red instead of pulling from the canonical system palette.

### Medium: Hardcoded Colors and Duplication

- **Problem**: System palettes define beautiful scales, but developers are bypassing them with raw
  hardcoded RGB/HEX values in components/themes.
- **Affected files**:
  - `_surface.scss` heavily hardcodes `rgb(255 255 255 / 45%)` and `rgb(212 175 55)` instead of
    using existing `$sys-color-neutral-0` and `$sys-color-gold-500`.
  - `thank-you/_luxury-hacienda.scss` relies on raw values like `rgb(47 33 24)`, `rgb(20 15 11)`,
    and `rgb(170 120 56)`.
- **Contrast risks**: `luxury-hacienda` blends thick brown gradients like `rgb(64 47 36 / 62%)` over
  dark surfaces, muddying the aesthetic and creating contrast risks for embedded text.

### Low: Unclear Ownership

- **Problem**: Variables such as `--color-border-subtle` are re-declared inconsistently inside
  section themes (`_base-theme.scss`), overriding semantic meaning set by `_color.scss`.

---

## 2. Source-of-Truth Map

To prevent cascade problems, layers should strictly communicate downstream:

1. **System Palette** (`src/styles/tokens/system/_color.scss`):
   - Only raw HSL variables (e.g. `$sys-color-coffee-500`).
   - No CSS variables (`--var`) published here.

2. **Semantic Tokens** (`src/styles/tokens/semantic/_color.scss`):
   - Maps system colors to functional names (`$semantic-color: ( surface: primary: ... )`).
   - Generates the `:root` variables: `--color-surface-primary`, `--color-surface-primary-rgb`.

3. **Theme Presets** (`src/styles/themes/presets/`):
   - Redefines the `:root` CSS variables from the semantic layer using specific values from the
     System Palette.
   - Example: overwriting `--color-surface-primary` for a dark theme.

4. **Component Contracts** (`src/styles/components/`):
   - Only read from the `--color-*` CSS variables defined in the semantic layer. Do not read
     directly from `$sys-` variables unless it's a fixed un-themeable asset.
   - Example: `background-color: rgb(var(--color-surface-elevated-rgb) / 50%);`

5. **Section-specific Overrides** (`src/styles/themes/sections/`):
   - Used only for highly specific, non-reusable layout adjustments. Must not redeclare core color
     variables.

---

## 3. Cleanup Plan

### Step 1: Fix the Invalid CSS Global Alpha Composition (Critical)

- **Files**: `src/styles/tools/_functions.scss`
- **Action**: Update `rgb-channels()` to return _space-separated_ values instead of comma-separated.
- **Risk**: Critical but highly beneficial; this single fix will instantly repair transparent glass
  effects and soft borders site-wide.
- **Validation**: Build CSS and inspect in browser; check if `#deckle-edge-filter` or glass surfaces
  are restored.

### Step 2: Remove Hardcoded Palette Bleed inside Semantic Layers

- **Files**: `src/styles/tokens/semantic/_surface.scss`, `tokens/system/_elevation.scss`
- **Action**: Replace `rgb(212 175 55)` with `var(--color-action-accent)` and `rgb(255 255 255)`
  with `var(--color-surface-elevated)`.
- **Risk**: Low.
- **Validation**: Compare visual output of a standard RSVP page before and after.

### Step 3: Replace Hardcoded Elements in Themes

- **Files**: `thank-you/_luxury-hacienda.scss` and other deeply styled presets.
- **Action**: Convert raw `rgb()` browns, coffees, and golds into uses of standard
  `--color-surface-canvas` or `--color-surface-secondary`. Move unique gradient combinations to
  proper shared variables.
- **Risk**: Medium. Requires visual QA for the specific luxury-hacienda URL to ensure the theme
  still feels correct.
- **Validation**: Run dev server and manually navigate to `luxury-hacienda` thank-you route.

### Step 4: Streamline Variable Fallback Chains

- **Files**: `src/styles/themes/sections/rsvp/*.scss`
- **Action**: Remove deeply nested variable fallbacks like
  `var(--rsvp-error-field, var(--color-state-danger, rgb(...)))`. Provide a single robust map in the
  semantic tokens layer.
- **Risk**: Low.
- **Validation**: Run existing unit tests (`pnpm test` if available) and typecheck. Create an
  intentional form error state on RSVP to see the red warning styles.

---

## 4. Specific Recommendations (Before / After Examples)

### A. The CSS Syntax Fix

**Before (`_functions.scss`)**:

```scss
@return #{color.channel($value, 'red', $space: rgb)},
  #{color.channel($value, 'green', $space: rgb)}, #{color.channel($value, 'blue', $space: rgb)};
```

**After (`_functions.scss`)**:

```scss
@return #{color.channel($value, 'red', $space: rgb)} #{color.channel($value, 'green', $space: rgb)}
  #{color.channel($value, 'blue', $space: rgb)};
```

### B. Decoupling Hardcoded Values from Utilities

**Before (`_surface.scss`)**:

```scss
--color-glass-bg: rgb(255 255 255 / 45%);
--color-glass-border: rgb(212 175 55 / 30%);
```

**After (`_surface.scss`)**:

```scss
--color-glass-bg: rgb(var(--color-surface-elevated-rgb) / 45%);
--color-glass-border: rgb(var(--color-action-accent-rgb) / 30%);
```

### C. Simplifying Fallbacks

**Before (`rsvp/_luxury-hacienda.scss`)**:

```scss
--rsvp-error-field: var(--color-state-danger, rgb(166 46 46));
```

**After (`rsvp/_luxury-hacienda.scss`)**: _(Assuming `--color-state-danger` is reliably published by
the semantic layer)_

```scss
--rsvp-error-field: var(--color-state-danger);
```
