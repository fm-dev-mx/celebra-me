# Plan: Ximena Meza Trasviña Invitation Restoration

> **Objective:** Restore the high-fidelity premium visual appearance of the `ximena-meza-trasvina` invitation and achieve full alignment with the centralized theme architecture.

## Context

Following the standardization of theme assets and the architectural refactoring (transitioning from event-specific SCSS to centralized theme presets), the invitation for **Ximena Meza Trasviña** has shown significant styling and content inconsistencies. Specifically, the visual mapping to the **"Top Premium Floral"** tokens remains incomplete, leading to a "hybrid" appearance where Rose Gold tokens clash with placeholder assets from the `noir-premiere-xv` demo (Valentina Noir).

## Root Cause Analysis

The regression was caused by a partial migration where:

1. **Asset Overwrite:** The `ximena-meza-trasvina` asset folder and JSON content were populated with copies of the `noir-premiere-xv` (Valentina Noir) demo, including family names and photos, but using the Rose Gold color palette.
2. **Variant Redundancy:** The `editorial` variant for invitation sections is still hardcoded inside event-specific SCSS files (`ximena-meza-trasvina.scss` and `noir-premiere-xv.scss`), violating the "Zero Hardcoded Styles" architectural principle.
3. **Zombie State:** The invitation renders with light Rose Gold backgrounds but dark editorial Noir photos, creating a jarring "Hybrid" look.

## Proposed Fix

1. **Asset Restoration:** Point the `ximena-meza-trasvina` content JSON back to its intended high-fidelity assets (or appropriate floral placeholders) and remove all "Valentina Noir" specific copy.
2. **Centralized Editorial Theme:** Extract the common `editorial` variant styles for `Hero`, `Family`, `Gallery`, `RSVP`, and `Gifts` into the centralized theme system (`src/styles/themes/sections/*.scss`).
3. **Token Hardening:** Verify that the `top-premium-floral` preset provides all necessary variables (including the complex `gold-metallic` gradients) to maintain the premium "Jewelry Box" aesthetic.

## Constraints

- **Zero Global Side-Effects:** Restoration must be scoped carefully using the `top-premium-floral` preset and event-specific IDs.
- **Accessibility:** Ensure all Rose Gold/Dusty Rose color mappings maintain WCAG 2.1 AA contrast against the light backgrounds.
- **Asset Integrity:** All images must be correctly linked and optimized via the `AssetRegistry`.

## Success Criteria

- [x] Ximena's invitation displays her correct family names and consistent "Floral/Rose Gold" imagery.
- [x] No "Valentina Noir" assets or copy are present on Ximena's page.
- [x] The `editorial` variant styles are successfully centralized and shared without duplication.
- [x] `top-premium-floral` tokens are fully applied and compliant.

## Plan ID

`ximena-invitation-restoration`
