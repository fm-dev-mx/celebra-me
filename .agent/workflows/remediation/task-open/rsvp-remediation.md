---
description:
    Remediation execution for the 'Gerardo' RSVP section based on discovery report findings
    (2026-02-13).
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-02-14
---

# 🛠️ Workflow: RSVP Remediation

## Objective

Address findings from `docs/audit/discovery-rsvp-2026-02-13.md` to ensure WCAG compliance and theme
consistency.

## Proposed Changes

### 1. Fix Placeholder Contrast

- **Problem**: `rgb(0 0 0 / 30%)` is too light for accessibility.
- **Action**: Increase opacity or map to a `tokens.$color-text-muted` variant that ensures a 4.5:1
  ratio against the glass background.

### 2. Abstract Submission Feedback

- **Problem**: Hardcoded emojis (`✨`, `✉️`).
- **Action**: Replace with theme-aware icons or allow providing icons via props in `RSVP.tsx`.

### 3. Tokenize Form Overrides

- **Problem**: Hardcoded white opacities in radio groups and focus states.
- **Action**: Use Jewelry Box glass/surface tokens.

## Verification Plan

1. **Accessibility Audit**: Run a lighthouse or a11y color check on the RSVP inputs.
2. **Success State**: Verify the "Success" screen looks visually integrated with the Hacienda theme.

// turbo
