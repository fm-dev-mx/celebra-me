# Phase 02: Token Unification

## Objective

Consolidate section-specific CSS tokens into canonical contracts, ensuring all theme presets can
uniformly override component styles.

## Context

Currently, section tokens are scattered:

- Some defined in `themes/sections/_tokens.scss`
- Some defined in individual section files (e.g., `_family.scss`, `_gallery.scss`)
- Some defined directly in preset files

This creates inconsistency where some sections respect theming while others don't.

## Current Token Inventory

| Section           | Tokens Defined | Defined In             |
| ----------------- | -------------- | ---------------------- |
| Base Section      | 12 tokens      | `_tokens.scss`         |
| Family            | 28 tokens      | `_family.scss:11-108`  |
| Gallery           | 45+ tokens     | `_gallery.scss:5-88`   |
| RSVP              | 22 tokens      | `_rsvp.scss:19-35`     |
| Hero              | 15 tokens      | Presets + `_hero.scss` |
| Landing (Elegant) | 60+ tokens     | `_elegant.scss`        |

## Implementation Steps

### 1. Audit Existing Tokens

Document all tokens currently defined in:

- `themes/sections/_tokens.scss`
- `themes/sections/_family-theme.scss`
- `themes/sections/_gallery-theme.scss`
- `themes/sections/_rsvp-theme.scss`
- `themes/sections/_hero-theme.scss`
- `invitation/_family.scss`
- `invitation/_gallery.scss`
- `invitation/_rsvp.scss`
- `invitation/_hero.scss`

### 2. Create Canonical Token Contracts

Each section should have a dedicated token file:

```
themes/sections/
├── _tokens.scss           # Base section tokens
├── _family-tokens.scss    # Family section tokens (NEW)
├── _gallery-tokens.scss   # Gallery section tokens (NEW)
├── _rsvp-tokens.scss      # RSVP section tokens (NEW)
├── _hero-tokens.scss      # Hero section tokens (NEW)
└── ...
```

### 3. Token Contract Template

```scss
// themes/sections/_family-tokens.scss
// Canonical token contract for Family section

:root {
  // Background & Surface
  --family-bg: var(--color-surface-primary);
  --family-panel-bg: rgb(var(--color-surface-primary-rgb), 0.7);
  --family-media-bg: rgb(17 12 9);

  // Borders & Dividers
  --family-border: rgb(var(--color-text-primary-rgb), 0.16);
  --family-divider: rgb(var(--color-text-primary-rgb), 0.2);

  // Typography
  --family-name-font: var(--font-display);
  --family-name-size: clamp(1.3rem, 3vw, 1.9rem);
  --family-meta-size: 0.72rem;
  --family-meta-letter-spacing: 0.18em;

  // Spacing
  --family-header-margin: clamp(2.5rem, 5vw, 4rem);
  --family-group-padding-block: clamp(1rem, 2.1vw, 1.4rem);

  // Effects
  --family-shadow: 0 18px 40px rgb(0 0 0 / 12%);
  --family-media-filter: none;
}
```

### 4. Update Component Files

Components should reference token variables with fallback to semantic tokens:

```scss
// invitation/_family.scss
.family {
  background: var(--family-bg, var(--color-surface-primary));
  color: var(--family-text-primary, var(--color-text-primary));

  &__panel {
    border: 1px solid var(--family-border, rgb(var(--color-text-primary-rgb), 0.16));
    background: var(--family-panel-bg);
    box-shadow: var(--family-shadow);
  }
}
```

### 5. Ensure Presets Override Tokens

All presets should define their section-specific overrides:

```scss
// themes/presets/_luxury-hacienda.scss
.theme-preset--luxury-hacienda {
  // Family Section
  --family-bg: linear-gradient(155deg, ...);
  --family-border: rgb(var(--color-action-accent-rgb), 0.24);
  --family-shadow: none;

  // Gallery Section
  --gallery-section-bg: var(--color-surface-primary);
}
```

## Files to Create/Modify

| File                                   | Action                 |
| -------------------------------------- | ---------------------- |
| `themes/sections/_family-tokens.scss`  | CREATE                 |
| `themes/sections/_gallery-tokens.scss` | CREATE                 |
| `themes/sections/_rsvp-tokens.scss`    | CREATE                 |
| `themes/sections/_hero-tokens.scss`    | CREATE                 |
| `themes/sections/_tokens.scss`         | ENHANCE with imports   |
| `invitation/_family.scss`              | REFACTOR to use tokens |
| `invitation/_gallery.scss`             | REFACTOR to use tokens |
| `invitation/_rsvp.scss`                | REFACTOR to use tokens |
| `invitation/_hero.scss`                | REFACTOR to use tokens |

## Verification

1. All sections render correctly with default tokens
2. Each preset correctly overrides section tokens
3. Runtime theme switching works on all sections
4. No hardcoded values remain in component files

## Output

Canonical token contracts for all sections with consistent override patterns.
