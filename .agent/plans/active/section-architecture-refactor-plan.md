---
title: Section Architecture Refactor Plan
status: active
created: unknown
updated: 2026-05-31
---

# Section Architecture Refactor Plan

## 1. Executive Summary

This plan outlines a phased migration from a highly fragmented theme-section styling architecture
(over 116 files) into a cleaner CSS variable contract system. The current approach forces visual
differences (colors, fonts, spacings) to be implemented conditionally per theme rather than passing
CSS variables predictably.

## 2. Corrections or Objections to the Original Audit

1. **Adding Missing Theme Variants:** The original audit suggested adding missing theme variants
   (e.g., Gallery, Gifts). We challenge this: we will **not** add more theme variants. If the
   differences are completely visual, we should define a CSS variable contract instead of building
   more theme-specific files.
2. **`_tokens.scss` Necessity:** The audit suggested creating a new
   `src/styles/invitation/_tokens.scss`. We challenge this: this introduces an additional
   abstraction layer. A cleaner approach is for each section's base SCSS (e.g., `_hero.scss`) to
   define its own variable contract (e.g., `--hero-bg`) with fallback defaults, inheriting directly
   from `_base.scss` and theme semantic tokens.
3. **Renaming Churn:** The audit suggested renaming `TimelineList.astro` and
   `ItineraryProgram.astro`. We will postpone this renaming to a later phase (when the itinerary
   itself is refactored) to avoid unnecessary churn during the initial section migration phase.
4. **Deploy Risks:** Issues in `env.ts`, `astro.config.mjs` and `RevealManager` are valid notes but
   decoupled from this CSS refactor. We intentionally postpone them.

## 3. Expanded Per-Section Inventory

| Section                | Files                                                             | Structural vs Variant                          | Theme-only Visual | Current SCSS Duplication | Theme-Specific Files Justified? | Consolidation Recommendation                                |
| ---------------------- | ----------------------------------------------------------------- | ---------------------------------------------- | ----------------- | ------------------------ | ------------------------------- | ----------------------------------------------------------- |
| **Header / Menu**      | `EventHeader.astro`, `SectionNavButton.astro`                     | Shared                                         | Yes               | High                     | No                              | Consolidate to CSS variables.                               |
| **Hero**               | `Hero.astro`                                                      | Shared                                         | Yes               | High (all themes)        | No                              | Consolidate to CSS variables.                               |
| **Intro/Quote**        | `Quote.astro`                                                     | Shared                                         | Yes               | High (8 themes)          | No                              | Consolidate.                                                |
| **Location/Map**       | `EventLocation.astro`, `VenueCard.astro`                          | Shared                                         | Yes               | High (8 themes)          | No                              | Consolidate.                                                |
| **Timeline/Itinerary** | `Itinerary.astro`, `TimelineList.astro`, `ItineraryProgram.astro` | Variant (`ItineraryProgram` vs `TimelineList`) | Behavior/HTML     | Medium                   | Yes, due to HTML differences    | Do not touch yet (postpone).                                |
| **Gallery**            | `Gallery.astro`, `PhotoGallery.astro`, `GalleryLightbox.astro`    | Shared                                         | Yes               | Partial (2 themes)       | No                              | Consolidate layout vars, no new variants.                   |
| **Dress code**         | Handled in Location/Content, no component                         | N/A                                            | N/A               | N/A                      | N/A                             | N/A                                                         |
| **Gifts**              | `Gifts.astro`                                                     | Shared                                         | Yes               | Partial (7 themes)       | No                              | Consolidate.                                                |
| **RSVP**               | `RSVP.tsx`, `RSVPComponents.tsx`, `RSVPFormFields.tsx`            | Shared                                         | Yes               | High (9 themes)          | No                              | Consolidate.                                                |
| **Music**              | `MusicPlayer.astro`                                               | Shared                                         | Yes               | High (8 themes)          | No                              | Consolidate.                                                |
| **Countdown**          | `Countdown.astro`, `CountdownTimer.astro`                         | Shared                                         | Yes               | High (9 themes)          | No                              | Consolidate.                                                |
| **ThankYou**           | `ThankYou.astro`                                                  | Shared                                         | Yes               | High (9 themes)          | No                              | Consolidate.                                                |
| **Interlude**          | `Interlude.astro`                                                 | Shared                                         | Yes               | High (7 themes)          | No                              | Consolidate.                                                |
| **Family**             | `Family.astro`, `FamilyDecorations.astro`                         | Variant (celestial-blue watermark vs image)    | Content/HTML      | High (9 themes)          | Yes, for celestial-blue         | Consolidate visual differences, keep conditional rendering. |
| **PersonalizedAccess** | `PersonalizedAccess.astro`                                        | Minimal (ornaments)                            | Yes               | High (9 themes)          | No                              | Consolidate, handle ornament via CSS `::before` or classes. |
| **Footer**             | `Footer.astro`                                                    | Shared                                         | Yes               | High (5 themes)          | No                              | Consolidate.                                                |
| **Reveal/Envelope**    | `EnvelopeReveal.astro`, `InvitationRevealCard.astro`              | Shared                                         | Yes               | High (8 themes)          | No                              | Consolidate.                                                |

