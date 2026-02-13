---
description: Itinerary Abstraction & Theme Audit (Gerardo vs XV Demo)
---

# 💎 Workflow: Itinerary Abstraction & Theme Audit

This workflow guides the analysis and remediation of the `Itinerary` section to ensure it is
properly abstracted, decoupled, and adheres to the project's theme architecture.

## 1. Analysis & Diagnosis

- [ ] **Data/UI Separation**: Check `Itinerary.astro` and `TimelineList.tsx`. Are they consuming
      data from content collections (`src/content/events/*.json`) without hardcoded strings?
- [ ] **Theme Leakage**: Identify styles in `_itinerary.scss` that are specific to one invitation
      but applied globally.
- [ ] **Convention Audit**: Check if it follows BEM naming conventions and CSS variable usage
      standards.
- [ ] **Theme Parity**: Verify if `luxury-hacienda` and `jewelry-box` have distinct, coherent visual
      signatures for this section.

## 2. Architectural Remediation

- [ ] **Create Theme File**:
    - [NEW] `src/styles/themes/sections/_itinerary-theme.scss`
- [ ] **Define Theme Blocks**:
    - Add `.theme-preset--luxury-hacienda .itinerary` and `.theme-preset--jewelry-box .itinerary`
      blocks.
- [ ] **Decouple Styles**:
    - Move color-specific and typography-specific overrides from `_itinerary.scss` to the new theme
      file.
    - Use CSS variables for values that change between themes (e.g., `--itinerary-line-color`,
      `--itinerary-icon-bg`).
- [ ] **Register Theme**:
    - [MODIFY] `src/styles/themes/sections/_index.scss` to forward the new theme.

## 3. Implementation (Gerardo 60)

- [ ] **Apply Luxury Hacienda Aesthetics**:
    - Ensure serif typography for headers (`font-heading-hacienda`).
    - Use editorial-style spacing and subtle parchment/hacienda textures if applicable.
    - Adjust icon flourish to match the "Old West/Hacienda" aesthetic.

## 4. Implementation (XV Demo)

- [ ] **Apply Jewelry Box Aesthetics**:
    - Ensure "sparkling" and "glass" effects.
    - Use refined, lighter weights for typography (`font-display-elegant`).
    - Adjust icons/flourishes to match the jewelry box theme.

## 5. Verification & Quality Gate

- [ ] **Visual Test**: Run `pnpm dev` and compare both invitations.
- [ ] **Responsive Check**: Verify no regression on mobile breakpoints.
- [ ] **Gatekeeper**: Run
      `[gatekeeper-commit](file:///c:/Code/celebra-me/.agent/workflows/gatekeeper-commit.md)`.

## 6. Cleanup

- [ ] **Archive Workflow**: Move this task-based workflow to archives after completion.
