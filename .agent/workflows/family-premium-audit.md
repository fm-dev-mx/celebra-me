---
description:
    Comprehensive audit and refinement of the Family section to ensure premium quality,
    responsiveness, and aesthetic excellence.
---

# 💎 Workflow: Family Section Premium Audit & Refinement

## Objective

Analyze, audit, and refine the "Family" section to ensure it meets 100% premium standards, exhibits
perfect responsiveness on both mobile and desktop, and maintains a balanced visual scale.

## Phase 1: Structural & Visual Audit

**Goal**: Identify friction points that diminish the premium feel.

1. **Static Analysis**:
    - Review `src/components/invitation/Family.astro` for semantic HTML and clean structure.
    - Inspect `src/styles/invitation/_family.scss` and
      `src/styles/themes/sections/_family-theme.scss`.
    - Check for hardcoded values (colors, spacing) that bypass design tokens.

2. **Responsive Check (Browser)**:
    - Open the invitation in the browser.
    - **Desktop**: Verify layout balance. Ensure it's not "too big" or overwhelming.
    - **Mobile**: Check portrait and landscape. Ensure text sizes and spacing are elegant, not
      cramped.
    - Check "Jewelry Box" vs "Luxury Hacienda" theme variants.

3. **Premium Rubric Validation**:
    - **Typography**: Is the hierarchy clear? Are the fonts (Cinzel/Playfair/etc) applied correctly?
    - **Texture & Depth**: Are `FamilyDecorations` adding depth or feeling like "clutter"?
    - **Negative Space**: Is there enough white space to let the names "breathe"?
    - **Motion**: Are reveal animations smooth and premium?
    - **Copywriting**: Is the formal/warm Spanish tone consistent? Are labels like "Padres de..."
      appropriate?
    - **Optimization**: Are images in `FamilyDecorations` using the correct formats and dimensions?

## Phase 2: Identification of Improvement Points

**Goal**: Document specific findings.

1. Create a `reports/family-audit-[theme]-[date].md` with the following:
    - **Vertical Scale**: Is the section taking up too much vertical space?
    - **Visual Noise**: List elements that don't feel "premium".
    - **Mobile Gaps**: Identify any layout breaks or awkward spacing on small screens.
    - **Token Drift**: List any hardcoded CSS values.

## Phase 3: Surgical Refinement (Execution)

**Goal**: Apply fixes based on Phase 2 findings.

1. **Optimize Vertical Rhythm**:
    - Adjust margins and paddings in `_family.scss` to prevent "bloated" sections.
    - Ensure font sizes scale gracefully.

2. **Premium Polish**:
    - Enforce 3-Layer Color Architecture.
    - Refine decorative elements in `FamilyDecorations.astro`.
    - Improve mobile layout (e.g., using `grid` or `flex` more effectively for lists).

3. **Motion Tuning**:
    - Ensure `IntersectionObserver` triggers feel intentional and elegant.

## Phase 4: Verification

**Goal**: Confirm all objectives are met.

1. **Visual Comparison**:
    - Compare before/after screenshots/recordings.
2. **Cross-Theme Verification**:
    - Ensure changes didn't break other themes (e.g., XV Years Demo / Jewelry Box).
3. **WCAG Compliance**:
    - Verify contrast and font sizes for accessibility.

---

## Critical Reflection

- **Does it look expensive?** Premium digital invitations should feel like high-end editorial
  design.
- **Is it balanced?** A section that is "too big" loses its impact.
- **Is it performant?** Ensure animations are GPU-accelerated and images are optimized.

// turbo
