# Gallery Variants — Current Contract and Compatibility Naming

**Last Updated:** 2026-08-09

**Related:** [`architecture.md`](architecture.md),
[`.agent/plans/active/section-architecture-refactor-plan.md`](../../../.agent/plans/active/section-architecture-refactor-plan.md)

This document describes the current gallery layout contract and its bounded theme-name compatibility
aliases.

Gallery entrance behavior is independent of gallery layout naming. The render plan selects the
behavior-named `stagger-group` recipe, items expose `data-reveal-item`, and the document coordinator
observes the gallery section once. [`motion.md`](motion.md) is the sole authority for timing and
reduced motion.

---

## 1. Current contract (as-is)

### Schema

`gallery.variant` in
[`src/lib/schemas/content/gallery.schema.ts`](../../../src/lib/schemas/content/gallery.schema.ts)
accepts:

- a canonical value from `uniform-grid`, `editorial-mosaic`, `magazine-spread`, `feature-mosaic`,
  `index-choreography`, or `single-keepsake`, or
- a legacy `THEME_PRESETS` value / `'single'` alias during migration.

The field is **optional**. When omitted, the adapter resolves:

1. `gallery.variant` if set
2. else `sectionStyles.gallery.variant`
3. else the invitation `theme.preset`

Source: `buildGallerySectionData` in `src/lib/adapters/event.ts`.

### Runtime CSS delivery

The active theme bundle remains the base stylesheet. When `gallery.variant` explicitly selects a
semantic layout that differs from the theme, `section-css-resolver` also emits the matching
compatibility partial independently. Legacy theme-name fallbacks retain the active theme CSS during
migration so existing invitations keep their established composition. The adapter keeps the resolved
visual skin in `visualVariant`; `data-structural-variant` is emitted only for explicit semantic
selection and is the renderer/layout hook.

Consequences:

- Setting a legacy `gallery.variant` theme name maps to a semantic layout and preserves the visual
  skin in `data-variant`.
- A cross-theme gallery variant now has an explicit CSS delivery path and is testable at the URL-map
  boundary.
- Unknown variant names still resolve to no variant stylesheet and must be rejected or normalized by
  the content boundary before publication.
- Invitation profiles load after canonical styles; selectors that change grid or hierarchy remain
  migration evidence, not a second variant contract.

Do not use theme-named values for new content; they are compatibility input only.

### Layout placement (`getLayoutClass`)

[`src/lib/components/gallery/getLayoutClass.ts`](../../../src/lib/components/gallery/getLayoutClass.ts)
assigns `feature` / `wide` / `standard` by index for semantic layouts and legacy aliases
(`luxury-hacienda`, `celestial-blue`, `enchanted-rose`, `editorial-magazine`, `jewelry-box`,
`single`). Other theme names always get `standard`; their mosaic comes from CSS `nth-child` /
`data-gallery-index` rules instead.

### Profile overrides (Lane A)

Client profiles under `src/styles/invitation-profiles/` may extend a canonical gallery layout when
the invitation needs a composition the shared variant does not yet represent. Example: Abril
Michelle forces a profile-specific uniform 2×2 (`4 / 5`) while selecting the explicit
`data-structural-variant='uniform-grid'` marker. The profile remains an unresolved invitation
exception; changing the semantic value alone does not reproduce its feature crop.

Goal 4 resolution status:

- The representative demos and managed definitions now author semantic `gallery.variant` values
  (`magazine-spread`, `index-choreography`, `feature-mosaic`, `editorial-mosaic`, `uniform-grid`, or
  `single-keepsake`) instead of relying on theme fallback. The wedding demo keeps the explicit
  legacy `jewelry-box-wedding` alias because its nth-child storyboard has no proven canonical
  replacement.
- `victoria-y-roberto.scss` no longer owns the single-image composition. The existing
  `single-keepsake` contract in `src/styles/invitation/_gallery.scss` owns that structure; the
  profile supplies only its label, border, and divider tokens.
- `abril-michelle-becerra-rea.scss` still owns a profile-specific 2×2 grid and feature aspect ratio.
  Its selector now requires the explicit `uniform-grid` structural marker, but the exact composition
  is an unresolved invitation-specific extension rather than a reusable variant contract and is
  intentionally retained
  (`src/styles/invitation-profiles/abril-michelle-becerra-rea.scss:1085-1131`).
- `demo-xv-celestial-blue.scss` owns gallery reveal sequencing and timing, not the canonical layout
  identifier (`src/styles/invitation-profiles/demo-xv-celestial-blue.scss:251-301`); this is a
  permitted motion/profile customization.
- `jewelry-box-wedding` keeps its legacy nth-child gallery structure in
  `src/styles/themes/sections/gallery/_jewelry-box.scss`; it remains a compatibility path because no
  representative content or fixture proves that `feature-mosaic` reproduces its storyboard.

---

## 2. Catalog — layout engines vs skins

