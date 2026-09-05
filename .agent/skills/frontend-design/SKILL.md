---
name: frontend-design
description:
  Create distinctive, production-grade frontend interfaces using Celebra-me theme presets, component
  styling contracts, Jewelry Box aesthetic, and premium typography systems.
domain: frontend
version: 1.4.0
when_to_use:
  - Designing or revising visual presentation, composition, typography, or layout
  - Evaluating whether an invitation UI feels premium and theme-coherent
  - Running a visual polish or critique pass before shipping UI
  - Designing or auditing invitation hero composition, focals, or face-safe overlays
  - Auditing marketing or dashboard UI for structural anti-slop bans (Persuade vs Operate)
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
  - docs/domains/theme/visual-design-reference.md
  - docs/domains/theme/typography.md
  - docs/domains/theme/architecture.md
  - .agent/briefs/celebra-me.md
  - .agent/skills/design-reference-to-build/SKILL.md
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
[`design-reference-to-build`](../design-reference-to-build/SKILL.md).

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

## Surface Registers

Pick the register from the surface in focus before designing:

| Register     | Surfaces                                         | Design job                                              |
| ------------ | ------------------------------------------------ | ------------------------------------------------------- |
| **Persuade** | Marketing, demos, public invitation presentation | Design _is_ the product: brand, photo, essence, emotion |
| **Operate**  | Host dashboard, editor, admin, commercial ops    | Design _serves_ the task: clarity, density, a11y, speed |

Do not force Jewelry Box / invitation ornament onto Operate surfaces. Do not flatten Persuade
surfaces into SaaS dashboard chrome.

## AI Slop Test (two altitudes)

If someone could look at the UI and say "AI made that" without doubt, it failed.

