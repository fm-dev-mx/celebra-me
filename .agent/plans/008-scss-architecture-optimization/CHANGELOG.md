# Changelog - Plan 008

All notable changes to this plan will be documented in this file.

## [Unreleased]

### Changed

- Refactored all 17 invitation SCSS components to use native CSS variables.
- Migrated `src/styles/invitation/` folder to the 3-layer token architecture.
- Removed redundant `src/styles/tokens/_primitives.scss` file.
- Updated `_whatsapp-button.scss` to use semantic variables.
- Removed the active runtime import of `src/styles/tokens/contracts/_core.scss` from `src/styles/global.scss`.
- Migrated `src/styles/themes/sections/_reveal-theme.scss` off `tokens/primitives/color`.
- Reclassified `src/styles/tokens/_semantic.scss` as a compatibility shim rather than a runtime source of truth.
- Synced theme architecture documentation with the real post-closeout token/runtime contract.
- Deleted `src/styles/tokens/contracts/_core.scss` and the entire `src/styles/tokens/primitives/` layer after confirming they had no remaining `src/` or `tests/` consumers.
- Removed unused imports from `src/styles/components/actions/_whatsapp-button.scss`.
