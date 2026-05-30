# Motion Tokens

**Last Updated:** 2026-03-25

## Overview

Celebra-me motion tokens define the rhythm and feel of digital invitations. Motion is part of the
semantic token layer, not a separate token layer.

## Core Principles

1. **Subtle & Floating (Jewelry Box)**: Focus on slow fades, gentle scale-ups, and luxury timing.
2. **Dynamic & Bouncy (Modern)**: Focus on energy, overshoot effects, and elastic transitions.
3. **Rustic & Grounded (Hacienda)**: Minimal movement, focusing on revealed textures rather than
   structural shifts.

## Technical Foundation: Semantic Tokens

Animations should always consume semantic tokens defined in
`src/styles/tokens/semantic/_motion.scss`.

### Durations

| Token                 | Value | Usage                                |
| --------------------- | ----- | ------------------------------------ |
| `--duration-fast`     | 0.1s  | Instant feedback, micro-interactions |
| `--duration-snappy`   | 0.2s  | UI feedback, buttons                 |
| `--duration-standard` | 0.4s  | Standard transitions                 |
| `--duration-slower`   | 0.6s  | Slower reveals                       |
| `--duration-premium`  | 1s    | Premium reveals (Jewelry Box, etc.)  |
| `--duration-reveal`   | 1.6s  | Staggered entrance sequences         |
| `--duration-long`     | 2s    | Extended animations                  |

### Easing Functions

| Token              | Bezier                                  | Usage                              |
| ------------------ | --------------------------------------- | ---------------------------------- |
| `--ease-out`       | `cubic-bezier(0, 0, 0.2, 1)`            | Exit animations                    |
| `--ease-standard`  | `cubic-bezier(0.4, 0, 0.2, 1)`          | Standard transitions               |
| `--ease-snappy`    | `cubic-bezier(0.25, 1, 0.5, 1)`         | Fast entrance, smooth finish       |
| `--ease-premium`   | `cubic-bezier(0.16, 1, 0.3, 1)`         | Luxury floating effects            |
| `--ease-overshoot` | `cubic-bezier(0.3, 1.5, 0.7, 1)`        | Overshoot emphasis                 |
| `--ease-bouncy`    | `cubic-bezier(0.68, -0.55, 0.27, 1.55)` | Youth-oriented elastic transitions |

### Shorthand Transition Variables

| Token                   | Applies to                                                     |
| ----------------------- | -------------------------------------------------------------- |
| `--transition-snappy`   | opacity, transform, border-color, box-shadow                   |
| `--transition-standard` | opacity, transform, border-color, box-shadow, background-color |

## Implementation Pattern

Sections may define their own keyframes or use global utility classes. Theme-specific motion should
flow through semantic or component tokens where it is reused.

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
