# 🤠 Workflow: Gerardo 60 Aesthetic Audit

This workflow performs a deep analysis and surgical correction of the `cumple-60-gerardo` invitation
styles to ensure they adhere to the project's premium design standards and architectural invariants.

## Context & Ground Truth

- **Target Event**: `cumple-60-gerardo` (`src/content/events/cumple-60-gerardo.json`)
- **Aesthetic**: Luxury Hacienda (Dark Mode, Leather, Gold).
- **Core Issues Identified**: Potential legacy typography variables, color contrast on dark
  surfaces, and RSVP alignment for birthday context.

## 1. Ground Truth Audit (Read-Only)

- [x] Inspect `src/content/events/cumple-60-gerardo.json` for theme parameters. <!-- id: 1 -->
- [x] Verify all assets in `src/assets/images/events/cumple-60-gerardo/` are correctly optimized
      (WebP). <!-- id: 4 -->
- [x] Audit `src/styles/themes/presets/_luxury-hacienda.scss` (if exists) or overrides in
      `_jewelry-box.scss`. <!-- id: 2 -->
- [x] Check `src/components/invitation/Hero.astro` for specific 60th birthday overrides.
      <!-- id: 3 -->

## 2. Typography Tokenization (Core 5 Alignment)

- [x] Ensure "Luxury Hacienda" uses:
    - Titles: `Cinzel` (Formal) -> Updated to `tokens.$font-display-formal`. <!-- id: 5 -->
    - Accents: `Pinyon Script` (Calligraphy) -> Referenced in `_luxury-hacienda.scss` as
      `calligraphy-accent`. <!-- id: 6 -->
    - Body: `EB Garamond` (Narrative) -> Updated `$birthday-font-sub` to `tokens.$font-body`.
        <!-- id: 7 -->
- [x] Verify `src/styles/invitation/_typography.scss` handles dark mode text correctly.
      <!-- id: 8 -->

## 3. 3-Layer Color Refactoring

- [x] Ensure `cumple-60-gerardo` uses dynamic CSS variables: <!-- id: 9 -->
    - Primary: `#D4AF37` (Gold)
    - Surface: `#1a1512` (Dark Leather)
    - Text: `#f5f5f5` (Off-white)
- [x] Verify `RSVP` section styling for "Luxury Hacienda" variant. <!-- id: 10 -->

## 4. Asset Registry Integrity

- [x] Verify `AssetRegistry.ts` keys for `cumple-60-gerardo`. <!-- id: 11 -->
- [x] Ensure `gallery` images are correctly mapped and exist. <!-- id: 12 -->

## 5. Verification & Visual QA

// turbo

- [ ] Run `pnpm build` to ensure no regression in static generation.
- [ ] Verify accessibility compliance (contrast ratio on Gold-on-Dark).
- [ ] Check mobile responsiveness of the `Hero` portrait.

## 6. Self-Archive

- [ ] Move this workflow to `.agent/workflows/archive/` once completed.
