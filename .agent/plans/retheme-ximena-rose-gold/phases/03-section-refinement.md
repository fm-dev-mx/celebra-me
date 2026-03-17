# Phase 03: Section-Specific Refinement (Decoupled Layer)

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Apply visual layout and component overrides in the event-specific SCSS, ensuring zero-leakage to other invitation variants.

**Weight:** 40% of total plan

---

## 🎯 Analysis / Findings

Individual sections like the Hero, Family Panel, and RSVP require specific color adjustments for overlays, borders, and button states to maintain high-end readability.

---

## 🛠️ Execution Tasks [STATUS: PENDING]

### 1. Hero & Atmosphere Refinement

- [ ] Update `.invitation-hero__background::after` overlay with warmer rose tones (10% of Phase).
- [ ] Adjust `.invitation-hero__portrait` arched border to Rose Gold (5% of Phase).
- [ ] Synchronize `invitation-hero__details` backdrop color (5% of Phase).

### 2. Structural Panels (Family & Itinerary)

- [ ] Update `--family-panel-bg` and border colors for lighter contrast (10% of Phase).
- [ ] Adjust `.family__media-frame` rose gold metallic casing (5% of Phase).
- [ ] Update `itinerary` icons and timeline markers (5% of Phase).

### 3. Interactive Components (RSVP & Gifts)

- [ ] Refine `.gift-card` border and shimmer effects (5% of Phase).
- [ ] Update `.rsvp__button` and `.copy-button` hover states to Rose Gold (5% of Phase).

---

## ✅ Acceptance Criteria

- [ ] The "Editorial" feel is maintained: large typography, generous whitespace.
- [ ] All arched portals (Hero, Family) use the Rose Gold border consistently.
- [ ] Button interactions feel "jewelry-like" with subtle shimmers.
