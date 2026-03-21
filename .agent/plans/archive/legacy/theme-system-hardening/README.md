# Theme System Hardening & Architectural Alignment

Plan to move from per-event overrides to a more robust, token-driven architecture with demo-aware layout support.

## Objective
Standardize the theme system to ensure that:
1. `_base-theme.scss` is agnostic of specific theme values (logic only).
2. Demos are handled by global flags (`.is-demo`) instead of per-slug files.
3. Event-specific files in `src/styles/events/` carry only TRULY unique styles (e.g., signatures).
4. Variants (Dark/Light) can be easily added via data attributes.

## Phases
1. **Core Abstraction**: Moving image filters and gradients to semantic tokens.
2. **Demo Architecture**: Adding `.is-demo` support and global demo overrides.
3. **Event Cleanup**: Refactoring existing event files and validating parity.
