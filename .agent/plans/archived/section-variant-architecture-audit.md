---
title: Section Variant Architecture Audit
status: archived
created: unknown
updated: 2026-05-31
---

# Section Variant Architecture Audit

**Date:** 2026-05-17 **Project:** Celebra-me.com **Stack:** Astro.js, TypeScript, SCSS, Vercel
**Status:** READ-ONLY AUDIT

---

## 1. Executive Summary

### Context

Celebra-me has 8 theme presets and ~14 section types. Currently, each section has per-theme SCSS
files (e.g., `family/_luxury-hacienda.scss`, `family/_editorial.scss`), creating a matrix of 100+
theme-section files. This approach has become difficult to maintain.

### Core Finding

**Most section differences are purely visual.** Only 3 sections have genuine structural variants:

| Section            | Has Structural Variant? | Trigger                                                             |
| ------------------ | ----------------------- | ------------------------------------------------------------------- |
| Itinerary          | YES                     | `celestial-blue` uses `ItineraryProgram` vs `TimelineList`          |
| Family             | YES                     | `celestial-blue` renders paper surface + watermark instead of image |
| PersonalizedAccess | Minimal                 | Non-standard adds ornament corners                                  |

All other sections use identical HTML structures with theme-driven CSS differences only.

### Key Architectural Issues

1. **Theme leaking into components** - `_base-theme.scss` contains `.theme-preset--*` selectors that
   style components directly
2. **Dual selector patterns** - Both `.theme-preset--*` classes AND `[data-variant='*']` attributes
   target the same elements
3. **Inconsistent variable scoping** - Some variables defined in preset files, others in section
   `_base.scss` files
4. **No clear boundary** between theme variables and section-level CSS contracts
5. **Some themes lack variants** for certain sections, relying on base fallback inconsistently

### Risk Assessment

| Risk                          | Level  | Notes                                                                |
| ----------------------------- | ------ | -------------------------------------------------------------------- |
| Path casing (Linux/Vercel)    | LOW    | Consistent use of `@/` Vite aliases                                  |
| Server/client boundaries      | MEDIUM | `RevealManager` uses `window` directly; proper in `<script>` context |
| Build/runtime env assumptions | HIGH   | `NODE_ENV` checked at config time in `astro.config.mjs`              |
| `process.cwd()` in serverless | MEDIUM | Used in `env.ts` may behave differently on Vercel                    |

---

## 2. Current Architecture Map

```
src/
├── content/
│   ├── events/                    # Production invitations (4 files)
│   ├── event-demos/               # Demo templates (5 files)
│   └── event-templates/
│
├── components/invitation/
│   ├── InvitationSections.astro    # Section renderer (dispatcher)
│   ├── Hero.astro                  # Hero section
│   ├── EventHeader.astro           # Header/navigation
│   ├── Footer.astro                # Footer
│   ├── EventLocation.astro         # Location with VenueCard
│   ├── VenueCard.astro             # Sub-component
│   ├── Itinerary.astro             # Itinerary dispatcher
│   ├── ItineraryProgram.astro       # Sub-component (celestial-blue variant)
│   ├── TimelineList.astro          # Sub-component (standard variant)
│   ├── Gallery.astro / PhotoGallery.astro / GalleryLightbox.astro
│   ├── Countdown.astro / CountdownTimer.astro
│   ├── CountdownTimer.tsx          # UNUSED React version
│   ├── Family.astro                 # Family section (has celestial-blue variant)
│   ├── Gifts.astro / Quote.astro / ThankYou.astro
│   ├── RSVP.tsx / RSVPComponents.tsx / RSVPFormFields.tsx
│   ├── Interlude.astro             # Full-screen image break
│   ├── MusicPlayer.astro           # Music player
│   ├── PersonalizedAccess.astro    # Access pass (has ornament variant)
│   ├── EnvelopeReveal.astro         # Envelope animation
│   ├── InvitationRevealCard.astro  # Reveal card
│   └── SectionNavButton.astro
│
├── lib/invitation/
│   ├── page-data.ts               # Builds InvitationPageContext
│   ├── section-render-data.ts     # Section descriptor mapping
│   ├── reveal-manager.ts          # Envelope reveal logic
│   ├── engagement.ts             # Section visibility tracking
│   ├── interlude-observer.ts      # Parallax handling
│   └── theme-styles.utils.ts      # Scoped CSS generation
│
├── styles/
│   ├── invitation/                # Section base styles (~18 files)
│   ├── themes/
│   │   ├── presets/               # 8 theme preset definitions
│   │   └── sections/              # ~116 theme-section override files
│   └── tokens/
│       ├── semantic/              # Purpose-based aliases
│       └── system/               # Primitive values
```

