---
description: Architectural Refactor - Transitioning to Aesthetic Presets
---

# Workflow: Architectural Refactor

This workflow ensures a safe transition from event-based logic to aesthetic presets, preserving the landing page and existing demos.

## 1. Schema & Data Stabilization
- Add `preset` to the `theme` object in `src/content/config.ts`.
- Update `demo-xv.json` with `preset: "jewelry-box"`.
- Update `cumple-60-gerardo.json` with `preset: "luxury-hacienda"`.

## 2. Style Encapsulation
- Create `src/styles/themes/presets/`.
- Extract `_jewelry-box.scss` variables and overrides.
- Extract `_luxury-hacienda.scss` variables and overrides.
- **Critical:** Remove invitation-specific imports from `src/styles/global.scss` to decouple the landing page.

## 3. Component Generalization
- Modify `Hero.astro`, `RSVP.tsx`, and `EventLocation.astro` to remove `isXV` / `isBirthday` checks.
- Use feature-detection (e.g., `if (nickname)`) instead.

## 4. Route Orchestration
- Update `src/pages/[eventType]/[slug].astro` to apply the `theme-preset--{preset}` class.
- Clean up the main render loop.

## 5. Regression Testing
- Verify `/xv/demo-xv/` (Jewelry Box).
- Verify `/cumple/cumple-60-gerardo/` (Luxury Hacienda).
- Verify `/` (Landing Page).
