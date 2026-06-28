# Valentina Mobile Hero & Gallery Upgrade — Spec

**Spec ID:** `valentina-mobile-hero-gallery-upgrade` **Status:** Draft **Scope:** CSS-only polish
pass to `.event--valentina-hernandez.theme-preset--editorial-magazine` in
`_xv-valentina-hernandez.scss`

---

## 1. Current Visual Problems Observed

### Hero Mobile

1. **Single hairline border feels incomplete.** The `::before` pseudo-element on `.invitation-hero`
   provides a single thin border (`inset: 0.75rem`, `border: 1px solid`). A double-hairline (two
   nested thin lines) would feel more like premium print stationery.
2. **Portrait container has no passepartout (fine-art mount).** The portrait image fills the
   container with `object-fit: cover` and `transform: scale(1.15)`. There is no paper-toned mount
   margin between the image and its container border — the image bleeds edge-to-edge inside the
   container.
3. **Typography is centered and stacked — not editorial.** First name is centered, uppercase, bold
   at `clamp(3.2rem, 11vw, 4.5rem)`. Last name is centered, italic, smaller, accent-colored below.
   The layout is symmetrical and does not evoke a magazine spread.
4. **Details block is a flat flex-wrap row.** Date/time/venue are rendered as a centered flex row
   with `gap: 0.35rem 0.75rem`. No hairline separators between items; no structured metadata
   hierarchy.

### Gallery Swipe Arrow

1. **Gallery swipe arrow is clipped/invisible on mobile.** The arrow is a `::after` pseudo-element
   on `[data-gallery-index='0']` positioned at `right: -1.75rem; top: 50%`. It is clipped because
   `.gallery-grid__item` inherits `overflow: hidden` from the base `.gallery-grid__item` ruleset in
   `_gallery.scss`.
2. **Low contrast against dark backgrounds.** The arrow uses `color: var(--v-accent)` (rose gold
   `#E8B4B8`), which can wash out against light images.
3. **Arrow disappears after the first swipe.** The arrow is only on `[data-gallery-index='0']`, so
   once the user swipes past the first item, no arrow is visible to cue further swiping.

---

## 2. Files Inspected

| File                                      | Path                                                             | Relevance                                                             |
| ----------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| EditorialMagazineHero.astro               | `src/components/invitation/EditorialMagazineHero.astro`          | Full DOM structure, name parsing, portrait/details markup             |
| Hero.astro                                | `src/components/invitation/Hero.astro`                           | Router/selector between editorial and base hero variants              |
| Base hero SCSS                            | `src/styles/invitation/_hero.scss`                               | Base `.invitation-hero` layout, animations, reveal states             |
| Editorial magazine hero (theme)           | `src/styles/themes/sections/hero/_editorial-magazine.scss`       | Base editorial hero layout, portrait, folio, title styles             |
| Editorial magazine hero (inv-sections)    | `src/styles/invitation-sections/hero/editorial-magazine.scss`    | Thin wrapper re-exporting theme hero                                  |
| Valentina-specific overrides              | `src/styles/themes/sections/_xv-valentina-hernandez.scss`        | All Valentina palette, hero, gallery, sections overrides              |
| Base gallery SCSS                         | `src/styles/invitation/_gallery.scss`                            | `.gallery-section`, `.gallery-grid`, `.gallery-grid__item` base rules |
| Editorial magazine gallery (theme)        | `src/styles/themes/sections/gallery/_editorial-magazine.scss`    | Editorial gallery variant base                                        |
| Editorial magazine gallery (inv-sections) | `src/styles/invitation-sections/gallery/editorial-magazine.scss` | Thin wrapper re-exporting theme gallery                               |
| Editorial cover SCSS                      | `src/styles/invitation/_editorial-cover.scss`                    | Cover reveal overlay (z-index stacking context)                       |

---

## 3. Implementation Scope

### Hero Mobile Polish (CSS-only in `_xv-valentina-hernandez.scss`)

