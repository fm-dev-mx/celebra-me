# Theme System Architecture (3-Layer Color Architecture)

## Overview

The invitation theme system is contract-driven and section-based.

- **Single contract source**: `src/lib/theme/theme-contract.ts`
- **Schema enforcement**: `src/content/config.ts` imports modular schemas from
  `src/lib/schemas/content/`
- **Runtime normalization**: `src/lib/adapters/event.ts` validates and normalizes variants
- **Rendering**: invitation sections use `data-variant` selectors
- **Preset application**: class-scoped presets (`.theme-preset--*`), not `:root` injection
- **Editorial Aesthetic**: Support for full-bleed, high-fashion layout variants (`editorial`) and
  event-specific premium overrides.

## Contract Ownership

`theme-contract.ts` defines canonical tuples and exported union types:

- `THEME_PRESETS`
- `QUOTE_VARIANTS`
- `COUNTDOWN_VARIANTS`
- `LOCATION_VARIANTS`
- `SHARED_SECTION_VARIANTS`
- `ITINERARY_VARIANTS`

All downstream consumers must import from this module instead of duplicating literals.

## Style Entry Points

Styles are split by domain/layout:

- `src/styles/global.scss`: base primitives/tokens/utilities
- `src/styles/landing.scss`: landing-only styles + presets used by landing
- `src/styles/invitation.scss`: invitation presets + section themes
- `src/styles/dashboard.scss`: dashboard shell/components
- `src/styles/auth.scss`: auth preset scope

This avoids loading invitation section themes in non-invitation routes.

## Section Theme Strategy

Section base styles live with components (e.g. `src/styles/invitation/_quote.scss`). Section variant
styles live in `src/styles/themes/sections/` and are loaded through `src/styles/invitation.scss`.

For `family`, `gifts`, `gallery`, and `thankYou`, the `standard` variant is satisfied by the base
section styles. Dedicated theme selectors are only required for non-default variants such as
`jewelry-box` and `luxury-hacienda`.

Selector contract:

```scss
.quote-section[data-variant='jewelry-box'] {
  /* variant styles */
}
```

## Preset Strategy

Presets are class-scoped and applied on page wrappers/body.

```scss
.theme-preset--jewelry-box {
  --color-primary: #d4af37;
}
```

Preset classes are consumed at runtime by invitation wrappers and dashboard/auth layouts.

Presenter-owned route wrappers may inject per-event custom properties inline for event-specific
values such as envelope colors, but those values still flow through semantic CSS variable names
rather than component-local hex literals.

Preset files must not own section layout architecture. As of 2026-03-16, the luxury-hacienda
countdown, family, and gallery layout defaults live in their section theme files rather than in
`src/styles/themes/presets/_luxury-hacienda.scss`. Presets may still provide high-level semantic
palette, typography, and cross-section surface tokens.

> [!NOTE] When defining presets, always use explicit index imports for tokens (e.g.,
> `@use '../../tokens/index' as tokens;`) to prevent name resolution ambiguities in complex
> dependency trees.

## Invitation-Level Isolation

Invitation pages now include event-level namespace classes:

- `.event--<slug>`

Optional per-event overrides can be placed in:

- `src/styles/events/<slug>.scss`

These files are lazy-loaded only for the matching event route.

## Runtime Validation Rules

`adaptEvent` applies strict preset behavior:

- Missing preset => default preset
- Invalid preset in production => explicit error (no silent fallback)
- Invalid section variant => warning + fallback

## Governance Notes

- Do not add variant literals directly in components/adapters/schema.
- Update `theme-contract.ts` first, then consume from it.
- Run `pnpm ops validate-schema` after theme changes.
- Treat `standard` shared-section variants as base-style behavior, not as missing themed selectors.
- Per-event editorial overhauls (e.g., `.event--ximena-meza-trasvina`) should prioritize 3-Layer
  Architecture even when using generic section variants.

## Semantic Token Governance

Base semantic tokens live in `src/styles/tokens/_semantic.scss` and are surfaced globally through
`src/styles/global.scss`.

As of 2026-03-16 Phase 03, `src/styles/global.scss` also defines the canonical runtime typography
and glass-role variables consumed by preset-sensitive invitation surfaces, including:

- `--font-display-hacienda`
- `--font-body-hacienda`
- `--color-glass-bg`
- `--color-glass-border`
- `--color-glass-shadow`
- `--shadow-subtle`
- `--shadow-emphasis`
- `--shadow-premium`

Phase 06 standardized these additional semantic roles for component-level styling:

- `--color-surface-elevated`
- `--color-surface-canvas`
- `--color-border-premium`
- `--color-text-muted`

Component rules:

- Astro and TSX files must not introduce hardcoded hex colors for invitation-facing UI.
- Runtime theme-sensitive SCSS should prefer semantic CSS variables such as `var(--font-*)`,
  `var(--color-*)`, and `var(--shadow-*)` over direct `tokens.$...` access for palette, glass, and
  typography values that presets may override at runtime.
- Direct `tokens.$...` access remains acceptable for authoring-only concerns such as animation
  timing, spacing defaults, and fallbacks where no runtime override exists.
- Styling-only `define:vars` blocks should be replaced with inline custom properties or preset/state
  classes.
- Script-level `define:vars` remains acceptable when Astro needs runtime data injection for client
  behavior.

## Collection Integration

The theme system integrates with Astro Content Collections. Content is now partitioned into:

- `event-demos`: Curated previews and marketing examples.
- `event-templates`: Master patterns for production invitations.
- `events`: Production user data (legacy/active).

Runtime resolution in `src/lib/content/events.ts` ensures that theme presets and section variants
are correctly mapped regardless of the source collection.

## Schema Architecture

Content schemas are modularized under `src/lib/schemas/content/`:

- `base-event.schema.ts`: Event top-level schema assembly
- `hero.schema.ts`: Hero/celebrant metadata
- `location.schema.ts`: Venue, ceremony, reception, indications
- `family.schema.ts`: Family relationships and groups
- `rsvp.schema.ts`: RSVP configuration + deprecated legacy labels
- `gifts.schema.ts`: Gift option variants
- `section-styles.schema.ts`: Section styling configuration
- `shared.schema.ts`: Asset, theme, and shared primitives

Legacy RSVP labels (`nameLabel`, `guestCountLabel`, `buttonLabel`) now live under
`sectionStyles.rsvp.legacy` with `@deprecated` JSDoc annotations. Adapters read the legacy namespace
as a fallback to preserve existing content behavior during migration.

---

**Last Updated:** 2026-03-16 (Phase 03 Q1 2026 Audit Sync)
