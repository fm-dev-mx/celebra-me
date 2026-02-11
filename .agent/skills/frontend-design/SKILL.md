---
name: frontend-design
description:
    Create distinctive, production-grade frontend interfaces using 3-Layer Color Architecture,
    Jewelry Box aesthetic, and premium typography systems.
---

# 🎨 Frontend Design Skill

> **Related skills**: [`accessibility`](file://.agent/skills/accessibility/SKILL.md) for contrast
> ratios, [`astro-patterns`](file://.agent/skills/astro-patterns/SKILL.md) for SCSS structure.

This skill guides creation of distinctive, production-grade frontend interfaces for **Celebra-me
digital invitations**. Avoid generic "AI slop" aesthetics. Execute with exceptional attention to
aesthetic details and creative choices.

## Project Context

**Celebra-me** creates premium digital invitations for:

- XV Años (Quinceañeras)
- Weddings (Bodas)
- Baptisms (Bautizos)
- Birthdays and other celebrations

**Tech Stack**: Astro, TypeScript, SCSS (no Tailwind), Vercel **Language**: UI in Spanish, code in
English

## Design Thinking

Before coding, commit to a **BOLD aesthetic direction**:

1. **Purpose**: Premium digital invitation that honors the celebration
2. **Audience**: Family and friends across generations (accessibility matters)
3. **Tone**: Elegant, warm, celebratory — never cold or corporate

### Recommended Aesthetics by Event Type

| Event      | Aesthetic Direction                                                           |
| ---------- | ----------------------------------------------------------------------------- |
| XV Años    | Romantic, soft pastels OR bold jewel tones. Floral motifs, elegant typography |
| Boda       | Timeless elegance, refined minimalism. Classic serif fonts, muted palettes    |
| Bautizo    | Pure, soft, ethereal. Light colors, gentle curves, spiritual motifs           |
| Cumpleaños | Joyful, dynamic. Bold colors, playful elements appropriate to age             |

## Implementation Rules

### Typography

- **Display fonts**: Elegant serifs (Playfair Display, Cinzel) or refined scripts (Pinyon Script)
- **Body fonts**: Clean, readable serifs (EB Garamond) or sans-serif (Montserrat)
- **NEVER use**: Arial, Inter, Roboto, system fonts, Space Grotesk
- Import fonts from Google Fonts in `BaseLayout.astro`

### Color Palettes

- Use the 3-Layer Color Architecture (Action, Surface, Status)
- Define tokens in `src/styles/tokens/`
- Import tokens via `@use '@/styles/tokens' as tokens;` in SCSS files

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
	padding: tokens.$spacing-xl;
	background: tokens.$color-surface-primary;

	&__title {
		font-family: tokens.$font-display-elegant;
		font-size: tokens.$text-3xl;
		color: tokens.$color-action-accent;
	}
}

// BEM naming for components
.event-card {
	&__header {
	}
	&__content {
	}
	&__footer {
	}

	&--highlight {
	}
}
```

## Anti-Patterns (NEVER DO)

- ❌ Generic purple gradients on white
- ❌ Cookie-cutter card layouts
- ❌ Stock photo placeholders
- ❌ Overused font families (Inter, Roboto, Arial)
- ❌ **Internal `<style>` blocks (ALWAYS externalize to `src/styles/`)**
- ❌ Inline styles in Astro components
- ❌ Tailwind classes (project uses SCSS only)
- ❌ Hard-coded colors (use variables)

## Component Structure

```astro
---
// Import external styles FIRST
import '@/styles/components/section.scss';

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
