---
description: Universal Asset System Orchestration & Maintenance Workflow
---

# /universal-asset-system: Unified Design Architecture

This workflow serves as the **Master Orchestrator** for the Celebra-me design system. It enforces a deterministic architecture where Colors, Typography, Motion, Icons, and Images are managed as unified atomic units.

## 🛡️ Architectural Invariants (Non-Negotiable)

1.  **Zero Hex/HSL Policy**: Component SCSS MUST NEVER contain raw color values. Use `tokens.$[role]`.
2.  **No Direct Imports**: Images MUST NEVER be imported directly via relative paths in components. Use `src/lib/assets/AssetRegistry.ts` as the canonical registry.
3.  **Atomic Icons Only**: All SVGs MUST be consumed via the `<Icon />` registry component to ensure decoupling.
4.  **Duality Principle**: Technical infrastructure (code, tokens, workflows) stays in English; UI content and strings stay in Spanish.

---

## 🚀 Execution Lifecycle

### 1. Token Orchestration (Style Layer)
Before styling any component, verify the token chain:
- **Primitives**: Define base values in `tokens/_primitives.scss`.
- **Semantics**: Map roles in `tokens/_semantic.scss` (e.g., `$color-surface-primary`).
- **Presets**: Map variables to semantic roles in `themes/presets/_[theme].scss`.
- **Implementation**: Always use the "Safe Fallback" logic:
  `color: var(--color-target, tokens.$semantic-fallback);`

### 2. Registry Integration (Asset Layer)
To add new icons or images:

#### Icons
1.  **Category Mapping**: Place React SVG in `src/components/common/icons/[ui|invitation|social]/`.
2.  **Registry Export**: Add to the corresponding `index.ts`.
3.  **Consumption**: Use `<Icon name="[IconName]" />` only.

#### Images
1.  **Optimization**: Generate `.webp` via `optimize-event-images.mjs`.
2.  **Registry Entry**: Update `src/lib/assets/AssetRegistry.ts`.
3.  **Loading Strategy**:
    - **Eager**: For Hero/Portrait (add `resolutions` to `ImageAsset`).
    - **Lazy**: For Gallery/Secondary assets (default).

---

## 🛠️ Performance & Accessibility (a11y)

1.  **Alt-Text Integrity**: Every entry in `AssetRegistry` MUST have a descriptive `alt` string.
2.  **Contrast Guard**: Any token change MUST be validated against WCAG AA (4.5:1).
3.  **Lazy Loading**: Enforce `loading="lazy"` for assets fetched via `getEventAsset` unless flag is overridden for LCP elements.

---

## 🏁 Quality Gate (Definition of Done)

// turbo-all

1.  **Build Integrity**: `pnpm build` must succeed without Sass or TypeScript regressions.
2.  **Asset Audit**: Run a scan to ensure NO orphan files exist in `src/assets/` that aren't in `AssetRegistry`.
3.  **Chain Verification**: Verify that changing a token in `_semantic.scss` correctly propagates to both the Landing Page and individual Invitations.

## 📝 Related Workflows
- [/color-architecture](./color-architecture.md): Specialized color management.
- [/asset-management](./asset-management.md): Low-level optimization and curation.
