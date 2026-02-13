---
description:
    Remediation execution for the 'Gerardo' family section based on discovery report findings
    (2026-02-13).
---

# 🛠️ Workflow: Family Section Remediation

## Objective

Address findings from `docs/audit/discovery-family-2026-02-13.md` to optimize vertical scale and
enforce token consistency.

## Proposed Changes

### 1. Optimize Vertical Scale

- **Problem**: Too much whitespace (`11vw` padding) makes sections feel disconnected.
- **Action**: Adjust `padding` clamp in `_family-theme.scss` (lines 68-70) to a more balanced range
  (e.g., `clamp(4rem, 6vw, 7rem)`).

### 2. Standardize Color Tokens

- **Problem**: Hardcoded colors in `_family-theme.scss` (`#fdfcf9`, `#1a1410`, etc.).
- **Action**: Map these values to existing `tokens.$color-*` or create new semantic tokens in the
  Jewelry Box architecture if necessary.

### 3. Mobile Density Refinement

- **Action**: Audit the 2-column children layout on mobile (`sm` breakpoint). If names wrap poorly,
  switch to 1-column for very narrow screens (<350px).

## Verification Plan

1. **Visual Walkthrough**: Ensure the section flows naturally into the next without excessive gap.
2. **Thematic Parity**: Verify "Jewelry Box" theme isn't regressions after shared base changes.

// turbo