### Data Flow

```
JSON Content (theme.preset + sectionStyles)
        ↓
adaptEvent() [event.ts adapter]
        ↓
InvitationViewModel with sections
        ↓
buildInvitationRenderPlan() [page-data.ts]
        ↓
InvitationPageContext with renderPlan
        ↓
buildInvitationSectionRenderDescriptors() [section-render-data.ts]
        ↓
InvitationSectionRenderDescriptor[]
        ↓
InvitationSections.astro renders with data-variant={variant}
        ↓
CSS: .theme-preset--* (global) + [data-variant='*'] (section)
```

---

## 3. Section Inventory Table

### 3.1 Hero Section

| Attribute                   | Details                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| **Files**                   | `components/invitation/Hero.astro`, `styles/invitation/_hero.scss`, `styles/themes/sections/hero/` |
| **Themes Using**            | All 8 themes                                                                                       |
| **Structural Variants**     | **NONE** - identical HTML structure                                                                |
| **Visual Differences**      | Overlay color, title size/font, badge styling, card background, shadows                            |
| **Content-Driven**          | `name`, `secondaryName`, `label`, `date`, `backgroundImage`, `portrait`, `focalPoint`              |
| **Behavior-Driven**         | Parallax on scroll                                                                                 |
| **Hardcoded Values**        | `--hero-overlay: rgb(0 0 0 / 40%)`, `--hero-title-size: clamp(4rem, 12vw, 8rem)`                   |
| **Existing Tokens**         | `--color-surface-primary`, `--font-display`, `--font-body`                                         |
| **Refactor Recommendation** | Keep single structure. Extract section variables to `_hero.scss` base. Use CSS vars.               |
| **Risk Level**              | LOW                                                                                                |

### 3.2 Itinerary/Timeline

| Attribute                   | Details                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Files**                   | `Itinerary.astro`, `TimelineList.astro`, `ItineraryProgram.astro`, `styles/invitation/_itinerary.scss`            |
| **Themes Using**            | All 8 themes                                                                                                      |
| **Structural Variants**     | **YES** - `celestial-blue` uses `ItineraryProgram` (paper panel), all others use `TimelineList` (zigzag timeline) |
| **Visual Differences**      | Timeline layout (zigzag vs centered panel), animation style                                                       |
| **Content-Driven**          | `items[]` with `icon`, `label`, `time`, `description`                                                             |
| **Behavior-Driven**         | Animated line SVG in TimelineList                                                                                 |
| **Refactor Recommendation** | **Maintain two components** - genuine structural difference. Rename to clarify intent.                            |
| **Risk Level**              | MEDIUM - Two actual structural variants exist by design                                                           |

### 3.3 Family

| Attribute                   | Details                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| **Files**                   | `Family.astro`, `styles/invitation/_family.scss`                                       |
| **Themes Using**            | All 8 themes                                                                           |
| **Structural Variants**     | **YES** - `celestial-blue` renders paper surface + watermark instead of featured image |
| **Visual Differences**      | Image vs typographic layout, watermark initials                                        |
| **Content-Driven**          | `parents`, `godparents`, `labels`, `featuredImage`                                     |
| **Refactor Recommendation** | **Keep conditional rendering** for celestial-blue variant. Document clearly.           |
| **Risk Level**              | MEDIUM - Structural variant exists by design                                           |

