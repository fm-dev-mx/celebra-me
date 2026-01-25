# 🎨 Master Prompt: Premium "Celebra-me" Ecosystem

## 🌟 1. The Vision

Transform **Celebra-me** from a standard invitation website into a **digital luxury** platform. Both the landing page and the invitations must emulate the tactile and visual experience of a high-end physical invitation (textured paper, embossed effects, curated typography, subtle transitions).

**UX Core:** We want a "static per section" design (one section at a time in the viewport) where navigation is subtle and information flows through elegant transitions, avoiding generic infinite scrolling.

---

## 🗺️ 2. Section & Component Map

### 🚀 A. Landing Page (User/Client Experience)

- [ ] **Header (The Jewelry Box):** Minimalist glassmorphism navigation with subtle action buttons.
- [ ] **Hero "Prime":** The first visual impact. Subtle background video or high-res imagery with elegant serif typography.
- [ ] **Services Showcase:** Interactive cards representing "XV Años" (Quinceañeras), "Bodas" (Weddings), and "Bautizos" (Christenings).
- [ ] **Storytelling (About):** Values section with micro-animations on vector icons.
- [ ] **Pricing (Plans):** Comparative pricing table with clean design and premium "hover effects".
- [ ] **FAQ (Inquiry):** Accordions with natural easing transitions.
- [ ] **Footer (Closing):** Contact info and social media with cohesive aesthetics.

### 📜 B. Digital Invitation (Guest Experience)

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

- **Tech Stack:** Astro (Framework), SCSS (Styles), React/TypeScript (Interactivity), Framer Motion or CSS Transitions for animations.
- **Visual Design:** Harmonic color palette (avoid flat colors), use of CSS variables for dynamic themes (`--primary`, `--accent`).
- **Navigation:** Subtle buttons (e.g., arrows with bounce micro-animation or side dots).
- **Transitions:** When a button is pressed, the current section info must gently disappear (fade-out) and the new section must "enter" (fade-in/slide) maintaining visual coherence.

---

## 📋 4. Implementation Protocol: "One Section at a Time"

We will work under the principle of **Perfectionism per Block**, following the modular instructions defined in `docs/plan/`:

1. **Reference:** Open and analyze the specific plan in `docs/plan/[section-name].md`.
2. **Definition:** Confirm data requirements (schema/content).
3. **Layout:** Build semantic HTML structure.
4. **Styling:** Implement premium SCSS and typography.
5. **Animation:** Add micro-interactions and transitions.
6. **Approval:** Only advance to the next section when the current one is confirmed as perfect.
