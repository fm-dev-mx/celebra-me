---
name: accessibility
description: Ensure digital invitations are accessible to all guests, including people with visual, motor, or cognitive disabilities. Apply WCAG 2.1 AA compliance standards to Astro components, SCSS styles, and dynamic content.
---

> **Related skills**: [`animation-motion`](file://.agent/skills/animation-motion/SKILL.md) for `prefers-reduced-motion` patterns in specific animations.

This skill ensures Celebra-me digital invitations meet **WCAG 2.1 Level AA** accessibility standards. Every guest should be able to view and interact with invitations regardless of ability.

## Core Principles

1. **Perceivable**: Content must be presentable in ways users can perceive
2. **Operable**: Interface must be navigable via keyboard and assistive technologies
3. **Understandable**: Content and operation must be clear
4. **Robust**: Content must work with current and future assistive technologies

## Semantic Structure

### HTML Elements
- Use semantic elements: `<main>`, `<nav>`, `<article>`, `<section>`, `<header>`, `<footer>`
- One `<h1>` per page (event title), logical heading hierarchy (`h1` → `h2` → `h3`)
- Use `<button>` for actions, `<a>` for navigation
- ARIA landmarks only when no native HTML equivalent exists

### Page Structure
```html
<header><!-- Site header, navigation --></header>
<main>
  <article><!-- Invitation content --></article>
</main>
<footer><!-- Footer --></footer>
```

## Images and Media

### Informative Images
- Provide descriptive `alt` text: `alt="Quinceañera de María Elena, 15 de marzo 2025"`
- Describe the purpose, not just appearance

### Decorative Images
- Use empty alt: `alt=""`
- Or use CSS background-image for purely decorative elements

### Background Images with Text
- Ensure text remains readable without the background
- Never embed critical information in images

## Color and Contrast

### Minimum Ratios (WCAG AA)
- **Normal text**: 4.5:1 contrast ratio
- **Large text** (18px+ or 14px+ bold): 3:1 contrast ratio
- **UI components and graphics**: 3:1 contrast ratio

### Color Independence
- Never use color as the only indicator of meaning
- Provide additional cues: icons, text labels, patterns

### SCSS Implementation
```scss
// Define accessible color pairs
$text-primary: #1a1a1a;      // Use on light backgrounds
$text-on-dark: #ffffff;       // Use on dark backgrounds
$accent: #8b5a2b;            // Verify contrast before use

// Focus states must be visible
:focus-visible {
  outline: 2px solid $accent;
  outline-offset: 2px;
}
```

## Keyboard Navigation

### Requirements
- All interactive elements reachable via Tab
- Logical focus order (follows visual flow)
- Visible focus indicator on all focusable elements
- No keyboard traps

### Skip Links
```html
<a href="#main-content" class="skip-link">Saltar al contenido principal</a>
```

### Focus Styles (SCSS)
```scss
.skip-link {
  position: absolute;
  left: -9999px;

  &:focus {
    left: 1rem;
    top: 1rem;
    z-index: 9999;
  }
}
```

## Forms (RSVP)

### Labels
- Every input must have an associated label
- Use `<label for="inputId">` or `aria-label`

### Error Messages
- Descriptive error text (not just "Invalid")
- Associate errors with inputs via `aria-describedby`
- Announce errors to screen readers

### Example
```html
<label for="guests">Número de invitados</label>
<input
  id="guests"
  type="number"
  aria-describedby="guests-error"
  aria-invalid="true"
/>
<span id="guests-error" role="alert">
  Por favor ingrese un número entre 1 y 10
</span>
```

## Motion and Animation

### Reduced Motion
Always respect user preference:
```scss
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Auto-Playing Content
- Provide pause/stop controls for animations > 5 seconds
- Never use content that flashes more than 3 times per second

## Astro-Specific Patterns

### Component Template
```astro
---
interface Props {
  title: string;
  description?: string;
}
const { title, description } = Astro.props;
---

<section aria-labelledby="section-title">
  <h2 id="section-title">{title}</h2>
  {description && <p>{description}</p>}
  <slot />
</section>
```

### Images with astro:assets
```astro
---
import { Image } from 'astro:assets';
import heroImage from '@images/hero.jpg';
---

<Image
  src={heroImage}
  alt="Salón de eventos decorado para XV años"
  loading="eager"
/>
```

## Testing Checklist

Before deployment, verify:
- [ ] Navigate entire page using only keyboard
- [ ] Test with screen reader (NVDA, VoiceOver)
- [ ] Check color contrast with browser devtools
- [ ] Verify heading hierarchy is logical
- [ ] Confirm all images have appropriate alt text
- [ ] Test forms for label associations and error handling
- [ ] Enable `prefers-reduced-motion` and verify animations stop
