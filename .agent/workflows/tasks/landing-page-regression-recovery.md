---
description: Recovery and remediation of Landing Page regressions (Hero, Pricing, Colors, Icons).
---

# 🛡️ Workflow: Landing Page Regression Recovery

This task workflow is designed to systematically analyze and fix visual and structural regressions
on the main landing page.

## Phase 1: Diagnostic & Root Cause Analysis

1. **Global Style Audit**:
    - Inspect `src/pages/index.astro` and its global styles.
    - Check for recent overrides in `src/styles/home/` that might be affecting `flex` or `display`
      properties.
    - Identify the source of the "brown/cafe" color (likely a misplaced token or hardcoded value).

2. **Token Verification**:
    - Verify that `theme-preset--landing-page` correctly maps to the intended color tokens in
      `src/styles/tokens/`.

## Phase 2: Remediation - Layout & Structural Fixes

// turbo

1. **Hero Recovery**:
    - Restore vertical spacing and element hierarchy in the Hero component.
2. **Pricing Section**:
    - Fix card dimensions (preventing them from becoming too small).
    - Restore vertical spacing within cards.
3. **Header Spacing**:
    - Adjust horizontal padding/gap for desktop/landscape layouts to prevent elements from being too
      close.
4. **Footer Restoration**:
    - Fix the broken layout and vertical alignment issues.

## Phase 3: Remediation - Visuals & Interaction

1. **Icon Hover State**:
    - Fix "About Us" icons disappearing on hover.
    - Check `opacity` or `transform` transitions in `_about-us.scss`.
2. **Color Neutralization**:
    - Purge "brown/cafe" tones from the following sections:
        - Pricing (Custom Card)
        - FAQ
        - Contact
        - Footer
        - Header
    - Align with the approved landing page color palette.

## Phase 4: Verification Protocol

1. **Build Integrity**:
    - Run `pnpm build` to ensure no syntax errors.
2. **Visual QA**:
    - Verify Hero elements are properly spaced.
    - Confirm icons are visible on hover in About Us.
    - Check Pricing card sizes and layout.
    - Validate Header spacing on desktop resolutions (>1024px).
    - Ensure all brown tones have been replaced with the correct theme colors.
3. **Responsive Check**:
    - Validate vertical stacking on mobile and horizontal spacing on desktop.

---

// turbo

## Completion

1. Update `docs/implementation-log.md` with the remediation details.
2. Self-archive this workflow by moving it to `.agent/workflows/archive/` or deleting it after
   verification.