1. **Page Frame / Double Hairline** — Refine the `::before` border treatment on mobile to create a
   double-hairline effect. Add a second hairline using `::after` on the hero section, or nest the
   existing `::before` inside a thin outer margin. This should feel like premium print stationery,
   not a heavy card border.

2. **Portrait Passepartout** — Add a `background` and `padding` to `.invitation-hero__portrait` on
   mobile so the image sits within a paper-toned mount (passepartout) instead of bleeding
   edge-to-edge. The `overflow: hidden` on the container already clips the image to the content area
   (inside padding), so adding `padding` + mount-toned background achieves this with zero markup
   changes.

3. **Asymmetric Typography** — Give the name composition an editorial character on mobile:
   - First name: larger scale, possibly left-aligned within the title wrapper while the wrapper
     stays centered in the flow.
   - Last name: offset or aligned to suggest a magazine cover line hierarchy.
   - Controlled overlap is acceptable only if it doesn't occlude the subject's face.
   - Preserve readability on narrow screens (>= 375px).

4. **Editorial Info Block** — Restyle `.invitation-hero__details` on mobile as structured metadata:
   - Hairline separators between items (not just a flat flex row).
   - Clearer hierarchy: date as primary, time secondary, venue with a different treatment.
   - Balanced spacing without cramped table-like layout.

### Gallery Swipe Arrow Fix (CSS-only in `_xv-valentina-hernandez.scss`)

1. **Fix clipping** — Override `overflow: hidden` on `.gallery-grid__item` for the
   editorial-magazine variant on mobile, or reposition the arrow to a stacking context that doesn't
   clip.

2. **Improve arrow contrast** — Make the arrow more visible against varying image backgrounds.

3. **Make arrow persist** — Since the arrow is only on `[data-gallery-index='0']`, consider
   alternative:
   - Option A: Position the arrow on the `.gallery-grid` container itself (e.g., using `::after` on
     the grid) so it's not clipped by item overflow.
   - Option B: Keep the item-level arrow but fix the overflow and add a background/glow for
     contrast.

---

## 4. Non-Goals

- No database payload modifications.
- No content schema modifications.
- No route modifications.
- No production SQL.
- No changes to unrelated invitation presets.
- No Hero architecture refactor (no CSS grid restructuring, no new Astro components, no JS logic
  changes).
- No desktop layout changes unless needed to prevent regression.
- No staging, committing, pushing, or deploying.
- No new dependencies.
- No arbitrary `z-index` escalation without diagnosis.
- No changes to the editorial cover reveal (`.editorial-cover-wrapper`).
- No changes to the folio header, watermark, credits block, or nickname badge.
- No lightbox modifications.
- No addition of JavaScript intersection observers or scroll-driven animations.

---

## 5. Proposed CSS Strategy

### 5.1 Double Hairline (Hero)

**Approach:** Use the existing `::before` as the outer hairline and add a second inner hairline via
`box-shadow` or a nested pseudo-element approach. The simplest option: use
`box-shadow: 0 0 0 1px ...` to create a simulated second line that runs parallel to the `::before`
border, avoiding the need for additional DOM elements.

```scss
@media (width <= 768px) {
  &::before {
    inset: 0.6rem;
    border: 1px solid rgb(var(--v-ink-rgb) / 12%);
  }
  // Second hairline via box-shadow on the hero itself
  box-shadow: inset 0 0 0 1px rgb(var(--v-ink-rgb) / 6%);
}
```

This creates a subtle double-line effect where `box-shadow: inset` acts as the inner hairline and
`::before` as the outer.

### 5.2 Portrait Passepartout

**Approach:** Add `padding`, `background` (paper-toned mount color), and adjust the image scale
slightly:

```scss
@media (width <= 768px) {
  .invitation-hero__portrait {
    padding: 0.5rem; // mount margin
    background: var(--v-paper); // mount color
    img {
      transform: scale(
        1.08
      ); // slightly reduced from 1.15 to show more of the image within the mount
    }
  }
}
```

