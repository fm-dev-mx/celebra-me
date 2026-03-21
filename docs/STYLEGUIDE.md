# SCSS Styleguide - Celebra-me

## Overview

This styleguide defines the architecture and patterns for SCSS in the Celebra-me project. Following
these guidelines ensures maintainability, theming support, and consistent code quality.

---

## Table of Contents

1. [Token Architecture](#token-architecture)
2. [File Organization](#file-organization)
3. [Import Patterns](#import-patterns)
4. [CSS Variable Usage](#css-variable-usage)
5. [Naming Conventions](#naming-conventions)
6. [Component Patterns](#component-patterns)
7. [Anti-Patterns](#anti-patterns)

---

## Token Architecture

### Token Hierarchy

1. **Primitives** (`tokens/_primitives.scss`)
   - Raw values: colors, spacing, typography
   - Never reference other tokens
   - Use descriptive names: `$base-coffee-900`, `$spacing-4`

2. **Semantic Tokens** (`tokens/_semantic.scss`)
   - Map primitives to purpose: `$color-text-primary`, `$color-action-accent`
   - Enable theming through CSS custom properties

3. **Section Tokens** (`themes/sections/*.scss`)
   - Section-specific values: `--family-*`, `--gallery-*`, `--rsvp-*`
   - Define defaults that can be overridden by themes

### Token Usage Rules

```scss
// CORRECT: Use semantic tokens
background: var(--color-surface-primary);
color: var(--color-text-primary);

// CORRECT: Use section tokens with fallbacks
background: var(--family-bg, var(--color-surface-primary));

// WRONG: Use SCSS variables from tokens in components
background: tokens.$color-surface-primary;

// CORRECT: SCSS variables are OK in mixins and functions
@mixin surface-glass($bg-color-rgb: --color-surface-primary-rgb) {
  background: rgb(var(#{$bg-color-rgb}), #{$opacity});
}
```

---

## File Organization

```
src/styles/
├── tokens/
│   ├── _primitives.scss      # Raw design values
│   ├── _semantic.scss        # Purpose-driven tokens
│   ├── _typography.scss      # Font families, sizes
│   ├── _motion.scss          # Durations, easing
│   ├── _spacing.scss         # Spacing scale
│   └── _index.scss           # Forward all tokens
├── global/
│   ├── _variables.scss       # Shared variables (breakpoints, z-index)
│   ├── _mixins.scss          # Reusable mixins
│   ├── _functions.scss       # Helper functions
│   └── _index.scss
├── themes/
│   ├── sections/
│   │   ├── _tokens.scss      # Section token contracts
│   │   ├── _family-tokens.scss
│   │   ├── _gallery-tokens.scss
│   │   ├── _rsvp-tokens.scss
│   │   ├── _hero-tokens.scss
│   │   ├── _family-theme.scss
│   │   └── ...
│   └── presets/
├── invitation/
│   ├── _hero.scss
│   ├── _family.scss
│   └── ...
└── dashboard/
```

---

## Import Patterns

### Correct Import Syntax

```scss
// CORRECT: Namespace imports
@use '../tokens' as tokens;
@use '../global/mixins' as mixins;
@use '../global/functions' as funcs;

// CORRECT: Variable imports for fallbacks
@use '../../tokens' as tokens;
font-family: var(--font-display, #{tokens.$font-display-elegant});

// WRONG: Wildcard imports
@use '../tokens' as *;

// WRONG: No namespace
@use '../tokens';
```

### Import Order

1. `@use 'sass:*'` (built-in modules)
2. `@use '../tokens'` (design tokens)
3. `@use '../global/mixins'` (mixins)
4. `@use '../global/functions'` (functions)
5. Component styles

---

## CSS Variable Usage

### Prefer CSS Variables Over Hardcoded Values

```scss
// CORRECT
color: var(--color-action-accent);
background: rgb(var(--color-surface-primary-rgb), 0.7);

// WRONG
color: #d4af37;
background: rgb(245, 245, 220, 0.7);
```

### Token Fallback Pattern

```scss
// Always provide fallback for section-specific tokens
background: var(--family-bg, var(--color-surface-primary));
border: 1px solid var(--family-border, rgb(var(--color-text-primary-rgb), 0.16));
```

### RGB Channel Pattern

```scss
// Use RGB variables for transparency
background: rgb(var(--color-surface-primary-rgb), 0.8);

// Instead of
background: rgba(245, 245, 220, 0.8);
```

---

## Naming Conventions

### SCSS Variables

```scss
// Pattern: $group-property-modifier
$color-text-primary: ...;
$font-size-h1: ...;
$breakpoints: (...);
$z-index-header: 10;

// WRONG: inconsistent patterns
$textColor: ...;
$TitleSize: ...;
```

### CSS Custom Properties

```scss
// Pattern: $section-property-modifier
--family-bg: ...;
--family-panel-border: ...;
--gallery-item-radius: ...;
--rsvp-error-bg: ...;

// BEM-influenced section tokens
--hero-title-size: ...;
--hero-scroll-indicator-color: ...;
```

### Classes

```scss
// BEM with BEMIT
.section {
}
.section__element {
}
.section--modifier {
}

// Block with data attributes for variants
.family[data-variant='editorial'] {
}
.family[data-variant='jewelry-box'] {
}
```

---

## Component Patterns

### Base Component Structure

```scss
@use '../tokens' as tokens;
@use '../global/mixins' as mixins;

.component {
  // CSS variables at root level for theming
  --component-bg: var(--color-surface-primary);
  --component-text: var(--color-text-primary);

  // Styles
  background: var(--component-bg);
  color: var(--component-text);

  &__element {
    // ...
  }

  &--variant {
    --component-bg: var(--color-surface-secondary);
  }

  @include mixins.respond-to(md) {
    // Responsive styles
  }
}
```

### Theme Override Pattern

```scss
// In themes/sections/_family-theme.scss

// Define CSS variable overrides for each theme
.family[data-variant='editorial'] {
  --family-bg: radial-gradient(circle at bottom right, #0d0d0d, #050505);
  --family-panel-bg: rgb(var(--color-surface-primary-rgb), 0.82);
}

.family[data-variant='jewelry-box'] {
  --family-bg: radial-gradient(circle at 50% -20%, #fffdfc, var(--color-surface-primary));
  --family-panel-bg: rgb(var(--color-surface-primary-rgb), 0.82);
}
```

---

## Anti-Patterns

### Avoid

- **Hardcoded hex/rgb values** in components
- **Wildcard imports** (`@use 'tokens' as *`)
- **Deep nesting** (max 3 levels)
- **Duplicate selectors**
- **`!important`** except for utility classes
- **Raw values** without token fallbacks

### Never Do

```scss
// WRONG: Hardcoded color
background: #d4af37;

// CORRECT: Token reference
background: var(--color-action-accent);

// WRONG: Raw value without fallback
border: 1px solid rgb(255, 255, 255);

// CORRECT: Token with fallback
border: 1px solid rgba($color-white, 0.5);

// WRONG: Too deep nesting
.nav {
  .nav__list {
    .nav__item {
      .nav__link {
        color: red;
      }
    }
  }
}

// CORRECT: Flat structure
.nav {
}
.nav__list {
}
.nav__item {
}
.nav__link {
}
```

---

## Linting

Run SCSS linting:

```bash
npm run lint:scss
```

The project uses Stylelint with `stylelint-config-standard-scss`. Key rules:

- BEM naming enforced
- No `!important` (except utilities)
- Modern color function notation
- No duplicate selectors
- Max 3 nesting depth
