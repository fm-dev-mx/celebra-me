# Visual Design Reference

Specialized reference extracted from the frontend-design skill. Load aesthetic examples only when
selecting art direction, and the hero contract when changing or reviewing invitation heroes.
[frontend-design](../../../.agent/skills/frontend-design/SKILL.md) remains the visual-intent owner;
[theme architecture](architecture.md) owns implementation. Example palettes/fonts are not a live
preset catalog; verify the active tokens and assets before use.

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