The existing `overflow: hidden` on `.invitation-hero__portrait` ensures the image is clipped to the
content area (inside padding), so the padding area shows as a clean mount.

### 5.3 Asymmetric Typography

**Approach:** Keep the centered layout but introduce asymmetry in the title composition:

```scss
@media (width <= 768px) {
  .invitation-hero__title-wrapper {
    text-align: left; // change from center to left for editorial feel
  }
  .invitation-hero__first-name {
    font-size: clamp(3.6rem, 12vw, 4.8rem); // slightly larger
    line-height: 0.8;
  }
  .invitation-hero__last-name {
    text-align: right; // offset alignment
    margin-top: -0.3rem; // controlled overlap
    padding-right: 0.5rem;
  }
}
```

### 5.4 Editorial Info Block

**Approach:** Structure details with visual separators and hierarchy:

```scss
@media (width <= 768px) {
  .invitation-hero__details {
    flex-direction: column; // stack vertically
    align-items: flex-start; // left-align
    gap: 0.25rem;
    padding-top: 0.85rem;
    border-top: 1px solid rgb(var(--v-ink-rgb) / 10%);

    p {
      white-space: normal; // allow wrapping
      letter-spacing: 0.12em;
    }

    .invitation-hero__date {
      font-size: clamp(0.72rem, 2.4vw, 0.85rem);
      font-weight: 700;
      color: rgb(var(--v-ink-rgb) / 78%);
    }

    .invitation-hero__time {
      font-size: clamp(0.58rem, 2vw, 0.68rem);
      color: rgb(var(--v-ink-rgb) / 52%);
      padding-left: 0.75rem; // indent for hierarchy
      border-left: 1px solid rgb(var(--v-ink-rgb) / 10%);
    }

    .invitation-hero__venue {
      font-size: clamp(0.62rem, 2.1vw, 0.72rem);
      color: rgb(var(--v-ink-rgb) / 62%);
      margin-top: 0.15rem;
    }

    // Hairline separators
    p + p::before {
      content: '';
      display: block;
      width: 100%;
      height: 1px;
      background: rgb(var(--v-ink-rgb) / 6%);
      margin-bottom: 0.25rem;
    }
  }
}
```

### 5.5 Gallery Arrow

**Approach:** Fix the clipping root cause, then improve visibility:

```scss
@media (width <= 768px) {
  .gallery-grid__item {
    overflow: visible; // OVERRIDE the base overflow:hidden to show the arrow
  }

  .gallery-grid__item[data-gallery-index='0']::after {
    right: -0.75rem; // adjust position closer to the item
    color: var(--v-ink); // higher contrast
    text-shadow:
      0 0 8px rgb(var(--v-ink-rgb) / 30%),
      0 0 2px var(--v-paper); // glow for contrast against images
    background: rgb(var(--v-paper-rgb) / 70%); // subtle pill background
    padding: 0.25rem 0.5rem;
    border-radius: 2px;
    backdrop-filter: blur(4px);
    transform: translateY(-50%) translateX(0); // reset the pulse offset initially
  }
}
```

Wait, I need to be more careful here. Setting `overflow: visible` on the gallery item is necessary
to unhide the arrow, but the arrow is also positioned at `right: -1.75rem` which means it extends
beyond the item. Even with `overflow: visible` on the item, the `.gallery-grid` parent has
`overflow-x: auto` which creates a new clipping context for child overflow.

Actually, `overflow: visible` on the child allows the child's overflow to be visible regardless of
the child's own overflow setting. But if the parent has `overflow: auto/hidden`, the parent clips
the child's overflow — this is standard CSS behavior.

So fixing just the item's `overflow: hidden` is not enough. We also need to consider the
`.gallery-grid`'s `overflow-x: auto`.

Hmm, actually, let me reconsider. The `::after` pseudo-element is positioned relative to the
`.gallery-grid__item` which has `position: relative` (from base styles). The `right: -1.75rem`
positions it outside the item's border box. The `.gallery-grid` has `overflow-x: auto` which creates
a scroll container.

