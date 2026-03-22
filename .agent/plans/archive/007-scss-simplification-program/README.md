# Plan 007: SCSS Simplification Program

## Abstract

This plan reduces architectural complexity in the SCSS system by removing parallel sources of truth,
locking a canonical token contract, and simplifying theme consumption patterns without breaking
runtime theming.

## Objectives

1. Preserve the modular token foundation that is already sound
2. Keep `tools/token()` as a minimal justified primitive for map access
3. Restrict or retire low-value abstractions such as wrapper layers that only mirror CSS variables
4. Eliminate parallel design-authoring layers in globals and mixins
5. Standardize consumers on canonical semantic CSS custom properties
6. Document contributor rules for keeping the styling system simple

## Background & Scope

Recent audit findings show that the main complexity risks are not the core token helpers, but:

- legacy alias proliferation in the CSS contract
- parallel breakpoint and typography definitions in `global/_mixins.scss`
- theme preset files that mix token assignment with component behavior
- landing/theme wrapper files that repackage `var(--...)` with little added value

## Non-Goals

- no rewrite of the primitive/semantic token stack
- no removal of runtime theming support
- no cosmetic redesign of working presets unless required for simplification
- no migration of every hardcoded style detail in one pass

## Implementation Principles

- prefer one source of truth per concern
- prefer CSS custom properties for runtime theme consumption
- use Sass functions only when they prevent real duplication
- avoid new abstractions unless they reduce maintenance in multiple files
- preserve working theme behavior while reducing architecture surface area

## Phases

- [01-contract-and-helper-boundaries]
- [02-global-layer-reduction]
- [03-theme-surface-simplification]
- [04-consumer-canonicalization]

## Execution Notes

- `token()` remains the canonical Sass map accessor and `rgb-channels()` remains allowed only for bounded `*-rgb` CSS contract output.
- `global/_mixins.scss` no longer owns breakpoints or authoring typography presets; those maps now live in canonical token files and mixins consume them.
- `themes/landing/*` wrapper files that only mirrored runtime CSS variables were removed; `landing.scss` now imports presets and real consumers directly.
- Theme presets were thinned so assignment stays in presets while reusable section behavior stays in section/theme layers.
- Legacy aliases were reduced, but `--color-surface`, `--color-border`, and `--ff-heading` remain as explicit temporary bridges because current Astro pages still consume them outside migrated SCSS files.

## Constraints

- all existing entrypoints must keep compiling
- active invitation, landing, dashboard, and auth themes must remain functional
- changes must remain compatible with current Sass module usage
- simplification must take precedence over architectural novelty
