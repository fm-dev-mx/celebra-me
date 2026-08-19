# Invitation Rhythm

**Status:** Canonical theme-domain guidance
**Last updated:** 2026-08-17

**Owns:** The compositional rhythm of an invitation — how adjacent sections relate through surface,
typography, intersection treatment, shadow, and reveal coordination.

**Related authority:** [`section-intersections.md`](section-intersections.md) owns geometry rules
and restraint limits for individual boundaries. [`motion.md`](motion.md) owns timing, recipes, and
the observation contract. [`architecture.md`](architecture.md) owns token layers and preset
boundaries. This document does not redefine those contracts; it provides the art-direction layer
that orchestrates decisions across them.

## Purpose

Rhythm is the temporal experience of reading an invitation from top to bottom: tension and rest,
light and shadow, density and air. A well-rhythmed invitation makes every section feel as though it
was designed knowing exactly what came before it and what comes next.

This document codifies the criteria that govern that experience, so an agent implementing a new
invitation can apply consistent, professional judgment rather than reinventing art direction
per project.

## Three Simultaneous Layers

Rhythm operates across three layers at once:

| Layer | Control variables |
| --- | --- |
| **Tonal** | Section background surface, neighbor surface, relative luminosity |
| **Typographic** | Display title weight and size, subtitle weight, body leading, tracking, alignment |
| **Spatial / Geometric** | Internal padding, intersection depth, clip-path direction, blend focal point |


---

## 1. Tonal Arc

Every invitation must define its **tonal band** before assigning section surfaces. A tonal band is
a deliberate luminosity progression across the full invitation sequence.

### Approved Tonal Band Patterns

| Pattern | Description | Canonical reference |
| --- | --- | --- |
| **Editorial light** | All sections in light surfaces. Contrast comes from type and focused dark overlays. | Valentina Hernandez (blush / paper / white) |
| **3-band** | Light editorial → mid pause → ink dark. The dark band is the narrative climax. | Alba-Rosa-Quinonez (ivory → cream → navy) |
| **Ivory-olive** | Warm cream with a vegetal dark accent. Interlude brings the dark; body returns to light. | Daniela-y-Martin (cream / beige / olive) |
| **Full-dark finale** | Final band (RSVP + thankYou) is always dark, creating dramatic closure. | Abril Michelle, Celestial Blue |

### Tonal Arc Rules

- No more than three distinct surfaces without a tonal relationship in a single invitation.
- A dark surface must not appear between two light surfaces without a bridge intersection.
- A luminosity change greater than approximately 30% between adjacent sections without an
  intersection treatment is a rhythm gap. Resolve it with an atmospheric-blend or by aligning the
  surfaces.
- The dark finale, when present, must have a clear closing transition. Do not end the invitation
  without one resolved final surface.

### Surface Assignment Protocol

Before writing any intersection SCSS, map every section to a surface band:

```
[section-kind] → [surface band] → [role: light / mid / dark / transition]
```

Record only the non-default surface assignments. Sections that share a band with their neighbors
need no intersection treatment; their visual continuity is the tonal relationship itself.

Map each role to the active preset's semantic tokens:

| Role | Token | Typical value range |
| --- | --- | --- |
| `light` | `--color-surface-primary` or `--color-surface-secondary` | High luminosity (L > 85%) |
| `mid` | Midtone surface token (preset-specific) | Medium luminosity (L 45–75%) |
| `dark` | `--color-surface-dark` | Low luminosity (L < 25%) |
| `transition` | Interlude or overlay surface | Depends on preset; usually dark or saturated |

Use the preset's named surface tokens. Do not introduce new role tokens at profile scope.

---

## 2. Typographic Hierarchy Between Sections

Typography is not reset per section. It is a continuous thread whose weight, tracking, and alignment
signal the reader's position in the narrative arc.

### Weight and Tracking by Surface Context

| Surface context | Display title | Subtitle | Body |
| --- | --- | --- | --- |
| Light section | Weight 500–700; tracking 0–0.04 em | Weight 400; tracking 0.04–0.08 em | Line-height 1.55–1.70 |
| Dark section | Weight 300–500; tracking 0.06–0.12 em | Weight 300–400; tracking 0.10–0.16 em | Line-height 1.60–1.75 |
| Interlude / transition | Weight 300; tracking 0.12–0.20 em; uppercase optional | — | — |

**Rationale:** dark surfaces absorb letter mass. Lighter weight and wider tracking compensate so the
type reads at the same optical strength. Uniform tracking across both contexts will make the dark
section look heavier and more compressed than intended.

### Alignment