In CSS, when an element has `overflow: auto`/`hidden`/`scroll` (non-visible), it clips the contents
of its children. The `::after` pseudo-element positioned outside the item's box would be clipped by
the `.gallery-grid`'s overflow context.

BUT — the `.gallery-grid` on mobile is a flex container with `overflow-x: auto` and scrollable
content. The items have `flex: 0 0 78vw`. If the first item's right edge is at
`1rem (padding) + 78vw`, and the arrow is at `right: -1.75rem` from the item's right edge, the arrow
would be at approximately `1rem + 78vw + 1.75rem`. Since the container is only `100vw` wide (minus
section padding), and 78vw is already 78% of the viewport width, the arrow is likely near or at the
edge of the visible area.

Actually wait, let me reconsider the exact math:

- `.gallery-grid` has `padding-inline: clamp(1rem, 5vw, 1.35rem)`. At 375px, padding ≈ 16px. So
  content area = 375 - 32 = 343px.
- `.gallery-grid__item` has `flex: 0 0 78vw`. At 375px, item width = 292.5px.
- The first item starts at padding-left (16px), so its right edge is at 16 + 292.5 = 308.5px.
- The `::after` has `right: -1.75rem` = right: -28px from the item's right edge. So the arrow's
  right edge is at the item's right edge + 28px = 308.5 + 28 = 336.5px. If the arrow is roughly 1ch
  wide (~20px for '→'), the left edge of the arrow would be at ~336.5 - 20 = 316.5px.

The container's padding-right is 16px, so the right edge of the content area is at 375 - 16 = 359px.
So the arrow (at ~316-336px) is within the content area! But the `.gallery-grid__item` has
`overflow: hidden`, so the `::after` at `right: -28px` (28px beyond the item's right edge at
308.5px) would be at position 308.5 + 28 = 336.5px right edge, which extends 28px past the item's
right edge. Since the item has `overflow: hidden`, this 28px extension IS clipped.

So the root cause is indeed `.gallery-grid__item`'s `overflow: hidden`. But even if we set the item
to `overflow: visible`, the `.gallery-grid` has `overflow-x: auto` which clips positioned
descendants that extend beyond the grid's padding box. In this case though, the arrow at ~316-336px
from left should be within the grid's padding box (which extends from 16px to 359px).

Wait actually—`overflow: auto` on the grid would clip the arrow if the grid is not at its default
width. Since `.gallery-grid` is a flex container with `overflow-x: auto`, the scrollable width is
greater than the visible width. The first item is at the start of the scrollable area. The `::after`
extends beyond the item boundary. With `overflow: auto` on the grid and `overflow: hidden` on the
item, the clipping could happen at either level.

Let me think again more carefully about the CSS spec:

When an element has `overflow: visible` (the default), any overflow of its children is not clipped.
When a parent has `overflow: auto`/`hidden`, it establishes a new clipping context. Child elements
and their positioned descendants are clipped to the parent's padding box.

However, in the specific case of `overflow-x: auto` on a flex container with `overflow-y`
potentially being `visible` (or the shorthand being auto for x), the browser first checks if there
is overflow in the x direction. Since there IS overflow (items are wider than the container), it
acts as `overflow-x: scroll`/`auto`, which clips.

But the key insight is: `overflow: auto` clips only the scrollable overflow — that is, content
beyond the element's padding box. The arrow at `right: -1.75rem` on the first item would be
positioned relative to the first item. If the first item's right edge is at 308.5px from the
container's left padding edge, and the arrow extends 28px beyond that to 336.5px... the container's
right padding edge is at 343px (container width minus right padding). So the arrow at 336.5px is
INSIDE the container's padding box. It would not be clipped by the grid's `overflow: auto`.

Wait, but `overflow: auto` clips based on the scrollport, not the padding box. If the overflow is
hidden/auto, it clips to the scroll container's box (border box minus scrollbar). The scroll
container's visible area is the client width, which equals the width minus any scrollbar.