1. **First-order:** Could someone guess the look from the category alone? ("XV → cream + gold +
   cursiva") Rework until the scene sentence is specific to this brand/event.
2. **Second-order:** After avoiding the obvious category reflex, could someone still guess the
   aesthetic family from "category + anti-references"? (e.g. not purple SaaS → generic editorial)
   Rework until both answers are not obvious. For invitation heroes this is the same bar as the
   essence / anti-clone rule in the linked hero reference.

## Named Intervention Loop

For visual work, use this vocabulary (procedure inside this skill — not an external install):

`shape → critique → distill → polish → audit`

- **shape** — define composition/hierarchy before coding
- **critique** — UX/heuristic review against this skill + brief
- **distill** — remove cards, chips, rules that do not earn their place
- **polish** — final brand/theme/spacing pass
- **audit** — a11y, responsive, contrast, reduced-motion

## Hard Typography and Contrast Floors

- Body line length: prefer 65–75ch on long marketing/dashboard prose.
- Body text contrast ≥ 4.5:1; large text ≥ 3:1. Light gray "for elegance" on tinted near-white is a
  common failure — bump toward ink.
- On colored backgrounds, prefer a darker shade of the same hue (or ink alpha) over washed gray.
- Display letter-spacing floor: do not go tighter than about `-0.04em` (cramped letters read as AI
  display tuning).
- Prefer `text-wrap: balance` on short headings and `text-wrap: pretty` on long prose when the
  cascade allows.
- Hero/display clamp max on marketing: keep display ceilings intentional; oversized shouting type is
  not premium.

## Aesthetic Directions

For art-direction choices, consult the
[aesthetic examples](../../../docs/domains/theme/visual-design-reference.md#aesthetic-directions).
Use the active preset as authority; these examples do not prescribe a palette for every surface.

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

For invitation hero implementation or review, load the complete
[hero contract](../../../docs/domains/theme/visual-design-reference.md#invitation-hero-composition-contract).
It preserves face-safe composition, approved-crop authority, grouped typography, profile essence,
inheritance resets, and viewport acceptance. This contract is not needed for unrelated dashboard
work.

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

## Structural Bans (marketing + dashboard Adopt)

Match-and-refuse on **Persuade marketing** and **Operate dashboard** surfaces (not an excuse to
rewrite preset-owned invitation language):

| Ban                                 | Refuse                                                                                     | Prefer                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Side-tab / side-stripe              | `border-left` or `border-right` > 1px as colored accent on cards, alerts, previews         | Equal border, background tint, leading icon/number, or nothing                               |
| Decorative gradient text            | `background-clip: text` + gradient as ornament                                             | Solid color; emphasis via weight/size (invitation mobile hero already prefers solid on-dark) |
| Nested cards                        | Card inside card as default scaffolding                                                    | Flatten hierarchy; one surface                                                               |
| Ghost-card                          | 1px border **plus** soft wide drop shadow (blur ≥ ~16px) as decoration on the same element | Border **or** a defined short shadow — not both as garnish                                   |
| Over-rounding                       | `border-radius` ≥ 32px on cards/sections/inputs                                            | ~12–16px for product cards; pills OK for tags/buttons                                        |
| Eyebrow scaffolding                 | Tiny uppercase tracked label above **every** section                                       | One deliberate system kicker is voice; every-section eyebrows are AI grammar                 |
| Numbered section markers as default | `01 / 02 / 03` above every block                                                           | Numbers only when order carries real information (itinerary, true steps)                     |
| Layout property motion              | Animating `width` / `height` / `padding` / `margin` for polish                             | `transform` / `opacity` (sidebar width collapse may Adapt — document why)                    |
| Reveal-gated content                | Content invisible until a JS/CSS reveal class fires                                        | Default visible; motion enhances, never gates (SSR / reduced-motion / headless)              |

## Adapt Rules (brand-safe)

These Impeccable-style tells are **not** absolute bans in Celebra-me:

- **Cream / ivory / parchment / glass**: allowed when the **active preset or invitation profile**
  owns them (e.g. Jewelry Box). Banned as the default for new marketing/dashboard UI that is not on
  that preset.
- **Serif italic display / calligraphy**: allowed as invitation/marketing brand voice; do not paste
  onto Operate dashboard chrome.
- **Subtle spring motion**: allowed only through `animation-motion` tokens/curves; do not invent
  bounce/elastic easings ad hoc.
- **Sidebar `width` transition**: Adapt — Prefer transform-based patterns for new work; existing
  shell collapse may keep width until a dedicated shell refactor.

**Reject** (never absorb): root `PRODUCT.md` / `DESIGN.md` as design SSOT; Impeccable (or similar)
as required runtime; CI gates that fail invitation presets for cream/glass; dice/"worlds" creative
direction on client Lane A invitations.

## Visual Critique / Polish Checklist

Use this as a procedure (not a separate skill) before shipping UI or invitation visuals:

1. **Register** — Persuade vs Operate named for the surface.
2. **Brand first** — first viewport still reads as Celebra-me / the event brand after removing nav.
3. **One job per section** — one purpose, one headline, one short support line.
4. **Theme coherence** — colors, type, glass/shadow roles come from the active preset tokens.
5. **Hierarchy** — display / heading / body / meta are distinct; no competing hero CTAs.
6. **Spacing rhythm** — spacing tokens, not ad-hoc pixel soup.
7. **Contrast & focus** — readable text, visible focus states (`accessibility`); apply hard floors.
8. **Motion** — intentional, reduced-motion safe; no layout-property polish; no reveal-gated content
   (`animation-motion`).
9. **Copy fit** — Spanish UI strings do not overflow or collide at mobile widths.
10. **Distill** — remove any card, chip, side-tab, or rule whose removal does not hurt
    understanding.
11. **Structural bans** — no side-tabs, nested cards, ghost-cards, eyebrow scaffolding, or
    decorative gradient text on marketing/dashboard.
12. **Slop test** — first- and second-order category reflex both fail (not obvious).
13. **Hero face-safe** (invitation Persuade only) — honoree face clear of type; complete hierarchy
    stays grouped in real photographic negative space; directional veil (not frosted band); approved
    crop is preserved unless reframing was explicitly authorized; profile essence remains distinct.

### Operate (dashboard) extras

When the surface is Operate, also check:

- Primary task is obvious within one viewport (no ornamental hero competing with the table/form).
- Touch targets ≥ 44px where interactive.
- Muted labels remain ≥ 4.5:1 against their surface.
- Status/info callouts use tint or equal border — not side-tab accents.

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
`.agent/skills/theme-architecture-governance/SKILL.md` and update the canonical theme documentation as
required there.
