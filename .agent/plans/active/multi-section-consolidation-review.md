---
title: Multi-Section Consolidation Review
status: active
created: unknown
updated: 2026-05-31
---

# Multi-Section Consolidation Review

## 1. Executive summary

This is a read-only consolidation review for the invitation sections after the Quote and Gifts
refactors. The safest next implementation target is **MusicPlayer**, followed by **Interlude**. Both
can mostly follow the Quote/Gifts pattern: keep shared component structure and move visual
differences into a small section-level CSS variable contract.

The earlier "shared section" assumption needs correction for several sections. **ThankYou**,
**Countdown**, **Location / VenueCard**, and **Gallery** contain real variants or content/behavior
branches that should not be flattened into simple theme skins without screenshot review.

Recommended next order:

1. MusicPlayer
2. Interlude
3. ThankYou, only after screenshot review
4. Countdown, only after screenshot review
5. Location / VenueCard, postponed
6. Gallery, postponed

## 2. Corrections to previous audit assumptions

- `data-variant` alone is not proof of a structural variant, but `ThankYou.astro` does have a real
  structural branch for `celestial-blue`.
- A shared Astro component is not proof that the section is variant-free. `VenueCard.astro`,
  `PhotoGallery.astro`, `CountdownTimer.astro`, and `Interlude.astro` all contain data or behavior
  branches.
- Gallery is not skin-only. `getLayoutClass()` maps selected variants to feature/wide/standard
  classes, and some theme partials add index-specific layout placement.
- Location is not skin-only. It conditionally renders one or two venues, map vs image media,
  optional navigation buttons, indications, and `luxury-hacienda` rivet markup.
- Countdown is not skin-only. `sacred-keepsake` changes the visual hierarchy of the timer with
  index-specific layout and hidden labels.
- ThankYou is not skin-only. `celestial-blue` renders a different wrapper tree, and
  `sacred-keepsake` uses a full-bleed overlay layout controlled by content metadata.

## 3. Recommended next implementation order after Quote/Gifts

| Order | Section              | Why                                                                                                                                                                                |
| ----- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | MusicPlayer          | Lowest risk. Component structure is stable; behavior branches are shared and should remain isolated in the component script. Theme partials are mostly visual button/prompt skins. |
| 2     | Interlude            | Shared DOM with content-driven focal/light/height data. Theme partials are mostly image filters, overlays, and height/spacing. Preserve observer behavior.                         |
| 3     | ThankYou             | Has real structural and layout exceptions. Do after screenshots for `celestial-blue` and `sacred-keepsake`.                                                                        |
| 4     | Countdown            | Has a real `sacred-keepsake` layout variant. Needs screenshots before simplifying partials.                                                                                        |
| 5     | Location / VenueCard | Postpone because media, navigation, indications, copy behavior, iOS behavior, and rivet markup all intersect.                                                                      |
| 6     | Gallery              | Postpone because layout strategy and lightbox behavior need careful regression coverage.                                                                                           |

## 4. Comparison table

| Section              | Component files                                                                                 | Subcomponents                                                                     | Base SCSS                                    | Theme-section files                      | Structural variants                                                       | Layout variants                                                                     | Content/data variants                                                             | Behavior variants                                                              | Theme skins                      | Duplication | Difficulty  | Visual risk | Recommended action           |
| -------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------- | ----------- | ----------- | ----------- | ---------------------------- |
| ThankYou             | `src/components/invitation/ThankYou.astro`                                                      | `OptimizedImage.astro`                                                            | `src/styles/invitation/_thank-you.scss`      | `src/styles/themes/sections/thank-you/*` | Yes: `celestial-blue` branch                                              | Yes: `sacred-keepsake` full-bleed overlay, standard centered/card layouts           | Optional image, focal point, overlay anchor, safe area                            | Small focal-point script                                                       | Yes, for other visual treatments | High        | High        | High        | Postpone; preserve variants  |
| Countdown            | `src/components/invitation/Countdown.astro`, `CountdownTimer.astro`, stale `CountdownTimer.tsx` | none active besides Astro timer                                                   | `src/styles/invitation/_countdown.scss`      | `src/styles/themes/sections/countdown/*` | No active component structural variant                                    | Yes: `sacred-keepsake` index-specific timer hierarchy; other card/grid layout skins | Title, subtitle prefix, footer text, event date                                   | Timer interval and section reveal observer                                     | Yes                              | High        | Medium-high | High        | Postpone pending screenshots |
| MusicPlayer          | `src/components/invitation/MusicPlayer.astro`                                                   | `Icon.astro`                                                                      | `src/styles/invitation/_music-player.scss`   | `src/styles/themes/sections/music/*`     | No                                                                        | No material section layout variants                                                 | Optional music section, autoplay, title, reveal mode                              | Autoplay, envelope/immediate reveal, prompt dismissal, manual toggle           | Yes                              | Medium      | Low         | Low-medium  | Best next consolidation      |
| Interlude            | `src/components/invitation/Interlude.astro`                                                     | `OptimizedImage.astro`, `initInterludeObserver`                                   | `src/styles/invitation/_interlude.scss`      | `src/styles/themes/sections/interlude/*` | No                                                                        | Minor height/index styling, mostly skin                                             | Image, alt, height, focal point, light position, overlay opacity, interlude index | Observer, reduced motion, parallax, variant parallax strength                  | Yes                              | Medium      | Low-medium  | Medium      | Second next consolidation    |
| Location / VenueCard | `EventLocation.astro`, `components/VenueCard.astro`                                             | `GoogleMap.astro`, `OptimizedImage.astro`, `Icon.astro`, `SectionNavButton.astro` | `src/styles/invitation/_event-location.scss` | `src/styles/themes/sections/location/*`  | Yes: `GoogleMap` vs image, optional nav anchors, `luxury-hacienda` rivets | Yes: one/two venue layout, indications grid/list treatments                         | Ceremony/reception optional, coordinates, map URLs, indications, next link        | Copy button, iOS Apple Maps reveal, section reveal observer                    | Yes                              | High        | High        | High        | Postpone                     |
| Gallery              | `Gallery.astro`, `PhotoGallery.astro`, `GalleryLightbox.astro`                                  | `getLayoutClass.ts`                                                               | `src/styles/invitation/_gallery.scss`        | `src/styles/themes/sections/gallery/*`   | No different component tree per theme                                     | Yes: variant layout strategy and index-specific theme placement                     | Optional subtitle, captions, focal points, item count                             | Lightbox, focus trap, keyboard open, reveal-state guard, intersection observer | Yes                              | High        | High        | High        | Postpone pending screenshots |

