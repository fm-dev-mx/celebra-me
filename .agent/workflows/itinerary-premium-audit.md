---
description:
    Comprehensive audit and refinement of the Itinerary section to ensure premium quality, perfect
    positioning, and aesthetic excellence.
---

# 💎 Workflow: Itinerary Section Premium Audit & Refinement

## Objective

Analyze, audit, and refine the "Itinerary" section to ensure it meets 100% premium standards,
exhibits perfect responsiveness on both mobile and desktop, and holds correct positioning and color
tokens.

## Phase 1: Structural & Visual Audit

**Goal**: Identify friction points in colors, sizes, and element positioning.

1. **Static Analysis**:
    - Review `src/components/invitation/Itinerary.astro` and
      `src/components/invitation/TimelineList.tsx`.
    - Inspect `src/styles/invitation/_itinerary.scss` and
      `src/styles/themes/sections/_itinerary-theme.scss`.
    - Check for legacy hardcoded colors in `_itinerary.scss` (e.g., `rgb(255 255 255 / 85%)`).
    - Validate font pairings and sizes against the 3-Layer Color Architecture.

2. **Responsive & Positioning Check (Browser)**:
    - Open the invitation in the browser.
    - **Desktop (Alternating Layout)**:
        - Verify items alternate correctly (Left/Right).
        - Ensure icons are perfectly centered on the timeline line.
        - Check that the vertical line connects all items without gaps or overlaps.
    - **Mobile (List Layout)**:
        - Verify all items align to the left.
        - Check that the icons still sit on the timeline line (usually moved to the left).
        - Ensure text doesn't feel cramped and touch targets are adequate.

3. **Premium Rubric Validation**:
    - **SVG Timeline**: Check the SVG line-drawing animation quality.
    - **Icon Containers**: Are the glassmorphic effects and shadows premium?
    - **Typography Equilibrium**: Is the balance between Time, Label, and Description harmonious?
    - **White Space**: Does the vertical spacing (5rem/8rem) provide enough "editorial" feel?
    - **Time Format**: Is the 12h/24h format consistent and typographically balanced?

## Phase 2: Identification of Improvement Points

**Goal**: Document specific findings.

1. Create a `reports/itinerary-audit-[theme]-[date].md` with the following:
    - **Positioning Errors**: Note if icons are misaligned or if the timeline line is broken.
    - **Color Token Drift**: List hardcoded values that bypass the theme system.
    - **Scale Issues**: Note if typography feels too loud or too quiet for the section.
    - **Motion Quality**: Assess the smoothness of the intersection-triggered reveals.

## Phase 3: Surgical Refinement (Execution)

**Goal**: Apply fixes based on Phase 2 findings.

1. **Fix Positioning & Layout**:
    - Adjust grid templates and margins to ensure pixel-perfect alignment.
    - Tune the mobile breakpoint reflow logic.

2. **Standardize Colors & Tokens**:
    - Re-wire all properties to use CSS variables defined in `_itinerary-theme.scss`.
    - Ensure contrast ratios are compliant with WCAG AA.

3. **Premium Polish**:
    - Refine SVG filter effects on the timeline line.
    - Improve icon centering logic (e.g., using `mask-image` or better `translateX`).
    - Optimize animation delays for a staggered, elegant reveal.

## Phase 4: Verification

**Goal**: Confirm all objectives are met.

1. **Visual Comparison**:
    - Confirm alignment across various screen widths (320px to 1440px).
2. **Cross-Theme Verification**:
    - Ensure "Luxury Hacienda" and "Jewelry Box" variants both render perfectly.
3. **Performance Audit**:
    - Check that SVG animations don't cause layout shifts or frame drops.

---

## Critical Reflection

- **Does the timeline tell a story?** The Itinerary is the narrative bridge of the event; it must
  feel cohesive.
- **is it readable at a glance?** Avoid over-decorating the icons if it obscures the time and label.
- **Is the animation subtle?** Premium motion is felt more than seen; avoid "bouncy" or overly
  aggressive entries.

// turbo
