---
name: frontend-design
description:
  Create distinctive, production-grade frontend interfaces using Celebra-me theme presets, component
  styling contracts, Jewelry Box aesthetic, and premium typography systems.
domain: frontend
version: 1.2.0
when_to_use:
  - Designing or revising visual presentation, composition, typography, or layout
  - Evaluating whether an invitation UI feels premium and theme-coherent
  - Running a visual polish or critique pass before shipping UI
  - Designing or auditing invitation hero composition, focals, or face-safe overlays
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/briefs/celebra-me.md for brand voice when brand-facing
  - Complete the design-reference brief for reference-driven redesigns
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
  - .agent/workflows/design-reference-to-build.md
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
  PRODUCT/DESIGN markdown files. Selective anti-slop and polish ideas from external design skills
  are absorbed here; they never become a second design system.

## Pre-Design Context Gate

Before reference-driven visual implementation, complete
[`design-reference-brief`](../../templates/creative/design-reference-brief.md) and follow
[`design-reference-to-build`](../../workflows/design-reference-to-build.md).

The brief owns task-scoped inputs, reference interpretation, boundaries, deviations, blocking
conditions, and acceptance criteria. For a real invitation, it supplements rather than replaces
`client-invitation-audit` and the two-lane spec. Inspect verified Celebra-me components, demos,
presets, and invitation evidence before external references. External screenshots and Figma frames
communicate intent only; they never override the brand brief or live theme contract.

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

## Invitation Hero Composition Contract

Use this contract for every real invitation, demo, and hero polish pass. It defines **quality
invariants**, not a single cloned look. Preset defaults are shared; **client essence lives in the
invitation profile** (`src/styles/invitation-profiles/<slug>.scss`) plus payload focals.

### Authority split

| Layer                | Owner                                                      | Responsibility                                                        |
| -------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Quality invariants   | this skill                                                 | Face-safe composition, legibility, anti-clone essence, viewport proof |
| Preset hero defaults | `theme-architecture` + `src/styles/themes/sections/hero/*` | Reusable section behavior                                             |
| Client essence       | invitation profile SCSS + provision focals                 | Unique art direction per invite (Lane A)                              |

Do **not** solve face/type conflicts by copying another invite’s hero SCSS wholesale.

### Face-safe composition (mandatory)

1. Identify the honoree’s face, primary subject, and **photographic negative space** before locking
   type placement.
2. Derive the face-safe zone from the actual image at every required viewport. Do not assume it is
   always the upper, middle, or lower third.
3. Keep the complete type hierarchy as one coherent stack in the available negative space. Never
   split the name and metadata into unrelated absolute-positioned zones.
4. Use a directional dark veil behind the chosen type zone only. Avoid frosted ivory/white cards or
   horizontal washed bands over the face on full-bleed photo heroes.
5. Preserve an approved crop by default. Change payload focals (`focalPoint` / `focalPointMobile` /
   `focalPointTablet` / `focalPointDesktop`) only when the task explicitly requires reframing and
   visual evidence proves it. When reframing is authorized, drive it through `object-position` via
   `--hero-focal-point-*`; container `background-position` does not control the `<img>` crop.
6. Audit the inherited preset hero rules before writing a profile override. Explicitly reset stale
   `position`, `inset`, `grid-area`, `transform`, `mix-blend-mode`, background, and backdrop rules
   that would fragment the client-specific composition.

### Typography roles on hero

| Element                 | Role           | Tokens                                                                            |
| ----------------------- | -------------- | --------------------------------------------------------------------------------- |
| Eyebrow (`MIS XV AÑOS`) | Meta / label   | `--font-label`, `--font-label-tracking`, `--hero-label-color`                     |
| Honoree name            | Display        | `--font-display`, solid on-dark color on mobile (avoid washed gradient text)      |
| Date / time             | Meta           | `--font-label` or `--font-body`; high-contrast on-dark; no low opacity over photo |
| Venue line              | Secondary meta | Smaller than date; calligraphy accent only on “en” when present                   |
| Scroll cue              | UI micro       | `--font-body`; subdued; must not compete with the name                            |

Size and spacing must respond through canonical breakpoints (`xs` 480 / `sm` 640 / `md` 768 / `lg`
992 / `xl` 1200 via `mixins.respond-to` / `respond-below`) and spacing tokens — not one-off
hardcoded viewport widths.

### Essence rule (anti-clone)

Each invitation hero must state a short **essence sentence** in its profile comment or invitation
doc (palette cue + type cue + composition cue). Examples of distinct essences:

- Abril: dusty-rose directional veil, Cormorant display, compact stack in the photograph’s negative
  space, no glass card, approved crop preserved.
- Romina: botanical sage, expressive display treatment, desktop bias distinct from Abril.
- Jewelry-box preset demos may use glass card — that is a **preset** language, not a default to
  paste onto every full-bleed client photo.

If two client heroes are visually interchangeable after swapping names, the profile work failed.

### Viewport proof matrix

Verify hero acceptance on the invitation’s audit viewports (Abril reference set: `360×800`,
`390×844` primary, `768×1024`, `1024×768`, `1440×900`). For each:

- Face (or primary subject) remains readable.
- Name / date / venue remain legible over the veil.
- Type stack does not collide with the scroll cue or the transparent header.
- Essence still reads as that invitation, not a generic template.

### Hero anti-patterns (additions)

- ❌ Large display type centered over the honoree’s face.
- ❌ Frosted / ivory content card on a full-bleed client portrait when the photo is the hero.
- ❌ Low-contrast white meta text on mid-tone photo without a lower veil.
- ❌ Cloning another slug’s hero SCSS instead of writing a Lane A essence.
- ❌ Moving an approved crop when relocating/resizing the text solves the collision.
- ❌ Allowing inherited preset absolute positioning to split the name from date/venue metadata.
- ❌ Tuning crop with container `background-position` instead of authorized focals /
  `object-position`.

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
10. **Hero face-safe** — honoree face clear of type; complete hierarchy stays grouped in real
    photographic negative space; directional veil (not frosted band); approved crop is preserved
    unless reframing was explicitly authorized; profile essence remains distinct.

## Focused Visual Iteration

Run visual iteration as a bounded loop:

1. **Capture** — record the current target and primary mobile baseline.
2. **Define** — name one coherent visual delta, its owning layer, allowed files, and preserved
   behavior.
3. **Change** — edit only that section, element, token group, asset, or scoped override.
4. **Verify** — compare against the baseline and apply the checklist above.
5. **Stop or repeat** — accept the unit or define the next independent delta; do not broaden the
   pass implicitly.

Prefer approved client/product assets over generated placeholders. When a visual change alters a
live token, preset, section variant, or isolation contract, run
`.agent/workflows/theme-architecture-governance.md` and update the canonical theme documentation as
required there.
