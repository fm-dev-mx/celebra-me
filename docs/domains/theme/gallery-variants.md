# Gallery Variants — As-Is and Deferred Target

**Last Updated:** 2026-07-26  
**Related:** [`architecture.md`](architecture.md),
[`.agent/plans/active/section-architecture-refactor-plan.md`](../../../.agent/plans/active/section-architecture-refactor-plan.md)

This document describes how invitation gallery variants work **today**, what breaks if you treat
them as theme-independent, and the **deferred** product target (fixed layout roles). It does not
authorize implementing that target in an invitation polish pass.

Gallery entrance behavior is independent of gallery layout naming. The render plan selects the
behavior-named `stagger-group` recipe, items expose `data-reveal-item`, and the document coordinator
observes the gallery section once. [`motion.md`](motion.md) is the sole authority for timing and
reduced motion.

---

## 1. Current contract (as-is)

### Schema

`gallery.variant` in
[`src/lib/schemas/content/gallery.schema.ts`](../../../src/lib/schemas/content/gallery.schema.ts)
is:

- any value from `THEME_PRESETS`, or
- `'single'` (optional `presentation: 'pet-keepsake'`).

The field is **optional**. When omitted, the adapter resolves:

1. `gallery.variant` if set
2. else `sectionStyles.gallery.variant`
3. else the invitation `theme.preset`

Source: `buildGallerySectionData` in `src/lib/adapters/event.ts`.

### Runtime CSS coupling (critical)

Gallery SCSS is loaded through **`invitation-sections-by-preset/<themePreset>.scss`**, keyed by the
invitation theme — not by `gallery.variant`.

Consequences:

- Setting `gallery.variant` to another theme’s name updates `data-variant` on the section.
- That does **not** guarantee the matching gallery partial is in the CSS bundle.
- Cross-theme gallery variants are therefore **schema-legal but visually unreliable**.
- `'single'` styles live in shared `src/styles/invitation/_gallery.scss` and are available across
  presets.

Do not document or sell “pick any gallery variant on any theme” until CSS is loaded by layout role
(see §4).

### Layout placement (`getLayoutClass`)

[`src/lib/components/gallery/getLayoutClass.ts`](../../../src/lib/components/gallery/getLayoutClass.ts)
assigns `feature` / `wide` / `standard` by index for some variants (`luxury-hacienda`,
`celestial-blue`, `enchanted-rose`, `editorial-magazine`, `jewelry-box`, `single`). Other theme
names always get `standard`; their mosaic comes from CSS `nth-child` / `data-gallery-index` rules
instead.

### Profile overrides (Lane A)

Client profiles under `src/styles/invitation-profiles/` may replace the theme gallery grid. Example:
Abril Michelle forces a uniform 2×2 (`4 / 5`) while keeping `data-variant='premiere-floral'`. In
that case, swapping the content variant string without updating profile selectors will not produce
the intended layout.

---

## 2. Catalog — layout engines vs skins

| Name (content `variant`)        | Kind                | Notes                                                                 |
| ------------------------------- | ------------------- | --------------------------------------------------------------------- |
| `editorial` / `premiere-floral` | Layout (mosaic)     | Shared SCSS in `_editorial.scss`; premiere-floral is an alias         |
| `editorial-magazine`            | Layout              | Fig. labels; flex → 12-col; uses feature/wide classes                 |
| `celestial-blue`                | Layout              | Index choreography via `data-gallery-index`                           |
| `enchanted-rose`                | Layout              | Feature/wide + image-key crops                                        |
| `luxury-hacienda`               | Layout              | Feature/wide 12-col                                                   |
| `jewelry-box-wedding`           | Layout (partial)    | nth-child hero / md columns in `_jewelry-box.scss`                    |
| `jewelry-box`                   | Mostly skin         | Thin chrome over base; weak use of JS layout classes                  |
| `editorial-rose`                | Thin layout + skin  | Uniform spans; token shell overlaps celestial early tokens            |
| `sacred-keepsake`               | Skin                | Atmosphere / captions; little distinct grid                           |
| `angelic-presence`              | Skin + light layout | Sacred palette + nth-child focal tweaks — unify candidate with sacred |
| `single` (+ `pet-keepsake`)     | Layout role         | True non-theme keepake; one image                                     |

**Unify candidates (deferred):** `sacred-keepsake` ≈ `angelic-presence` (tokens, not separate layout
enums); keep distinct engines above.

---

## 3. How to change a gallery today (honest recipe)

| Level                   | What to change                                      | When it works                                                                                      |
| ----------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **A — Content variant** | Set `gallery.variant` (and optional `presentation`) | Only if that variant’s SCSS is already in the **current theme bundle**, or the variant is `single` |
| **B — Content items**   | Reorder `items[]`, focals, alts, captions           | Always valid; array order is display order                                                         |
| **C — Client profile**  | Lane A SCSS under `invitation-profiles/`            | When the invite needs a grid the theme mosaic does not provide (e.g. Abril 2×2)                    |

**Practice rule (until §4 ships):** every real invitation that includes a gallery should set
`gallery.variant` **explicitly** so the choice is visible in provision/content, even if it matches
`theme.preset`. Do not rely on silent inheritance for managed invites.

---

## 4. Target (deferred — do not implement in invite polish)

Product goal: a **small fixed set of layout roles** usable independently of theme tokens.

Tentative closed set:

| Layout role          | Replaces / covers today                                       |
| -------------------- | ------------------------------------------------------------- |
| `uniform-grid`       | Regular 2×N grids (e.g. Abril profile 2×2)                    |
| `editorial-mosaic`   | `editorial` + `premiere-floral`                               |
| `magazine-spread`    | `editorial-magazine`                                          |
| `feature-mosaic`     | `luxury-hacienda`, `enchanted-rose`, jewelry feature patterns |
| `index-choreography` | `celestial-blue`                                              |
| `single-keepsake`    | `single` + `pet-keepsake`                                     |

Skins (`sacred-keepsake` / `angelic-presence` / jewelry chrome) move to **theme tokens**, not the
layout enum.

Required follow-through (platform work):

1. Screenshot matrix of current gallery variants (per `section-architecture-refactor-plan`).
2. Schema: layout enum separate from `THEME_PRESETS`; required when gallery section present.
3. CSS delivery: load gallery partials by layout role (not only theme bundle).
4. Unify near-duplicate skins before freezing the enum.
5. Migrate demos and managed invites to explicit layout roles.

Until that ships, treat §1–§3 as authoritative.

The itinerary compatibility alias `celestial-blue` → `timeline-paper` is an example of the bounded
migration strategy gallery layouts should eventually follow: introduce a behavior name, preserve the
required legacy value, and keep palette ownership in theme tokens. It does not change the deferred
gallery scope above.

---

## 5. Out of scope here

- Installing external design SSOTs (e.g. Impeccable).
- Adding theme-named gallery files “for symmetry.”
- Masonry libraries or carousel components.
- Making `gallery.variant` required across all demos in one pass (tracked with the deferred target).