- Narrative sections (quote, family, thankYou): centered.
- Functional sections (location, gifts, RSVP): leading-aligned or centered according to preset.
- Date and itinerary sections: centered or indented list; never flowing paragraph blocks.
- Do not change the title alignment between adjacent sections without a surface change to justify
  the shift.

### Alternating Energy Rule

Two consecutive sections with similarly weighted, centered display titles must be separated by a
section with a distinct visual treatment: an interlude, a surface-contrast section, or a geometric
intersection. Without that break, the reader perceives repetition rather than rhythm.

### Desktop Scale Ceiling and Viewport Proportion Rules

When designing or tuning theme presets, section variants, or invitation profiles for desktop
viewports (≥ 992px and widescreen ≥ 1440px):

- **Section Display Title Ceiling:** Section display headings must stay bounded within
  `clamp(2.2rem, 5.5vw, 4.2rem)` (approx. 35px to 67px). Avoid unconstrained `vw` growth or upper
  bounds > `5rem` (80px+), which cause titles to dominate the entire viewport and disrupt the reading
  cadence.
- **Narrative Display Copy Bounds:** Extended display text (e.g., quotes, dedication messages,
  introductory ledes) must maintain a font ceiling of `clamp(1.6rem, 3.8vw, 3.2rem)` with a minimum
  `line-height` of `1.15`, preventing single paragraphs from sprawling across hundreds of vertical pixels.
- **Section Padding and Vertical Rhythm:** Section block padding (`--section-padding-block`) must
  remain bounded within `clamp(3.5rem, 6vw, 6.5rem)` (approx. 56px to 104px). Viewport percentages
  exceeding `8vw` on vertical padding create artificial scroll fatigue without aesthetic benefit.
- **Media and Multi-column Grid Balance:** In desktop multi-column layouts (galleries, location
  cards, gift catalogs), containers must enforce a maximum content width (`1040px`–`1140px`) and
  explicit aspect-ratio/max-height constraints on media elements to prevent large portrait images
  from exceeding single-screen vertical spans.

---

## 3. Intersection Cadence: Neutral / Bridge / Climax

This section expands the composition cadence model from
[`section-intersections.md`](section-intersections.md) into an operational assignment protocol with
concrete decision criteria.

### Roles

- **Neutral:** The boundary is clean and fully spaced. No transition treatment. The adjacent
  sections may share a surface or a compatible tone.
- **Bridge:** A photographic or atmospheric connection that hands off one surface to another without
  a geometric break. One selected overlap or one atmospheric blend.
- **Climax:** An arch or a deep atmospheric blend that marks a strong narrative turn. Reserve these
  for one or two moments in the invitation.

### Assignment Protocol

Follow the selection process defined in `section-intersections.md` §Selection Matrix.
Apply these two thresholds as extensions to that process:

- **~15% luminosity difference or less** between adjacent surfaces → default to Neutral even
  without a dense-content condition.
- **Greater than ~30% luminosity difference** without a photographic or strong narrative
  connection → minimum atmospheric-blend (light treatment). A larger gap with a narrative turn
  qualifies as Climax.

### Restraint Limits

Apply the restraint limits defined in `section-intersections.md` §Restraint. This document
adds no new numeric limits. Enforce them before assigning any non-neutral pattern.

### Cadence Map Format

The cadence map is the planning record for non-neutral boundaries. It maps directly to
`composition.intersections` in the invitation's typed configuration. Neutral boundaries are
omitted; their absence is the intentional signal.

Record the map as a comment block in the invitation profile SCSS, immediately before the
intersection token block:

```scss
// Cadence map — non-neutral boundaries only
// [sectionA] → [sectionB] : [role] [pattern]
//
// hero            → countdown         : bridge  atmospheric-blend
// countdown       → location          : bridge  atmospheric-blend
// interlude-paris → gallery           : bridge  overlap diagonal-left-deep
// gallery         → gifts             : bridge  atmospheric-blend
// gifts           → access            : bridge  atmospheric-blend
// access          → rsvp              : climax  arch
//
// Neutral boundaries (location→interlude-paris, rsvp→family, family→thankYou)
// are intentionally omitted. Their absence is the neutral signal.
```

This map is required for every invitation profile that uses the intersection system. Its absence
from the profile is a rhythm gap.

---

## 4. Asymmetric Geometry: Craft Rules

These rules complement the geometry rules in
[`section-intersections.md`](section-intersections.md) with art-direction criteria for each
geometric type.

### Diagonal clip-path (overlap)

A diagonal cut must have an intentional reading direction relative to the invitation's visual flow.

- **Direction rule:** cut deep on the side where the outgoing content reaches its lowest
  visual weight — open sky, negative space, or the compositionally quieter edge. Cut shallow on
  the side with the primary focal point, face, or heaviest visual mass.
