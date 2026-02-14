---
description:
    Comprehensive audit and refinement of the Event Location section to ensure premium quality,
    perfect responsiveness, and aesthetic excellence.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-02-14
---

# 💎 Workflow: Event Location Section Premium Audit & Refinement

## Objective

Analyze, audit, and refine the "Event Location" section to ensure it meets 100% premium standards,
exhibits perfect responsiveness on both mobile and desktop, and maintains consistent sizing and
color tokens across all variants.

## Phase 1: Structural & Visual Audit

**Goal**: Identify friction points in colors, sizes, and responsiveness.

1. **Static Analysis**:
    - Review `src/components/invitation/EventLocation.astro` for semantic HTML and data mapping.
    - Inspect `src/styles/invitation/_event-location.scss` and
      `src/styles/themes/sections/_location-theme.scss`.
    - Check for hardcoded color values bypassing `tokens.$color-*` or semantic variables.
    - Validate card sizing and padding across different variants.

2. **Responsive Check (Browser)**:
    - Open the invitation in the browser.
    - **Desktop**: Verify side-by-side card layout balance. Ensure icons and text are sharp and
      well-aligned.
    - **Mobile**: Check vertical stacking. Verify touch targets for "Ver mapa" and "Waze" buttons
      (min 44px).
    - **Variants**: Switch between `luxury-hacienda`, `jewelry-box`, and `structured` to ensure
      consistency.

3. **Premium Rubric Validation**:
    - **Card Frames**: Are the gold/texture frames feeling "premium" or pixelated?
    - **Typography**: Check the hierarchy of Venue Name, Date, and Address.
    - **Indications Area**: Verify the "Indicaciones" divider and item spacing.
    - **Motion**: Check the `fadeInUp` animation quality and trigger points.
    - **Content Balance**: How does the card handle extremely long venue names or addresses?

## Phase 2: Identification of Improvement Points

**Goal**: Document specific findings.

1. Create a `reports/event-location-audit-[theme]-[date].md` with the following:
    - **Color Drift**: List any hardcoded hex/rgb values in the SCSS.
    - **Sizing Inconsistencies**: Note if cards feel too narrow on tablet or too tall on mobile.
    - **Visual Noise**: Identify elements (like too many flourishes) that detract from a premium
      feel.
    - **Mobile UX Gaps**: Note any buttons that are too close together on small screens.

## Phase 3: Surgical Refinement (Execution)

**Goal**: Apply fixes based on Phase 2 findings.

1. **Optimize Layout & Rhythm**:
    - Adjust `clamp()` values for padding and gaps in `_event-location.scss`.
    - Refine card widths and max-heights for visual balance.

2. **Premium Polish**:
    - Enforce 3-Layer Color Architecture in `_location-theme.scss`.
    - Refine SVG stroke weights and icon colors.
    - Ensure address "copy to clipboard" feedback feels premium.

3. **Responsive Hardware**:
    - Ensure map links and Waze integration work perfectly on both iOS and Android.

## Phase 4: Verification

**Goal**: Confirm all objectives are met.

1. **Visual Comparison**:
    - Compare before/after screenshots/recordings for both desktop and mobile.
2. **Cross-Theme Verification**:
    - Ensure changes in the base component don't break older themes (minimal, organic).
3. **WCAG Compliance**:
    - Verify contrast for address text and interactive buttons.

---

## Critical Reflection

- **Does it look like a high-end invitation?** The location section is factual but must remain
  ceremonial.
- **Is the typography legible?** Address information is critical; don't sacrifice clarity for
  aesthetic flourishes.
- **Is the mobile experience friction-less?** Testing the map links is essential for guest
  experience.

// turbo
