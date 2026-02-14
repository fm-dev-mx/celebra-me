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

| Module             | Status            | Visual Aesthetic  | Implementation Notes                                     |
| :----------------- | :---------------- | :---------------- | :------------------------------------------------------- |
| **Landing Page**   | ✅ **Live**       | "The Jewelry Box" | Optimized, SEO-ready, zero broken links.                 |
| **XV Años Engine** | ✅ **Production** | "Jewelry Box"     | 3-Layer Color Arch, Asset Registry, Preset System.       |
| **60th Birthday**  | ✅ **Production** | "Luxury Hacienda" | Full data integration, interactive maps, refined motion. |

---

## 3. Product Architecture

### A. Core Technology

- **Stack:** Astro (Static + ISR), React (Interactive Islands), SCSS (Design System), Framer Motion
  (Orchestration).
- **Design System:** Token-based architecture with **Aesthetic Presets** for theme variations.

### B. Aesthetic Presets Architecture

Celebra-me uses a **Preset-based** styling system to support multiple aesthetics without code
duplication:

- **Presets Directory:** `src/styles/themes/presets/` contains entry points for each aesthetic.
- **Scoping:** Each preset wraps styles in a `.theme-preset--{name}` class.
- **Available Presets:**
    - `jewelry-box` — Glassmorphism, Gold/Silver, Serif (XV, Wedding)
    - `luxury-hacienda` — Leather, Cognac, Aged Gold (Birthday, Corporate)
- **Integration:** Driven by the `preset` field in `src/content/config.ts` and detailed in
  [THEME_SYSTEM.md](./THEME_SYSTEM.md).

### C. Typography System (Core 5)

A curated font system optimized for premium digital invitations:

| Role            | Family           | Use Case                            |
| :-------------- | :--------------- | :---------------------------------- |
| Display Formal  | Cinzel           | Monumental headers, XV/Wedding      |
| Display Elegant | Playfair Display | Editorial titles, Hero sections     |
| Calligraphy     | Pinyon Script    | Accents, signatures, "y" separators |
| Body Narrative  | EB Garamond      | Paragraphs, descriptions            |
| UI/Functional   | Montserrat       | Buttons, navigation, metadata       |

Tokens defined in `src/styles/tokens/`. Utility classes in `src/styles/invitation/_typography.scss`.

### D. Standard Component Library (The "Engine")

All invitations share a core library in `src/components/invitation/`, adapted via CSS variables and
JSON configuration:

1. **Ceremonial Opening:** 3D Envelope reveal.
2. **Hero:** High-impact portrait + typography.
3. **Countdown:** Dynamic urgency feedback.
4. **Protocol:** Family/Godparents editorial layout.
5. **Location:** Interactive styled maps (Google Maps custom styles).
6. **Itinerary:** Vertical timeline with scroll-triggered animations.
7. **RSVP:** Conversational form with capacity logic.
8. **Gifts:** Multi-channel registry (Store, Bank, PayPal, Cash).

### E. Universal Asset System

All invitation assets (images, logos, signatures) are managed via a deterministic registry in
`src/lib/assets/AssetRegistry.ts`. This ensures:

- **Performance:** Only optimized assets are consumed.
- **Maintainability:** Semantic naming (e.g., `getEventAsset('gerardo-sesenta', 'hero')`).
- **Safety:** Build-time validation of asset paths.

---

## 4. Active Roadmap

### Phase 1: Foundation (Completed)

- [x] Landing Page Remaster (Jewelry Box Aesthetic)
- [x] XV Años Demo (Proof of Concept)
- [x] Technical Debt Liquidation (Maps, Waze, Reduced Motion)

### Phase 2: Expansion (Current Focus)

- **60th Birthday Invitation (Gerardo "Jefe Botas")**
    - _Goal:_ Validate engine flexibility for different demographics/aesthetics.
    - _Challenge:_ "Luxury Hacienda" theme (Leather/Cognac/Gold) vs. XV Pink/Gold.
- **Multi-Event Support**
    - _Goal:_ Seamless routing for Wedding, Baptism, and Corporate events.

---

## 5. Changelog

| Date       | Change                                                                    |
| :--------- | :------------------------------------------------------------------------ |
| 2026-01-31 | **Landing Page** marked production-ready.                                 |
| 2026-02-07 | **XV Demo** marked production-ready. Embedded Styled Maps implemented.    |
| 2026-02-07 | Consolidated documentation to focus on Phase 2 (Expansion).               |
| 2026-02-08 | **Aesthetic Presets Architecture** implemented. Components generalized.   |
| 2026-02-08 | **Typography System** documentation added. Documentation audit completed. |
| 2026-02-11 | **Universal Asset System** implemented. Documentation sync completed.     |
| 2026-02-11 | **Refined Preset Architecture** extended to Family, Gifts, and Countdown. |