### 3.4 PersonalizedAccess

| Attribute                   | Details                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| **Files**                   | `PersonalizedAccess.astro`, `styles/invitation/_section-primitives.scss`       |
| **Themes Using**            | All 8 themes                                                                   |
| **Structural Variants**     | **MINIMAL** - `standard` variant omits ornament corners                        |
| **Visual Differences**      | Corner ornaments (non-standard)                                                |
| **Refactor Recommendation** | Consider if ornament corners justify conditional rendering. Could be pure CSS. |
| **Risk Level**              | LOW                                                                            |

### 3.5 Gallery

| Attribute                   | Details                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| **Files**                   | `Gallery.astro`, `PhotoGallery.astro`, `GalleryLightbox.astro`             |
| **Themes Using**            | Only `jewelry-box` and `editorial` have variants. Others fallback to base. |
| **Structural Variants**     | **NONE** - wrapper + grid renderer pattern                                 |
| **Visual Differences**      | Grid layout (mosaic vs standard), card radius                              |
| **Refactor Recommendation** | Add missing theme variants. Create gallery-specific tokens.                |
| **Risk Level**              | LOW                                                                        |

### 3.6 All Other Sections (Quote, RSVP, Gifts, Countdown, ThankYou, Interlude, Music, Location, Header, Footer)

| Attribute                   | Details                                                                      |
| --------------------------- | ---------------------------------------------------------------------------- |
| **Structural Variants**     | **NONE** for all                                                             |
| **Visual Differences**      | CSS-only (colors, fonts, spacing, shadows)                                   |
| **Refactor Recommendation** | Standardize on semantic tokens. Consolidate to single base file per section. |
| **Risk Level**              | LOW                                                                          |

---

## 4. Recommended Target Architecture

### Principles

1. **One structure per section type** - Unless HTML markup genuinely differs
2. **Theme variables cascade** - Theme preset → Section base → Section variant
3. **Section CSS contracts** - Each section defines its own `--section-*` variables
4. **Visual variants via CSS only** - No conditional component rendering for visual differences
5. **Structural variants explicit** - Documented, named after structure not theme

### What Changes and What Stays

| Section            | Current              | Recommended                                            |
| ------------------ | -------------------- | ------------------------------------------------------ |
| Hero               | 8 theme files + base | 1 base file with CSS vars                              |
| Family             | 8 theme files + base | 1 base + celestial-blue condition (documented)         |
| Itinerary          | 8 theme files + base | Keep 2 files: standard + paper (structural difference) |
| PersonalizedAccess | 8 theme files + base | 1 base, ornament via CSS                               |
| All others         | Multiple theme files | 1 base file per section with CSS vars                  |

---

## 5. Rules: Variant vs CSS Variables

### Create a New Variant WHEN:

1. **HTML structure changes** - Different elements rendered, different DOM hierarchy
2. **Layout model differs** - Flexbox vs Grid vs absolute positioning
3. **Behavior is different** - Different JavaScript logic, different animations
4. **Content ordering changes** - Elements appear in different positions semantically

### Use CSS Variables WHEN:

1. **Only color changes** - Background, text, border, shadow colors
2. **Only typography changes** - Font family, size, weight, line-height
3. **Only spacing changes** - Padding, margin, gap values
4. **Only opacity/shadow changes** - Transparency, elevation
5. **Only texture/ornamentation** - Background patterns, decorative elements
6. **Only size/dimension changes** - Width, height, border-radius

### Decision Tree

```
Is the HTML markup different between themes?
├── YES → Create structural variant component
└── NO → Is the visual difference only CSS?
    ├── YES → Use CSS variables in base + overrides
    └── NO (behavior/semantics differ) → Create structural variant
```

