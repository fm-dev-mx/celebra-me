# Plan: Ximena Meza Trasviña XV Editorial Finalization

Platform: **Celebra-me**  
Role: **Senior Product Designer & Lead Frontend Engineer**  
Status: **Ready for Implementation**

## 1. Objective

The current implementation for Ximena Meza Trasviña is a direct variation of the "Jewelry Box"
system. While the palette uses high-end ivory and gold, the visual grammar (floating glass cards,
standard symmetry, and decorative density) still feels like a template rather than a bespoke
editorial invitation.

This plan defines a **Top Premium Editorial Redesign** for Ximena. We will move away from the
"Princess XV" aesthetic towards a "High-End Fashion Editorial" (Vogue-inspired) language, focusing
on dramatic typography, asymmetric framing, and a sophisticated "Noir & Pearl" palette.

## 2. Locked Product Decisions

- **Canonical route:** `/xv/ximena-meza-trasvina`
- **Active eventType:** `xv`
- **Active preset:** `top-premium-xv-ximena`
- **Scope class:** `event--ximena-meza-trasvina`
- **Design direction:** Modern Fashion Editorial (Quinceañera Vogue)
- **Visual principle:** Negative space, dramatic typography, and layered depth

## 3. New Creative Direction

### Design Name

Noir & Pearl Editorial (The Luminaire Edition)

### Emotional Reference

