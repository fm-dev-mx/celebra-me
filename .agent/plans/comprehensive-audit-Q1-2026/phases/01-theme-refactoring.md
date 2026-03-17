# Phase 01: Theme Architecture Refactoring

## 🔍 Finding: Bloated Theme Presets & Style Coupling
**Domain**: Theme Architecture / Frontend Design
**Criticality**: High

### Root Cause & Impact
Theme presets (e.g., `_luxury-hacienda.scss`) contain excessive component-specific variables (e.g., `--family-media-column`, `--luxury-countdown-grid-columns-mobile`).
*   **Root Cause**: Lack of abstraction between global theme definitions and component-local layout logic.
*   **Impact**: Tightly coupled stylesheets make updating components extremely difficult. A change in a component's layout requires modifying every theme preset, increasing CSS bundle size (13KB+ per preset) and maintenance friction.

## 🛠️ Minimalist Viable Improvement (MVI)
1.  **Semantic Token Enforcement**: Strip component-specific variables from presets.
2.  **Section Pattern Migration**: Move layout logic to `_section.scss` partials.
3.  **Local Tokens**: Components should compute their specific needs from generic semantic tokens (e.g., `--color-accent`) inside their own styles.

### ROI
High. Reduces CSS bloat and decouples global themes from internal component implementations.
