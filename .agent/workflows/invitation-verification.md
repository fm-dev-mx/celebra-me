---
description:
    Verification workflow for digital invitations. Ensures aesthetic consistency and technical
    health after each ADU.
---

# 🔍 Workflow: Invitation Verification

Use this workflow immediately after an ADU has been implemented to ensure zero-defect delivery.

## 🛠️ Verification Steps

1.  **Schema & Build Integrity**:
    - Run `npm run build` (or equivalent) to ensure no breaking changes in Content Collections.
    - Validate that the JSON data matches the TypeScript interfaces.

2.  **Aesthetic "Jewelry Box" Audit**:
    - **Colors**: Are the hex codes using the "Luxury Hacienda" palette (`#4B3621`, `#D4AF37`)?
    - **Typography**: Are headings using the robust Serif font?
    - **Spacing**: Verify one-section-per-viewport behavior.

3.  **Thematic Verification**:
    - Is the "Cowboy/Western" theme presented as "Premium" (e.g., subtle textures, elegant icons) vs
      "Generic"?
    - Is the Dress Code (Boots & Hat) clearly visible?

4.  **Accessibility Check**:
    - Verify `ReducedMotion` support if animations were added/modified.
    - Check contrast ratios for background/text.

5.  **Final Log Entry**:
    - If passed, update the Implementation Log in the Master Plan to `Verified` and add the date.
    - If failed, revert or fix before marking as complete.

// turbo 6. **Screenshot/Recording**:

- If UI changed, use the browser tool to capture progress.