- High-fashion magazine covers (Vogue, Harper's Bazaar)
- Minimalist luxury boutiques
- Architectural light and shadow
- Sophisticated maturity (transitioning to XV)

### Palette

| Token          | Hex       | Use                                  |
| -------------- | --------- | ------------------------------------ |
| Obsidian Ink   | `#1B140D` | Primary text, deep contrast sections |
| Pearl Silk     | `#F9F6F2` | Main page backgrounds                |
| Burnished Gold | `#C5A059` | Editorial rules, fine accents        |
| Alabaster      | `#FFFFFF` | Layered highlights                   |
| Muted Stone    | `#D4CDC3` | Borders and structural depth         |

### Typography

- **Display / headlines:** `Bodoni Moda` (High-contrast editorial serif)
- **Editorial labels:** `Cinzel Variable` (Wide tracking, uppercase)
- **Body / details:** `Montserrat` (Clean, modern sans-serif)
- **Accent script:** `The Nautigal` (Used sparingly for signatures only)

### Shape Language

- **Asymmetric Layering:** Frames that don't align perfectly with images (offset borders).
- **Arched Portals:** Used for transition interludes and focal portraits.
- **Thin Editorial Rules:** 1px gold lines creating a "printed page" structure.
- **Vertical Rhythm:** Typography that feels like a magazine masthead.

## 4. Why the Current Implementation Fails "Top Premium"

- **Centralized Card Bias:** The Hero relies on a 2-column glass card which feels like a "web
  widget" rather than a cover.
- **Generic Ornaments:** It still uses "Jewelry Box" flower seals and glints.
- **Symmetric Fatigue:** Every section is centered and predictable. Top Premium requires intentional
  asymmetry and "breathing room."
- **Materiality:** It relies on "glass" (blur) instead of "paper/silk" (texture and solid layering).

## 5. Asset Direction

### Required Editorial Photography

Ximena's assets must be treated as a fashion lookbook:

1. **The "One Face" Principle:** All featured portraits (Hero, Family, Gallery, Thank You) must
   showcase the same person. Avoid generic stock photos that break the immersion.
2. **Visual Coherence:** Every image must share the same "Editorial Issue" logic: similar
   retouching, lighting (high-contrast or soft silk), and fashion styling to ensure the invitation
   feels like a single photoshoot session.
3. **Hero (Portrait):**
    - High-fashion pose, dramatic lighting (Chiaroscuro).
    - Composition should allow for text overlap (White space on one side).
4. **Family (The Circle of Light):**
    - Arched frames, portrait-style, high-end finishing.
5. **Interludes (Storytelling):**
    - Dynamic parallax images that break the "section container" feeling.
6. **Gallery Items:**
    - A mix of wide, vertical, and detail shots (e.g., jewelry, dress texture) all from the same
      aesthetic collection.

## 6. Section-by-Section Redesign Spec

### 6.1 Hero: The "Vogue" Cover

**Goal:** Transform the entry into a high-fashion magazine cover.

- **Layout:** Remove the floating glass card. Use a **full-bleed background portrait** with the name
  "Ximena" in massive, offset `Bodoni Moda` typography.
- **Typography:** Name vertically aligned or overlapping the portrait with high-contrast (Obsidian
  on Pearl or Silver on Noir).
- **Metadata:** Clean editorial footer (Date, Location) using high-tracked `Cinzel`.

### 6.2 Family: The Editorial Portrait

**Goal:** Present the inner circle as a "featured story".

- **Visual:** Use an **asymmetric arched frame** for the featured family image.
- **Hierarchy:** "Padres" and "Padrinos" in clean columns using 1px vertical separators.
- **Contrast:** Pearl surface with Obsidian text for maximum legibility and prestige.

### 6.3 Interludes: Architectural Rhythm

**Goal:** Use the `contentBlocks` to create "pauses" in the experience.

- **Visual:** Full-screen images with **subtle quote overlays** or minimalist captions in the
  corner.
- **Motion:** Parallax effect with a "reveal" animation on scroll.

### 6.4 Location & Itinerary: The Event Program

**Goal:** Move away from "Maps" and "Lists" towards "Experience Design".

- **Itinerary:** Fine-line vertical timeline. Icons should be minimalist (no fills, only 1px gold
  outlines).
- **Venue:** Large-scale architectural venue photo taking precedence over the map card.

### 6.5 Gifts & RSVP: The Fine Stationery

**Goal:** Treat these "widgets" as formal response cards found in physical envelopes.

- **RSVP:** A solid Obsidian Ink panel with Pearl Silk text. Radio buttons styled as minimalist
  circles. No glassmorphism.
- **Gifts:** "Gift Concierge" header in `Bodoni Moda`. Cards are flat Alabaster with 1px Burnished
  Gold borders.

### 6.6 Thank You: The Signature

**Goal:** A personal, high-end closing note.

- **Visual:** A vertical arch portrait of Ximena with her "Signature" (`The Nautigal`) overlapping
  the bottom edge.
- **Message:** Centered, wide-tracked serif text with ample negative space.

## 7. Technical Implementation Strategy

### 7.1 Style Scoping

- All new rules must live in `src/styles/events/ximena-meza-trasvina.scss`.
- We will define a new set of local variables that override the `top-premium-xv-ximena` preset to
  achieve the asymmetric layouts without touching core components.

### 7.2 Component Overrides

- Use the `data-variant="jewelry-box"` (or a future `"editorial"`) hook to apply the Ximena-specific
  logic while keeping the Astro templates clean.

## 8. Implementation Phases

### Phase 1: Creative Foundation (Audit & Cleanup)

- [x] Move any "Jewelry Box" legacy CSS out of the `ximena` scope.
- [x] Update `top-premium-xv-ximena` preset with the new "Noir & Pearl" color tokens.
- [x] Align `ximena-meza-trasvina.json` placeholders for the new editorial captions.

### Phase 2: The Editorial Hero

- [x] Implement the magazine cover layout in SCSS.
- [x] Ensure massive typography handles responsive views correctly (Portrait vs Landscape).
- [x] Remove the "Glass Card" constraint.

### Phase 3: Structural Redesign

- [x] Redesign Family section with asymmetric arches.
- [x] Refactor Itinerary and Location with "Fine Stationery" aesthetics.
- [x] Implement the "Obsidion Ink" RSVP/Gifts panels.

- [x] Set overall plan to 100% completion.

### Phase 4: Motion & Polish

- [x] Add subtle "reveal" animations to editorial blocks.
- [x] Refine typography tracking and line-heights for a "printed" feel.
- [x] Final asset mapping with high-resolution editorial photos.

## 9. Acceptance Criteria

- [ ] Hero looks like a magazine cover, not a web card.
- [ ] Palette is Noir & Pearl, avoiding generic "XV Pink/Gold" tropes.
- [ ] Every section has unique asymmetric elements or editorial framing.
- [ ] RSVP and Gifts feel like premium stationery, not app widgets.
- [ ] Zero leakage to other XV or Wedding demos.
