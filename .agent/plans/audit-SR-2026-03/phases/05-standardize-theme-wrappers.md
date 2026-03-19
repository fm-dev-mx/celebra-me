# Phase 05: Standardize Theme Wrapper Structure (TS to SCSS)

**Completion:** 0% | **Status:** PENDING

## 🎯 Objective

Move inline style generation for theme variables from TypeScript to SCSS. Use the 3-Layer Color
Architecture logic to handle variable mapping.

## 🛠️ Actions

1. **Logic Separation**: Refactor `buildWrapperStyle` in `invitation-presenter.ts` to return an
   object of **logical keys** instead of a raw CSS string.
2. **Attribute Mapping**: Apply these keys as data-attributes (e.g.,
   `data-theme-envelope="primary"`).
3. **SCSS Integration**: Update `src/styles/layout/_event-wrapper.scss` (or equivalent) to read:

```scss
[data-theme-envelope='primary'] {
  --env-bg: var(--color-primary);
}
```

1. **Optimization**: Remove the `style` attribute injection from the Astro template.

## ✅ Verification

- **DOM Inspection**: Wrapper should have `data-theme-*` attributes.
- **Style Source**: Chrome DevTools should show styles coming from CSS files, not inline `style`
  tags.
