# Phase 04: Pattern Standardization & Documentation

## Objective

Enforce consistent SCSS patterns across the codebase and create documentation for future
contributions.

## Context

The audit revealed inconsistent patterns:

- Mix of `@use '../tokens' as tokens` vs `@use '../tokens' as *`
- Components using Sass token references instead of CSS variables
- No clear guidelines for when to use which token type

## Implementation Steps

### 1. Standardize Import Patterns

All component files should use the same import pattern:

```scss
// CORRECT: Consistent import
@use '../tokens' as tokens;
@use '../global/mixins' as mixins;

// WRONG: Wildcard import (loses namespace clarity)
@use '../tokens' as *;

// WRONG: Direct Sass variable usage in components
background: tokens.$color-surface-primary; // Breaks runtime theming!
```

### 2. Enforce CSS Variable Usage in Components

Components MUST use CSS variables for runtime theming:

```scss
// CORRECT: CSS variables with fallback
.invitation-hero {
  background: var(--color-surface-primary);
  color: var(--color-text-primary);
}

// WRONG: Sass variables (compile-time only)
.invitation-hero {
  background: tokens.$color-surface-primary; // NO!
  color: tokens.$color-text-primary; // NO!
}
```

Exception: Sass variables MAY be used for:

- Breakpoints in mixins
- Animation durations/easings
- Font stacks that don't need runtime switching

### 3. Create STYLEGUIDE.md

Create `docs/STYLEGUIDE.md`:

```markdown
# Celebra-me SCSS Styleguide

## Token Architecture

### 3-Layer System

1. **Primitives** (`tokens/_primitives.scss`)
   - Raw HSL color scales
   - NEVER use directly in components

2. **Semantic** (`tokens/_semantic.scss`)
   - Purpose-driven color roles
   - Always use CSS variables

3. **Themes** (`themes/presets/*.scss`, `themes/sections/*.scss`)
   - Runtime overrides
   - CSS variable redefinitions

## Variable Usage Rules

| Scenario             | Use                     | Never            |
| -------------------- | ----------------------- | ---------------- |
| Runtime theming      | CSS variables           | Sass variables   |
| Build-time constants | Sass variables          | Hardcoded values |
| Component defaults   | CSS vars with fallbacks | Raw primitives   |

## Naming Conventions

### CSS Variables (Runtime Theming)
```

--{category}-{variant}-{state} --color-text-primary --color-surface-dark --spacing-section-gap

```

### Sass Variables (Build-time)
```

${category}-{variant}-{state}
$color-text-primary $spacing-8
$font-size-h1

```

### Component Tokens
```

--{component}-{property}-{modifier} --family-bg --gallery-item-radius --rsvp-field-border

```

## File Organization

```

src/styles/ ├── tokens/ # Design tokens (primitives, semantic) ├── themes/ # Theme presets and
section variants ├── global/ # Global utilities, mixins, functions ├── components/ # Reusable
component styles ├── invitation/ # Invitation page styles ├── landing/ # Landing page styles ├──
dashboard/ # Dashboard styles └── auth.scss # Auth page styles

````

## Import Patterns

```scss
// Standard component import
@use '../tokens' as tokens;
@use '../global/mixins' as mixins;

// Function import (if needed)
@use '../global/functions' as funcs;

// Theme file import
@use '../themes/presets/luxury-hacienda';
````

## Component Template

```scss
@use '../tokens' as tokens;
@use '../global/mixins' as mixins;

.{component} {
  // Use CSS variables with token fallbacks
  background: var(--component-bg, var(--color-surface-primary));
  color: var(--component-text, var(--color-text-primary));

  // Typography via tokens
  font-family: var(--font-body, #{tokens.$font-body});

  // Spacing via tokens
  padding: var(--component-padding, #{tokens.$spacing-6});

  // Transitions via token mixins
  @include mixins.transition(button);

  // Responsive via token mixins
  @include mixins.respond-to(md) {
    padding: var(--component-padding-md, #{tokens.$spacing-8});
  }

  &__element {
    // Element-specific styles
    border: 1px solid var(--component-border, var(--color-border-subtle));
  }
}
```

## Anti-Patterns

### DO NOT

1. Hardcode color values:

```scss
// WRONG
color: #d93025;
background: rgb(0 0 0 / 40%);
```

2. Use primitives directly:

```scss
// WRONG
background: tokens.$base-gold-500;
color: tokens.$base-coffee-900;
```

3. Mix Sass and CSS variables incorrectly:

```scss
// WRONG - Sass vars don't respond to runtime theming
background: tokens.$color-surface-primary;

// CORRECT - CSS vars with fallback
background: var(--color-surface-primary);
```

4. Define tokens in component files:

```scss
// WRONG - Tokens belong in themes/sections/
:root {
  --my-component-bg: red;
}

// CORRECT - Components just consume
.component {
  background: var(--my-component-bg);
}
```

## Testing

1. **Build Test**: `npm run build` completes without errors
2. **Theme Test**: Each preset renders correctly
3. **Responsive Test**: Breakpoints work at all sizes
4. **Accessibility Test**: Color contrast meets WCAG AA

## Contributing

When adding new styles:

1. Always use tokens for colors, spacing, typography
2. Define component-specific tokens in section files
3. Override tokens in theme presets, not components
4. Test with at least 2 different presets
5. Update this guide if introducing new patterns

````

### 4. Add SCSS Linting Configuration

Create or update `.stylelintrc.json`:

```json
{
  "extends": "stylelint-config-standard-scss",
  "rules": {
    "color-no-hex": true,
    "scss/dollar-variable-pattern": "^[a-z]+-[a-z]+(-[a-z]+)*$",
    "scss/at-rule-no-unknown": true,
    "property-no-vendor-prefix": true,
    "selector-class-pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$"
  }
}
````

### 5. Update CI/CD

Add SCSS linting to pipeline:

```yaml
# .github/workflows/lint.yml
- name: Lint SCSS
  run: npx stylelint "src/styles/**/*.scss"
```

## Files to Create/Modify

| File                         | Action                     |
| ---------------------------- | -------------------------- |
| `docs/STYLEGUIDE.md`         | CREATE                     |
| `.stylelintrc.json`          | CREATE or UPDATE           |
| `.github/workflows/lint.yml` | ADD SCSS lint step         |
| All affected SCSS files      | REFACTOR to match patterns |

## Verification

1. All SCSS files pass linting
2. Styleguide accurately reflects codebase
3. CI/CD validates SCSS on every push
4. Code review checklist includes token usage

## Output

- Consistent SCSS patterns across codebase
- Comprehensive styleguide for future contributions
- Automated linting to maintain standards