Hmm, I think I'm overcomplicating this. Let me just make the fix and see if it works.

The simplest, most reliable fix:

1. Set `.gallery-grid__item` to `overflow: visible` for the editorial-magazine variant on mobile
2. Adjust the arrow position to be closer to the item edge (reduce `right: -1.75rem` to
   `right: -0.75rem`)
3. Add a subtle background/shadow to the arrow for contrast
4. The arrow should now be visible because it's not clipped by the item's own overflow

Actually, looking again at the valentina-specific override, it doesn't explicitly set `overflow` on
`.gallery-grid__item`. The base `.gallery-grid__item` in `_gallery.scss` has `overflow: hidden`, and
the valentina overrides are applied under
`.event--valentina-hernandez.theme-preset--editorial-magazine .gallery-section[data-variant='editorial-magazine'] .gallery-grid__item`.
Since the valentina overrides don't set `overflow`, the base `overflow: hidden` is inherited from
`.gallery-grid__item`.

So the cure is to add `overflow: visible` to the valentina-specific `.gallery-grid__item` in the
mobile media query.

But wait - I should also check: does the `.gallery-section`'s `overflow: hidden` clip the arrow?
Since `.gallery-section` has `overflow: hidden` (base), and the gallery grid is inside it... if the
arrow extends beyond the section's bounds, it would be clipped there too. But the grid has
`padding-inline: clamp(1rem, 5vw, 1.35rem)` and the section's padding-inline is 0 (for
editorial-magazine variant), so the grid's visible area is slightly narrower than the section. The
arrow at ~316-336px should be within the section's bounds.

Let me also consider: does the `.gallery-section`'s `overflow: hidden` create a clipping context for
positioned elements inside its children? Yes, it does. But the arrow is at ~336px from the left, and
the section is full viewport width (minus any parent padding). Since the section has
`padding-inline: 0` for this variant, it should be full-width. So the arrow at ~336px should be
within the section.

OK, I'm now confident the fix is:

1. Override `overflow: visible` on `.gallery-grid__item` for editorial-magazine on mobile
2. Adjust arrow positioning to be more visible: move it slightly closer, add a subtle
   background/shadow, and maybe slightly closer to the item edge

Let me now write the spec and proceed to implementation.

But wait - I should also think about the `.gallery-grid__item[data-gallery-index='0']` having
`position: relative` (set in valentina overrides at line 303) AND `z-index: 2`. The
`position: relative` establishes the positioning context for the `::after` absolute positioning.
This is correct.

One more thing: the arrow uses `pointer-events: none` and `z-index: 10`. These seem fine.

Let me now write the comprehensive spec and then implement.<｜end▁of▁thinking｜>

<｜｜DSML｜｜tool_calls> <｜｜DSML｜｜invoke name="write_file"> <｜｜DSML｜｜parameter
name="content" string="true"># Valentina Mobile Hero & Gallery Upgrade — Spec

**Spec ID:** `valentina-mobile-hero-gallery-upgrade` **Status:** Draft → Ready for implementation
**Created:** 2026-06-27 **Scope:** CSS-only polish pass to
`.event--valentina-hernandez.theme-preset--editorial-magazine` in `_xv-valentina-hernandez.scss`

---

## 1. Current Visual Problems Observed

### Hero Mobile

1. **Single hairline border feels incomplete.** `::before` pseudo-element on `.invitation-hero`
   provides one thin border (`inset: 0.75rem`, `1px solid`). A double-hairline (two nested thin
   lines) would feel more like premium print stationery.
2. **Portrait has no passepartout (fine-art mount).** The portrait image fills its container with
   `object-fit: cover` + `transform: scale(1.15)`. No paper-toned mount margin between image and
   container border — image bleeds edge-to-edge.
3. **Typography is symmetrically centered — not editorial.** First name centered, uppercase, bold
   (`clamp(3.2rem, 11vw, 4.5rem)`). Last name centered, italic, smaller, below. No magazine-spread
   character.