## 5. Per-section analysis

### ThankYou

Variant inventory:

- Structural variant: yes. `ThankYou.astro` renders `.thank-you-editorial` with
  `.thank-you-editorial__media` and `.thank-you-editorial__copy` only for
  `variant === 'celestial-blue'`; all other variants render `.thank-you-content`.
- Layout variant: yes. `sacred-keepsake` CSS turns the normal content into a full-bleed image with
  overlay copy and hides `.closing-name`.
- Content/data variant: yes. `image`, `focalPoint`, `overlayAnchor`, and `overlaySafeArea` drive
  optional image rendering and subject-aware copy constraints.
- Behavior variant: small shared behavior. The inline script maps `data-focal-point` into
  `--thank-you-focal-point`.
- Theme skins: yes. `editorial`, `premiere-floral`, `jewelry-box`, `angelic-presence`, and
  `luxury-hacienda` mostly restyle the shared content tree.
- Styling artifacts: most circular/square frame differences are visual; the `celestial-blue` branch
  and `sacred-keepsake` overlay are real.

Recommendation:

- Do not apply the Quote/Gifts pattern directly yet.
- Preserve the `celestial-blue` structural branch unless screenshots prove it can be expressed with
  the shared tree.
- Preserve content-driven overlay anchor and safe-area handling in the component/base SCSS.
- Use a variant-aware base SCSS contract, but keep full-bleed overlay rules as a local exception.
- Postpone until screenshot review covers `celestial-blue`, `sacred-keepsake`, and at least one
  standard centered theme.

Styling consolidation:

- Duplicated SCSS: frame sizing, photo filters, radial backgrounds, message/card surfaces,
  calligraphy closing styles, footer border/opacity.
- Practical customization points: background, text color, accent color, message surface, message
  border, frame size, image fit/position, footer border color.
- Internal defaults: safe-area math, drop-cap float behavior, signature animation, pseudo-layer
  sizing, hover scale.
- Eventual deletion: possible only after preserving `celestial-blue` and `sacred-keepsake`
  exceptions in base or documented variant blocks.
- Explicit overrides likely: `celestial-blue`, `sacred-keepsake`, `luxury-hacienda`,
  `angelic-presence`, `jewelry-box`.
- Fallback-only candidates: `editorial` and `premiere-floral` may share a premium preset once
  screenshots pass.

### Countdown

Variant inventory:

- Structural variant: no active Astro structural variant. `Countdown.astro` always renders the same
  section/header/timer/footer tree, and `CountdownTimer.astro` always renders four segments.
- Layout variant: yes. `sacred-keepsake` changes the timer from equal cards into one dominant days
  segment plus compact h/m/s segments using `[data-index]`; it hides some labels and adds unit
  suffixes via pseudo-elements.
- Content/data variant: yes. `title`, `subtitlePrefix`, `footerText`, and `eventDate` are content
  fields.
- Behavior variant: shared. `CountdownTimer.astro` runs a 1000ms interval and clamps past dates to
  zeros; `Countdown.astro` uses an intersection observer for reveal.
- Theme skins: yes. Most other variants are card/background/type/color treatments.
- Styling artifacts: `data-variant` for most themes is visual; `sacred-keepsake` is a real layout
  variant.

Recommendation:

- Do not use the Quote/Gifts pattern directly for all themes.
- Use a compact variable contract for standard/card countdowns.
- Preserve or explicitly classify the `sacred-keepsake` timer layout as a layout variant.
- Consider removing or separately auditing stale `CountdownTimer.tsx`; it imports Framer Motion but
  is not referenced by active rendering.
- Postpone implementation until screenshot review.

Styling consolidation:

- Duplicated SCSS: background gradients, title/subtitle styles, segment card
  background/border/shadow, value/label color and font, footer spacing/text.
