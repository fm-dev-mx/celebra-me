# Theme System Architecture (3-Layer Color Architecture)

## Overview

The invitation theme system is contract-driven and section-based.

- **Single contract source**: `src/lib/theme/theme-contract.ts`
- **Schema enforcement**: `src/content/config.ts` uses contract arrays in Zod enums
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

## Collection Integration

The theme system integrates with Astro Content Collections. Content is now partitioned into:

- `event-demos`: Curated previews and marketing examples.
- `event-templates`: Master patterns for production invitations.
- `events`: Production user data (legacy/active).

Runtime resolution in `src/lib/content/events.ts` ensures that theme presets and section variants
are correctly mapped regardless of the source collection.

---

**Last Updated:** 2026-03-12 (Editorial Aesthetic Sync)
