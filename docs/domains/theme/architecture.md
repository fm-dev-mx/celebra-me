# Theme System & Inventory Architecture

## 1. System Overview (Theme Presets)

This document describes the visual customization system that allows each event to have a unique and
irrepeatable identity. Events define specific styles per section.

Each event can configure its styles in the JSON file (example):

```json
{
	"sectionStyles": {
		"quote": {
			"variant": "elegant",
			"fontStyle": "serif",
			"animation": "fade"
		}
	}
}
```

## 2. Sections Inventory and CSS Architecture

- **Main Selector**: All section styles are encapsulated using `[data-variant='...']`.
- **Styles Location**: Theme styles reside in `src/styles/themes/sections/_<section>-theme.scss`.
- **Isolation Law**: Base styles do NOT contain theme logic; theme presets in
  `src/styles/themes/presets/` do NOT contain class selectors (e.g., `.card`), their only
  responsibility is defining CSS variables.

| Section               | Component             | Theme File (SCSS)       | Base Variants                                                    |
| --------------------- | --------------------- | ----------------------- | ---------------------------------------------------------------- |
| **Hero**              | `Hero.astro`          | `_hero-theme.scss`      | `standard`, `jewelry-box`, `luxury-hacienda`                     |
| **Reveal (Envelope)** | `EnvelopeReveal.tsx`  | `_reveal-theme.scss`    | `jewelry-box`, `luxury-hacienda`                                 |
| **Quote**             | `Quote.astro`         | `_quote-theme.scss`     | `elegant`, `modern`, `jewelry-box`, `luxury-hacienda`, `minimal` |
| **Countdown**         | `Countdown.astro`     | `_countdown-theme.scss` | `minimal`, `vibrant`, `jewelry-box`, `classic`                   |
| **Location**          | `EventLocation.astro` | `_location-theme.scss`  | `structured`, `organic`, `jewelry-box`, `luxury-hacienda`        |
| **Itinerary**         | `Itinerary.astro`     | `_itinerary-theme.scss` | `base`, `jewelry-box`, `luxury-hacienda`                         |
| **Family / Gifts**    | `Family.astro`        | `_family-theme.scss`    | `standard`, `jewelry-box`, `luxury-hacienda`                     |

## 3. Global Design Tokens

### Standard Base Colors

```scss
// Primary
$color-action-accent: #d4af37; // Gold

// Neutrals
$color-neutral-50: #fafafa;
$color-neutral-100: #f5f5f5;
$color-neutral-200: #eeeeee;
$color-neutral-300: #e0e0e0;
$color-neutral-400: #bdbdbd;
$color-neutral-500: #9e9e9e;
$color-neutral-600: #757575;
$color-neutral-700: #616161;
$color-neutral-800: #424242;
$color-neutral-900: #212121;
```

### Typography Tokens

```scss
// Font Families
$font-heading: 'Playfair Display', serif;
$font-body: 'Lato', sans-serif;
$font-accent: 'Great Vibes', cursive;

// Font Sizes
$text-xs: 0.75rem; // 12px
$text-sm: 0.875rem; // 14px
$text-base: 1rem; // 16px
$text-lg: 1.125rem; // 18px
$text-xl: 1.25rem; // 20px
$text-2xl: 1.5rem; // 24px
$text-3xl: 1.875rem; // 30px
$text-4xl: 2.25rem; // 36px

// Line Heights
$leading-tight: 1.25;
$leading-normal: 1.5;
$leading-relaxed: 1.625;
```

### Spacing System

```scss
$spacing-1: 0.25rem; // 4px
$spacing-2: 0.5rem; // 8px
$spacing-3: 0.75rem; // 12px
$spacing-4: 1rem; // 16px
$spacing-6: 1.5rem; // 24px
$spacing-8: 2rem; // 32px
$spacing-12: 3rem; // 48px
$spacing-16: 4rem; // 64px
```

### Breakpoints (Mobile-First)

```scss
$breakpoint-sm: 640px;
$breakpoint-md: 768px;
$breakpoint-lg: 1024px;
$breakpoint-xl: 1280px;
```

## 4. Theme Application Flow

### 4.1 JSON Configuration

The event configuration in the database contains the theme selection:

```json
{
	"theme": {
		"preset": "jewelry-box",
		"colors": {
			"primary": "#1a1a2e",
			"accent": "#d4af37"
		}
	}
}
```

### 4.2 CSS Variables Injection

The preset loads its CSS variables in the document root:

```scss
// src/styles/themes/presets/jewelry-box.scss
:root {
	--color-primary: #1a1a2e;
	--color-accent: #d4af37;
	--font-heading: 'Playfair Display', serif;
}
```

### 4.3 Component-Level Styling

Components use these variables for styling:

```scss
// src/styles/themes/sections/_hero-theme.scss
[data-variant='jewelry-box'] {
	.hero-title {
		font-family: var(--font-heading);
		color: var(--color-primary);
	}

	.hero-cta {
		background: var(--color-accent);
		color: white;
	}
}
```

## 5. Component Section Registry

### Registry Structure

```typescript
// src/lib/theme/registry.ts
export const SECTION_REGISTRY = {
	hero: {
		component: Hero,
		themeFile: 'hero-theme',
		variants: ['standard', 'jewelry-box', 'luxury-hacienda'],
	},
	reveal: {
		component: EnvelopeReveal,
		themeFile: 'reveal-theme',
		variants: ['jewelry-box', 'luxury-hacienda'],
	},
	// ... more sections
} as const;
```

### Variant Resolution

1. Event config specifies variant in JSON
2. Component reads variant from props or context
3. Component applies `[data-variant='{variant}']` selector
4. CSS variables from preset are already loaded
5. Component styles use CSS variables

## 6. Best Practices

### Do's

- ALWAYS use CSS variables for colors, fonts, spacing
- Define variants as data attributes on wrapper elements
- Keep component styles in theme files, not component files
- Use semantic HTML inside themed sections

### Don'ts

- DON'T hardcode colors in components
- DON'T create variant-specific class names (e.g., `.hero-jewelry-box`)
- DON'T mix layout styles with theme styles
- DON'T skip the preset loading step

## 7. Adding New Sections

### Steps

1. Create component in `src/components/`
2. Create theme file in `src/styles/themes/sections/`
3. Add section to registry with variants
4. Update JSON schema for event config
5. Document in this file

### Example: Adding a "Gallery" section

```typescript
// 1. Component: src/components/gallery/Gallery.astro
// 2. Theme file: src/styles/themes/sections/_gallery-theme.scss
// 3. Registry:
gallery: {
  component: Gallery,
  themeFile: 'gallery-theme',
  variants: ['standard', 'minimal', 'masonry']
}
```

## 8. Maintenance

### When to Update

- New section added
- New variant needed
- Design tokens change
- CSS architecture refactored

### Migration Strategy

1. Add new tokens/variants (backward compatible)
2. Update components to use new tokens
3. Remove old tokens after all events migrated
4. Archive old presets

---

**Last Updated:** 2026-03-04 (Governance Phase 2: Kebab-case naming enforced) **Owner:** Frontend Lead
