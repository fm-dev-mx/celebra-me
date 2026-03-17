# Phase 05: Design System & Utility Cleanup

## 🔍 Finding: Ad-hoc Utility Reinvention & Layout Hacks
**Domain**: Frontend Design / Astro Patterns
**Criticality**: Medium

### Root Cause & Impact
Redundant layout utilities (e.g., `.w-6`, `.h-6`, `.container-custom`) exist in `global.scss` alongside a robust Design Token system.
*   **Root Cause**: Attempting to solve specific layout gaps without consulting or extending the theme tokens.
*   **Impact**: Fragmented CSS architecture. It makes the "Jewelry Box" aesthetic harder to enforce because developers use hardcoded values instead of semantic spacing/layout roles.

## 🛠️ Minimalist Viable Improvement (MVI)
1.  **Utility Audit**: Identification of all ad-hoc layout classes being used in components.
2.  **Token Migration**: Map these hardcoded values to the existing `spacing` tokens or add missing semantic roles to `_tokens.scss`.
3.  **Cleanup**: Delete the redundant `.w-*`, `.h-*`, and manual container classes, replacing them with standard layout components or token-based styles.

### ROI
Medium. Improves code readability and ensures that layout shifts are governed by the typography and spacing system.
