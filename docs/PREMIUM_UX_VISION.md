# 🎨 Premium UX Vision — Celebra-me Ecosystem

## 1. The Vision

Transform **Celebra-me** from a standard invitation website into a **digital luxury** platform. Both
the landing page and the invitations must emulate the tactile and visual experience of a high-end
physical invitation (textured paper, embossed effects, curated typography, subtle transitions).

**UX Core:** A "static per section" experience (one section at a time in the viewport) where
navigation is subtle and information flows through elegant transitions, avoiding generic infinite
scrolling.

---

## 2. Global Status (Production Ready)

| Module             | Status             | Visual Aesthetic  | Implementation Notes                                     |
| :----------------- | :----------------- | :---------------- | :------------------------------------------------------- |
| **Landing Page**   | ✅ **Live**        | "The Jewelry Box" | Optimized, SEO-ready, zero broken links.                 |
| **XV Años Engine** | ✅ **Live**        | "The Jewelry Box" | Full data integration, interactive maps, reduced motion. |
| **60th Birthday**  | 🚧 **Implementing**| "Luxury Hacienda" | Bespoke spec finalized. Transitioning to styling & logic. |

---

## 3. Product Architecture

### A. Core Technology

- **Stack:** Astro (Static + ISR), React (Interactive Islands), SCSS (Design System), Framer Motion
  (Orchestration).
- **Design System:** Token-based "Jewelry Box" aesthetic (Glassmorphism, Gold/Silver accents, Serif
  typography).

### B. Standard Component Library (The "Engine")

All invitations share this core library, adapted via CSS variables and JSON configuration:

1.  **Ceremonial Opening:** 3D Envelope reveal.
2.  **Hero:** High-impact portrait + typography.
3.  **Countdown:** Dynamic urgency feedback.
4.  **Protocol:** Family/Godparents editorial layout.
5.  **Location:** Interactive styled maps (Google Maps custom styles).
6.  **Itinerary:** Vertical timeline with scroll-triggered animations.
7.  **RSVP:** Conversational form with capacity logic.
8.  **Gifts:** Multi-channel registry (Store, Bank, PayPal, Cash).

---

## 4. Active Roadmap

### Phase 1: Foundation (Completed)

- [x] Landing Page Remaster (Jewelry Box Aesthetic)
- [x] XV Años Demo (Proof of Concept)
- [x] Technical Debt Liquidation (Maps, Waze, Reduced Motion)

### Phase 2: Expansion (Current Focus)

- [ ] **60th Birthday Invitation (Gerardo "Jefe Botas")**
    - _Goal:_ Validate engine flexibility for different demographics/aesthetics.
    - _Challenge:_ "Luxury Hacienda" theme (Leather/Cognac/Gold) vs. XV Pink/Gold.
- [ ] **Multi-Event Support**
    - _Goal:_ Seamless routing for Wedding, Baptism, and Corporate events.

---

## 5. Changelog

| Date       | Change                                                                 |
| :--------- | :--------------------------------------------------------------------- |
| 2026-01-31 | **Landing Page** marked production-ready.                              |
| 2026-02-07 | **XV Demo** marked production-ready. Embedded Styled Maps implemented. |
| 2026-02-07 | Consolidated documentation to focus on Phase 2 (Expansion).            |
