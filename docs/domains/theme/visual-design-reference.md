# Visual Design Reference

Specialized reference extracted from the frontend-design skill. Load aesthetic examples only when
selecting art direction, and the hero contract when changing or reviewing invitation heroes.
[frontend-design](../../../.agent/skills/frontend-design/SKILL.md) remains the visual-intent owner;
[theme architecture](architecture.md) owns implementation. Example palettes/fonts are not a live
preset catalog; verify the active tokens and assets before use.

## Comparative Quality Criteria

Use these criteria with the existing design-reference brief and creative QA report. They evaluate
the rendered result, not the amount of implementation work. Human creative acceptance remains
independent of mechanical validation.

| Dimension      | Observable review                                                                     | Demonstrated anti-pattern                                                                         |
| -------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Composition    | Identify the dominant element and the role of each secondary element                  | Reproducing palette and ornament while losing the reference's spatial relationships               |
| Typography     | Distinct display, narrative and functional roles; effective size, contrast and reflow | A long script paragraph competing with the names; tiny tracked capitals for practical information |
| Rhythm         | Review complete sections and boundaries, plus readable detail crops                   | Treating unrevealed blank content as negative space; approving isolated components only           |
| Surfaces       | Explain the hierarchy served by each border, shadow and ornament                      | Outer border, inner frame, medallion and elevation all marking the same item                      |
| Imagery        | Verify loaded media, crop, resolution and its narrative role at required viewports    | Assuming resource presence proves correct rendering or crop                                       |
| Implementation | Check the consumer's computed styles and complete delivery chain                      | Assuming root tokens override component-local values or isolated CSS proves page parity           |
| Resilience     | Verify narrow and short viewports, text enlargement and relevant interactions         | Shrinking practical text or clipping overflow to preserve decoration                              |

### Melissa and Luis Osmar: bounded before/after evidence

The September 2026 audit recovered these historical examples; they are not a universal wedding style
prescription. Detailed provenance and limitations belong in
[`docs/invitations/melissa-y-luis-osmar.md`](../../invitations/melissa-y-luis-osmar.md).

- Opening: a framed calligraphic name stack became a restrained monogram/name composition with an
  architectural landscape. The transferable principle is a specific composition; Cinzel, the
  Mediterranean landscape and `M | L` belong to this invitation.
- Quote: a large script paragraph became readable editorial prose. The historical text also changed,
  so reduced height cannot be attributed to typography alone.
- Functional sections: repeated ornamental boundaries and small capitals were reduced in favor of
  readable names, metadata and controls. More restraint did not require removing semantic grouping.
- Later polishing retained content and artwork hashes while reducing observed profile declarations
  from 1,040 to 489. This demonstrates possible simplification, not an automatic quality score.

The existing ignored evidence sets are `melissa-transfer` and `melissa-polish` under
`.tmp/visual-review/`. Only the latter's `before-full/after-full` pair includes the full harness
presentation on both sides; its earlier profile was reconstructed on the later shared styles. Do not
regenerate an "original" image and label it historical. If these local artifacts are absent, mark
the visual comparison unavailable and retain the qualified written findings.

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

## Invitation Hero Composition Contract

Use this contract for every real invitation, demo, and hero polish pass. It defines **quality
invariants**, not a single cloned look. Preset defaults are shared; **client essence lives in the
invitation profile** (`src/styles/invitation-profiles/<slug>.scss`) plus payload focals.

### Authority split

| Layer                | Owner                                                      | Responsibility                                                        |
| -------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Quality invariants   | frontend-design + this reference                           | Face-safe composition, legibility, anti-clone essence, viewport proof |
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
