---
description:
    Comprehensive audit and refinement of the Header component to ensure premium quality, perfect
    responsiveness, and aesthetic excellence.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-02-14
---

# 💎 Workflow: Header Premium Audit & Refinement

## Objective

Analyze, audit, and refine the Header component (both Landing and Invitation variants) to ensure it
meets 100% premium standards, exhibits perfect responsiveness on both mobile and desktop, and holds
correct sizing and color tokens.

## Phase 1: Structural & Visual Audit

**Goal**: Identify friction points in colors, sizes, and responsiveness.

1. **Static Analysis**:
    - Review `src/components/common/HeaderBase.astro` and
      `src/components/invitation/EventHeader.astro`.
    - Inspect `src/styles/layout/_header-base.scss` and `src/styles/invitation/_event-header.scss`.
    - Check for hardcoded color values bypassing `tokens.$color-*` or semantic variables.
    - Validate header heights (`--header-height`, `--header-height-scrolled`) against design
      guidelines.

2. **Responsive Check (Browser)**:
    - Open the invitation/landing page in the browser.
    - **Desktop**: Verify height transitions on scroll. Ensure nav links have correct spacing and
      hover states.
    - **Mobile**: Check the "hamburger" menu. Verify touch targets (min 44px). Ensure the logo/title
      doesn't overflow.
    - **Theming**: Check "Jewelry Box" vs "Luxury Hacienda" theme header variants.

3. **Premium Rubric Validation**:
    - **Transitions**: Is the elevation/blur change on scroll smooth?
    - **Typography**: Are the logo and nav links using the correct premium fonts?
    - **Feedback**: Does the active section have a visual indicator?
    - **Header Hidden pattern**: Is the auto-hide (Headroom pattern) working elegantly without jank?

## Phase 2: Identification of Improvement Points

**Goal**: Document specific findings.

1. Create a `reports/header-audit-[date].md` with the following:
    - **Color Drift**: List hex codes that should be replaced with tokens.
    - **Sizing Inconsistencies**: Note if the logo feels too small/large or if spacing is
      unbalanced.
    - **Mobile UX Gaps**: Identify any awkward behavior in the mobile menu or title overflow.
    - **Performance**: Note any jank in the sticky header transitions.

## Phase 3: Surgical Refinement (Execution)

**Goal**: Apply fixes based on Phase 2 findings.

1. **Enforce Tokenization**:
    - Replace hardcoded colors with `tokens.$color-*` or semantic variables.
    - Ensure `EventHeader` correctly propagates theme variables via `define:vars`.

2. **Refine Sizing & Spacing**:
    - Adjust header heights and container paddings for vertical balance.
    - Improve responsive reflow of the title/logo.

3. **Enhance Premium UX**:
    - Tune transition timings and easing curves.
    - Improve focus states for accessibility.
    - Polish `NavBarMobile.tsx` animations if needed.

## Phase 4: Verification

**Goal**: Confirm all objectives are met.

1. **Visual Comparison**:
    - Verify desktop vs mobile layout parity.
2. **Cross-Variant Verification**:
    - Ensure changes work for both `HomeHeader` and `EventHeader`.
3. **WCAG Compliance**:
    - Verify contrast for text against transparent and opaque backgrounds.
    - Check keyboard navigation in the mobile menu.

---

## Critical Reflection

- **Does it feel "sticky" or "integrated"?** A premium header should feel like it belongs to the
  content, not just sit on top.
- **Is it too tall?** Excessive header height wastes valuable vertical space.
- **Are the colors harmonious?** Check transition between transparent and glassmorphism states.

// turbo