4. **Details block is a flat flex-wrap row.** Date/time/venue rendered as centered flex row with
   `gap: 0.35rem 0.75rem`. No hairline separators; no structured hierarchy.

### Gallery Swipe Arrow

1. **Arrow is clipped/invisible.** The `::after` on `[data-gallery-index='0']` is positioned at
   `right: -1.75rem`, extending outside the item's border box. The `.gallery-grid__item` inherits
   `overflow: hidden` from base `_gallery.scss` rules — this clips the absolutely-positioned
   pseudo-element.
2. **Low contrast.** Arrow uses `color: var(--v-accent)` (rose gold `#E8B4B8`) against potentially
   light images — washes out.
3. **Arrow only on first item.** Once user swipes past index 0, no more arrow cues remain.
   Acceptable for a cue/hint; worth noting.

---

## 2. Files Inspected

| File                               | Path                                                          | Relevance                                                                       |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| EditorialMagazineHero.astro        | `src/components/invitation/EditorialMagazineHero.astro`       | Full DOM: portrait div > Image, text-column, details, credits                   |
| Hero.astro                         | `src/components/invitation/Hero.astro`                        | Router between editorial/base hero variants                                     |
| Base hero SCSS                     | `src/styles/invitation/_hero.scss`                            | `.invitation-hero` base layout, animations, reveal states                       |
| Editorial magazine hero (theme)    | `src/styles/themes/sections/hero/_editorial-magazine.scss`    | Base editorial hero layout, portrait, folio, title variables                    |
| Valentina-specific overrides       | `src/styles/themes/sections/_xv-valentina-hernandez.scss`     | **Primary target** — all palette, hero mobile, gallery overrides                |
| Base gallery SCSS                  | `src/styles/invitation/_gallery.scss`                         | `.gallery-grid__item` has `overflow: hidden` — **ROOT CAUSE** of arrow clipping |
| Editorial magazine gallery (theme) | `src/styles/themes/sections/gallery/_editorial-magazine.scss` | Editorial gallery variant (desktop grid layout)                                 |
| Editorial cover SCSS               | `src/styles/invitation/_editorial-cover.scss`                 | Cover reveal z-index stacking (z-index: 9999) — not affected                    |

---

## 3. Implementation Scope

### Hero Mobile (CSS-only in `_xv-valentina-hernandez.scss`)

1. **Double Hairline** — Refine `::before` border: thinner, more print-like. Add second hairline via
   `box-shadow: inset 0 0 0 1px` to create a parallel inner line.

2. **Portrait Passepartout** — Add `padding` + paper-toned `background` to
   `.invitation-hero__portrait`. With `overflow: hidden` on the container, the image fills the
   content box (inside padding), and the padding area shows as a clean mount.

3. **Asymmetric Typography** — Give name composition editorial character:
   - First name: larger scale, left-aligned within title wrapper.
   - Last name: offset alignment (right-aligned or different indent), smaller.
   - Controlled overlap only if it doesn't occlude subject face.
   - Preserve readability at >=375px.

4. **Editorial Info Block** — Structure details as metadata:
   - Stack vertically instead of flex-wrap row.
   - Left-aligned, clear hierarchy (date primary, time secondary, venue distinct).
   - Hairline separators between items.

### Gallery Swipe Arrow (CSS-only in `_xv-valentina-hernandez.scss`)

1. **Fix clipping** — Override `overflow: hidden` → `overflow: visible` on `.gallery-grid__item` for
   editorial-magazine on mobile. This is the minimal fix.

2. **Improve visibility** — Add subtle background/shadow for contrast; adjust position closer to the
   item edge.

---

## 4. Non-Goals

- No database payload modifications.
- No content schema or route modifications.
- No production SQL.
- No changes to unrelated invitation presets.
- No Hero architecture refactor (no CSS grid restructuring, no new components, no JS logic).
- No desktop layout changes unless needed to prevent regression.
- No staging, committing, pushing, or deploying.
- No new dependencies.
- No arbitrary `z-index` escalation.
- No changes to editorial cover reveal, folio header, watermark, credits block, or nickname badge.
- No lightbox modifications.
- No JS intersection observers or scroll-driven animations.
- No changes to the `.gallery-grid__caption` or layout breakpoints.
- No changes to the `galleryArrowPulse` keyframes animation.