- **Mirror rule:** if two diagonal cuts exist in the same invitation, they must be opposite in
  direction (one left-deep, one right-deep) or create an intentional vector that points toward the
  narrative climax. Random same-direction cuts are prohibited.
- **Proportion rule:** the ratio `cut-shallow : cut-deep` must be between `1:5` and `1:8`. Below
  `1:5` the cut reads as a trapezoid. Above `1:8` the cut risks hiding content on mobile.
- **Token rule:** declare `--[slug]-cut-deep` and `--[slug]-cut-shallow` as profile tokens inside
  the intersection selector. Never hardcode values directly in the `clip-path` declaration.
- Validate at 320 px width that no content enters the cut zone.

```scss
// Example: gallery cut, left-deep
.gallery-section {
    --[slug]-cut-deep:    clamp(3.5rem, 9vw,   7rem);
    --[slug]-cut-shallow: clamp(0.5rem, 1.5vw, 1.25rem);

    clip-path: polygon(
        0    var(--[slug]-cut-deep),
        58%  var(--[slug]-cut-shallow),
        100% 0,
        100% 100%,
        0    100%
    );
}
```

### Editorial arch

The arch introduces the incoming surface as though it rises into the outgoing composition.

- **Asymmetry rule:** the arch vertex must not sit at 50%. Place it between 55% and 70% from the
  left edge for a standard left-biased composition. Invert (30–45%) only when the outgoing section
  is strongly right-dominant.
- **Height rule:** set `--intersection-arch-height` using a responsive range calibrated to the
  outgoing section's content density:
  - Dense body text (family, quote): `clamp(2.5rem, 5vw, 4.75rem)` — Alba reference.
  - Sparse content or after-interlude exit: `clamp(3rem, 6vw, 5.5rem)` — Daniela interlude reference.
  - Countdown or itinerary exit: `clamp(2.85rem, 5.5vw, 5.25rem)` — Daniela default.
  An arch height below 2.5rem disappears at mobile scale; above 6rem risks overlapping content
  at 390px.
- **Surface rule:** fill the arch with the incoming surface color. Never use a gradient fill on the
  arch itself; atmospheric treatment belongs to the blend pattern, not the arch.
- **Combination rule:** do not combine arch and diagonal in the same boundary. Each boundary receives
  one primary geometric treatment.

### Atmospheric blend

The blend paints the incoming surface as a soft light onto the outgoing section, bridging two
related moods without a literal edge.

- **Focal point rule:** the ellipse focal point (`at X% 0%`) must be asymmetric. Valid range:
  30–70% from the left edge. A value of exactly 50% is permitted only when the content layout is
  genuinely centered and the symmetry is intentional; this requires a note in the SCSS comment.
- **Termination rule:** the blend must end at `transparent` (0% opacity) before the incoming
  section's content begins. Using a non-zero final opacity creates an unintended tinted band at the
  top of the incoming section.
- **Specificity rule:** each `atmospheric-blend` for a specific `[data-section-kind]` must define
  its own `--intersection-blend` override. The global `--intersection-blend` token is a fallback
  only; it must not substitute for art-directed pairs.
- **Layer limit:** maximum two radial layers in a single blend. A stack of three or more gradients
  creates muddiness and maintenance debt.
- **Color match rule:** the blend's opening color must match the outgoing surface; its closing color
  must match the incoming surface. Mismatching creates a visual non-sequitur.

```scss
// Example: per-section atmospheric-blend override
.event--[slug] {
    .invitation-section-wrapper[data-intersection='atmospheric-blend'] {
        &[data-section-kind='location'] {
            --intersection-depth: clamp(1.75rem, 3.5vw, 2.75rem);
            --intersection-blend: radial-gradient(
                ellipse 140% 80% at 44% 0%,
                rgb(var(--[slug]-outgoing-rgb) / 88%) 0%,
                rgb(var(--[slug]-incoming-rgb) / 40%) 42%,
                transparent 100%
            );
        }
    }
}
```

---

## 5. Shadows and Depth

> These rules apply the shadow conventions of `theme-architecture` to the specific context of
> invitation section rhythm. They do not replace `theme-architecture` guidance; they narrow it
> to rhythm-critical decisions.

Shadow is elevation vocabulary. An element with a shadow rises from the surface; one without it is
flush with or recessed into it. Applying shadows indiscriminately destroys this signal.

### Rules by Surface Context

