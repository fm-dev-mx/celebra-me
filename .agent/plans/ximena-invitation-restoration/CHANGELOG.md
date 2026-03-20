# Changelog: Ximena Meza Trasviña Invitation Restoration

All notable changes to the `ximena-meza-trasvina` invitation restoration will be documented in this file.

## [Implemented] - 2026-03-20

### Added

- Created `src/styles/themes/sections/_interlude-theme.scss` to centralize interlude variant styles.
- Integrated premium metallic tokens (`--gold-metallic`, `--gold-glow`) in `top-premium-floral` and `jewelry-box` presets.

### Changed

- Centralized `editorial` variant styles from event-specific SCSS to the theme system for all sections (Hero, Family, Gallery, RSVP, Gifts, Itinerary, Location, Countdown, Thank You, Interlude).
- Generalized centralized styles using CSS variables to support multi-theme presets.
- Overwrote `ximena-meza-trasvina` Noir-style assets with correct Floral/Rose Gold webp assets.
- Refined `ximena-meza-trasvina.json` with correct descriptions, alt texts, and asset references (Floral focus).

### Fixed

- Resolved "Noir/Floral Zombie" look by aligning assets with the `top-premium-floral` theme.
- Fixed layout inconsistencies by moving local overrides to the centralized theme architecture.
- Corrected bank details and family photo metadata for Ximena.

### Removed

- Cleaned and removed ~1600 lines of redundant SCSS from `src/styles/events/ximena-meza-trasvina.scss` and `src/styles/events/noir-premiere-xv.scss`.