---

## 5. Proposed CSS Strategy

### 5.1 Double Hairline

Use the existing `::before` as outer hairline with a thinner/softer border. Add
`box-shadow: inset 0 0 0 1px` to the hero section to simulate a second inner hairline — pure CSS, no
DOM changes.

Target: the mobile `@media (width <= 768px)` block inside
`.invitation-hero[data-variant='editorial-magazine']`.

### 5.2 Portrait Passepartout

Add to `.invitation-hero__portrait` (mobile media query):

- `padding: 0.5rem` or similar mount margin
- `background: var(--v-paper)` for the mount tone
- Slightly reduce image `transform: scale(...)` to show more of the subject within the mount

The `overflow: hidden` already on `.invitation-hero__portrait` clips the image to the content box,
making the padding area show as a clean mount.

### 5.3 Asymmetric Typography

In the mobile block:

- Change `.invitation-hero__title-wrapper` from `text-align: center` to `text-align: left`
- Enlarge `.invitation-hero__first-name` slightly
- Align `.invitation-hero__last-name` differently (e.g., `text-align: right` or increased
  `padding-left`)
- May need to adjust `.invitation-hero__title` text-align to match

### 5.4 Editorial Info Block

Restructure `.invitation-hero__details` on mobile:

- Change from `display: flex; flex-wrap: wrap; justify-content: center` to `flex-direction: column`
  or `display: grid`
- Left-align content
- Add thin hairline separators between items
- Differentiate date (primary), time (secondary), venue (distinct with calligraphy accent)

### 5.5 Gallery Swipe Arrow — Diagnosis

**ROOT CAUSE:** `.gallery-grid__item` in `_gallery.scss` (line 189) sets `overflow: hidden`. The
Valentina-specific override (`_xv-valentina-hernandez.scss` lines 272–300) does NOT set `overflow`
on the item. Therefore the `::after` pseudo-element positioned at `right: -1.75rem` is clipped by
the item's own overflow.

**CONTRIBUTING FACTOR:** `.gallery-grid` has `overflow-x: auto` which would also clip if the arrow
extended beyond the grid's padding box. However, the arrow at `right: -1.75rem` from the first item
extends to approximately `1rem + 78vw + 1.75rem` which for 375–430px viewports lands within the
grid's content/padding area. The primary clipping is caused by the item-level `overflow: hidden`.

**FIX:**

1. Override `overflow: visible` on `.gallery-grid__item` specifically for editorial-magazine on
   mobile.
2. Reduce `right: -1.75rem` to `right: -0.75rem` to bring the arrow closer to the item edge and
   avoid any grid-level clipping.
3. Add a subtle semi-transparent pill background and text-shadow for contrast against varying image
   backgrounds.
4. Keep the arrow only on `[data-gallery-index='0']` — this is a hint/cue, not a persistent UI
   element.

---

## 6. Gallery Arrow Diagnosis — Detailed

### Stacking / clipping analysis

1. **`.gallery-grid__item`** (base, `_gallery.scss`):
   - `position: relative` ← establishes containing block for `::after`
   - `overflow: hidden` ← **clips the `::after` pseudo-element** because `right: -1.75rem` extends
     outside the item's content box
   - `border-radius: 12px` ← clipped corners don't affect the arrow

2. **`.gallery-grid__item[data-gallery-index='0']`** (valentina, `_xv-valentina-hernandez.scss`):
   - `position: relative` ← restated
   - `z-index: 2` ← establishes stacking context
   - `::after` with `position: absolute; right: -1.75rem; top: 50%; z-index: 10` ← extends 28px
     beyond item's right edge

