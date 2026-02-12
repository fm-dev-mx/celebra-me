---
description: Design System orchestration (Colors, Typography, Icons, Assets).
---

# /universal-asset-system: Master Orchestrator

1. **Invariants (Non-Negotiable)**
    - **Zero Hex**: Use `tokens.$[role]`.
    - **No Direct Imports**: Use `AssetRegistry.ts` for images.
    - **Atomic Icons**: All SVGs via `<Icon />` component.
    - **Duality**: Logic (English), UI Content (Spanish).

2. **Style Orchestration**
    - Primitives -> Semantics -> Presets -> Implementation.
    - Fallback: `color: var(--color-target, tokens.$fallback);`.

3. **Asset Lifecycle**
    - **Icons**: Place TSX in `common/icons/` -> Export in `index.ts` -> Use `<Icon />`.
    - **Images**: Optimize WebP -> Update `AssetRegistry.ts`.
    - **Loading**: Eager for LCP (Hero/Portrait), Lazy for others.

4. **Performance & A11y**
    - `alt` text mandatory. Contrast WCAG AA check. `loading="lazy"` default.

5. **Quality Gate**
    - `pnpm build`: Zero regressions.
    - **Orphan Audit**: Scan `src/assets/` for files missing from Registry.
    - **Propagations**: Verify token changes impact Landing and Invitations.

// turbo-all **Related**: [/color-architecture](./color-architecture.md),
[/asset-management](./asset-management.md)
