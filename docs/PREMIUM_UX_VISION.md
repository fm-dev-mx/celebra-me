# 🎨 Master Prompt: Premium "Celebra-me" Ecosystem

## 🌟 1. The Vision

Transform **Celebra-me** from a standard invitation website into a **digital luxury** platform. Both the landing page and the invitations must emulate the tactile and visual experience of a high-end physical invitation (textured paper, embossed effects, curated typography, subtle transitions).

**UX Core:** We want a "static per section" design (one section at a time in the viewport) where navigation is subtle and information flows through elegant transitions, avoiding generic infinite scrolling.

---

## 🗺️ 2. Section & Component Map

### 🚀 A. Landing Page (User/Client Experience)

| Section | Visual Status | Link QA | Notes |
|---------|---------------|---------|-------|
| **Header (The Jewelry Box)** | ✅ Complete | ✅ Fixed | Navigation links to internal anchors |
| **Hero "Prime"** | ✅ Complete | ✅ Fixed | WhatsApp + internal anchors for zero broken links |
| **Services Showcase** | ✅ Complete | ✅ Fixed | Cards redirect to `#contacto` for inquiry |
| **Storytelling (About)** | ✅ Complete | ✅ Fixed | CTA redirects to `#contacto` |
| **Testimonials** | ✅ Complete | ✅ N/A | No external links |
| **Pricing (Plans)** | ✅ Complete | ✅ Fixed | CTAs redirect to `#contacto` |
| **FAQ** | ✅ Complete | ✅ N/A | No external links |
| **Contact (Concierge)** | ✅ Complete | ✅ Fixed | Integrated WhatsApp + Form functional |
| **Footer** | ✅ Complete | ✅ Fixed | Legal pages created and linked |

### 📜 B. Digital Invitation (Guest Experience) - [UPCOMING]

- [ ] **Header:** Invitation header with subtle action buttons.
- [ ] **Cover/Preludio:** Elegant loading screen with music control (`MusicPlayer`).
- [ ] **Hero (Signature):** Cover with names, date, and main image. "Reveal" type entrance effect.
- [ ] **Quote (Sentiment):** Poem or phrase with real invitation typography.
- [ ] **Countdown (Anticipation):** Minimalist counter generating urgency and emotion.
- [ ] **Family (Protocol):** Section dedicated to parents and godparents with a subtle family tree design.
- [ ] **Location (Map):** Aesthetic Google Maps integration with stylized "Get Directions" buttons.
- [ ] **RSVP (Confirmation):** High-fidelity reactive form for attendance confirmation.
- [ ] **Gift Registry:** Elegant icons for bank transfers or external links.
- [ ] **Itinerary (Timeline):** Visual timeline of event moments.
- [ ] **Gallery (Memories):** Photo slider with "fade-in" transition effect.
- [ ] **Final Thank You:** Closing appreciation message.

---

## 🛠️ 3. Technical & Aesthetic Specifications

- **Tech Stack:** Astro (Framework), SCSS (Styles), React/TypeScript (Interactivity), Framer Motion (Motion Design).
- **Visual Design:** "Jewelry Box" Aesthetic: Glassmorphism, Silver/Gold accents, Serif headings (Outfit/Inter).
- **Navigation:** Adaptive headers that switch between transparent/glass and solid luxury states.

---

## 💎 4. Jewelry Box Remediation Status

The targeted remediation of the landing page to eliminate "low-quality" signals is **Visually complete**.

### ✅ Completed Visual Targets

- [x] **Testimonials:** "High-Society Feed" grid (Framer Motion).
- [x] **FAQ:** "Premium Accordion System" with `AnimatePresence`.
- [x] **Contact:** "Concierge Request" redesign (Glassmorphism + Motion feedback).
- [x] **Iconography:** Bespoke stroke-drawing SVGs across all sections.
- [x] **Experience:** Refined header and mobile navigation for zero layout shift and premium transitions.

---

## ✅ 5. Resolved Integration Issues

> All issues identified during the Digital Invitation phase transition have been resolved (2026-01-31):

1. ~~**Header Duality**~~ → `Layout.astro` now has `hideHeader` prop; invitation pages opt-out of landing header.
2. ~~**BEM Inconsistency**~~ → `HeaderBase.astro` classes aligned with `_header-base.scss` spec.
3. ~~**Responsive Breakage**~~ → Mobile toggle now correctly hidden on desktop via BEM-compliant CSS.
4. ~~**UX Inconsistency**~~ → `EventHeader.astro` now uses `NavBarMobile.tsx` with Framer Motion.

---

### ✅ Complete: Production Readiness (Link Integrity QA)

> **Archived Plan:** [docs/plan/archive/landing-page-completion.md](file:///c:/Code/celebra-me/docs/plan/archive/landing-page-completion.md)

**All items resolved as of 2026-01-31:**

- [x] Services card links → `#contacto`
- [x] AboutUs CTA → `#contacto`
- [x] Pricing CTAs → `#contacto`
- [x] Footer "Compañía" links → internal anchors
- [x] `/terminos` page created
- [x] `/privacidad` page created
- [x] Footer social links verified

---

## 📁 5. Related Documentation

| Document | Purpose |
|----------|---------|
| [landing-page-completion.md](file:///c:/Code/celebra-me/docs/plan/landing-page-completion.md) | Step-by-step plan to production |
| [invitation-master-plan.md](file:///c:/Code/celebra-me/docs/plan/invitation-master-plan.md) | Digital invitation roadmap |

---

## 📅 6. Changelog

| Date | Change |
|------|--------|
| 2026-01-31 | **PHASE CLOSURE**: Landing Page marked production-ready. All pending items resolved. |
| 2026-01-31 | Archived `landing-page-completion.md` to `docs/plan/archive/` |
| 2026-01-31 | Created `landing-page-completion.md` plan for link integrity QA |
| 2026-01-31 | Restructured document with table-based status tracking |
| 2026-01-30 | Visual remediation completed (Blocks A-D) |
