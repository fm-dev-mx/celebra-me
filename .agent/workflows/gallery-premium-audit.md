---
description:
    Comprehensive audit and refinement of the Gallery section to ensure premium quality, perfect
    responsiveness, and advanced mobile interactions (B&W to Color transition).
---

# 💎 Workflow: Gallery Section Premium Audit & Refinement

## Objective

Analyze, audit, and refine the "Gallery" section to ensure it meets 100% premium standards, exhibits
perfect masonry/grid flow, and implements high-end mobile transitions (Black & White to Color) using
Intersection Observer.

## Phase 1: Structural & Visual Audit

**Goal**: Identify friction points in colors, sizing, and mobile interactions.

1. **Static Analysis**:
    - Review `src/components/invitation/Gallery.astro` and
      `src/components/invitation/PhotoGallery.tsx`.
    - Inspect `src/styles/invitation/_gallery.scss` and
      `src/styles/themes/sections/_gallery-theme.scss`.
    - Locate the `mix-blend-mode: luminosity` and `filter` applications for the "Luxury Hacienda"
      theme.
    - Check for `tokens.$color-*` and `tokens.$font-*` consistency.

2. **Responsive Check (Browser)**:
    - Open the invitation in the browser.
    - **Desktop**: Verify masonry/column layout and hover effects. Ensure the lightbox transitions
      are snappy but elegant.
    - **Mobile**:
        - **B&W Effect**: Confirm if images remain B&W because there is no hover.
        - **Intersection Observation**: Verify that currently, color only triggers on click
          (lightbox) or doesn't trigger at all on scroll.
        - **Sizing**: Ensure images don't cause layout shifts (CLS) and are well-proportioned.

3. **Premium Rubric Validation**:
    - **Image Quality**: Are there pixelated images or slow loading placeholders?
    - **Motion Quality**: Do images reveal with a staggered, high-end feel?
    - **Interaction Feedback**: Does the transition from B&W to Color feel "magical" or jarring?

## Phase 2: Identification of Improvement Points

**Goal**: Document findings specifically for the mobile interaction gap.

1. Create a `reports/gallery-audit-[theme]-[date].md` with:
    - **Mobile Interaction Gap**: Explicitly document the lack of color transition on scroll for
      mobile devices.
    - **Technical Debt**: Identify if `mix-blend-mode` is causing performance issues on older
      devices.
    - **Sizing Inconsistencies**: Note if any portrait vs landscape images break the grid rhythm.

## Phase 3: Surgical Refinement (Execution)

**Goal**: Implement the mobile-first Intersection Observer effect.

1. **Implement Color Reveal Logic**:
    - Update `PhotoGallery.tsx` to use `whileInView` from Framer Motion OR a custom
      `IntersectionObserver` to toggle a class.
    - Add CSS transitions for `filter` and `mix-blend-mode` in `_gallery-theme.scss`.
    - Ensure the effect is subtle (e.g., color fades in when the image is 50% in view).

2. **Optimize Performance**:
    - Ensure `will-change: filter, transform` is used if needed.
    - Verify image optimization (`loading="lazy"`, correct sizes).

3. **Premium Polish**:
    - Fine-tune the box shadows and "riva" (rivet) decorations for the Hacienda theme.
    - Improve lightbox "X" button and navigation accessibility.

## Phase 4: Verification

**Goal**: Confirm all objectives are met.

1. **Visual Comparison**:
    - Confirm smooth B&W -> Color transition on mobile scrolling.
2. **Cross-Theme Verification**:
    - Ensure "Jewelry Box" (which might not use B&W) still looks premium and isn't negatively
      affected.
3. **Accessibility Audit**:
    - Verify `alt` text and keyboard navigation for the interactive grid.

---

## Critical Reflection

- **Does it trigger an emotional response?** The transition to color as the guest scrolls should
  feel like "bringing the memories to life".
- **Is the performance smooth?** Blends and filters can be expensive; ensure 60fps scrolling on
  mobile.
- **Is it too aggressive?** The effect should be a reward for scrolling, not a distraction.

// turbo