- Practical customization points: background, title/text/accent colors, segment surface/border,
  value/label color, mobile/tablet columns.
- Internal defaults: interval timing, transition timings, reveal delays, rivet placement, pseudo
  suffix details, hover distances.
- Eventual deletion: possible for most theme partials only if `sacred-keepsake` remains as a local
  layout exception.
- Explicit overrides likely: `sacred-keepsake`, `luxury-hacienda`, `celestial-blue`,
  `angelic-presence`, `editorial`.
- Fallback-only candidates: `jewelry-box-wedding` if it can inherit jewelry/semantic tokens.

### MusicPlayer

Variant inventory:

- Structural variant: no. `MusicPlayer.astro` always renders an audio element, prompt, controls, and
  play/pause icons.
- Layout variant: no material section layout variant. Some themes resize or hide prompt on mobile;
  that is a skin/local responsive exception.
- Content/data variant: yes. The entire player is optional via `viewModel.music`; `url`, `autoPlay`,
  `title`, and `revealMode` drive data behavior.
- Behavior variant: yes. `autoPlay` and `revealMode` branch between envelope event and first
  interaction. Prompt dismissal also depends on reveal state and scroll.
- Theme skins: yes. Theme partials mostly restyle prompt and play button.
- Styling artifacts: all `data-variant` partials appear visual; no structural variant is justified.

Recommendation:

- Best next section for consolidation.
- Follow Quote/Gifts pattern directly: keep the component unchanged and define a small CSS variable
  contract in `_music-player.scss`.
- Preserve behavior in the component script.
- Move visual overrides into theme presets, not new section files.

Styling consolidation:

- Duplicated SCSS: prompt background/color/border/radius/shadow, button
  background/color/border/shadow, ring color.
- Practical customization points: prompt background/color/border, button background/color/border,
  pulse ring color.
- Internal defaults: fixed position, z-index, animation names, transition timings, button sizes,
  hover transform, prompt dismissal timings.
- Eventual deletion: likely yes for `src/styles/themes/sections/music/` after import references and
  tests pass.
- Explicit overrides likely: `celestial-blue`, `luxury-hacienda`, `sacred-keepsake`, `jewelry-box`,
  `editorial`/`premiere-floral`.
- Fallback-only candidates: base and `jewelry-box-wedding`.

### Interlude

Variant inventory:

- Structural variant: no. The component always renders `.invitation-interlude` with a media wrapper
  and `OptimizedImage`.
- Layout variant: minor. `height` changes section height, and some themes adjust min-height or
  index-specific heights, but the DOM remains shared.
- Content/data variant: yes. `image`, `alt`, `height`, `focalPoint`, `lightX`, `lightY`,
  `overlayOpacity`, and `interludeIndex` affect rendering/styling.
- Behavior variant: yes but shared. `initInterludeObserver()` sets CSS variables, applies
  reduced-motion behavior, runs intersection reveal, and applies desktop parallax. It has a
  variant-specific parallax strength branch for `premiere-standard`.
- Theme skins: yes. Most partials tune overlays, filters, image scale, background, and focal
  defaults.
- Styling artifacts: most theme partials are skin-only; index-specific sacred/angelic height/focal
  rules are local content exceptions.

Recommendation:

- Good second consolidation candidate.
- Use a small base SCSS contract and preset overrides.
- Preserve observer behavior and content-driven CSS variables.
- Avoid exposing parallax internals as theme variables unless a theme proves it needs them.

Styling consolidation:

- Duplicated SCSS: overlay opacity, image filter, hover scale, background, pseudo-overlay gradients,
  focal defaults.
- Practical customization points: background, overlay, overlay opacity, image filter, image scale,
  focal point.
- Internal defaults: observer thresholds, parallax math, transition timings, hover media-query
  logic, aspect-ratio breakpoints.
- Eventual deletion: likely yes, except document local exceptions if index-specific rules remain in
  base.
- Explicit overrides likely: `celestial-blue`, `angelic-presence`, `sacred-keepsake`, `editorial`,
  `premiere-floral`.
- Fallback-only candidates: base and possibly `jewelry-box`/`jewelry-box-wedding`.

### Location / VenueCard

Variant inventory:

- Structural variant: yes. `VenueCard.astro` renders `GoogleMap` when `coordinates` exists,
  otherwise `OptimizedImage`. It conditionally renders Apple Maps, Google Maps, Waze, or fallback
  map buttons. It conditionally appends rivet spans for `luxury-hacienda`.
- Layout variant: yes. `EventLocation.astro` can render one or two venues; theme partials change
  card image aspect ratios, indications layout, and single/dual card rhythm.
- Content/data variant: yes. Ceremony/reception are optional, indications are optional,
  `showFlourishes` controls ornament markup, and `nextSectionLink` is derived from the render plan.
- Behavior variant: yes. Copy buttons, iOS-only Apple Maps reveal, and intersection reveal are
  initialized in the section script.
- Theme skins: yes. Many colors, borders, surfaces, image filters, and button styles are visual.
- Styling artifacts: some partial differences are skin-only, but map/image, nav links, indications,
  one/two venues, and rivets are real.

