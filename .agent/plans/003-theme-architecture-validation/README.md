# Plan 3: Theme Architecture Governance & Variant Centralization

## Abstract

This plan executes a rigorous teardown and centralization of stylistic debt within Celebra-me's SCSS ecosystem. Specifically, it tackles the 1,600+ lines of production styles currently locked inside the ad-hoc `noir-premiere-xv` event, moving them into the structured `editorial` theme preset variants in accordance with the project's native **3-Layer Color Architecture**.

## Objectives

1. **Audit & Standardize:** Discover where hardcoded CSS values are ignoring design tokens.
2. **Variant Centralization:** Distil the massive `noir-premiere-xv` file into modular `editorial` section variants so other events can reuse the Noir aesthetic.
3. **Cross-Preset Immunity:** Ensure refactoring the `editorial` preset does not cause visual regressions in the `top-premium-floral` preset used by active clients.
4. **Visual Regression:** Establish strict checkpoints for UI testing before commit.

## Phases

- **[01-theme-audit]**: Map out token violations and missing section variants.
- **[02-noir-premiere-refactor]**: The heavy-lifting SCSS migration.
- **[03-cross-preset-compatibility]**: Floral protection layer.
- **[04-visual-regression]**: The manual/automated QA step ensuring structural integrity.

---
*Generated under the chronological archival governance rule `001-plan-archival-governance`.*
