# Phase 01: Redundancy Elimination

## Objective

Remove duplicate variable definitions across `_mixins.scss`, `_variables.scss`, and
`_functions.scss` to establish a single source of truth.

## Context

The audit revealed 6 critical redundancies:

| Variable                    | Locations                                                                | Impact                  |
| --------------------------- | ------------------------------------------------------------------------ | ----------------------- |
| `$transitions-by-component` | `_mixins.scss:8-45`, `_variables.scss:85-122`                            | 100% duplication        |
| `$breakpoints`              | `_mixins.scss:46-53`, `_variables.scss:127-134`, `_functions.scss:14-21` | 3x duplication          |
| `$border-radius`            | `_variables.scss:137-145`, `_functions.scss:32-40`                       | 2x duplication          |
| `$z-index`                  | `_variables.scss:147-157`, `_functions.scss:22-31`                       | 2x duplication          |
| `$backdrop-blurs`           | `_variables.scss:44-50`, `_functions.scss:7-13`                          | 2x duplication          |
| Color palette maps          | `_variables.scss:8-43`, `_functions.scss:42-78`                          | Semantic map duplicated |

## Implementation Steps

### 1. Consolidate to `_variables.scss` as Single Source

All shared variables should be defined ONLY in `src/styles/global/_variables.scss`:

```scss
// _variables.scss (ONLY location for shared variables)
$transitions-by-component: (
  button: (
    ...,
  ),
  card: (
    ...,
  ), // etc.
);

$breakpoints: (
  xs: 375px,
  sm: 640px, // etc.
);

$border-radius: (...);
$z-index: (...);
$backdrop-blurs: (...);
```

### 2. Update `_mixins.scss`

Remove local copies and import from `_variables.scss`:

```scss
// _mixins.scss
@use 'variables' as vars;

// Use vars.$transitions-by-component instead of local $transitions-by-component
// Use vars.$breakpoints instead of local $breakpoints
```

### 3. Update `_functions.scss`

Remove duplicate definitions and use variables:

```scss
// _functions.scss
@use 'variables' as vars;

// Use vars.$breakpoints, vars.$z-index, vars.$border-radius, vars.$backdrop-blurs
// Remove local color palette map - import via tokens instead
```

### 4. Update `@use` Statements

Ensure all files import from the canonical source:

```scss
// In any file that needs these variables:
@use '../global/variables' as vars;
@use '../tokens' as tokens;
```

## Files to Modify

| File                                | Action                                   |
| ----------------------------------- | ---------------------------------------- |
| `src/styles/global/_variables.scss` | KEEP all canonical definitions           |
| `src/styles/global/_mixins.scss`    | REMOVE duplicate definitions, use `@use` |
| `src/styles/global/_functions.scss` | REMOVE duplicate definitions, use `@use` |

## Verification

1. Compile SCSS without errors
2. Verify all breakpoints still work in responsive components
3. Verify transition timings unchanged
4. Test runtime theming in invitation pages

## Output

Single source of truth for shared variables with zero duplication.
