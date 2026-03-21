# Phase 03: Hardcoded Value Elimination

## Objective

Replace raw CSS values (hex, rgb, rgba, numeric) with semantic token references throughout the
component files.

## Context

Components should NEVER contain hardcoded values. All visual values should reference:

1. Semantic tokens (`--color-text-primary`, `--spacing-4`, etc.)
2. Component tokens (`--family-bg`, `--gallery-item-radius`, etc.)
3. CSS functions (`calc()`, `rgb()`, with tokenized channels)

## Hardcoded Values Found

### Critical (Must Fix)

| File                      | Line    | Hardcoded Value          | Should Be                                     |
| ------------------------- | ------- | ------------------------ | --------------------------------------------- |
| `invitation/_hero.scss`   | 38-44   | `rgb(0 0 0 / 40%)`       | `--overlay-dark` or `--hero-overlay`          |
| `invitation/_hero.scss`   | 152     | `rgb(255 255 255 / 70%)` | `--color-text-on-dark`                        |
| `invitation/_family.scss` | 108     | `rgb(17 12 9)`           | `--family-media-bg`                           |
| `invitation/_rsvp.scss`   | 231-232 | `rgb(255, 77, 77)`       | `--color-error-rgb` (exists but inconsistent) |

### High Priority

| File                    | Hardcoded Value                   | Should Be                                 |
| ----------------------- | --------------------------------- | ----------------------------------------- |
| `dashboard/_shell.scss` | `rgb(212 175 55 / 8%)`            | `--color-action-accent` at 8% opacity     |
| `dashboard/_shell.scss` | `rgb(58 40 25 / 5%)`              | `--color-text-primary` at 5% opacity      |
| `dashboard/_shell.scss` | `#fff`, `white`                   | `--color-white` or `--color-text-on-dark` |
| `dashboard/_shell.scss` | `color.adjust($base-gold-700...)` | Should use CSS variable                   |

### Medium Priority

| File                       | Hardcoded Value        | Should Be              |
| -------------------------- | ---------------------- | ---------------------- |
| `invitation/_hero.scss`    | `transparent`          | Already tokenized      |
| `invitation/_gallery.scss` | Various opacity values | Already using CSS vars |

## Implementation Steps

### 1. Create Missing Semantic Tokens

Add to `tokens/_semantic.scss`:

```scss
// Error states
$color-error-rgb: var(--color-error-rgb, 217, 48, 37);
$color-error-field: var(--color-error-field, #d93025);

// Overlays
$overlay-dark: var(--overlay-dark, rgb(0 0 0 / 40%));
$overlay-light: var(--overlay-light, rgb(255 255 255 / 70%));

// Neutral
$color-white: var(--color-white, 255 255 255);
```

### 2. Define Component-Specific Tokens

Add to section token files:

```scss
// themes/sections/_hero-tokens.scss
:root {
  --hero-overlay: rgb(0 0 0 / 40%);
  --hero-overlay-gradient: linear-gradient(
    to bottom,
    transparent 0%,
    rgb(0 0 0 / 20%) 50%,
    rgb(0 0 0 / 60%) 100%
  );
  --hero-scroll-indicator-color: rgb(255 255 255 / 70%);
}

// themes/sections/_family-tokens.scss
:root {
  --family-media-bg: rgb(17 12 9);
}

// themes/sections/_rsvp-tokens.scss
:root {
  --rsvp-error-bg: rgb(217 48 37 / 10%);
  --rsvp-error-border: rgb(217 48 37 / 28%);
}
```

### 3. Update Component Files

Replace hardcoded values:

**Before (invitation/\_hero.scss):**

```scss
&::after {
  background:
    radial-gradient(circle at center, transparent 20%, rgb(0 0 0 / 40%) 100%),
    linear-gradient(to bottom, transparent 0%, rgb(0 0 0 / 20%) 50%, rgb(0 0 0 / 60%) 100%);
}
```

**After:**

```scss
&::after {
  background: var(
    --hero-overlay-gradient,
    linear-gradient(to bottom, transparent 0%, rgb(0 0 0 / 20%) 50%, rgb(0 0 0 / 60%) 100%)
  );
}
```

**Before (invitation/\_hero.scss:152):**

```scss
color: rgb(255 255 255 / 70%);
```

**After:**

```scss
color: var(--hero-scroll-indicator-color, rgb(255 255 255 / 70%));
```

### 4. Update Dashboard Shell

**Before (dashboard/\_shell.scss):**

```scss
background:
  radial-gradient(circle at top right, rgb(212 175 55 / 8%), transparent 40%),
  radial-gradient(circle at bottom left, rgb(58 40 25 / 5%), transparent 40%),
  $color-surface-primary;
```

**After:**

```scss
background:
  radial-gradient(circle at top right, rgb(var(--color-action-accent-rgb), 0.08), transparent 40%),
  radial-gradient(circle at bottom left, rgb(var(--color-text-primary-rgb), 0.05), transparent 40%),
  var(--color-surface-primary);
```

### 5. Standardize Error Colors

**Before (invitation/\_rsvp.scss):**

```scss
background: rgb(var(--color-error-rgb, 255, 77, 77), 0.1);
border: 1px solid rgb(var(--color-error-rgb, 255, 77, 77), 0.28);
```

**After:**

```scss
background: var(--rsvp-error-bg, rgb(var(--color-error-rgb), 0.1));
border: 1px solid var(--rsvp-error-border, rgb(var(--color-error-rgb), 0.28));
```

## Files to Modify

| File                                  | Changes                                   |
| ------------------------------------- | ----------------------------------------- |
| `tokens/_semantic.scss`               | Add missing tokens                        |
| `invitation/_hero.scss`               | Replace overlay, scroll indicator colors  |
| `invitation/_family.scss`             | Replace media background                  |
| `invitation/_rsvp.scss`               | Standardize error colors                  |
| `dashboard/_shell.scss`               | Replace gradient colors, white references |
| `themes/sections/_hero-tokens.scss`   | Define hero tokens                        |
| `themes/sections/_family-tokens.scss` | Define family tokens                      |
| `themes/sections/_rsvp-tokens.scss`   | Define rsvp tokens                        |

## Verification

1. Compile SCSS without errors
2. Visual inspection of all affected components
3. Verify error states display correctly
4. Test dashboard theming

## Output

Zero hardcoded color values in component files.