---

## 6. Proposed Folder/File Organization

### Components

```
src/components/invitation/
├── InvitationSections.astro     # Unchanged
├── Hero.astro                    # Unchanged
├── EventHeader.astro / Footer.astro / EventLocation.astro / VenueCard.astro
├── Itinerary.astro               # Keep dispatch logic
├── ItineraryStandard.astro       # NEW NAME: was TimelineList
├── ItineraryPaper.astro          # NEW NAME: was ItineraryProgram (celestial-blue)
├── Gallery.astro / PhotoGallery.astro / GalleryLightbox.astro
├── Countdown.astro / CountdownTimer.astro
├── Family.astro                  # Keep conditional (document clearly)
├── Gifts.astro / Quote.astro / RSVP.tsx / ThankYou.astro
├── Interlude.astro / MusicPlayer.astro
├── PersonalizedAccess.astro       # Consider simplifying ornament
├── EnvelopeReveal.astro / InvitationRevealCard.astro
└── SectionNavButton.astro
```

### SCSS Structure

```
src/styles/invitation/
├── _tokens.scss              # Section CSS contracts (NEW)
├── _section-primitives.scss # Shared
├── _hero.scss
├── _family.scss
├── _itinerary-standard.scss  # NEW: for standard timeline
├── _itinerary-paper.scss     # NEW: for paper panel (celestial-blue)
├── _countdown.scss / _quote.scss / _gallery.scss / _gifts.scss
├── _rsvp.scss / _thank-you.scss / _interlude.scss / _music-player.scss
├── _location.scss / _header.scss / _footer.scss / _access.scss / _reveal.scss
└── _navigation.scss

src/styles/themes/
├── _contracts.scss          # Theme-level variable contracts
├── presets/
│   ├── _base.scss
│   ├── _invitation.scss
│   ├── _jewelry-box.scss / _jewelry-box-wedding.scss / _luxury-hacienda.scss
│   ├── _editorial.scss / _premiere-floral.scss / _celestial-blue.scss
│   ├── _sacred-keepsake.scss / _angelic-presence.scss
└── sections/
    └── (MINIMAL - only for actual structural variants like itinerary-paper)
```

---

## 7. Proposed Section-Level CSS Variable Contracts

### Hero Contract

```scss
:root {
  --hero-overlay: rgb(0 0 0 / 40%);
  --hero-title-size: clamp(4rem, 12vw, 8rem);
  --hero-card-bg: var(--color-glass-bg);
  --hero-card-shadow: var(--shadow-premium);
  --hero-parallax-strength: -0.1;
}
```

### Itinerary Contract

```scss
:root {
  /* Standard variant */
  --itinerary-item-gap: 2rem;
  --itinerary-dot-size: 12px;
  --itinerary-icon-size: 2rem;

  /* Paper variant */
  --itinerary-paper-width: min(90%, 600px);
  --itinerary-paper-bg: var(--color-surface-primary);
}
```

### Gallery Contract

```scss
:root {
  --gallery-grid-gap: 1rem;
  --gallery-card-radius: 6px;
  --gallery-card-hover-scale: 1.02;
}
```

---

## 8. Safe Quick Wins

| #   | Action                                                   | Impact | Risk     |
| --- | -------------------------------------------------------- | ------ | -------- |
| 1   | Delete unused `CountdownTimer.tsx`                       | Low    | Very Low |
| 2   | Rename `TimelineList.astro` → `ItineraryStandard.astro`  | Low    | Low      |
| 3   | Rename `ItineraryProgram.astro` → `ItineraryPaper.astro` | Low    | Low      |
| 4   | Add missing gallery theme variants                       | Medium | Low      |
| 5   | Add missing gifts theme variants                         | Medium | Low      |
| 6   | Localize hardcoded Spanish strings                       | Medium | Low      |

---

