# Phase 02: Noir Premiere XV Variant Centralization

## Objective

Dismantle the massive file `noir-premiere-xv.scss` and move its logic into reusable, global component variants mapped to the `editorial` theme preset.

## Context

Current event styles are scoped purely to `data-event="noir-premiere-xv"`. We need these high-quality, elegant Noir styles to be accessible by ANY generic event using `data-theme="editorial"`.

## Implementation Steps

1. **Identify Missing Variants:** Review Astro components in `src/components/` and determine which elements lack an `.editorial` SCSS namespace.
2. **Code Translocation:** Cut the SCSS rules from `noir-premiere-xv.scss` and paste them into their respective component modules (e.g., `src/components/Hero/Hero.scss`), wrapped explicitly under the `[data-theme="editorial"]` layer.
3. **Token Replacement:** Swap out the hardcoded hex codes found in Phase 01 with generic CSS custom properties (e.g., `var(--color-primary)`), relying on the `editorial` preset to inject the actual Noir colors.

## Output

A drastically reduced `noir-premiere-xv.scss` file, and richly populated `[data-theme="editorial"]` variants across all section components.