Recommendation:

- Postpone.
- Do not create a universal section abstraction.
- Preserve `VenueCard` as a subcomponent and keep content-driven conditionals.
- If consolidated later, use a variant-aware base contract plus local exceptions for rivets and
  map/image handling.
- Require screenshot review for single venue, dual venue, image venue, map venue, indications, and
  mobile.

Styling consolidation:

- Duplicated SCSS: card surfaces, title/flourish styles, image frame styles, content typography, nav
  button styles, indications surfaces.
- Practical customization points: section background, card background/border/text, accent, nav
  button colors, indication background, image focus x/y.
- Internal defaults: copy success timing, iOS detection, observer threshold, button shimmer
  mechanics, image hover scale unless reused.
- Eventual deletion: possible only after preserving structural/content branches and
  `luxury-hacienda` rivets.
- Explicit overrides likely: `luxury-hacienda`, `celestial-blue`, `angelic-presence`,
  `sacred-keepsake`, `editorial`.
- Fallback-only candidates: none until screenshots prove enough parity.

### Gallery

Variant inventory:

- Structural variant: no section-level component swap. `Gallery.astro` always uses `PhotoGallery`
  and `GalleryLightbox`.
- Layout variant: yes. `getLayoutClass.ts` assigns feature/wide/standard classes for
  `luxury-hacienda`, `celestial-blue`, and `jewelry-box`. Theme partials, especially
  `celestial-blue` and `editorial`, add index-specific placement and aspect-ratio rules.
- Content/data variant: yes. Optional subtitle, optional captions, focal points, and variable item
  counts change output.
- Behavior variant: yes. `PhotoGallery.astro` handles intersection reveal, click/keyboard open, and
  reveal-state gating. `GalleryLightbox.astro` handles dialog state, focus trap, body scroll lock,
  and Escape/overlay close.
- Theme skins: yes. Many color/filter/frame/lightbox values are visual.
- Styling artifacts: simple frame/filter differences are skin-only; layout strategy and
  index-specific placement are real.

Recommendation:

- Postpone.
- Preserve `getLayoutClass()` or replace it only with an equally explicit variant-aware layout
  strategy.
- Keep lightbox behavior isolated.
- Do not reduce all gallery variables immediately; first separate layout variables from visual skin
  variables.
- Require screenshot review across gallery item counts and variants.

Styling consolidation:

- Duplicated SCSS: section background, title/subtitle typography, item frame/surface/border/shadow,
  image filters, lightbox colors.
- Practical customization points: background, title/subtitle colors, item
  surface/border/radius/shadow, image filter/position, lightbox background/border/text.
- Internal defaults: focus trap, keyboard behavior, observer thresholds, z-index, transition
  timings, hover distances, per-index placement.
- Eventual deletion: not until layout strategies are explicitly preserved.
- Explicit overrides likely: `celestial-blue`, `luxury-hacienda`, `angelic-presence`,
  `sacred-keepsake`, `editorial`.
- Fallback-only candidates: base and maybe `premiere-floral` if it aligns with editorial fallback.

## 6. Evidence table for real variants

| Section              | Variant type       | Evidence                                                                                                                                                             | Control source                   |
| -------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| ThankYou             | Structural         | `ThankYou.astro` branches on `isCelestialBlue` and renders `.thank-you-editorial` vs `.thank-you-content`.                                                           | Component logic from `variant`.  |
| ThankYou             | Layout/content     | `_thank-you.scss` handles `data-overlay-anchor` and `data-has-overlay-safe-area`; `_sacred-keepsake.scss` makes `.photo-frame` full-bleed and hides `.closing-name`. | Content fields plus CSS.         |
| ThankYou             | Content/data       | `thankYouSchema` allows `image`, `focalPoint`, `overlayAnchor`, `overlaySafeArea`; `buildThankYouSectionData()` passes them through.                                 | Content and adapter.             |
| Countdown            | Layout             | `_sacred-keepsake.scss` uses `[data-index='0']` as dominant days and `[data-index='1'..'3']` as compact h/m/s with pseudo suffixes.                                  | CSS only, variant selector.      |
| Countdown            | Behavior           | `CountdownTimer.astro` updates `[data-countdown-value]` every second; `Countdown.astro` adds `.is-visible` via IntersectionObserver.                                 | Component scripts.               |
| MusicPlayer          | Behavior           | `MusicPlayer.astro` branches on `autoPlay` and `revealMode`, listens for `envelope:opened`, click/touch, scroll, and button click.                                   | Component script and music data. |
| Interlude            | Content/data       | `interludeSchema` and `Interlude.astro` support `height`, `focalPoint`, `lightX`, `lightY`, `overlayOpacity`, `interludeIndex`.                                      | Content and render plan.         |
| Interlude            | Behavior           | `interlude-observer.ts` sets CSS vars, handles reduced motion, intersection reveal, and desktop parallax.                                                            | Shared JS behavior.              |
| Location / VenueCard | Structural/content | `VenueCard.astro` renders `GoogleMap` for coordinates, otherwise `OptimizedImage`; conditionally renders map provider links and `luxury-hacienda` rivets.            | Content and component logic.     |
| Location / VenueCard | Content/data       | `locationSchema` allows optional ceremony/reception, coordinates, map URLs, indications; `section-render-data.ts` derives `nextSectionLink`.                         | Content, adapter, render plan.   |
| Location / VenueCard | Behavior           | `EventLocation.astro` calls `initCopyButtons`, `revealIOSOnly`, and an IntersectionObserver.                                                                         | Component script.                |
| Gallery              | Layout             | `getLayoutClass.ts` returns feature/wide/standard classes by variant; gallery theme partials add index-specific layout.                                              | Component helper plus CSS.       |
| Gallery              | Content/data       | `gallerySchema` supports optional subtitle/captions/focal points; content files have 2-12 gallery items.                                                             | Content and adapter.             |
| Gallery              | Behavior           | `PhotoGallery.astro` dispatches `gallery:open`; `GalleryLightbox.astro` traps focus, closes on Escape/overlay, and locks body scroll.                                | Component scripts.               |