| Name (content `variant`)              | Kind                | Notes                                                                 |
| ------------------------------------- | ------------------- | --------------------------------------------------------------------- |
| `editorial` / `premiere-floral`       | Layout (mosaic)     | Shared SCSS in `_editorial.scss`; premiere-floral is an alias         |
| `editorial-magazine`                  | Layout              | Fig. labels; flex → 12-col; uses feature/wide classes                 |
| `celestial-blue`                      | Layout              | Index choreography via `data-gallery-index`                           |
| `enchanted-rose`                      | Layout              | Feature/wide + image-key crops                                        |
| `luxury-hacienda`                     | Layout              | Feature/wide 12-col                                                   |
| `jewelry-box-wedding`                 | Layout (partial)    | nth-child hero / md columns in `_jewelry-box.scss`                    |
| `jewelry-box`                         | Mostly skin         | Thin chrome over base; weak use of JS layout classes                  |
| `editorial-rose`                      | Thin layout + skin  | Uniform spans; token shell overlaps celestial early tokens            |
| `sacred-keepsake`                     | Skin                | Atmosphere / captions; little distinct grid                           |
| `angelic-presence`                    | Skin + light layout | Sacred palette + nth-child focal tweaks — unify candidate with sacred |
| `single-keepsake` (+ legacy `single`) | Layout role         | True non-theme keepake; one image                                     |

**Unify candidates (deferred):** `sacred-keepsake` ≈ `angelic-presence` (tokens, not separate layout
enums); keep distinct engines above.

---

## 3. How to change a gallery today (honest recipe)

| Level                   | What to change                                               | When it works                                                                                                     |
| ----------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **A — Content variant** | Set semantic `gallery.variant` (and optional `presentation`) | The adapter emits `data-structural-variant`; the resolver loads a matching partial when it differs from the theme |
| **B — Content items**   | Reorder `items[]`, focals, alts, captions                    | Always valid; array order is display order                                                                        |
| **C — Client profile**  | Lane A SCSS under `invitation-profiles/`                     | When the invite needs a grid the theme mosaic does not provide (e.g. Abril 2×2)                                   |

**Practice rule:** every real invitation that includes a gallery should set `gallery.variant`
**explicitly** so the choice is visible in provision/content, even if it matches `theme.preset`. Do
not rely on silent inheritance for managed invites. Until that migration is complete,
`jewelry-box-wedding` retains its legacy nth-child storyboard through the active theme partial; it
is not redefined as `feature-mosaic`.

---

## 4. Canonical layout contract

Gallery uses a small fixed set of layout identifiers independently of theme tokens. The canonical
source is `gallery.variant`; theme-named values remain accepted only as compatibility aliases while
published content migrates.

Canonical closed set:

| Layout role          | Replaces / covers today                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `uniform-grid`       | Regular 2×N grids (e.g. Abril profile 2×2)                                     |
| `editorial-mosaic`   | `editorial` + `premiere-floral`                                                |
| `magazine-spread`    | `editorial-magazine`                                                           |
| `feature-mosaic`     | `luxury-hacienda`, `enchanted-rose`, and legacy `jewelry-box` feature patterns |
| `index-choreography` | `celestial-blue`                                                               |
| `single-keepsake`    | `single` + `pet-keepsake`                                                      |

Skins (`sacred-keepsake` / `angelic-presence` / jewelry chrome) move to **theme tokens**, not the
layout enum.

The adapter emits the semantic value as `sections.gallery.variant` and retains the visual skin as
`visualVariant`. Explicit semantic content is consumed for placement and emits
`data-structural-variant`; `layoutRole` still wins for an individual item. Legacy aliases keep their
existing theme CSS until managed content is migrated. The section CSS resolver loads the matching
layout partial independently only for explicit semantic selection when it differs from the active
theme bundle.

Compatibility mapping is bounded and deterministic:

- `editorial-magazine` → `magazine-spread`
- `celestial-blue` → `index-choreography`
- `luxury-hacienda`, `enchanted-rose`, and legacy `jewelry-box` → `feature-mosaic`
- `editorial`, `editorial-rose`, and `premiere-floral` → `editorial-mosaic`
- `single` → `single-keepsake`

Remaining bounded work:

1. Directed visual comparison remains appropriate when a renderer, structural CSS, or profile
   interaction changes; an exhaustive screenshot matrix is not a release prerequisite.
2. Compatibility CSS entrypoints may be replaced by direct layout-role files only when parity is
   proven; `uniform-grid` and `single-keepsake` already use the shared Gallery contract.
3. Near-duplicate visual skins remain a separate token-level cleanup and are not structural
   variants.
4. The managed representative migration is complete; retained aliases and the wedding storyboard
   remain until their documented consumers reach zero.

Until all published records are migrated, treat the aliases above as a legacy input boundary only;
new invitation content should use the semantic identifiers.

The itinerary compatibility alias `celestial-blue` → `timeline-paper` is an example of the bounded
migration strategy gallery layouts follows: introduce a behavior name, preserve the required legacy
value, and keep palette ownership in theme tokens.

---

## 5. Out of scope here

- Installing external design SSOTs (e.g. Impeccable).
- Adding theme-named gallery files “for symmetry.”
- Masonry libraries or carousel components.
- Making `gallery.variant` mandatory for every historical published record while compatibility
  consumers remain.
