# Phase 08: Standardizing Naming & Architectural Alignment

**Completion:** 0% | **Status:** PENDING

## 🎯 Objective

Standardize theme, content, and asset naming to ensure architectural consistency and remove
specific-to-event identifiers from general system components.

## 🛠️ Actions

1. **Theme Generalization**:
   - Rename `top-premium-xv-ximena.scss` to `top-premium-classic.scss` (or `floral`).
   - Update all references in `theme-contract.ts` and event JSONs.
2. **Preset Consolidation**:
   - Evaluate if `jewelry-box-wedding` should be merged with `jewelry-box` using the Phase 07
     decoupling logic.
3. **Asset Governance**:
   - Ensure all assets follow: `src/assets/images/events/[event-slug]/[section]-[role].[ext]`.
   - Cleanup any loose or poorly named files in `common/` or `hero/` that belong to specific events.
4. **Content Slug Alignment**:
   - Standardize filenames in `src/content/events/` to match a `YYYY-MM-DD-[slug].json` pattern if
     needed, or simply ensure they match the primary slug.

## ✅ Verification

- **Code Search**: No references to `ximena` remaining in `src/lib/theme/` or `src/styles/themes/`.
- **Build Integrity**: `pnpm run build` must pass, ensuring all asset imports and theme names are
  correctly mapped.