## 7. Proposed minimal variable contracts

### ThankYou

```scss
--thank-you-bg
--thank-you-text-color
--thank-you-accent-color
--thank-you-card-bg
--thank-you-card-border
--thank-you-frame-size-mobile
--thank-you-frame-size-desktop
--thank-you-image-fit
--thank-you-image-position
```

### Countdown

```scss
--countdown-bg
--countdown-title-color
--countdown-text-color
--countdown-accent-color
--countdown-segment-bg
--countdown-segment-border
--countdown-value-color
--countdown-label-color
--countdown-grid-columns-mobile
--countdown-grid-columns-tablet
```

### MusicPlayer

```scss
--music-player-prompt-bg
--music-player-prompt-color
--music-player-prompt-border
--music-player-button-bg
--music-player-button-color
--music-player-button-border
--music-player-ring-color
```

### Interlude

```scss
--interlude-bg
--interlude-overlay
--interlude-overlay-opacity
--interlude-image-filter
--interlude-image-scale
--interlude-focal-point
```

### Location / VenueCard

```scss
--location-bg
--location-card-bg
--location-card-border
--location-card-text
--location-accent
--location-button-bg
--location-button-color
--location-indication-bg
--event-location-image-focus-x
--event-location-image-focus-y
```

### Gallery

Keep the current contract temporarily, then reduce toward:

```scss
--gallery-section-bg
--gallery-title-color
--gallery-subtitle-color
--gallery-item-bg
--gallery-item-border
--gallery-item-radius
--gallery-item-shadow
--gallery-item-image-filter-rest
--gallery-item-image-filter-in-view
--gallery-item-image-filter-hover
--gallery-item-image-position
--gallery-lightbox-bg
--gallery-lightbox-image-border
--gallery-lightbox-footer-color
```

Preserve layout variables only where real layout variants need them.

## 8. Variables explicitly rejected

| Section              | Reject                                                                                                              | Why                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| ThankYou             | Animation names, signature delay, safe-area calc internals, drop-cap float details, pseudo-layer dimensions         | Internal mechanics; not meaningful theme choices.                             |
| Countdown            | Timer interval, transition delays, hover translate distances, rivet positions, pseudo suffix dimensions             | Behavior/layout internals; high regression risk if tokenized.                 |
| MusicPlayer          | Fixed z-index, dismiss timeouts, pulse animation names, hover scale, button mobile dimensions                       | Shared behavior and component ergonomics should remain stable.                |
| Interlude            | Observer thresholds, parallax strength, scroll math, transition timings, aspect-ratio breakpoint values             | Behavior/crop mechanics should not become broad theme API.                    |
| Location / VenueCard | Copy success timing, iOS reveal logic, shimmer movement, every button padding, every image aspect ratio             | Content and behavior specifics should stay local.                             |
| Gallery              | Focus trap state, lightbox z-index, every per-index grid placement, hover transform distances, transition durations | Layout/behavior internals; only expose if a real reusable variant needs them. |

## 9. Values that should remain hardcoded internal defaults

- Countdown timer calculation and 1000ms update cadence.
- Countdown reveal observer threshold and reduced-motion fallback behavior.
- Music prompt text updates and dismissal timing.
- Music `envelope:opened` and first-interaction autoplay orchestration.
- Interlude observer threshold, mobile parallax disablement, and reduced-motion visibility.
- Location copy-to-clipboard success feedback and iOS-only Apple Maps reveal.
- Gallery dialog focus trap, Escape handling, body scroll lock, and keyboard open.
- ThankYou overlay safe-area math and focal-point CSS property assignment.
- Internal pseudo-element dimensions, z-indexes, and microinteraction timing across all reviewed
  sections.

## 10. Theme presets likely needing explicit overrides

- `celestial-blue`: ThankYou structural branch, Countdown card/grid sizing, MusicPlayer hidden
  prompt on smaller viewports, Interlude blue overlays, Location and Gallery bespoke layout/skin.
- `sacred-keepsake`: ThankYou full-bleed overlay, Countdown sacred timer hierarchy, MusicPlayer soft
  pulse, Interlude index/focal exceptions, Location and Gallery sacred card/list treatments.
