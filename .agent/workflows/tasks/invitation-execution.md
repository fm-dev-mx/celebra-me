---
description: Deterministic execution plan for the aesthetic audit findings (cumple-60-gerardo).
---
# /invitation-execution: Gerardo - Phase 2 (Quotes, Countdown, Location)

This workflow executes the aesthetic refinements for the middle sections of the invitation, transitioning from "Jewelry Box" to "Luxury Hacienda".

## 🏗️ Atomic Deployable Units (ADUs)

### ADU-1: Theme & Variables Synchronization

- **Target**: `src/styles/themes/presets/` (e.g., `_luxury-hacienda.scss`).
- **Action**: Align palette with `#4B3621` (Deep Coffee) and `#D4AF37` (Aged Gold) within the preset.
- **Verification**: Check that color variables in the preset correctly map to the semantic tokens.

### ADU-2: Quote Section – Leather & Authority

- **Target**: `src/styles/invitation/_quote.scss`
- **Action**:
  - Update `.quote-section` background to use a dark leather texture.
  - Swap `.quote-content` typography to a more weighted serif (`EB Garamond` Medium).
  - Replace SVG dividers with brass-finished ornaments.
- **Verification**: Visual check of text legibility over texture.

### ADU-3: Countdown Section – The Chronometer

- **Target**: `src/styles/invitation/_countdown.scss` & `src/components/invitation/CountdownTimer.tsx`
- **Action**:
  - Change background to a warm parchment/leather gradient.
  - Redesign `.countdown__segment` as brass-rimmed boxes.
  - Update digit typography for high-contrast masculine feel.
- **Verification**: Ensure animation fluidity (`framer-motion`) is maintained.

### ADU-4: EventLocation – Hacienda Cards & Persona Icons

- **Target**: `src/styles/invitation/_event-location.scss` & `src/components/invitation/EventLocation.astro`
- **Action**:
  - Update `iconMap` to use thematic icons (Boot/Envelope/Hat).
  - Change card background to tactile parchment texture.
  - Refine nav-buttons with Cognac glass effect and gold shimmer.
- **Verification**: Confirm `jardin.webp` is properly framed.

## 🏁 Final Verification

1. Run `pnpm build` to ensure no SCSS regression.
2. Visual walkthrough of the full scroll experience from Hero to Location.
