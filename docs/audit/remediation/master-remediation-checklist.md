# 💎 Master Remediation Checklist: Premium Quality Audit

**Date**: 2026-02-13 **Status**: 🛠️ Blueprinting Complete / Execution Pending

This checklist consolidates all friction points, technical debt, and visual bugs identified during
the Premium Audit of the "Gerardo" (Luxury Hacienda) invitation.

---

## 🚨 Top Priority: Critical UX/A11y

- [x] **Header**: Fix invisible navigation links on Desktop top-state.
    - _File_: `src/styles/invitation/_event-header.scss` /
      `src/components/invitation/EventHeader.astro`
- [ ] **Gallery**: Implement mobile Intersection Observer for B&W to Color transition (currently
      hover-only).
    - _File_: `src/components/invitation/PhotoGallery.tsx`
- [ ] **RSVP**: Increase contrast for input placeholders (currently failing WCAG).
    - _File_: `src/styles/invitation/_rsvp.scss`

---

## 🎨 Visual & Editorial Refinement

- [ ] **Family**: Reduce excessive vertical padding (`11vw`) to improve section flow.
    - _File_: `src/styles/themes/sections/_family-theme.scss`
- [ ] **Itinerary**: Ensure the dynamic SVG line aligns perfectly with the `.itinerary__line-end`
      diamond.
    - _File_: `src/styles/invitation/_itinerary.scss`
- [ ] **Event Location**: Fix misleading icon mapping (e.g., `dress -> Hat`).
    - _File_: `src/components/invitation/EventLocation.astro`
- [x] **Header**: Add subtle text-shadow or weight to the "Gerardo Mendoza" title for better pop on
      dark backgrounds.

---

## 🛠️ Technical Debt & Tokenization

- [x] **Header**: Replace hardcoded `rgb(10 10 10 / 80%)` with semantic tokens.
- [ ] **Family**: Map parchment `#fdfcf9` and ink `#1a1410` values to theme tokens.
- [ ] **Event**: Replace hardcoded `hsl(43deg 30% 45%)` in venue card titles.
- [ ] **Itinerary**: Remove hardcoded fallback color `#d4af37` from React component.
    - _File_: `src/components/invitation/TimelineList.tsx`
- [ ] **Gallery**: Tokenize hardcoded backgrounds `#1a1510` and gradients.
- [ ] **RSVP**: Remove hardcoded opacities in radio groups and map to surface system.

---

## 📱 Mobile Polish

- [ ] **Family**: Audit name wrapping on ultra-narrow screens (<360px).
- [ ] **Itinerary**: Verify icons don't clip the left edge of the screen on mobile devices.
- [ ] **RSVP**: Switch hardcoded status emojis (`✨`, `✉️`) for theme-aware SVGs.

---

## 🏁 Verification Registry

_Once remediations are executed, use these workflows to verify:_

- [ ] Gerardo Master Remediation (`/gerardo-remediation-master`)
- [ ] Section Remediation (`/generic-section-remediation`)
- [ ] Hero Remediation (`/hero-premium-audit-remediation`)