- `luxury-hacienda`: Location rivets and hacienda surfaces, Gallery masonry-like layout strategy,
  Countdown dark leather-style treatment, MusicPlayer hacienda button/prompt.
- `angelic-presence`: Countdown, Interlude, Location, Gallery, ThankYou sacred/ivory visual
  identity.
- `editorial`: Location and Gallery editorial layouts, Countdown dark card style, MusicPlayer
  prompt/button.
- `premiere-floral`: Shares some editorial behavior/skin but needs explicit screenshot confirmation.

## 11. Themes likely safe to leave as fallback-only

- MusicPlayer base can likely cover themes without strong visual identity needs.
- `jewelry-box-wedding` can likely inherit semantic tokens or `jewelry-box`-like fallback for
  MusicPlayer and Interlude.
- Interlude base may be acceptable for `jewelry-box` and `jewelry-box-wedding` if screenshots
  confirm image treatment parity.
- No fallback-only recommendation for Location or Gallery until screenshot review confirms content
  and layout parity.

## 12. Local exceptions likely needed

- ThankYou `celestial-blue` structural wrapper and portrait/copy grid.
- ThankYou `sacred-keepsake` full-bleed image overlay, hidden closing name, and overlay safe-area
  composition.
- Countdown `sacred-keepsake` timer layout using index-specific dominant days and compact h/m/s.
- Location `luxury-hacienda` rivets in `VenueCard.astro`.
- Location map/image media branches and optional provider buttons.
- Gallery `getLayoutClass()` strategies for `luxury-hacienda`, `celestial-blue`, and `jewelry-box`.
- Gallery `celestial-blue` index-specific placement and focal overrides.
- Interlude index-specific focal/height rules for sacred/angelic content.

## 13. Import/deletion cleanup plan per section

### ThankYou

1. Add/refine variables in `src/styles/invitation/_thank-you.scss`.
2. Move visual-only values into relevant theme presets.
3. Preserve structural/layout exceptions for `celestial-blue` and `sacred-keepsake`.
4. Run `rg "themes/sections/thank-you|data-variant='...'" src tests`.
5. Delete `src/styles/themes/sections/thank-you/` only after imports/references are clean and
   screenshots pass.

### Countdown

1. Add compact variables to `src/styles/invitation/_countdown.scss`.
2. Move standard/card visual skins into presets.
3. Preserve `sacred-keepsake` as a local layout exception.
4. Audit stale `CountdownTimer.tsx` separately before any deletion.
5. Delete `src/styles/themes/sections/countdown/` only after screenshots and tests pass.

### MusicPlayer

1. Add the small variable contract to `src/styles/invitation/_music-player.scss`.
2. Move prompt/button/ring visual overrides into presets.
3. Keep `MusicPlayer.astro` unchanged unless implementation proves an accessibility bug.
4. Remove `@forward 'music'` from `src/styles/themes/sections/_index.scss` only after `rg` shows no
   partial references.
5. Delete `src/styles/themes/sections/music/` after tests pass.

### Interlude

1. Add the minimal contract to `src/styles/invitation/_interlude.scss`.
2. Move overlay/filter/background values into presets.
3. Keep observer behavior in `src/lib/invitation/interlude-observer.ts`.
4. Preserve index/content exceptions locally if needed.
5. Delete `src/styles/themes/sections/interlude/` after screenshots and references pass.

### Location / VenueCard

1. Do not start until screenshot matrix is ready.
2. Add variables only after separating content branches from visual skins.
3. Preserve `VenueCard.astro`, map/image branching, map provider buttons, indications, and rivets.
4. Delete `src/styles/themes/sections/location/` only after all venue/content combinations pass.

### Gallery

1. Do not start until layout strategy is explicitly retained.
2. Reduce visual variables separately from layout variables.
3. Keep `getLayoutClass.ts`, lightbox behavior, and keyboard behavior intact unless a dedicated
   refactor replaces them.
4. Delete `src/styles/themes/sections/gallery/` only after variant screenshots pass.

## 14. Validation checklist per section

### ThankYou

- `pnpm test -- invitation.section-render-data`
- `pnpm test -- theme-presets`
- Screenshot `celestial-blue`, `sacred-keepsake`, and one standard centered theme.
- Verify overlay anchor and safe-area copy do not cover the image subject.

### Countdown

- `pnpm test -- invitation.section-render-data`
- `pnpm test -- theme-presets`
- Screenshot `sacred-keepsake`, `luxury-hacienda`, `celestial-blue`, and `editorial`.
- Verify timer still counts down and past dates clamp to zero.

### MusicPlayer

- `pnpm test -- theme-presets`
- Manual/browser check for play/pause toggle, prompt text, envelope reveal autoplay, immediate
  reveal autoplay, and scroll dismissal.
- Verify mobile prompt behavior for `celestial-blue` if preserved.

### Interlude

- `pnpm test -- invitation.section-render-data`
- Screenshot desktop and mobile for image crop/focal point.
- Verify reduced-motion shows interludes without parallax.
- Verify parallax remains inactive on mobile.

### Location / VenueCard

- `pnpm test -- invitation.section-render-data`
- Screenshot single venue, dual venue, image venue, coordinate map venue, indications, and mobile.
- Verify copy button feedback uses Spanish UI text.
- Verify Apple Maps links remain hidden except on iOS.

