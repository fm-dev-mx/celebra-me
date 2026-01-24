---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
---

> **Related skills**: [`accessibility`](file://.agent/skills/accessibility/SKILL.md) for contrast ratios, [`astro-patterns`](file://.agent/skills/astro-patterns/SKILL.md) for SCSS structure.

This skill guides creation of distinctive, production-grade frontend interfaces for **Celebra-me digital invitations**. Avoid generic "AI slop" aesthetics. Execute with exceptional attention to aesthetic details and creative choices.

## Project Context

**Celebra-me** creates premium digital invitations for:
- XV Años (Quinceañeras)
- Weddings (Bodas)
- Baptisms (Bautizos)
- Birthdays and other celebrations

**Tech Stack**: Astro, TypeScript, SCSS (no Tailwind), Vercel
**Language**: UI in Spanish, code in English

## Design Thinking

Before coding, commit to a **BOLD aesthetic direction**:

1. **Purpose**: Premium digital invitation that honors the celebration
2. **Audience**: Family and friends across generations (accessibility matters)
3. **Tone**: Elegant, warm, celebratory — never cold or corporate

### Recommended Aesthetics by Event Type

| Event | Aesthetic Direction |
|-------|---------------------|
| XV Años | Romantic, soft pastels OR bold jewel tones. Floral motifs, elegant typography |
| Boda | Timeless elegance, refined minimalism. Classic serif fonts, muted palettes |
| Bautizo | Pure, soft, ethereal. Light colors, gentle curves, spiritual motifs |
| Cumpleaños | Joyful, dynamic. Bold colors, playful elements appropriate to age |

## Implementation Rules

### Typography
- **Display fonts**: Elegant serifs (Playfair Display, Cormorant) or refined scripts (Great Vibes, Tangerine)
- **Body fonts**: Clean, readable sans-serif (Lato, Source Sans Pro, Nunito)
- **NEVER use**: Arial, Inter, Roboto, system fonts, Space Grotesk
- Import fonts from Google Fonts in `BaseLayout.astro`

### Color Palettes
- Define CSS custom properties in `:root`
- Use SCSS variables referencing CSS properties
- Dominant color + 1-2 accent colors
- Ensure WCAG AA contrast (see `accessibility` skill)

```scss
:root {
  --color-primary: #8b5a2b;
  --color-secondary: #d4a574;
  --color-accent: #c9a054;
  --color-background: #faf8f5;
  --color-text: #2d2d2d;
}
```

### Spatial Composition
- Generous whitespace for elegance
- Vertical rhythm with consistent spacing scale
- Full-width hero sections
- Centered content with max-width for readability

### Visual Details
- Subtle textures (paper, linen patterns)
- Decorative borders and dividers
- Soft shadows, not harsh drop shadows
- Gradient accents used sparingly

### SCSS Patterns
```scss
// Use design tokens
.invitation-section {
  padding: var(--spacing-xl);
  background: var(--color-background);

  &__title {
    font-family: var(--font-display);
    font-size: var(--text-3xl);
    color: var(--color-primary);
  }
}

// BEM naming for components
.event-card {
  &__header { }
  &__content { }
  &__footer { }

  &--highlight { }
}
```

## Anti-Patterns (NEVER DO)

- ❌ Generic purple gradients on white
- ❌ Cookie-cutter card layouts
- ❌ Stock photo placeholders
- ❌ Overused font families (Inter, Roboto, Arial)
- ❌ Inline styles in Astro components
- ❌ Tailwind classes (project uses SCSS only)
- ❌ Hard-coded colors (use variables)

## Component Structure

```astro
---
// Props interface first
interface Props {
  title: string;
  variant?: 'default' | 'highlight';
}

// Destructure with defaults
const { title, variant = 'default' } = Astro.props;
---

<section class:list={['section', `section--${variant}`]}>
  <h2 class="section__title">{title}</h2>
  <slot />
</section>

<style lang="scss">
  @use '@/styles/variables' as *;

  .section {
    padding: $spacing-xl 0;

    &__title {
      font-family: $font-display;
      text-align: center;
    }

    &--highlight {
      background: $color-primary;
      color: $color-text-inverse;
    }
  }
</style>
```

## Quality Checklist

Before completing any frontend work:
- [ ] Typography uses distinctive fonts, not defaults
- [ ] Colors defined as CSS/SCSS variables
- [ ] Spacing uses consistent scale
- [ ] No inline styles
- [ ] BEM naming convention followed
- [ ] Responsive design tested
- [ ] Contrast ratios meet WCAG AA
- [ ] Component is accessible via keyboard

