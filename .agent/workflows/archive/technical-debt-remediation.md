---
description: Address technical debt (SCSS migration, AssetRegistry, nesting).
---

# 🔧 Workflow: Technical Debt Remediation

**Source**: `docs/audit/technical-debt-audit-2026-02-11.md` **Type**: Evergreen

1. **Pre-Remediation Analysis**
    - Confirm debt presence:
        - `rg "@use.*(birthday|invitation)/variables" src/styles`
        - `rg "\\bxv\\.|\\bvars\\." src/styles`
    - Create backup branch: `git checkout -b debt-remediation-[date]`

2. **SCSS Legacy Migration**
    - **Goal**: Standardize on token system.
    - **Mapping**:
        - `$font-heading-formal` -> `tokens.$font-display-elegant`
        - `$font-decorative-cursive` -> `tokens.$font-handwriting`
        - `$color-gold` -> `tokens.$color-action-accent`
    - **Actions**: Replace imports, update variable refs, remove unused `@use`.
    - **Order**: Invitation components -> Theme presets -> Home -> Layout.

3. **AssetRegistry Pattern**
    - Ensure `docs/ASSET_REGISTRY_GUIDE.md` exists.
    - Reference in `ARCHITECTURE.md`, `ASSET_MANAGEMENT.md`, and `.agent/PROJECT_CONVENTIONS.md`.

4. **Nesting Optimization**
    - **Limit**: Max 3 levels (BEM methodology).
    - **Target**: `_hero.scss`, `_gallery.scss`.

5. **Verification**
    - Each batch: `npm run build` + `npm run lint`.
    - Final: Full test suite (`pnpm test`).

// turbo
