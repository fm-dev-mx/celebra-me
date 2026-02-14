---
description:
    Remediation execution for the 'Gerardo' gallery section based on discovery report findings
    (2026-02-13).
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-02-14
---

# 🛠️ Workflow: Gallery Remediation

## Objective

Address findings from `docs/audit/discovery-gallery-2026-02-13.md` and implement the "magical"
mobile color transition.

## Proposed Changes

### 1. Implement Mobile Intersection Effect

- **Problem**: B&W only triggers on hover (no mobile hover).
- **Action**:
    - Update `PhotoGallery.tsx` to use Framer Motion's `whileInView` for EACH image item.
    - Define a "colored" state that removes the B&W filter/blend mode when the image is in the
      viewport (e.g., `viewport={{ amount: 0.5 }}`).
- **Verification**: Scroll on mobile and confirm color "reveals" as images appear.

### 2. Standardize Gallery Tokens

- **Problem**: Hardcoded backgrounds and card colors.
- **Action**: Replace `rgb(30 20 15 / 98%)` and `#1a1510` with theme surface tokens.

### 3. Performant B&W Fallback

- **Action**: Use `filter: grayscale(1)` for the B&W effect if `mix-blend-mode` causes stuttering on
  mobile.

## Verification Plan

1. **Mobile Scroll UX**: Ensure 60fps scrolling while filters transition.
2. **Lightbox Consistency**: Verify that opening the lightbox from a B&W state (if transition hasn't
   completed) still results in the correct color image.

// turbo
