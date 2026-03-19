# Phase 07: Implementation of Decoupled Theme Overrides (Slug Scoping)

**Completion:** 0% | **Status:** PENDING

## 🎯 Objective

Enable complete independence for each invitation and demo by moving from "Preset Classes" to a
"Slug-Scoped Semantic Token" system. This allows visual variations (colors, fonts) to be defined
entirely in JSON without creating new SCSS files.

## 🛠️ Actions

1. **Skeleton Refactor**: Update structural presets (e.g., `_jewelry-box.scss`) to use strictly
   semantic CSS variables (e.g., `var(--color-primary)`) instead of hardcoded Sass primitive
   references.
2. **Slug Scoping**: Update the main layout to inject a CSS scope based on the event slug:

```html
<div data-event-slug="ximena-meza" class="theme-preset--jewelry-box"></div>
```

1. **Presenter Injection**: Enhance `src/lib/presenters/invitation-presenter.ts` to generate a
   scoped CSS block from JSON tokens:

```css
[data-event-slug='ximena-meza'] {
  --color-primary: #fbeded;
  --color-accent: #d4a5a5;
}
```

1. **Landing Page Alignment**: Ensure the Landing Page uses a similar "Visual Palette" override
   system for its own presets (Elegant, Dark).

## ✅ Verification

- **Independence Test**: Modifying colors for `demo-wedding` in JSON must NOT affect
  `invitation-graduation`, even if both use the `jewelry-box` skeleton.
- **Zero-Code Variant**: Create a new demo variant (e.g., "Silver Edition") solely by editing a
  `.json` file and verify it renders correctly.
