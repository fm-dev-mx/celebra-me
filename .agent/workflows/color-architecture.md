---
description: Color Architecture & Design Token Management Workflow
---

# /color-architecture: Color Architecture & Design Token Management

This workflow defines the deterministic process for managing the color ecosystem in Celebra-me. It ensures global consistency while enabling deep aesthetic overrides for different event types (Birthdays, Weddings, XV) and premium presets.

## 🏗️ Design Token Architecture (3-Layer System)

1. **Primitive Tokens (Base)**: Hardcoded Hex/HSL values (e.g., `$base-gold-500`). These are **NEVER** used directly in components.
2. **Semantic Tokens (Purpose)**: Abstract roles defining *how* a color is used (e.g., `$color-surface-primary`, `$color-text-emphasis`).
3. **Preset Overrides (Event Specific)**: Theme-level overrides using CSS Variables to allow hot-swapping (e.g., `--color-leather-dark`).

---

## 🚀 Execution Phases

### Phase 1: Context & Audit

1. **Identify Event Scope**: Determine if the change impact is global, event-type specific (e.g., all Birthdays), or instance-specific (e.g., Gerardo's 60th).
2. **Color Audit**: Check `src/styles/tokens/_semantic.scss` for existing tokens.
3. **Contrast Pre-check**: Verify that the proposed palette meets WCAG AA (4.5:1) for text readability.

### Phase 2: Token Implementation

// turbo

1. **Global Primitives**: If adding new base colors, register them in `src/styles/tokens/_primitives.scss`.
2. **Semantic Mapping**: Map primitives to functional roles in `src/styles/tokens/_semantic.scss`.
3. **Junction Sync**: Ensure `src/styles/tokens/_index.scss` forwards all tokens.
4. **Implementation Logic**: Use the "Safe Fallback" logic: `color: var(--color-target, tokens.$semantic-fallback);`.

### Phase 3: Theme Preset Definition

1. **Registry**: Update or create the preset in `src/styles/themes/presets/_[theme-name].scss`.
2. **CSS Variable Injection**:

    ```scss
    .theme-preset--[name] {
      // Functional Overrides
      --color-primary: #{$theme-hex};
      --color-primary-rgb: #{vars.to-rgb($theme-hex)};

      // Aesthetic specific (e.g., Leather, Parchment)
      --color-texture-tint: rgba(75, 54, 33, 0.15);
    }
    ```

### Phase 4: Migration & Component Refactor

1. **Hardcode Removal**: Search for hex values or old `xv-` variables in `src/components/` SCSS.
2. **Atomic Replacement**: Replace with semantic variables using the "Safe Fallback" pattern:
    - *Modern*: `color: var(--color-text-primary, vars.$color-primary-dark);`

### Phase 5: Verification Gate (The Quality Bar)

// turbo

1. **Build Integrity**: Run `pnpm build` to ensure no Sass regressions.
2. **Visual Walkthrough**: Verify that selecting the theme class on a container correctly propagates all color changes.
3. **Duality Check**: Ensure all UI strings in the components remain in Spanish while technical documentation and tokens are in English.

---

## 📝 Golden Rules

- **Zero Hex Policy**: Component SCSS must **NEVER** contain hex values. Use tokens.
- **RGB Support**: Always provide an RGB version of major tokens (e.g., `--color-primary-rgb`) to allow opacity variations with `rgba(var(--color-primary-rgb), 0.5)`.
- **Texture Integrity**: Background colors for premium themes must contemplate alpha channels to blend with underlying textures (SVG/SVG-Filter).
- **Naming**: Use `$color-[role]-[state]` format (e.g., `$color-button-primary-hover`).

// turbo-all

