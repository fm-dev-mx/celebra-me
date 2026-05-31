---
title: Mobile Menu Drawer Audit & Implementation Plan
status: implemented
created: unknown
updated: 2026-05-31
---

# Mobile Menu Drawer Audit & Implementation Plan

## Summary of the current issue

The mobile navigation drawer across the Celebra-me platform functions mechanically but presents
severe visual defects. The main navigation links are frequently invisible or faint, backgrounds feel
accidentally solid, the music player overlaps the drawer, and route-specific token implementations
(like on the landing page) are missing variables causing broken contrast. The issue stems from CSS
stacking context conflicts, disjointed state selectors between the menu and its parent header, and
inconsistent theme variable implementations.

## Files Inspected

- `src/components/ui/header/NavBarMobile.astro`
- `src/components/common/HeaderBase.astro`
- `src/components/invitation/EventHeader.astro`
- `src/components/home/HomeHeader.astro`
- `src/styles/layout/_header-base.scss`
- `src/styles/invitation/_event-header.scss`
- `src/styles/home/_home-header.scss`
- `src/styles/themes/sections/header/*.scss` (All 10 theme partials)
- `src/styles/themes/sections/_base-theme.scss`
- `src/styles/themes/landing/presets/_jewelry-box-landing.scss`
- `tests/unit/header-navigation.test.ts`

## Confirmed DOM Findings

- Mobile links successfully render in the DOM on all routes as
  `<a data-nav-mobile-link class="... mobile-nav-stagger-X">`.
- `NavBarMobile.astro` uses an internal script to toggle `aria-expanded` on the hamburger,
  `data-state="open"` on the `<nav>` drawer, and adds `.header-base--menu-open` to the parent
  `<header id={headerId}>` component.
- The `z-index` of the Music player is `1000`, while the parent `<header>` relies on
  `z-index: var(--layer-nav)` which is also `1000`.

## Confirmed CSS Cascade & Computed-Style Findings

- **Stacking Context Conflict**: The `<header>` element (`.header-base`) creates its own stacking
  context via `z-index` and `backdrop-filter`. The drawer acts within this context. Since the Music
  Player is rendered later in the DOM with the same `z-index: 1000`, the player renders _above_ the
  mobile drawer.
- **Selector Fragility**: Link stagger visibility in `_header-base.scss` is currently evaluated on
  `.header-base--menu-open .mobile-nav-links__link`, rather than
  `[data-state="open"] .mobile-nav-links__link`. If the ancestor class application fails or lags,
  the links remain stuck at their initial state (`opacity: 0%`, `transform: translateX(24px)`).
- **Opacity / Solidity**: The drawer background variable (`--mobile-drawer-bg`) is often set to
  `96%` or `98%` alpha values in theme presets (e.g., `_celestial-blue.scss`, `_editorial.scss`),
  creating an opaque, "solid" appearance that loses the elegant glassmorphism and
  `.mobile-drawer-sheen` gradients.
- **Overflow Clip Issue**: `.header-base` previously used `overflow-x: clip`, which limits
  overflowing descendent geometry inside its stacking block.

## Theme Variable Findings

- Top-level event themes follow a strict `--mobile-drawer-*` naming convention.
- The Landing Page (`_jewelry-box-landing.scss`) employs a disconnected variable system
  (`--landing-header-nav-*`) but explicitly _omits_ assigning `--mobile-drawer-*` variables. It
  relies entirely on `:root` defaults, resulting in inappropriate contrast layers on the landing
  view.
- A redundant `:root` block inside `src/styles/themes/sections/_base-theme.scss` duplicates
  `--header-*` variables uncontrollably.

## Root Causes Ranked by Likelihood

1. **Link Visibility Selector Disconnect**: The stagger animations depend on
   `.header-base--menu-open` on the parent, rather than `[data-state="open"]` on the menu itself.
2. **Missing Token Contract on Landing**: The landing page does not populate the `--mobile-drawer-*`
   CSS variables, falling back to variables optimized for a dark mode canvas that clash with the
   actual rendered background.
3. **Z-Index Contention**: The header and music player share `z-index: 1000`. The header's `z-index`
   is not elevated when the menu is opened.
4. **Nested Backdrop Filters**: The header attempts to remove its `backdrop-filter` by setting
   `--nav-blur: 0` when `--menu-open` applies, but browsers can struggle with remaining nested
   composition layers. Theme alphas (`98%`) compound this.

## Recommended Mobile Menu Architecture

- **Component-Driven State**: Tie menu link visibility directly to the
  `nav[data-state="open"] .mobile-nav-links__link` selector to enforce strict component boundaries
  and guarantee robustness regardless of parent logic.
- **Dynamic Z-Index Elevation**: Elevate the header's `z-index` to `10050` _only_ when
  `.header-base--menu-open` is active, allowing it to easily clear the Music Player (`1000`) but sit
  safely under the Gallery lightbox (`20000`).
- **Token Harmonization**: Inject the formal `--mobile-drawer-*` variable contract into
  `_home-header.scss` to guarantee visual consistency on the Landing route.
- **Glassmorphism Correction**: Adjust base and theme `--mobile-drawer-bg` alphas down to roughly
  `80-85%` while leaving `--mobile-drawer-blur` robust (`20px - 40px`), restoring the premium glass
  aesthetic while avoiding accidental solidity.

## Proposed Implementation Phases

**Phase 1: Architecture Robustness**

- Update `_header-base.scss` to bind link visibility and CTA stagger transitions to the
  `.header-base__mobile-menu[data-state="open"]` selector instead of `.header-base--menu-open`.
- Elevate `.header-base--menu-open` in `_header-base.scss` to use `z-index: 10050`.

**Phase 2: Token Resolution**

- Add mapping for `--mobile-drawer-*` variables specifically for the Landing Page into
  `#home-header` scoped blocks within `_home-header.scss`.

**Phase 3: Visual Polish**

- Moderate opacity values across the theme presets for `--mobile-drawer-bg` to revive the premium
  glass rendering.

## Files Likely to Change

- `src/styles/layout/_header-base.scss`
- `src/styles/home/_home-header.scss`
- `src/styles/themes/sections/header/*.scss` (Various partials to tweak background alphas)

## Regression Risks

- Modifying `z-index` could cause the menu to accidentally obscure high-priority overlays. Target
  `z-index: 10050` threads the needle between nav layer and heavy z-indexed features like the
  gallery (`20000`).
- Tweaking `--mobile-drawer-bg` opacity could expose low-contrast text situations if not verified
  against light-themed presets.

## Validation Checklist

- [ ] `astro check`
- [ ] `pnpm run lint:styles`
- [ ] `pnpm run build`
- [ ] Existing header/navigation tests pass correctly
- [ ] `/` (Landing): Opens, links visible, brand colors applied.
- [ ] `/xv/ana-sofia-cota-guillen`: Only one close button visible, links visible with good contrast.
- [ ] `/xv/ximena-meza-trasvina`: Only one close button visible
- [ ] `/cumple/demo-cumple-luxury-hacienda`
- [ ] `/xv/demo-xv-editorial`
- [ ] `/boda/demo-boda-jewelry-box-wedding`
- [ ] `/bautizo/demo-bautismo-angelic-presence`
- [ ] Cross-check all route validations: music player isn't overlapping, colors resolve with correct
      opacity.
