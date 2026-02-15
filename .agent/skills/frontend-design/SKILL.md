---
name: frontend-design
description:
    Create distinctive, production-grade frontend interfaces using 3-Layer Color Architecture,
    Jewelry Box aesthetic, and premium typography systems.
---

> **Related skills**: [`theme-architecture`](../theme-architecture/SKILL.md) for SCSS
> implementation, [`accessibility`](../accessibility/SKILL.md) for contrast.

This skill governs the **visual aesthetics** of Celebra-me digital invitations. Focus on _design
intent_, composition, and feeling. Technical implementation details (CSS variables, file structure)
are now managed by `theme-architecture`.

## Design Philosophy

**"Anti-AI Slop"**: Avoid generic web design. Each invitation must feel:

1. **Premium**: Use of whitespace, serif typography, and rich textures.
2. **Harmonious**: Colors and fonts must strictly follow the active theme's palette.
3. **Alive**: Micro-interactions and smooth transitions (no jarring movements).

## Aesthetic Directions

### 1. The "Jewelry Box" Aesthetic (XV Años Premium)

_Concept: A precious object being opened._

- **Keywords**: Ethereal, Sparkling, Soft, Luxurious.
- **Palette**:
    - Surface: Ivory (`#FDFBF7`), Cream.
    - Accents: Liquid Gold (`#D4AF37`), Rose Gold.
    - Text: Deep Warm Grey, never pure black.
- **Typography**:
    - Headings: `Pinyon Script` (Cursive) or `Playfair Display` (Italic).
    - Body: `EB Garamond` or `Cormorant Garamond`.
- **UI Qualities**:
    - Glassmorphism (frosted glass) for cards.
    - Thin, elegant borders (1px solid gold).
    - Generous letter-spacing on uppercase text.

### 2. The "Luxury Hacienda" Aesthetic (Bodas/Aniversarios)

_Concept: Timeless tradition and strength._

- **Keywords**: Rusted, Earthy, Historic, Masculine/Neutral.
- **Palette**:
    - Surface: Leather texture, Dark Wood, Parchment.
    - Accents: Bronze (`#CD7F32`), Burnt Orange, Deep Green.
    - Text: Off-white on dark backgrounds, Dark Brown on light.
- **Typography**:
    - Headings: `Rye` (Western/Display) or `Cinzel` (Classic).
    - Body: `Montserrat` (Clean Sans) or `Special Elite` (Typewriter).
- **UI Qualities**:
    - Heavy textures (paper grain, leather).
    - Thick borders, double lines.
    - Box-shadows that imply depth and weight.

## Composition Rules

### 1. 3-Layer Color Architecture

When designing a component, think in layers:

- **Layer 1 (Background)**: The event theme's base (e.g., the parchment texture).
- **Layer 2 (Surface)**: The card or container (e.g., a white card or frosted glass).
- **Layer 3 (Content)**: Text, icons, and buttons on top of the surface.

_Rule_: Never place text directly on Layer 1 unless it's a large display heading designed for it.

### 2. Typography Hierarchy

- **Display**: Used for names ("María Elena") and big numbers ("XV").
- **Heading**: Section titles ("Itinerario", "Ubicación").
- **Body**: Readable text (16px+).
- **Meta**: Small details (dates, hints), usually uppercase and tracking-wide.

### 3. Spacing Rhythm

Use the `spacing` tokens religiously.

- Small gaps: `0.5rem` (8px).
- Content separation: `1.5rem` (24px).
- Section padding: `4rem` (64px) minimum.

## Common Anti-Patterns

- ❌ **Generic Gradients**: Don't use default CSS generated gradients. Use tailored, subtle shifts.
- ❌ **System Fonts**: Never use Arial/Helvetica. Always load specific fonts.
- ❌ **High Contrast Borders**: Avoid pure black borders. Use alpha transparency (e.g.,
  `rgba(0,0,0,0.1)`).
- ❌ **Clutter**: If in doubt, add more whitespace.
