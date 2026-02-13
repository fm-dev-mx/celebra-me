# Discovery Report: Event Location Section

**Date**: 2026-02-13 **Theme**: Luxury Hacienda (Gerardo)

## 🎨 Visual Patterns & Aesthetics

- **Card Frames**: The `VenueCard` uses a 2-layer frame system (outer/inner) which provides a rich,
  tactile feel.
- **Theming**: Variant-specific "rivets" are correctly injected only for the `luxury-hacienda`
  variant in `VenueCard.astro`.

## 🔴 Visual Bugs & Friction Points

- **Icon Mapping Inconsistency**: The component maps `dress -> Hat` and `gift -> Boot`. This is
  misleading and reduces semantic clarity.
- **Fixed Max-Width**: `max-width: 420px` for cards might cause issues if content (like long venue
  names or addresses) varies significantly.
- **Transition Delays**: Fixed delays of `0.1s` and `0.25s` for cards. A more generic stagger system
  would be better for scalability.

## 🛠️ Technical Audit (SCSS & Tokens)

- **Hardcoded Colors & Overrides**:
    - `_event-location.scss:44`: `color: hsl(43deg 30% 45% / 70%)` for `__card-title`.
    - `_event-location.scss:119-120`: Hardcoded `hsl` values for shadows.
    - `_event-location.scss:396`: Hardcoded `hsl` for Apple Maps button.
- **Global Mixins**: Correct usage of `mixins.respond-to(md)` for layout transitions.

## 📱 Mobile UX

- **Stacking**: Correctly stacks cards on mobile via `flex-direction: column`.
- **Map Interaction**: `GoogleMap` is used as an alternative to `OptimizedImage`. Need to verify if
  the map is interactive on touch or if it blocks scrolling.

---

**Status**: Ready for Remediation Blueprinting.