## 9. Risky Refactors to Postpone

1. **Merge all theme preset files** - Too many consumers, unknown dependencies
2. **Remove the `[data-variant]` attribute pattern** - Many components rely on it
3. **Convert ItineraryProgram to CSS-only** - Paper panel layout genuinely requires different HTML
4. **Move all hardcoded colors to CSS variables** - Unknown impact scope
5. **Create universal section base component** - Overgeneralization risk

---

## 10. Suggested Migration Order

### Phase 1: Cleanup (Weeks 1-2)

1. Delete `CountdownTimer.tsx`
2. Add missing gallery/gifts theme variants
3. Localize hardcoded Spanish strings
4. Document structural variants with code comments

### Phase 2: Renaming (Weeks 2-3)

5. Rename `TimelineList.astro` → `ItineraryStandard.astro`
6. Rename `ItineraryProgram.astro` → `ItineraryPaper.astro`
7. Update imports

### Phase 3: Token Foundation (Weeks 3-4)

8. Create `src/styles/invitation/_tokens.scss`
9. Add border-radius token scale
10. Extract interlude parallax strength to CSS variable

### Phase 4: Incremental Consolidation (Weeks 4-8)

11. Consolidate gallery, gifts, quote, thank-you styles

### Phase 5: Theme Reduction (Weeks 8-12)

12. Audit theme overlaps, reduce theme-section files

---

## 11. Validation Checklist

### Pre-Refactor Validation

- [ ] All 8 theme presets render correctly
- [ ] No broken imports after renames
- [ ] No JavaScript errors in browser console
- [ ] Build completes (`npm run build`)
- [ ] Lint passes (`npm run lint`)

### Post-Refactor Validation

- [ ] Section inventory table is accurate
- [ ] All structural variants documented
- [ ] Theme-section file count reduced (target: -50%)
- [ ] No hardcoded Spanish text in components
- [ ] All sections have CSS variable contracts
- [ ] No orphaned or unused files remain

---

## Appendix A: Key Findings

| Item                   | Status                                             |
| ---------------------- | -------------------------------------------------- |
| Unused React component | `CountdownTimer.tsx` - not referenced anywhere     |
| Structural variants    | 3 (Itinerary, Family, PersonalizedAccess minimal)  |
| Theme-section files    | ~116 total, many purely visual differences         |
| Hardcoded Spanish      | Countdown, RSVP, Envelope, Location sections       |
| Missing theme coverage | Gallery (6 themes), Gifts (5 themes) lack variants |

## Appendix B: Theme Presets in Content

| Preset              | Demo Content                        | Production Content          |
| ------------------- | ----------------------------------- | --------------------------- |
| jewelry-box         | demo-xv-jewelry-box.json            | -                           |
| jewelry-box-wedding | demo-boda-jewelry-box-wedding.json  | -                           |
| luxury-hacienda     | demo-cumple-luxury-hacienda.json    | gerardo-sesenta.json        |
| editorial           | demo-xv-editorial.json              | -                           |
| premiere-floral     | -                                   | ximena-meza-trasvina.json   |
| celestial-blue      | -                                   | ana-sofia-cota-guillen.json |
| sacred-keepsake     | -                                   | cesar-ramses.json           |
| angelic-presence    | demo-bautismo-angelic-presence.json | -                           |

## Appendix C: Deployment Risks

| Priority | Issue                                           | Recommendation                                  |
| -------- | ----------------------------------------------- | ----------------------------------------------- |
| HIGH     | `NODE_ENV` at config time in `astro.config.mjs` | Hardcode production URL or use Vite define      |
| MEDIUM   | `process.cwd()` in `env.ts` for serverless      | Verify works on Vercel runtime                  |
| MEDIUM   | `window` access in `RevealManager`              | Already works in `<script>` context but fragile |
| LOW      | Path casing                                     | Verified - uses `@/` Vite aliases consistently  |
