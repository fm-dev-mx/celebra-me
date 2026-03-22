# 03 Theme Surface Simplification

## Goal

Simplify preset and wrapper ownership so that runtime theming remains intact with fewer layers and
clearer boundaries.

## Scope

- presets assign values, not broad component behavior
- reduce theme wrapper files under `themes/landing/*` that mostly mirror CSS vars
- move component-specific theme logic closer to the component when it is not a reusable preset concern
- keep runtime theming behavior intact for invitation and landing variants

## Work Items

- separate preset-level variable assignment from selector-driven component styling
- review landing and section theme wrappers and remove low-value mirroring layers
- keep only reusable theme slots that materially help multiple consumers
- document any intentional exceptions where a preset still owns component-specific behavior

## Acceptance Criteria

- preset ownership is narrower and documented
- low-value wrappers are reduced or removed
- no preset file acts as a full page-local design system without explicit justification

## Outcome

- `themes/landing/*` wrapper files that only mirrored runtime custom properties were removed.
- `src/styles/landing.scss` now imports presets and landing consumers directly.
- `src/styles/themes/presets/_editorial.scss` was reduced to preset assignment instead of owning page-level behavior.
- `src/styles/layout/_event-wrapper.scss` no longer republishes broad legacy color aliases and stays focused on section contract variables.
