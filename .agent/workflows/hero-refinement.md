---
description: Hero Section Aesthetic Refinement - Gerardo 60
---

# /hero-refinement-execution

This workflow executes the refined aesthetic plan for the `cumple-60-gerardo` hero section.

## Atomic Deployable Units (ADUs)

### ADU-1: Technical Fix & Filter Polish
**Goal**: Fix typo and enhance background atmosphere.
1. Fix `sasurate` -> `saturate` in `_luxury-hacienda.scss`.
2. Add a `vignette` effect to `.invitation-hero__background::after`.
3. Update background filter to include subtle contrast boosting.

### ADU-2: Typography & Masculine Profile
**Goal**: Strengthen visual hierarchy.
1. Increase `.invitation-hero__title` `font-weight` to `500` or `Medium`.
2. Increase `.invitation-hero__label` `letter-spacing` to `0.4em`.
3. Ensure `.invitation-hero__date` uses `Montserrat` for a robust, modern look.

### ADU-3: Theme Unification (Cognac Glass)
**Goal**: Remove modern white-glass and apply Hacienda textures.
1. Override `.invitation-hero__content` in `_luxury-hacienda.scss`.
2. Apply `$birthday-glass-bg` and `$birthday-glass-border`.
3. Add a subtle leather-like background-image texture to the panel.

### ADU-4: Artisanal Gold Shimmer
**Goal**: Luxury motion finish.
1. Modify the `@keyframes shimmer` to use gold gradients:
   - `transparent 0%, rgba(212, 175, 55, 0.4) 50%, transparent 100%`.
2. Apply the shimmer specifically to the name and the divider.

---

## Verification Steps
1. Run `pnpm dev` and inspect at 390px (Mobile) and 1440px (Desktop).
2. Check color contrast of Gold text against the new Cognac panel.
3. Verify the background image filter renders correctly without SCSS errors.
