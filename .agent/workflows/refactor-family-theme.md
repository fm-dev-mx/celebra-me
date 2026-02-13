---
description: Refactor and optimize Family section themes (Luxury Hacienda & Jewelry Box)
---

# 💎 Workflow: Family Section Refactor & Optimization

1.  **Synthesis**
    -   **Objective**: Standardize `Family` section architecture, fix BEM inconsistencies, and decouple theme logic from structure.
    -   **Context**: The `Family` component has hardcoded theme checks (`luxury-hacienda`) and styles are split inconsistently between `_family.scss` and `_family-theme.scss`.
    -   **References**:
        -   `src/components/invitation/Family.astro`
        -   `src/styles/invitation/_family.scss`
        -   `src/styles/themes/sections/_family-theme.scss`

2.  **Categorization**
    -   Type: **Refactor / Technical Debt**
    -   Risk: **Medium** (Visual regression potential)

3.  **Strategic Injection**
    -   **BEM Standardization**: Enforce `family__` prefix for all decoration elements.
    -   **Animation Consistency**: Resolve `goldShimmer` (camelCase) vs `gold-shimmer` (kebab-case) mismatch.
    -   **Separation of Concerns**: Move theme-specific styles out of base structural files.

4.  **Construction**

    ## Phase 1: Animation & Token Standardization
    1.  **Audit Animations**:
        -   Verify definition of `@keyframes goldShimmer` in `_family.scss`.
        -   Rename usage in `_family-theme.scss` from `gold-shimmer` to `goldShimmer` (or vice-versa, prefer kebab-case globally).
        -   Ensure `gentleFloat` and `subtlePulse` are available to themes.

    ## Phase 2: Style Refactoring
    2.  **Migrate Theme Logic**:
        -   Move `.theme-preset--jewelry-box` logic from `src/styles/invitation/_family.scss` (lines 69-74) to `src/styles/themes/sections/_family-theme.scss`.
        -   Ensure `_family.scss` remains strictly structural/base.

    3.  **Clean Up Redundancy**:
        -   Remove any duplicate gradient definitions if they exist in both files.
        -   Verify if `family__card-ornament` styles in `_family.scss` should be theme-specific or if they are shared defaults.

    ## Phase 3: Component Decoupling
    4.  **Abstract Decorations**:
        -   Create a helper component `<FamilyDecorations variant={variant} />` (or similar) to encapsulate the rivets, parchment, and leather tooling markup.
        -   Replace hardcoded inline checks in `Family.astro` with this component.

    5.  **Fix BEM & Naming**:
        -   Rename `family-rivet` -> `family__rivet`.
        -   Rename `leather-tooling` -> `family__leather-tooling`.
        -   Update SCSS accordingly in `_family-theme.scss`.

    ## Phase 4: Verification
    6.  **Visual Check**:
        -   Verify "Gerardo - 60 Años" (Luxury Hacienda) for rivets and texture.
        -   Verify "XV Demo" (Jewelry Box) for silk texture and gradients.
        -   Ensure animations play correctly.

5.  **Deployment**
    -   Commit changes: "refactor(family): standardize themes and decouple logic"
    -   Update `docs/implementation-log.md`.

// turbo
