# Mobile Menu Audit & Implementation Plan

## 1. Concise Diagnosis

**A. Incomplete theme token coverage.** `_header-base.scss` defines a complete set of
`--mobile-drawer-*` defaults, but `jewelry-box` and `luxury-hacienda` override zero of them, relying
entirely on dark defaults.

**B. Landing page `--mobile-drawer-*` values are inert.** The landing preset sets
`--mobile-drawer-bg` etc. on `.theme-preset--jewelry-box-landing` (a body class), but
`.header-base { --mobile-drawer-bg: var(--nav-glass-bg); }` shadows them because the declaration is
on the element itself.

**C. Sacred Keepsake over-engineering.** `_sacred-keepsake.scss` (367 lines) completely restyles the
mobile drawer with hardcoded selectors, bypassing the `--mobile-drawer-*` contract entirely.

**D. Missing UX details.** No close button inside the drawer. Overlay uses `[hidden]` →
`display: none` with no fade transition. Menu uses `hidden` attribute which breaks CSS transitions.

## 2. Adjusted Implementation Strategy (7 Phases)

### Phase 1: Variable cascade fix ✅ COMPLETED

- `_header-base.scss`: extracted visual/default semantic `--mobile-drawer-*`, `--mobile-overlay-*`,
  `--hamburger-*`, `--mobile-signature-color`, `--mobile-close-button-color` from `.header-base { }`
  into a `:root` block
- Kept ALL layout, sizing, z-index, spacing, breakpoints, structural timing, padding, max-width,
  width, animation durations, stagger delays, transitions, layer variables in `.header-base`
- `.header-base` continues to reference `var(--x)` but does not redeclare visual defaults

### Phase 2: Landing menu mapping

- `_home-header.scss`: add `#home-header` → `--mobile-drawer-*` mappings
- Verify landing preset drawer values now cascade correctly

### Phase 3: Missing theme overrides ✅ COMPLETED

- Added `--mobile-drawer-*` override sets to `_jewelry-box.scss` and `_luxury-hacienda.scss`
- Added `--mobile-close-button-color` to both themes
- Standardized hardcoded RGB values in `_luxury-hacienda.scss` to use theme tokens where available
- Removed redundant `--mobile-drawer-blur: 40px` from `_angelic-presence.scss`

### Phase 4: Close button + accessibility ✅ COMPLETED

- `NavBarMobile.astro`: added X button in drawer header area
- JS updates: close button handler, `aria-expanded`, `aria-label` toggle, `inert`, focus return,
  body scroll lock, Escape key
- `_header-base.scss`: added `--mobile-close-button-color` and close button styles
- Made hamburger button non-focusable when menu is open via `inert: true`

### Phase 5: Overlay + menu transition ✅ COMPLETED

- Replaced `[hidden]` with class-based approach on overlay (`--visible` modifier)
- Replaced `menu.hidden` with `data-state="open"/"closed"` attribute for proper CSS transitions
- Added CSS opacity transition for overlay
- Removed `&[hidden]` and `&:not([hidden])` rules from menu, replaced with `[data-state]` selectors

### Phase 6: Validation

- Run `pnpm run test:unit`, `pnpm run typecheck`, `pnpm run build`

### Phase 7: Sacred Keepsake refactor (deferred)

- Only after base system is stable and validated
- Refactor to use `--mobile-drawer-*` contract

## 3. Constraints Applied

- Keep layout/sizing/z-index/spacing/breakpoints/structural timing in `.header-base`
- Move only visual/default semantic values needed for theme inheritance to `:root`
- Minimal JS updates only for close button, overlay state, and accessibility
- Do not create `_navigation.scss` blindly — first verify existing test
- Implement in small safe phases
- Sacred Keepsake deferred to Phase 7
- Menu transitions use `data-state` attribute instead of `hidden` for proper CSS animation support

## 4. Specific Files Changed

| Phase | Files                                                                                                    | Status           |
| ----- | -------------------------------------------------------------------------------------------------------- | ---------------- |
| 1     | `src/styles/layout/_header-base.scss`                                                                    | ✅               |
| 2     | `src/styles/home/_home-header.scss`                                                                      | Pending          |
| 3     | `src/styles/themes/sections/header/_jewelry-box.scss`, `_luxury-hacienda.scss`, `_angelic-presence.scss` | ✅               |
| 4     | `src/components/ui/header/NavBarMobile.astro`, `_header-base.scss`                                       | ✅               |
| 5     | `NavBarMobile.astro`, `_header-base.scss`                                                                | ✅               |
| 6     | `tests/unit/header-navigation.test.ts`                                                                   | ✅ (tests added) |
| 7     | `_sacred-keepsake.scss` (deferred)                                                                       | Pending          |

## 5. What Remains Untouched

- `HeaderBase.astro` (scroll/hide/shrink behavior)
- `EventHeader.astro` and `HomeHeader.astro` component structure
- `Layout.astro`, `[eventType]/[slug].astro`, `index.astro`
- All content JSON files
- Theme preset SCSS for non-header sections
- Dashboard styles
- Mixins, tools, global styles

## 6. Mobile/Theme Validation Checklist

Each theme verified at 320px, 375px, 414px, 768px, 991px:

- Drawer background correct
- Text readable (contrast)
- CTA button visible
- Close button present and styled
- Overlay fades in/out
- Hamburger color correct
- Scroll-state behavior works
- Keyboard: Tab, Escape
- `prefers-reduced-motion` respected
- Envelope reveal interaction (invitation pages)

Themes: `jewelry-box`, `jewelry-box-wedding`, `luxury-hacienda`, `editorial`, `premiere-floral`,
`celestial-blue`, `sacred-keepsake`, `angelic-presence`, landing.

## 7. Build Safety

- `pnpm run typecheck` — no TS errors
- `pnpm run lint` — no new warnings
- `pnpm run test:unit` — all header-navigation tests pass
- `pnpm run build` — successful
- No casing mismatches in SCSS imports
- No CSS custom property cycles
- No `display: none` on overlay (use opacity + pointer-events)
- Menu transitions use `data-state` attribute, not `hidden`
