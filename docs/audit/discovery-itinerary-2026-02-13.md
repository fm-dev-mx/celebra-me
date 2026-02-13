# Discovery Report: Itinerary Section

**Date**: 2026-02-13 **Theme**: Luxury Hacienda (Gerardo)

## 🎨 Visual Patterns & Aesthetics

- **Dynamic Timeline**: The SVG path animation linked to scroll progress (`pathLength`) is a
  high-end interaction that adds significant perceived value.
- **Symmetry**: Desktop alternating layout (Left/Right) creates a rhythmic editorial flow.

## 🔴 Visual Bugs & Friction Points

- **Line End Marker**: The `.itinerary__line-end` (line 116 in `_itinerary.scss`) uses a hardcoded
  diamond that might not perfectly align with the SVG path's finish depending on the section's total
  height.
- **Mobile Icon Overflow**: On mobile, the icon wrapper is positioned absolutely (`left: -3rem`). If
  the container padding isn't enough, it might clip or look unbalanced.

## 🛠️ Technical Audit (SCSS & Tokens)

- **Hardcoded Colors & Fallbacks**:
    - `TimelineList.tsx:110`: Hardcoded `#d4af37` as a final fallback for the timeline path stroke.
    - `_itinerary.scss:202`: `rgb(255 255 255 / 85%)` for descriptions.
    - `_itinerary.scss:211`: `rgb(255 255 255 / 95%)` for icon backgrounds.
- **Variable Usage**: Good use of CSS variables (`--itinerary-bg`, `--itinerary-line-color`)
  allowing for theme overrides.

## 📱 Mobile UX

- **Alignment Shift**: Successfully transitions from alternating to single-column left-aligned
  layout for mobile.
- **Touch Targets**: Icon wrappers are `48px` on mobile (line 289), meeting the `44px+`
  accessibility standard.

---

**Status**: Ready for Remediation Blueprinting.
