# Phase 02: Remediate Hex Code Leaks in Content Layers

**Completion:** 0% | **Status:** PENDING

## 🎯 Objective

Eliminate hardcoded hex values in JSON content files and replace them with semantic token keys that the backend/presenter can resolve.

## 🛠️ Actions

1. **Content Audit**: Identify all hex occurrences in `src/content/events/` and `src/content/event-demos/`.
    - Key Targets: `theme.primaryColor`, `theme.accentColor`, `envelope.closedPalette.*`.
2. **Schema Update**: Modify `src/lib/schemas/content/base-event.schema.ts` (lines 61-63).
    - Current: `.regex(/^#/)`.
    - Robust: Change to `z.string()` or a union that allows both hex (fallthrough) and semantic tokens (e.g., `primary`, `accent`, `background`).
3. **Adapter Resolution**: Update `src/lib/adapters/invitation.adapter.ts` (or relevant adapter) to resolve the token name to a fallback hex if the theme is not active, ensuring zero regression.
4. **Data Migration**: Shift JSON files to use token aliases where possible.

## ✅ Verification

- **Schema Check**: `pnpm run build` or `pnpm exec astro check` should pass with token strings in JSON.
- **Visual Check**: Colors must remain consistent with the "Jewelry Box" palette.
