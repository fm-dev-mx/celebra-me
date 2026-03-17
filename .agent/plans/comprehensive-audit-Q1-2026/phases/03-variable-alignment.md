# Phase 03: SCSS-to-CSS Variable Migration

## 🔍 Finding: Static SCSS Variable Consumption
**Domain**: Theme Architecture
**Criticality**: High

### Root Cause & Impact
Stylesheets (e.g., `_quote.scss`) consume tokens via static SCSS variables (e.g., `tokens.$font-display`) instead of dynamic CSS variables (e.g., `var(--font-display)`).
*   **Clarification**: This phase does **NOT** involve renaming `.scss` files to `.css`. We will keep using SCSS for nesting and mixins.
*   **Root Cause**: Legacy styling patterns that pre-date the runtime theme architecture.
*   **Impact**: Visual properties are "build-time static." This breaks the ability to swap themes dynamically (e.g., from "Jewelry Box" to "Luxury Hacienda") at runtime, as SCSS variables cannot respond to the parent classes defined in theme presets.

## 🛠️ Minimalist Viable Improvement (MVI)
1.  **Variable Replacement**: Systematically replace SCSS variable usages with their corresponding CSS variable semantic tokens.
2.  **Fallback Implementation**: Use the SCSS variable only as a fallback inside the `var()` function to ensure zero-regress design if a token is missing.
3.  **Token Validation**: Ensure all used CSS variables are properly defined in the global token manifest.

### ROI
High. Unlocks the full power of the dynamic theme system and ensures visual consistency across all presets.