## 4. Final Decision Rules

1. **Structural Variant**: If the HTML DOM tree or behavior changes drastically (e.g.
   `ItineraryProgram` vs `TimelineList`), it warrants a dedicated Astro component variant or
   conditional rendering.
2. **CSS-only Theme Skin**: If the variant only changes colors, spacing, borders, or typography, DO
   NOT create a theme skin file. Define local CSS variables on the section base file and inject
   overrides via the theme preset or semantic tokens.
3. **Content-driven Difference**: Render conditionally within a single component (e.g.
   `Family.astro` checking for image vs parents text).
4. **Behavior-driven Difference**: Warrants a distinct component wrapper or isolated prop behavior,
   rather than an overriding SCSS file.

## 5. Target Architecture

- **Defaults:** Section base files (e.g. `src/styles/invitation/_hero.scss`) will contain all base
  structural styling AND define the default value for their specific CSS variable contract (e.g.
  `var(--section-hero-bg, var(--color-surface-primary))`).
- **Theme Overrides:** `src/styles/themes/presets/_<theme>.scss` will directly override specific
  section variables ONLY when absolutely necessary. Most sections will rely entirely on semantic
  tokens.
- **Section-Level CSS Variables:** Only used when a token is truly specific to a section (e.g.
  `--hero-overlay-opacity`), not when a global semantic token suffices (e.g.
  `--color-surface-primary`).
- **Semantic/System Tokens:** Used everywhere natively in the components as fallbacks.
- **Theme-Section Partials:** Eliminated completely for 95% of use cases. Kept ONLY for sections
  with complex structural variants (like `itinerary`), and even then, heavily minimized.

## 6. Naming Conventions

- Section variable namespace: `--<section>-<property>` (e.g. `--quote-padding`,
  `--hero-overlay-opacity`).
- Files will NOT be renamed in this phase.

## 7. CSS Variable Contract Strategy

Each section defines its contract near the top of its base `.scss` file, for example:

```scss
// _quote.scss
.invitation-quote-wrapper {
  --quote-bg: var(--color-surface-primary);
  --quote-spacing: clamp(4rem, 10vh, 8rem);

  background-color: var(--quote-bg);
  padding-block: var(--quote-spacing);
}
```

No dedicated `_tokens.scss` layer will be introduced.

## 8. Migration Order

1. **Phase 1 (Proof of Concept & Easy Wins):** One simple section with high duplication, no
   structural changes, and easy visual validation -> `Quote` section.
2. **Phase 2 (Content Sections):** `Gifts`, `Location`, `ThankYou`, `Countdown`.
3. **Phase 3 (Nav & Layout):** `Header`, `Footer`, `Hero`.
4. **Phase 4 (Interactive):** `Reveal`, `RSVP`, `Music`, `Interlude`, `Gallery`.
5. **Phase 5 (Complex/Structural):** `PersonalizedAccess`, `Family`, `Itinerary`.

## 9. Recommended First Implementation Phase

**Phase 1 Candidate:** `Quote` Section.

- **Why:** Low risk (no TypeScript logic, simple layout), high duplication (8 themes override it for
  minor tweaks), visually very easy to validate.

## 10. Exact Scope for Phase 1

- Update `src/styles/invitation/_quote.scss` to declare a standard CSS variable contract.
- Move necessary variable overrides into the respective theme preset files
  (`src/styles/themes/presets/*.scss`), or omit them if global semantic tokens already achieve the
  correct look.
- Delete the `src/styles/themes/sections/quote/` directory entirely.

## 11. Files likely to change in Phase 1

- `src/styles/invitation/_quote.scss` (Modified to include contract)
- `src/styles/themes/presets/*.scss` (Modified to apply specific overrides if needed)
- `src/styles/themes/sections/quote/*.scss` (Deleted)

## 12. Files that must not change in Phase 1

- Any `.astro` file, including `Quote.astro`.
- Any component logic (`RSVP.tsx`)
- Itinerary/Family files.
- `astro.config.mjs` or `env.ts`

## 13. Validation Commands

```bash
# Build script will validate there are no broken SCSS references
npm run build
```

