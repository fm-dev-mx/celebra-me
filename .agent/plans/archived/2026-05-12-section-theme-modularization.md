---
title: Section Theme Modularization Refactor Plan
status: superseded
created: 2026-05-12
updated: 2026-05-31
superseded_by: section-architecture-refactor-plan
---

# Section Theme Modularization Refactor Plan

**Goal:** Standardize invitation section theme SCSS so every section follows the modular Hero
pattern: `_base.scss`, per-variant partials, and a section `_index.scss`.

**Architecture:** Section theme entrypoints are directory based. Shared selector-neutral defaults
live in each section `_base.scss`; concrete `[data-variant='...']` rules live in one partial per
variant. The central `src/styles/themes/sections/_index.scss` forwards section directories directly.

**Constraints:** Preserve existing styling behavior, keep `_auth-theme.scss` and `_base-theme.scss`
as special non-section surfaces, update validation/docs that still assume flat `_*-theme.scss`
files, and keep documented base-style fallbacks intact.

---

## Implementation Checklist

- [ ] Create modular directories for Quote, Countdown, Location, Family, Gifts, Gallery, RSVP, Thank
      You, Footer, Reveal, Itinerary, Header, Music, and Interlude.
- [ ] Split each legacy section theme file into `_base.scss` plus concrete variant partials.
- [ ] Replace grouped `premiere-*` selectors with explicit `premiere-floral` selectors.
- [ ] Update the central section entrypoint to forward directories directly.
- [ ] Update `scripts/validate-schema.mjs` to read modular section directories recursively.
- [ ] Update theme architecture documentation and agent governance references.
- [ ] Delete migrated flat `_*-theme.scss` files and the obsolete `_hero-theme.scss` shim.
- [ ] Verify with schema validation, stylelint, type-check, build, and visual smoke coverage where
      feasible.
