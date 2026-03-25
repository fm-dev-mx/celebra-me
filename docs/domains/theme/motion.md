# Motion Layer Architecture

**Last Updated:** 2026-03-25

## Overview

The Celebra-me Motion Layer defines the **rhythm and feel** of digital invitations. It bridges the
gap between static design tokens and interactive premium experiences.

## Core Principles

1. **Subtle & Floating (Jewelry Box)**: Focus on slow fades, gentle scale-ups, and luxury timing.
2. **Dynamic & Bouncy (Modern)**: Focus on energy, overshoot effects, and elastic transitions.
3. **Rustic & Grounded (Hacienda)**: Minimal movement, focusing on revealed textures rather than
   structural shifts.

## Technical Foundation: Semantic Tokens

Animations should always consume semantic tokens defined in
`src/styles/tokens/semantic/_motion.scss`.

### Durations

- `--duration-snappy`: 200ms (UI feedback, buttons)
- `--duration-standard`: 400ms (standard transitions)
- `--duration-premium`: 800ms (Jewelry Box reveals)
- `--duration-reveal`: 1200ms (Staggered entrance)

### Easing Functions

- `--ease-snappy`: Fast entrance, smooth finish.
- `--ease-premium`: Luxury cubic-bezier for floating effects.
- `--ease-bouncy`: Traditional overshoot for youth-oriented themes.

## Implementation Pattern (`data-variant`)

Variants should define their own keyframes or utilize global utility classes.

```scss
.my-section[data-variant='jewelry-box'] {
  .reveal-item {
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity var(--duration-premium) var(--ease-premium),
      transform var(--duration-premium) var(--ease-premium);

    &.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
```

## Accessibility (Reduced Motion)

All animations **MUST** respect the `prefers-reduced-motion` media query.

```scss
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