## 14. Visual Regression Checklist

1. Setup local Dev Server (`npm run dev`).
2. Navigate to a Light theme demo (e.g. `jewelry-box` or `luxury-hacienda`) and verify the Quote
   section spacing and fonts are unchanged.
3. Navigate to a Dark theme demo (e.g. `editorial`) and ensure contrast and layout remain correct.
4. Scale viewport to mobile size to ensure responsiveness wasn't tied to the deleted specific scss
   files.

## 15. Rollback Strategy

If Phase 1 is fundamentally flawed or introduces regressions:

1. Re-checkout `src/styles/themes/presets/*.scss` via `git checkout`.
2. Restore the deleted folder: `git restore src/styles/themes/sections/quote/`.
3. Revert base file: `git checkout src/styles/invitation/_quote.scss`.

## 16. Risks Intentionally Postponed

- Itinerary structural refactor (`TimelineList` vs `ItineraryProgram`).
- Component file renames.
- `NODE_ENV` config time checks in `astro.config.mjs`.
- Addressing Vercel `process.cwd()` deploy inconsistencies for `env.ts`.

## 17. Phase 1 Completion Note: Quote Section

**Completed:** 2026-05-17

Quote section styling was consolidated into `src/styles/invitation/_quote.scss` using a minimal
section-level variable contract. The obsolete `src/styles/themes/sections/quote/` partial directory
was removed after Quote values were migrated, `@forward 'quote';` was removed from
`src/styles/themes/sections/_index.scss`, reference search confirmed no remaining theme-section
Quote imports, and validation passed.

Final Quote variables:

- `--quote-bg`
- `--quote-text-color`
- `--quote-author-color`
- `--quote-accent-color`
- `--quote-padding-block`
- `--quote-padding-inline`
- `--quote-content-max-width`
- `--quote-content-font`
- `--quote-content-size`
- `--quote-content-line-height`
- `--quote-content-style`
- `--quote-content-letter-spacing`
- `--quote-divider-display`
- `--quote-divider-color`
- `--quote-divider-opacity`
- `--quote-ornament-color`
- `--quote-ornament-opacity`
- `--quote-texture-bg`
- `--quote-texture-opacity`

Theme overrides migrated:

- `jewelry-box`: dark Quote background and gold-on-dark text/accent treatment.
- `luxury-hacienda`: parchment background, larger spacing, serif italic typography, accent dividers
  and ornaments.
- `editorial`: dark editorial texture, serif italic typography, gold accents, and light text.
- `premiere-floral`: same Quote contract shape as editorial, using premiere-floral semantic colors.
- `celestial-blue`: cinematic dark blue layered background, hidden dividers, silver accents,
  calligraphy sizing, and texture.
- `angelic-presence`: luminous ivory layered background, sacred gold accents, formal italic
  typography, and silk texture.

Fallback themes:

- `jewelry-box-wedding` continues to inherit the base Quote contract through champagne
  surface/text/accent tokens.
- `sacred-keepsake` continues to inherit the base Quote contract through sacred surface/text/accent
  tokens.

Local exceptions retained in the base Quote SCSS:

- `luxury-hacienda` keeps a top decorative hairline as a small selector because it is not a useful
  cross-theme contract value.
- `angelic-presence` keeps its softer visible-state fade as a small selector because exposing
  animation names/timing as Quote variables was intentionally avoided.

Duplication removed:

- Deleted duplicated `editorial` and `premiere-floral` Quote partials.
- Deleted empty/comment-only Quote base partial and one-off Quote theme partials.
- Removed the Quote theme-section import from the global theme-section index.

Validation results:

- `pnpm lint:styles`: passed.
- `pnpm type-check`: passed with 0 errors, 0 warnings, 0 hints.
- `pnpm lint`: passed; existing boundaries plugin migration warning remains.
- `pnpm build`: passed, including event parity, Astro check, and Vercel server build.

Manual visual risk:

- Browser screenshot review is still recommended for the eight theme presets because layered
  backgrounds and ornament gradients were consolidated into the base contract without changing
  `Quote.astro`.

---

## Phase 2 Completion Note: Gifts Section

**Completed:** 2026-05-17

Gifts section styling was consolidated into `src/styles/invitation/_gifts.scss` using a practical
section-level variable contract. The obsolete `src/styles/themes/sections/gifts/` partial directory
was deleted after Gifts values were migrated, `@forward 'gifts';` was removed from
`src/styles/themes/sections/_index.scss`, reference search confirmed no remaining theme-section
Gifts imports, and validation passed.

### Final Gifts Variables (32)

