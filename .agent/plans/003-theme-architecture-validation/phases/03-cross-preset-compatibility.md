# Phase 03: Cross-Preset Compatibility (Floral vs Editorial)

## Objective

Ensure that centralizing "Noir" styles into the global `.editorial` space does not accidentally poison or override the visual layout of the `top-premium-floral` preset.

## Context

Because we are moving logic from an isolated event ID (`noir-premiere-xv`) to a generic theme preset class (`editorial`), we risk CSS specificity battles.

## Implementation Steps

1. **Specificity Check:** Ensure all newly migrated variant styles are strictly nested under `[data-theme="editorial"]` and do not leak to sibling nodes.
2. ** floral Invariants Validation:** Run an automated shell scan ensuring no raw colors were accidentally injected into Base components without a `data-theme` scope.
3. **Clean-Up:** If the floral preset relied on any loose styles previously defined near the Noir blocks, isolate them carefully.

## Output

A mathematically decoupled SCSS architecture where `floral` and `editorial` coexist independently.
