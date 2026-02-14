---
description:
    Remediation execution for the 'Gerardo' header based on discovery report findings (2026-02-13).
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-02-14
---

# 🛠️ Workflow: Header Remediation

## Objective

Address findings from `docs/audit/discovery-header-2026-02-13.md` to ensure perfect contrast and
technical consistency in the Header.

## Proposed Changes

### 1. Fix Desktop Contrast (Transparent State)

- **Problem**: Nav links are invisible against the dark Hero background.
- **Action**: Update `src/styles/invitation/_event-header.scss` to use a light color (e.g.,
  `tokens.$base-neutral-0` or a theme accent) when the header is in the `.header-base--transparent`
  state.
- **Verification**: Verify legibility on the production-like local env.

### 2. Tokenize Hardcoded Values

- **Problem**: Hardcoded `rgb` and hex values in `_header-base.scss` and `_event-header.scss`.
- **Action**:
    - Replace `rgb(10 10 10 / 80%)` with a semantic glass-bg token.
    - Replace `#fff` overrides with theme-aware CSS variables.

### 3. Title Legibility

- **Action**: Apply a subtle `text-shadow` or increase font-weight slightly for "Gerardo Mendoza" in
  its transparent state.

## Verification Plan

1. **Visual Walkthrough**: Confirm links are 100% visible immediately on page load.
2. **Scroll Test**: Ensure the transition to the "scrolled" (shrunken) state remains smooth and
   colors switch correctly.
3. **Responsive Check**: Verify title truncation doesn't occur on small mobile screens.

// turbo