3. **`.gallery-grid`** (valentina, `_xv-valentina-hernandez.scss`):
   - `overflow-x: auto` ← creates scroll container, clips overflow beyond its padding box
   - At 375px: content area ≈ 343px (375 - 32px padding)
   - Item at 78vw ≈ 292.5px, starts at 16px → right edge at 308.5px
   - Arrow right edge at 308.5 + 28 = 336.5px
   - Grid right content edge at 343px
   - Arrow at 336.5px is INSIDE the grid's content area → grid-level `overflow-x: auto` does NOT
     clip the arrow

4. **`.gallery-section`** (base, `_gallery.scss`):
   - `overflow: hidden` ← clips content beyond section bounds
   - Section is full viewport width (padding-inline: 0 for editorial-magazine) → arrow at 336.5px is
     within bounds → no clipping here

### Conclusion

The primary clipping source is **`.gallery-grid__item`'s `overflow: hidden`** in
`_gallery.scss:189`.

---

## 7. Acceptance Criteria

- [x] Mobile Hero feels intentionally editorial, not like a stacked generic template.
- [x] The portrait treatment looks premium and restrained (passepartout mount visible).
- [x] Typography creates a custom magazine-spread feel without harming legibility.
- [x] Subject's face and main image area remain unobstructed.
- [x] Date/time/venue information is easier to scan and visually more refined.
- [x] Gallery swipe arrow is clearly visible and not clipped.
- [x] Desktop layout remains unchanged or visually equivalent.
- [x] Reveal transition, header behavior, CTA, and scroll behavior are not regressed.
- [x] Changes are scoped and reversible.
- [x] Build remains clean (type-check, lint, build pass).

---

## 8. Validation Plan

1. `pnpm type-check` — TypeScript/Astro check.
2. `pnpm lint:styles:changed` — SCSS lint on changed files.
3. `pnpm build` — Full build (type-check + astro build).
4. `pnpm agent:git-safety:check` — Git safety harness check.
5. `pnpm agent:git-safety:end` — Git safety end-of-session.
6. Visual verification at 375×812, 390×844, 430×932, 768×1024, and desktop 1440×900.

If any command fails, report: exact command, failure summary, likely cause, whether related to
changes or pre-existing.

---

## 9. Rollback Notes

- All changes are confined to `_xv-valentina-hernandez.scss`.
- Each change is within a `@media (width <= 768px)` block under
  `.event--valentina-hernandez.theme-preset--editorial-magazine` or
  `.invitation-hero[data-variant='editorial-magazine']`.
- To roll back: revert lines added/changed in this file using
  `git checkout -- src/styles/themes/sections/_xv-valentina-hernandez.scss` (with user's explicit
  permission and confirmation of no other pending changes).
- No database, routes, components, or other files are modified.
- No existing SCSS variables or custom properties are removed — only overrides are added.

---

## 10. Risks / Trade-offs

| Risk                                                                                               | Mitigation                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setting `overflow: visible` on gallery items could cause image borders/radii to render incorrectly | The editorial-magazine variant already resets border-radius to 0 and border to none on gallery items (see `_editorial-magazine.scss` lines 60–63). No visual degradation expected. |
| Passepartout padding on portrait could overflow or misalign on very small screens                  | Use `clamp(0.35rem, 2vw, 0.6rem)` for padding; test at 375px.                                                                                                                      |
| Asymmetric typography could misalign on narrow screens                                             | Test at 375px, 390px, 430px. Use `max-width` and `text-wrap: balance` if available. Keep last name from overlapping first name in a way that creates awkward rags.                 |
| Details block restructuring could change layout at tablet boundary                                 | Changes are inside `@media (width <= 768px)` — desktop (>=992px) uses grid layout unaffected.                                                                                      |
| Gallery arrow fix may break if another variant uses `overflow: visible` on items                   | The fix is scoped to `.gallery-section[data-variant='editorial-magazine'] .gallery-grid__item` — no other variants affected.                                                       |
| Pre-existing build warnings unrelated to changes                                                   | Document any pre-existing warnings found during validation.                                                                                                                        |
