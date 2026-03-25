---
name: theme-architecture
description:
  Manage the technical implementation of the 3-Layer Color Architecture, Theme Presets (`.scss`),
  and Design Tokens in Celebra-me.
domain: frontend
when_to_use:
  - Editing SCSS tokens, presets, theme sections, or component styling architecture
  - Reviewing theme consistency, token usage, or preset isolation
preconditions:
  - Read .agent/README.md
  - Read .agent/GATEKEEPER_RULES.md
inputs:
  - Theme SCSS files, design tokens, presets, and section styles
outputs:
  - Implementation guidance for theme-safe SCSS architecture
related_docs:
  - docs/domains/theme/architecture.md
  - docs/domains/theme/typography.md
---

# Theme Architecture

> **Related skills**: [`frontend-design`](../frontend-design/SKILL.md) for aesthetic guidelines,
> [`astro-patterns`](../astro-patterns/SKILL.md) for component usage.

This skill governs the **styling infrastructure** of Celebra-me. It separates the _definition_ of a
theme (variables) from the _implementation_ of UI components.

## Core Architecture

### 1. The "Preset" Pattern

Themes are defined by **CSS Variables** injected at the root level via a class.

**Location**: `src/styles/themes/presets/_my-theme.scss`

```scss
// ✅ CORRECT: Only variables
.theme-preset--my-theme {
  --color-surface-primary: #fff;
  --font-display: 'Cinzel', serif;
}

// ❌ INCORRECT: Direct styles
.theme-preset--my-theme .card {
  // FORBIDDEN
  background: red;
}
```

### 2. The "Section" Pattern

Visual styles for specific sections (Hero, Quote, RSVP) are encapsulated in dedicated partials that
respond to `[data-variant]`.

**Location**: `src/styles/themes/sections/_quote-theme.scss`

```scss
.quote-section {
  // Base styles...

  &[data-variant='jewelry-box'] {
    // Specific overrides for this variant
    background-color: var(--color-surface-primary);
    border: 1px solid var(--color-border-subtle);
  }

  &[data-variant='luxury-hacienda'] {
    background-image: url('/textures/leather.jpg');
  }
}
```

### 3. Design Tokens

Always use semantic tokens found in `src/styles/tokens/`. Never hardcode hex values in components.

| Token Type  | Example                        | Usage                       |
| :---------- | :----------------------------- | :-------------------------- |
| **Color**   | `var(--color-surface-primary)` | Main background             |
| **Color**   | `var(--color-action-accent)`   | Primary buttons, highlights |
| **Font**    | `var(--font-display-elegant)`  | Headings (H1, H2)           |
| **Spacing** | `var(--spacing-md)`            | Padding, Margins            |

## Integration with Astro

### Config & Schemas

New variants **MUST** be registered in the **Theme Contract** first, then mapped in the modular
schema before use.

**Location**: `src/lib/theme/theme-variants.ts` (Literal Definitions) **Location**:
`src/lib/schemas/content/section-styles.schema.ts` (Zod Enforcement)

```typescript
// 1. Update Contract (theme-variants.ts)
export const QUOTE_VARIANTS = [... , 'new-variant'] as const;

// 2. Schema will automatically consume it via enum(QUOTE_VARIANTS)
// inside src/lib/schemas/content/section-styles.schema.ts
```

### Usage in Components

Components accept a `variant` prop and apply it as a data attribute.

```astro
---
interface Props {
  variant: 'elegant' | 'jewelry-box';
}
const { variant } = Astro.props;
---

<section class="quote-section" data-variant={variant}>
  <slot />
</section>
```

## Theme Switching

The active theme is determined by the `theme-preset--{name}` class on the `<body>` or main wrapper.
This is controlled dynamically by the `[slug].astro` page based on the event configuration.