### Gallery

- `pnpm test -- gallery-microinteractions`
- `pnpm test -- invitation.section-render-data`
- Screenshot item counts 5, 6, 8, 10, and 12 if available.
- Verify keyboard open, lightbox focus trap, Escape close, overlay close, body scroll lock, and
  reveal-state guard.

## 15. Rollback strategy per section

- Restore that section's theme directory and `_index.scss` forwarding.
- Remove the corresponding section variables from theme presets.
- Restore original base SCSS declarations for the section.
- Re-run the section-specific tests listed above.
- For visual regressions, roll back only the affected section so Quote/Gifts work remains untouched.

Section-specific rollback notes:

- ThankYou: restore `thank-you` partial forwarding first because structural exceptions are
  high-risk.
- Countdown: restore `countdown` partial forwarding first if `sacred-keepsake` layout regresses.
- MusicPlayer: restore `music` partial forwarding and preset-specific visual rules.
- Interlude: restore `interlude` partial forwarding if focal/overlay/parallax screenshots drift.
- Location / VenueCard: restore `location` partial forwarding and verify map/image branches.
- Gallery: restore `gallery` partial forwarding and verify `getLayoutClass()` visual behavior.

## 16. Final recommendation

- Best next section: **MusicPlayer**.
- Second-best next section: **Interlude**.
- Sections to postpone: **ThankYou**, **Countdown**, **Location / VenueCard**, **Gallery**.
- Sections needing screenshot review before implementation: **ThankYou**, **Countdown**, **Location
  / VenueCard**, **Gallery**.
- Do not create new token layers, new theme-section files, universal abstractions, or visual-only
  component variants.

## 17. MusicPlayer — completed

Implementation in commits `9aa3c9ee` (refactor) and `0da9e322` (tests).

**Files changed:**

- `src/styles/invitation/_music-player.scss` — base contract (8 variables + component rewrite)
- `src/styles/themes/presets/_angelic-presence.scss`
- `src/styles/themes/presets/_celestial-blue.scss`
- `src/styles/themes/presets/_jewelry-box.scss`
- `src/styles/themes/presets/_luxury-hacienda.scss`
- `src/styles/themes/presets/_premiere-floral.scss`
- `src/styles/themes/presets/_sacred-keepsake.scss`
- `src/styles/themes/sections/_index.scss` — removed `@forward 'music'`
- `tests/unit/style-boundaries.test.ts` — added boundary test
- `tests/unit/theme-presets.test.ts` — added sacred-keepsake contract test

**Files deleted:** `src/styles/themes/sections/music/` (8 files)

**Final variables (8):**

| Variable                       | Approved  | Status                                                                          |
| ------------------------------ | --------- | ------------------------------------------------------------------------------- |
| `--music-player-prompt-bg`     | Yes       | Base + all 7 explicit presets                                                   |
| `--music-player-prompt-color`  | Yes       | Base + all 7 explicit presets                                                   |
| `--music-player-prompt-border` | Yes       | Base + all 7 explicit presets                                                   |
| `--music-player-prompt-accent` | **Extra** | Justified — the `♪` icon color was already customized independently by 3 themes |
| `--music-player-button-bg`     | Yes       | Base + 6 presets (luxury-hacienda inherits base default)                        |
| `--music-player-button-color`  | Yes       | Base + all 7 explicit presets                                                   |
| `--music-player-button-border` | Yes       | Base + all 7 explicit presets                                                   |
| `--music-player-ring-color`    | Yes       | Base + all 7 explicit presets                                                   |

**Validation:** `pnpm lint:styles` ✅, `pnpm type-check` ✅, `pnpm lint` ✅, `pnpm build` ✅,
`pnpm test -- theme-presets --runInBand` 14/14 ✅,
`pnpm test -- style-boundaries -t "music player theme skin"` ✅.

**Pre-existing failures:** Full `style-boundaries` fails due to missing `_footer-theme.scss` and
`_rsvp-theme.scss` — unrelated to MusicPlayer.

**Remaining screenshot risk:** Low. All presets checked for contrast, readability, and
theme-appropriate colors.

**Next section:** Interlude confirmed.

## 18. Interlude — completed

**Files changed:**

- `src/styles/invitation/_interlude.scss` — Added contract defaults (`--interlude-bg`,
  `--interlude-image-filter`, `--interlude-overlay`, `--interlude-overlay-secondary`,
  `--interlude-overlay-opacity`), kept existing structural/behavior CSS, added `::before` overlay
  layer driven by `--interlude-overlay-secondary`, changed `::after` to use `--interlude-overlay`,
  added 3 compact local exception blocks for theme-specific overlay/layout differences
- `src/styles/themes/presets/_celestial-blue.scss` — Added `--interlude-bg`,
  `--interlude-image-filter`, `--interlude-overlay`
- `src/styles/themes/presets/_angelic-presence.scss` — Added `--interlude-bg`,
  `--interlude-image-filter`, `--interlude-image-scale`, `--interlude-overlay`,
  `--interlude-overlay-secondary`
