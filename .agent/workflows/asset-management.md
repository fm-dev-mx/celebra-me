---
description: Asset Management & Optimization Workflow
---

# Asset Management Workflow

1. **Discovery**
    - Check `src/assets/images/events/[event-slug]/`.
    - Format: All images must be `.webp`.
    - Script: Run `scripts/optimize-event-images.mjs` if needed.
    - Inventory: Flag redundant or low-quality assets.

2. **Standardization**
    - Pattern: `[category]-[index].webp` (e.g., `gallery-01.webp`).
    - Categories: `hero`, `portrait`, `gallery`, `preview`, `signature`.
    - Index: 2-digit padded (e.g., `01`).

3. **Registry (Barrel Pattern)**
    - **Local**: `src/assets/images/events/[event-slug]/index.ts` (export named constants).
    - **Global**: `src/assets/images/events/index.ts` (re-export event module).
    - **Universal**: `src/lib/assets/AssetRegistry.ts` (register canonical keys).

4. **Integration**
    - Update `src/content/events/[event-slug].json`.
    - **Constraint**: No raw string paths. Use registry keys.

5. **Verification**
    - [ ] `pnpm build`: Verify import resolution.
    - [ ] `pnpm dev`: Check `/cumple-60-gerardo` (Hero/Portrait).
    - [ ] Cleanup: Delete legacy raw images.

---

**Related**: [/universal-asset-system](./universal-asset-system.md)
