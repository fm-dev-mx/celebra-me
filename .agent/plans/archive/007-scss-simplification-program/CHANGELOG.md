# CHANGELOG

## 2026-03-22

- Created plan `007-scss-simplification-program`
- Locked the initial simplification goals after the SCSS architecture audit
- Recorded the helper-boundary decision: keep `token()`, review `rgb-channels()` pragmatically
- Drafted planned commit units before implementation
- Executed the four planned units and aligned the SCSS architecture with the canonical semantic contract
- Moved breakpoint and authoring typography ownership out of `global/_mixins.scss` into canonical token layers
- Removed low-value landing theme wrappers and narrowed preset ownership to variable assignment
- Migrated touched style consumers toward canonical semantic variables and removed wildcard Sass imports from touched files
- Preserved `--color-surface`, `--color-border`, and `--ff-heading` as temporary compatibility bridges for remaining Astro consumers