- `src/styles/themes/presets/_editorial.scss` — Added `--interlude-image-filter`,
  `--interlude-image-scale`, `--interlude-overlay-opacity`, `--interlude-overlay-secondary`
- `src/styles/themes/presets/_premiere-floral.scss` — Added `--interlude-image-filter`,
  `--interlude-image-scale`, `--interlude-overlay-opacity`, `--interlude-overlay-secondary`
- `src/styles/themes/presets/_sacred-keepsake.scss` — Added `--interlude-bg`,
  `--interlude-image-filter`, `--interlude-overlay-opacity`, `--interlude-overlay`,
  `--interlude-overlay-secondary`
- `src/styles/themes/sections/_index.scss` — Removed `@forward 'interlude'`
- `tests/unit/theme-presets.test.ts` — Removed interlude section-file references from angelic and
  sacred section lists; added `'styles interludes through the base interlude contract'` test
- `.agent/plans/multi-section-consolidation-review.md` — This note

**Files deleted:** `src/styles/themes/sections/interlude/` (7 files: `_index.scss`, `_base.scss`,
`_angelic-presence.scss`, `_celestial-blue.scss`, `_editorial.scss`, `_premiere-floral.scss`,
`_sacred-keepsake.scss`)

**Final variables (6 contract variables):**

| Variable                        | Base default                    | Purpose                                       |
| ------------------------------- | ------------------------------- | --------------------------------------------- |
| `--interlude-bg`                | `var(--color-surface-dark)`     | Section background                            |
| `--interlude-image-filter`      | `saturate(0.96) contrast(1.02)` | Image CSS filter                              |
| `--interlude-image-scale`       | `1`                             | Image transform scale                         |
| `--interlude-overlay-opacity`   | `10%`                           | Overall overlay darkness                      |
| `--interlude-overlay`           | Base dark vignette gradient     | `::after` overlay background (multi-gradient) |
| `--interlude-overlay-secondary` | `none` (invisible)              | `::before` additional atmospheric layer       |

All 6 variables are within the permitted expansion budget (0-3 additional = no stop required; only
`--interlude-overlay` and `--interlude-overlay-secondary` are additions beyond the original 4).

**Variables deliberately not added:**

- `--interlude-image-hover-scale` — hover transform distance (explicitly rejected)
- `--interlude-focal-point` — content-driven via `data-focal-point` / observer
- `--interlude-parallax-offset` — observer scroll math internal
- `--interlude-light-x`, `--interlude-light-y` — content-driven via `data-light-x` / `data-light-y`
- Animation names, transition timings, z-index, aspect-ratio breakpoints

**Local exceptions kept (3) and why they could not be variables:**

1. **Celestial-blue `::before`** — grain SVG overlay. Fundamentally different content type (SVG data
   URI with opacity); cannot be expressed as a CSS gradient variable.
2. **Sacred-keepsake `::after`** — bordered frame (`inset: 0.75rem`, `border: 1px`). Layout-level
   structural difference (inset + border), not just a background change.
3. **Angelic-presence `anchor-navigation-only` mixin + index-specific height clamps** — SCSS mixin
   cannot be expressed as a variable; height clamps are per-index layout differences.

Plus two tiny single-property exceptions: celestial-blue `::after` `z-index: 2` (stacking order),
sacred-keepsake index-specific `--interlude-focal-y` overrides.

**Themes eliminated from section-file system (now fully variable-driven):**

- Editorial and premiere-floral — fully expressed through `--interlude-overlay-secondary`,
  `--interlude-image-filter`, `--interlude-image-scale`, `--interlude-overlay-opacity`. No local
  exception needed.
- Angelic-presence overlay layers — fully expressed through `--interlude-overlay` +
  `--interlude-overlay-secondary`. Only the `anchor-navigation-only` mixin and height clamps remain
  as local exceptions.

**Validation results:**

| Check                                                     | Result                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm lint:styles`                                        | ✅ Pass                                                                             |
| `pnpm type-check`                                         | ✅ Pass (0 errors)                                                                  |
| `pnpm lint`                                               | ✅ Pass (only pre-existing boundaries warning)                                      |
| `pnpm build`                                              | ✅ Pass (full build + prerender)                                                    |
| `pnpm test -- theme-presets --runInBand`                  | ✅ 15/15 (including new interlude contract test)                                    |
| `pnpm test -- invitation.section-render-data --runInBand` | ✅ 7/7                                                                              |
| `pnpm test -- style-boundaries --runInBand`               | Same 2 pre-existing failures (`_footer-theme.scss`, `_rsvp-theme.scss` — unrelated) |

**Pre-existing failures:** Full `style-boundaries` still fails for `ENOENT: _footer-theme.scss` and
`ENOENT: _rsvp-theme.scss`. Unrelated to Interlude.

**Remaining screenshot risks:** Low-medium. Risk areas: sacred-keepsake `::before` layer now sits
above `::after` (z-index 1 vs auto) which could subtly warm-tint the bordered frame;
editorial/premiere-floral `::before` now uses z-index 1 from base (same as before in section files);
all other overlays are visually identical. These should be verified in a browser before shipping.

**Next recommended section:** ThankYou or Countdown, pending screenshot review as noted in the
original analysis (sections 5-6).
