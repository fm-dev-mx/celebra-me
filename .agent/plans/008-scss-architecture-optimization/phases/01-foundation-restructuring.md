# Phase 01: Foundation & System Layer Restructuring

## Goal

Establish the new directory structure and migrate raw primitives to the System Layer.

## Steps

1. **Directory Setup**:
   - Create `src/styles/tokens/system`
   - Create `src/styles/tokens/semantic`
   - Create `src/styles/tokens/components`
2. **System Layer Migration**:
   - Move raw color maps from `primitives/_color.scss` to `system/_color.scss`.
   - Rename variables to use the `$sys-` prefix (e.g., `$sys-color-gold-500`).
   - Move spacing values to `system/_spacing.scss`.
3. **Internal Integration**:
   - Update `tools/_functions.scss` if needed to support the new mapping.
