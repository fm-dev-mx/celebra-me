# Plan 008: SCSS Architecture Optimization

## Objective

Audit, sanitize, and re-architect the project's SCSS variable/token system to eliminate
redundancies, enforce strict naming conventions, and establish a world-class theme engine.

## Background

The current system has "implementation drift" where SCSS variables and CSS variables are duplicated,
and components frequently bypass the token system. This plan implements the "Top Pro" 3-Layer Color
Architecture.

## Scope

- `src/styles/tokens/`: Restructuring into system, semantic, and component layers.
- `src/styles/themes/`: Refactoring theme presets to use a simpler mapping pattern.
- `src/styles/components/`: Incremental migration to CSS-variable-only consumption.
- `src/styles/global.scss`: Main entry point cleanup.

## Constraints

- **Maintain SIMPLICITY**: Avoid over-engineering. Use native CSS features where appropriate.
- **Scalability**: Support 10+ themes without payload bloat.
- **Aesthetics**: Maintain and enhance the "Jewelry Box" visual excellence.

## Phases

1. **01-foundation-restructuring**: Create the new directory structure and system layer.
2. **02-theme-engine-refactor**: Refactor theme presets and semantic mapping.
3. **03-component-tokenization**: Migrating components to the new token system.
4. **04-cleanup-and-finalization**: Removing legacy bridges and redundant code.
