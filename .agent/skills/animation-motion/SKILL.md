---
name: animation-motion
description: Create elegant, performant animations for premium digital invitations. Focus on subtle transitions, scroll reveals, and micro-interactions while respecting accessibility and performance constraints.
---

> **Related skills**: [`accessibility`](file://.agent/skills/accessibility/SKILL.md) for reduced-motion requirements and focus states.

This skill guides creation of **elegant minimalist animations** for Celebra-me digital invitations. Animations should enhance the premium feel without overwhelming the content or compromising performance.

## Design Philosophy

**Elegance through restraint**. A few well-executed animations create more impact than many scattered effects.

Prioritize:
- Subtle over dramatic
- Purposeful over decorative
- Performance over complexity
- Accessibility over flair

## Performance Rules

### GPU-Accelerated Properties (USE THESE)
- `transform` (translate, scale, rotate)
- `opacity`

### Layout-Triggering Properties (AVOID ANIMATING)
- `width`, `height`
- `top`, `left`, `right`, `bottom`
- `margin`, `padding`
- `font-size`

### Duration Guidelines
| Animation Type | Duration |
|----------------|----------|
| Micro-interactions (hover, focus) | 150-250ms |
| Element reveals | 400-600ms |
| Page transitions | 500-800ms |
| Staggered sequences | 50-100ms delay between items |

### Easing Functions
```scss
$ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);    // Default for reveals
$ease-in-out: cubic-bezier(0.645, 0.045, 0.355, 1);  // For emphasis
$ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);     // Subtle bounce
```

## Core Animation Patterns

### 1. Fade-In Reveal
Simple opacity transition for content appearing:
```scss
.fade-in {
  opacity: 0;
  transition: opacity 0.5s $ease-out;

  &.visible {
    opacity: 1;
  }
}
```

### 2. Slide-Up Reveal
Content rises gently into view:
```scss
.slide-up {
  opacity: 0;
  transform: translateY(20px);
  transition:
    opacity 0.5s $ease-out,
    transform 0.5s $ease-out;

  &.visible {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 3. Staggered Reveals
Sequential appearance for lists or grids:
```scss
.stagger-item {
  opacity: 0;
  transform: translateY(15px);
  transition:
    opacity 0.4s $ease-out,
    transform 0.4s $ease-out;

  @for $i from 1 through 10 {
    &:nth-child(#{$i}) {
      transition-delay: #{$i * 0.08}s;
    }
  }

  &.visible {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 4. Hover Micro-Interactions
Subtle feedback on interactive elements:
```scss
.interactive-card {
  transition:
    transform 0.2s $ease-out,
    box-shadow 0.2s $ease-out;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}
```

### 5. Focus States
Clear, animated focus indicators:
```scss
.focusable {
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: outline-color 0.2s $ease-out;

  &:focus-visible {
    outline-color: var(--color-accent);
  }
}
```

## Scroll-Triggered Animations

### IntersectionObserver Pattern
```javascript
// src/scripts/scroll-reveal.js
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
);

document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
```

### Usage in Astro
```astro
<section data-reveal class="slide-up">
  <h2>Detalles del Evento</h2>
</section>

<script src="@/scripts/scroll-reveal.js"></script>
```

## Accessibility: Reduced Motion

**MANDATORY**: Always respect `prefers-reduced-motion`. See the [`accessibility` skill](file://.agent/skills/accessibility/SKILL.md) for the canonical implementation.

When adding new animation classes, ensure they are covered by the reduced-motion query in your global styles:

```scss
// In your component or global styles
@media (prefers-reduced-motion: reduce) {
  .your-new-animation {
    animation: none;
    transition: none;
  }
}
```

Alternative approach using `prefers-reduced-motion: no-preference`:

```scss
// Only animate when user has no preference
@media (prefers-reduced-motion: no-preference) {
  .reveal {
    animation: slideUp 0.5s $ease-out forwards;
  }
}
```

## Astro Integration

### Client Directives
```astro
<!-- Animate on scroll - load when visible -->
<ScrollReveal client:visible />

<!-- Critical animation - load immediately -->
<HeroAnimation client:load />
```

### CSS-Only When Possible
Prefer CSS animations over JavaScript for:
- Hover effects
- Focus states
- Simple transitions
- Keyframe animations

Use JavaScript only for:
- Scroll-triggered reveals (IntersectionObserver)
- Complex orchestration
- User-initiated animations

## Anti-Patterns (AVOID)

- ❌ Parallax effects (performance heavy, motion sickness risk)
- ❌ Auto-playing carousels
- ❌ Continuous looping animations
- ❌ Animations that block content visibility
- ❌ Flash effects or rapid blinking
- ❌ Animations longer than 1 second for UI feedback

## Examples for Celebra-me

### Invitation Header
```scss
.invitation-header {
  opacity: 0;
  transform: translateY(-10px);
  animation: revealHeader 0.8s $ease-out 0.2s forwards;
}

@keyframes revealHeader {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Event Details Cards
```scss
.event-card {
  opacity: 0;
  transform: translateY(20px);

  &.visible {
    animation: revealCard 0.5s $ease-out forwards;
  }

  @for $i from 1 through 4 {
    &:nth-child(#{$i}).visible {
      animation-delay: #{($i - 1) * 0.1}s;
    }
  }
}
```

## Verification Checklist

Before completing animation work:
- [ ] Animations use only `transform` and `opacity` (GPU-accelerated)
- [ ] Durations follow the guidelines table (150-800ms by type)
- [ ] Easing functions use defined variables, not hardcoded values
- [ ] `prefers-reduced-motion` is implemented
- [ ] Scroll reveals use IntersectionObserver (not scroll events)
- [ ] No parallax, auto-play carousels, or infinite loops
- [ ] Below-fold animations use `client:visible` if they require JS
