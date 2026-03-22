# Phase 03: Inline Style Elimination

## Objective

Replace forbidden `style={}` usage with class-driven styling, variant APIs, or CSS custom
properties without changing rendered behavior.

## Target Areas

- `src/components/common/OptimizedImage.astro`
- `src/components/common/icons/Icon.astro`
- `src/components/invitation/TimelineList.tsx`
- `src/components/layout/Section.astro`
- `src/components/ui/Confetti.tsx`

## Planned Actions

- Convert inline styles to semantic classes where values are finite and variant-driven.
- Use CSS custom properties only where dynamic values remain necessary.
- Keep presentational logic out of component render trees where possible.

## Exit Criteria

- No `no-restricted-syntax` failures remain for inline style props.