- `--gifts-bg`
- `--gifts-text-color`
- `--gifts-title-color`
- `--gifts-subtitle-color`
- `--gifts-title-letter-spacing`
- `--gifts-padding-block`
- `--gifts-padding-inline`
- `--gifts-card-bg`
- `--gifts-card-border`
- `--gifts-card-radius`
- `--gifts-card-shadow`
- `--gifts-card-title-color`
- `--gifts-card-title-letter-spacing`
- `--gifts-icon-color`
- `--gifts-icon-opacity`
- `--gifts-button-bg`
- `--gifts-button-color`
- `--gifts-button-border`
- `--gifts-button-border-radius`
- `--gifts-button-hover-bg`
- `--gifts-button-hover-color`
- `--gifts-bank-bg`
- `--gifts-bank-border-left`
- `--gifts-bank-text-color`
- `--gifts-bank-label-color`
- `--gifts-account-bg`
- `--gifts-account-color`
- `--gifts-account-border`
- `--gifts-copy-bg`
- `--gifts-copy-color`
- `--gifts-copy-border`

### Variables Deliberately Not Included

- `--gifts-card-hover-transform`: base hardcodes `translateY(-10px)`; editorial/premiere-floral use
  `-8px`, celestial-blue uses `-3px` via local exceptions
- `--gifts-card-hover-shadow`: editorial uses complex multi-shadow glow; luxury-hacienda uses warm
  shadow — local exceptions
- `--gifts-clabe-box-shadow`: editorial uses inset glow; luxury-hacienda uses warm shadow — local
  exceptions
- `--gifts-copy-font-size`, `--gifts-copy-letter-spacing`: consistent across themes
- Icon filter variables: hardcoded `drop-shadow`; luxury-hacienda uses `filter: none` via local
  exception
- Animation variables: shimmer kept as `@keyframes gifts-shimmer-slide` in base

### Theme Overrides Migrated

- `editorial` + `premiere-floral`: share same glass-morphism card, shimmer hover, slide-fill button,
  bank grid layout — editorial preset provides `--gifts-bg: var(--color-surface-dark)` and
  `--gifts-subtitle-color`
- `celestial-blue` + `jewelry-box`: share glass-morphism card with `::after` inset border, pill
  button — celestial-blue preset provides full override set (bg gradient, title color, card
  bg/border/radius, icon color, account styling)
- `luxury-hacienda`: distinct warm brown palette, pill buttons, hacienda font, warm bank/account
  styling — full override set in luxury-hacienda preset

### Fallback Themes

- `jewelry-box-wedding`: inherits base contract through champagne surface/text/accent tokens. Likely
  acceptable.
- `sacred-keepsake`: inherits base contract through sacred surface/text/accent tokens. Likely
  acceptable.
- `angelic-presence`: inherits base contract. Gifts section not visually distinctive in this theme.

### Local Exceptions in `_gifts.scss`

- `luxury-hacienda`: icon `filter: none`, card hover `translateY(-3px)` (softer), reduced-motion
  only disables transform
- `editorial` + `premiere-floral`: shimmer animation, button slide-fill `::before`, card top-border
  gradient line, bank-details grid layout with `::after` dot, CLABE inset box-shadow with glow
- `jewelry-box` + `celestial-blue`: card `::after` inset border decoration

### Import/Deletion Cleanup

- Removed `@use '../tokens' as tokens;` from `_gifts.scss` (was unused)
- Moved `@keyframes gifts-shimmer-slide` from `_base.scss` to `_gifts.scss`
- Removed `@forward 'gifts';` from `src/styles/themes/sections/_index.scss`
- Deleted all 7 files in `src/styles/themes/sections/gifts/`

### Validation Results

- `pnpm lint:styles`: passed.
- `pnpm type-check`: passed with 0 errors, 0 warnings, 0 hints.
- `pnpm lint`: passed; existing boundaries plugin migration warning remains.
- `pnpm build`: passed, including event parity, Astro check, and Vercel server build.

### Remaining Manual Screenshot Risks

- `jewelry-box`: card glass bg, icon visibility, button pill radius
- `celestial-blue`: cool-toned accent on glass card
- `editorial` + `premiere-floral`: shimmer animation, button slide-fill, CLABE glow
- `luxury-hacienda`: warm brown palette, pill buttons, CLABE warm styling, no accidental bleed
- `jewelry-box-wedding` + `sacred-keepsake` + `angelic-presence`: fallback contrast

### Recommended Next Section

**Phase 3: Location/ThankYou/Countdown** — These content sections share a similar structure (section
header + card grid) and can likely be consolidated using the same pattern as Gifts with minimal
variable contracts. Alternatively, **Hero** could be considered if a simpler starting point is
preferred.
