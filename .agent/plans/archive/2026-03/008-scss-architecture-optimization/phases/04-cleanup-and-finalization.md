# Phase 04: Cleanup & Finalization

## Goal

Remove legacy bridges and finalize the "Top Pro" architecture.

## Steps

1. **Deprecation**:
   - Remove legacy SCSS variable definitions in `tokens/_semantic.scss` and `_primitives.scss`.
2. **Contract Removal**:
   - Delete `src/styles/tokens/contracts/core.scss`.
   - Consolidate all global variables into the new structure.
3. **Final Validation**:
   - Run audit to ensure zero hardcoded colors and zero redundant variable layers.
   - Verify performance and payload scalability.
