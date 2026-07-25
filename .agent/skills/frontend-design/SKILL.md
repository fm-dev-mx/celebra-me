---
name: frontend-design
description:
  Create distinctive, production-grade frontend interfaces using Celebra-me theme presets, component
  styling contracts, Jewelry Box aesthetic, and premium typography systems.
domain: frontend
version: 1.1.0
when_to_use:
  - Designing or revising visual presentation, composition, typography, or layout
  - Evaluating whether an invitation UI feels premium and theme-coherent
  - Running a visual polish or critique pass before shipping UI
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/briefs/celebra-me.md for brand voice when brand-facing
inputs:
  - Visual requirements, page layouts, components, and theme context
outputs:
  - Design-direction guidance for premium invitation interfaces
related_skills:
  - theme-architecture
  - accessibility
  - animation-motion
related_docs:
  - docs/domains/theme/typography.md
  - docs/domains/theme/architecture.md
  - .agent/briefs/celebra-me.md
---

# Frontend Design

> **Related skills**: [`theme-architecture`](../theme-architecture/SKILL.md) for SCSS
> implementation, [`accessibility`](../accessibility/SKILL.md) for contrast.

This skill governs the **visual aesthetics** of Celebra-me digital invitations. Focus on _design
intent_, composition, and feeling. Technical implementation details (CSS variables, file structure)
are now managed by `theme-architecture`.

## Design Sources of Truth (do not fork)

- Brand and voice: [`.agent/briefs/celebra-me.md`](../../briefs/celebra-me.md)
- Theme tokens and SCSS architecture: `theme-architecture` + `docs/domains/theme/*`
- Do **not** install Impeccable (or similar) as a parallel SSOT, and do **not** add root
  `PRODUCT.md` / `DESIGN.md`. Selective anti-slop and polish ideas from external design skills are
  absorbed here; they never become a second design system.

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

### 1. Visual Layering

When designing a component, think in layers:

- **Layer 1 (Background)**: The event theme's base (e.g., the parchment texture).
- **Layer 2 (Surface)**: The card or container (e.g., a white card or frosted glass).
- **Layer 3 (Content)**: Text, icons, and buttons on top of the surface.

_Rule_: Never place text directly on Layer 1 unless it's a large display heading designed for it.

All reusable color, typography, glass, and shadow roles should flow through the live semantic token
system and the active preset/section architecture described by `theme-architecture`, not through
ad-hoc hardcoded values or archived design notes.

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
- ❌ **System Fonts**: Never use Arial/Helvetica/Inter/Roboto as the expressive face. Always load
  theme fonts.
- ❌ **High Contrast Borders**: Avoid pure black borders. Use alpha transparency (e.g.,
  `rgba(0,0,0,0.1)`).
- ❌ **Clutter**: If in doubt, add more whitespace.
- ❌ **Purple-on-white / indigo SaaS gradients**: default AI aesthetic — not Celebra-me.
- ❌ **Warm cream + terracotta + generic serif stack**: another AI design cluster — avoid unless the
  active preset explicitly owns those tokens.
- ❌ **Broadsheet / dense newspaper columns** with hairline rules and zero radius as a default look.
- ❌ **Hero cards / inset media**: on promotional surfaces prefer full-bleed hero planes over
  floating media cards unless the live design system requires otherwise.
- ❌ **Pill clusters, stat strips, badge overlays** on hero media.
- ❌ **Glow stacks and multi-layer shadows** used as decoration instead of hierarchy.
- ❌ **Motion noise**: prefer 2–3 intentional motions; always respect `prefers-reduced-motion`
  (`animation-motion`).

## Visual Critique / Polish Checklist

Use this as a procedure (not a separate skill) before shipping UI or invitation visuals:

1. **Brand first** — first viewport still reads as Celebra-me / the event brand after removing nav.
2. **One job per section** — one purpose, one headline, one short support line.
3. **Theme coherence** — colors, type, glass/shadow roles come from the active preset tokens.
4. **Hierarchy** — display / heading / body / meta are distinct; no competing hero CTAs.
5. **Spacing rhythm** — spacing tokens, not ad-hoc pixel soup.
6. **Contrast & focus** — readable text, visible focus states (`accessibility`).
7. **Motion** — intentional, reduced-motion safe (`animation-motion`).
8. **Copy fit** — Spanish UI strings do not overflow or collide at mobile widths.
9. **Distill** — remove any card, chip, or rule whose removal does not hurt understanding.