| Context | Rule |
| --- | --- |
| Dark section | No box-shadows on internal elements. The background contrast is the depth. |
| Light section | Box-shadow permitted on cards, portraits, and elevated elements. |
| Interlude photo | No drop-shadow on the image itself. Its mass is its contrast. |
| Portrait / family medallion | Soft shadow: `0 8px–16px 24px–40px rgb(var(--ink-rgb) / 10–18%)`. Never placed at the section boundary. |
| clip-path boundary | `drop-shadow` on the clip container: `≤ 0 6px 20px rgb(...) / 20%`. Higher opacity flattens the cut. |

### Shadow Token Declaration

Declare shadow as a profile token when it must be tuned for a specific surface. Do not hardcode
shadow values inline in section selectors.

```scss
--[slug]-card-shadow:     0 8px 32px rgb(var(--[slug]-ink-rgb) / 12%);
--[slug]-portrait-shadow: 0 12px 40px rgb(var(--[slug]-ink-rgb) / 14%);
--[slug]-clip-drop:       0 4px 16px rgb(var(--[slug]-ink-rgb) / 16%);
```

---

## 6. Reveal Coordination

Section reveals reinforce rhythm when their recipe and distance match the visual context created by
the intersection treatment. They contradict rhythm when applied uniformly regardless of context.

### Reveal Recipe by Boundary Role

| Incoming boundary role | Reveal recipe | `--motion-reveal-distance` |
| --- | --- | --- |
| Neutral | `fade-up` | Default (18 px) |
| Bridge — overlap (photographic) | `media-scale` for bridge media; `fade` for incoming section | N/A for `media-scale` |
| Bridge — atmospheric-blend | `fade-up` | Reduced (10–13 px) — the blend already introduces the arrival |
| Climax — arch | `fade` | — (the arch performs the visual entrance) |
| Climax — dark finale, full-width | `fade` | — |
| Hero | Follow `motion.md` hero role sequence | Per `motion.md` role limits |

### Stagger Constraint

`stagger-group` placement is governed by `motion.md` §Stagger placement rule. As a rhythm
guideline: do not assign `stagger-group` to two consecutive sections.

### Distance Calibration

Reduce `--motion-reveal-distance` for sections entering through an atmospheric-blend boundary. The
blend already provides the visual approach; a full 18 px translate compounds the movement
unnecessarily. A value of 10–13 px reads as arrival rather than emergence.

---

## 7. Rhythm Validation Protocol

Apply this checklist before considering an invitation profile visually complete.

### A. Tonal Arc

- [ ] Tonal band pattern selected and named (editorial-light, 3-band, ivory-olive, full-dark-finale,
  or documented variant).
- [ ] Every section assigned to a surface band.
- [ ] No luminosity change ≥ 30% without an intersection treatment.
- [ ] Dark finale has a resolved closing transition.

### B. Typography

- [ ] Display title tracking in dark sections ≥ 0.06 em.
- [ ] No two adjacent sections with similarly weighted centered titles without a differentiating
  treatment between them.
- [ ] Alignment is consistent with the preset and does not shift without a surface change.

### C. Intersections

- [ ] Cadence map comment block present in the profile SCSS.
- [ ] Neutral / Bridge / Climax role recorded for every boundary.
- [ ] ≤ 2 geometric treatments (arch or diagonal clip-path) in the invitation.
- [ ] ≤ 3 primary pattern types across the invitation.
- [ ] ≥ 40% of boundaries are neutral.
- [ ] Every atmospheric-blend has an asymmetric focal point and terminates at `transparent`.
- [ ] Every diagonal has an intentional direction; two diagonals are mirrored or form a vector.
- [ ] `cut-shallow : cut-deep` ratio is between 1:5 and 1:8 for every diagonal.
- [ ] Every arch vertex is between 30–45% or 55–70% from the left edge (never centered).

### D. Reveals

- [ ] No two adjacent sections use `stagger-group`.
- [ ] Sections entering through atmospheric-blend use `fade-up` with reduced distance (10–13 px).
- [ ] Sections entering through arch use `fade`.
- [ ] Hero sequence respects the timing limits defined in `motion.md` §Categories and limits.

### E. Shadows

- [ ] No box-shadows on internal elements in dark sections.
- [ ] clip-path `drop-shadow` opacity ≤ 20%.
- [ ] Shadow values declared as profile tokens, not hardcoded inline.

---

## Relationship to Other Documents

This document is the art-direction layer. It orchestrates across:

- **`section-intersections.md`** — geometry rules, DOM attributes, and restraint limits for
  individual boundaries. Selects intersection pattern and role.
- **`motion.md`** — timing categories, reveal recipes, and the observation contract. Assigns
  reveal recipe.
- **`architecture.md`** — three-level token model and preset boundaries. Governs surface and
  token placement decisions.

If a rule here conflicts with any of those documents, the owned domain document takes precedence.

