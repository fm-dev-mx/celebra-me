# 🎨 Premium UX Vision — Celebra-me Ecosystem

## 1. The Vision

Transform **Celebra-me** from a standard invitation website into a **digital luxury** platform. Both the landing page and the invitations must emulate the tactile and visual experience of a high-end physical invitation (textured paper, embossed effects, curated typography, subtle transitions).

**UX Core:** A "static per section" experience (one section at a time in the viewport) where navigation is subtle and information flows through elegant transitions, avoiding generic infinite scrolling.

---

## 2. Section & Component Map

### A. Landing Page (User/Client Experience)

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

---

## 3. Digital Invitation (Guest Experience)

**Execution status and next steps are tracked in:**
- [docs/plan/invitation-master-plan.md](./plan/invitation-master-plan.md)

This document defines the **qualitative UX bar** (premium signals, pacing, motion, restraint). The master plan defines the **deterministic execution order** and completion status.

High-level invitation components (for orientation):
- Ceremonial Envelope Opening → Signature Hero → Quote → Countdown → Family → Location → RSVP → Registry → Itinerary → Gallery → Final Thank You

---

## 4. Technical & Aesthetic Specifications

- **Tech Stack:** Astro (Framework), SCSS (Styles), React/TypeScript (Interactivity), Framer Motion (Motion Design).
- **Visual Design:** "Jewelry Box" Aesthetic: Glassmorphism, Silver/Gold accents, Serif headings + clean sans details.
- **Navigation:** Adaptive headers that switch between transparent/glass and solid luxury states.

---

## 5. Jewelry Box Remediation Status (Landing Page)

The targeted remediation of the landing page to eliminate "low-quality" signals is **visually complete**.

### Completed Visual Targets

- [x] **Testimonials:** "High-Society Feed" grid (Framer Motion).
- [x] **FAQ:** "Premium Accordion System" with `AnimatePresence`.
- [x] **Contact:** "Concierge Request" redesign (Glassmorphism + Motion feedback).
- [x] **Iconography:** Bespoke stroke-drawing SVGs across all sections.
- [x] **Experience:** Refined header and mobile navigation for zero layout shift and premium transitions.

---

## 6. Resolved Integration Issues

> All issues identified during the Digital Invitation phase transition have been resolved (2026-01-31):

1. ~~**Header Duality**~~ → `Layout.astro` now has `hideHeader` prop; invitation pages opt-out of landing header.
2. ~~**BEM Inconsistency**~~ → `HeaderBase.astro` classes aligned with `_header-base.scss` spec.
3. ~~**Responsive Breakage**~~ → Mobile toggle now correctly hidden on desktop via BEM-compliant CSS.
4. ~~**UX Inconsistency**~~ → `EventHeader.astro` now uses `NavBarMobile.tsx` with Framer Motion.

### Production Readiness (Link Integrity QA)

> **Archived Plan:** [docs/plan/archive/landing-page-completion.md](./plan/archive/landing-page-completion.md)

**All items resolved as of 2026-01-31:**

- [x] Services card links → `#contacto`
- [x] AboutUs CTA → `#contacto`
- [x] Pricing CTAs → `#contacto`
- [x] Footer "Compañía" links → internal anchors
- [x] `/terminos` page created
- [x] `/privacidad` page created
- [x] Footer social links verified

---

## 7. Related Documentation

| Document | Purpose |
|----------|---------|
| [docs/plan/archive/landing-page-completion.md](./plan/archive/landing-page-completion.md) | Landing page step-by-step plan (archived) |
| [docs/plan/invitation-master-plan.md](./plan/invitation-master-plan.md) | Digital invitation roadmap + canonical progress |

---

## 8. Changelog

| Date | Change |
|------|--------|
| 2026-01-31 | Landing Page marked production-ready. All pending items resolved. |
| 2026-01-31 | Archived landing-page-completion.md to docs/plan/archive/ |
| 2026-01-31 | Restructured document for clearer status mapping |
