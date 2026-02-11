---
description:
    Deep analysis and surgical correction of Gerardo's 60th birthday invitation styles for Luxury
    Hacienda aesthetic standards.
---

# 🤠 Workflow: Gerardo 60 Aesthetic Alignment

This workflow performs a deep analysis and surgical correction of the `cumple-60-gerardo` invitation
styles to ensure they adhere to the project's "Luxury Hacienda" design standards and architectural
invariants.

## Context & Ground Truth

- **Target Event**: `cumple-60-gerardo` (`src/content/events/cumple-60-gerardo.json`)
- **Aesthetic**: Luxury Hacienda (Leather, antique Gold, Serif/Western).
- **Core Issues to Audit**:
    - Verify `luxury-hacienda` preset adheres to 3-Layer Color Architecture.
    - Ensure typography uses the correct "Hacienda" font stack (masculine serif/western).
    - Check asset integrity for the gallery and hero sections.

## 1. Ground Truth Audit (Read-Only)

- [ ] Inspect `src/content/events/cumple-60-gerardo.json` for theme parameters.
- [ ] Verify all assets in `src/assets/images/events/cumple-60-gerardo/` are correctly optimized
      (WebP).
- [ ] Audit `src/styles/themes/presets/_luxury-hacienda.scss` against the 3-Layer Color
      Architecture.
    - Must use `--color-text-primary`, `--color-surface-primary`, etc.
    - Check for hardcoded colors that should be tokens.
- [ ] Check section styles for consistencies:
    - Quote (`elegant` variant - should be masculine elegant)
    - Countdown (`minimal` variant)
    - Location (`structured` variant - check map style)

- [ ] **Masculine Tone Audit**:
    - Verify every section avoids "Jewelry Box" flourishes (glitter, soft curves).
    - Ensure `Hero` uses strong, blocky, or slab-serif typography.
    - Confirm `Gifts` icons are minimal/sharp, not decorated.
    - Validate `RSVP` uses solid buttons, not gradient-glass unless "Cognac" tinted.

## 2. Typography Tokenization (Hacienda Alignment)

- [ ] Verify `src/styles/birthday/_variables.scss` or similar defines the correct font stack for
      `luxury-hacienda`.
- [ ] Map these fonts to global CSS variables if not already done:
    - `--font-display-hacienda` (e.g., Rye or Special Elite for accents)
    - `--font-body-hacienda`
- [ ] Ensure `_luxury-hacienda.scss` restricts typography to these variables.

## 3. 3-Layer Color Refactoring

- [ ] Modify `src/styles/themes/presets/_luxury-hacienda.scss` to ensure it accepts dynamic
      overrides:
    - `var(--color-primary)` should map to the Leather/Brown tones.
    - `var(--color-action-accent)` should map to the Gold/Western tones.
- [ ] Verify `src/pages/[eventType]/[slug].astro` passes `cumple` specific parameters correctly.

## 4. Asset Registry Integrity

- [ ] Verify `AssetRegistry.ts` contains entries for `cumple-60-gerardo` assets (gallery, hero,
      portrait).
- [ ] Ensure `cumple-60-gerardo.json` uses semantic asset keys (e.g., `gallery01` instead of paths).

## 5. Verification & Visual QA

// turbo

- [ ] Run `pnpm build` to ensure no regression in static generation.
- [ ] Verify accessibility compliance (contrast ratio on Gold-on-Leather).
- [ ] Check mobile responsiveness of the `Hero` portrait and "Wanted" poster effect (if applicable).

## 6. Self-Archive

- [ ] Move this workflow to `.agent/workflows/archive/` once completed.

---

### Critical Reflection (Architect's Note)

The "Luxury Hacienda" theme demands a different set of invariants than "Jewelry Box". While Jewelry
Box is about _light, glass, and air_, Hacienda is about _weight, texture, and history_. We must
ensure the `envelope` implementation for Gerardo (which uses a "WANTED" poster style) is correctly
integrated and doesn't conflict with the standard envelope logic.
