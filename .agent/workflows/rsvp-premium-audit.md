---
description:
    Comprehensive audit and refinement of the RSVP section to ensure premium quality, perfect
    responsiveness, and aesthetic excellence.
---

# 💎 Workflow: RSVP Section Premium Audit & Refinement

## Objective

Analyze, audit, and refine the "RSVP" section to ensure it meets 100% premium standards, exhibits
perfect responsiveness on both mobile and desktop, and maintains consistent sizing and color tokens
across all variants.

## Phase 1: Structural & Visual Audit

**Goal**: Identify friction points in colors, sizes, and responsiveness.

1. **Static Analysis**:
    - Review `src/components/invitation/RSVP.tsx` for semantic HTML and React logic.
    - Inspect `src/styles/invitation/_rsvp.scss` and `src/styles/themes/sections/_rsvp-theme.scss`.
    - Check for legacy hardcoded colors in `_rsvp.scss` (e.g., `rgb(0 0 0 / 30%)`).
    - Validate font pairings and sizes against the 3-Layer Color Architecture.

2. **Responsive Check (Browser)**:
    - Open the invitation in the browser.
    - **Desktop**: Verify form width and centering. Ensure input fields and buttons are
      well-proportioned.
    - **Mobile**: Check portrait and landscape. Ensure the "glassmorphic" card is readable and touch
      targets are adequate (min 44px).
    - **States**: Verify hover, focus, and error states for all form elements.

3. **Premium Rubric Validation**:
    - **Glassmorphism**: Is the blur/saturation effect premium or distracting?
    - **Interactive Elements**: Do buttons and radio groups have elegant transitions?
    - **Typography Equilibrium**: Is the balance between Labels, Inputs, and Title harmonious?
    - **Success/Error States**: Are feedback messages easy to read and aesthetically consistent?

## Phase 2: Identification of Improvement Points

**Goal**: Document specific findings.

1. Create a `reports/rsvp-audit-[theme]-[date].md` with the following:
    - **Color Token Drift**: List hardcoded values that bypass the theme system.
    - **Sizing Inconsistencies**: Note if the form feels too narrow on tablet or too tall on mobile.
    - **Usability Gaps**: Identify any confusing form patterns or lack of feedback.
    - **Motion Quality**: Assess the smoothness of the `AnimatePresence` transitions for extra
      fields.

## Phase 3: Surgical Refinement (Execution)

**Goal**: Apply fixes based on Phase 2 findings.

1. **Optimize Layout & Rhythm**:
    - Adjust `max-width` and `padding` in `_rsvp.scss` for better visual balance.
    - Tune the mobile spacing and font sizes.

2. **Standardize Colors & Tokens**:
    - Re-wire all properties to use CSS variables defined in the token system.
    - Ensure contrast ratios are compliant with WCAG AA, especially for placeholders and secondary
      text.

3. **Premium Polish**:
    - Refine input focus effects and radio group styling.
    - Improve the "loading" and "success" animations.
    - Optimize `motion` transition timings for a staggered, elegant feel.

## Phase 4: Verification

**Goal**: Confirm all objectives are met.

1. **Visual Comparison**:
    - Confirm alignment across various screen widths (320px to 1440px).
2. **Cross-Theme Verification**:
    - Ensure "Luxury Hacienda" and "Jewelry Box" variants render perfectly.
3. **Accessibility Audit**:
    - Verify keyboard navigation flow and focus visibility.
    - Check screen reader accessibility for form labels.

---

## Critical Reflection

- **Is the form inviting?** An RSVP is a guest's first direct interaction; it must feel rewarding
  and easy.
- **Is the feedback clear?** Avoid ambiguous loading states or subtle error messages.
- **Does it look expensive?** Use subtle shadows and high-quality glass gradients to maintain the
  luxury feel.

// turbo
