# Motion Tokens

**Last Updated:** 2026-07-27

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

## Motion Recipe Tokens (Premium Reveals)

Preset-level recipes tune shared section reveals without changing selector structure. Defaults live
in `src/styles/tokens/semantic/_motion.scss`; presets override under `.theme-preset--*`.

| Token                       | Meaning                               | Guardrail                                                          |
| --------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| `--motion-reveal-distance`  | Entrance translate distance           | Small drift (~10–24px), no layout motion                           |
| `--motion-reveal-duration`  | Entrance duration                     | `animation-motion` bands (≤ ~1.2s)                                 |
| `--motion-reveal-ease`      | Entrance easing                       | Usually `--ease-premium`                                           |
| `--motion-reveal-blur`      | Pending-state blur                    | Only under `prefers-reduced-motion: no-preference`; 0 when reduced |
| `--motion-stagger-step`     | Stagger step between items            | ≤ 0.1s                                                             |
| `--motion-stagger-cap`      | Maximum stagger delay                 | ≤ ~0.5s                                                            |
| `--motion-ambient-scale-to` | Ambient scale target (e.g. interlude) | Subtle (≤ ~1.05); reduced-motion disables                          |
| `--motion-ambient-duration` | Ambient loop duration                 | Slow; no scroll math                                               |
| `--motion-scene-fade`       | Envelope→hero handoff delay           | 0 under reduced-motion                                             |

Hard contract remains: content is visible in SSR; pending hide only under
`.has-motion:not(.is-visible)`; IntersectionObserver fail-open reveals all; reduced-motion reveals
immediately and disables ambient/parallax.

## Implementation Pattern

Sections may define their own keyframes or use global utility classes. Theme-specific motion should
flow through semantic or component tokens where it is reused. Reveal content is visible in the
server-rendered baseline. `src/utils/animations.ts` adds `has-motion` only after an
`IntersectionObserver` is successfully attached; CSS may hide pending reveal items only beneath that
class.

```scss
.has-motion .my-section[data-variant='jewelry-box'] {
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

If observation is unavailable, throws, or exceeds the safety timeout, the runtime removes
`has-motion` and reveals all items. Reduced-motion users are revealed immediately. New motion must
preserve this fail-open behavior so content is never dependent on JavaScript to become readable.

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
