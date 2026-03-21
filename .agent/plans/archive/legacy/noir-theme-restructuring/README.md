# Plan: Noir Premiere XV Theme Restructuring

> **Objective:** Restructure the theme system for the `noir-premiere-xv` demo by merging extensive production styles into centralized `editorial` variants within section theme files.

## Context

The `noir-premiere-xv` invitation had 1,600+ lines of styles inside `noir-premiere-xv.scss`. To follow the project's architectural principles (Zero Hardcoded Styles), these styles should be part of the theme system as `editorial` variants, allowing them to be reused or adapted by other premium themes.

## Proposed Changes

1. **Centralization:** Move section-specific styles from `noir-premiere-xv.scss` to `src/styles/themes/sections/*.scss` under the `editorial` variant.
2. **Editorial Preset:** Create `src/styles/themes/presets/_editorial.scss` to manage global editorial-specific tokens.
3. **Data Adaptation:** Update `src/lib/adapters/event.ts` and `base-event.schema.ts` to properly handle the image structure required for the editorial aesthetic.
4. **Verification:** Ensure `tests/unit/event.adapter.test.ts` covers the new content mapping logic.

## Plan ID

`noir-theme-restructuring`
