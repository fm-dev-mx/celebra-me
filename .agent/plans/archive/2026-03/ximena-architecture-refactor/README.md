# Ximena Architecture Refactor

## Intent

Resolve severe architectural coupling discovered during the Ximena event audit. The `Hero.astro`
styling in `_hero-theme.scss` directly implements event-specific overrides (`ximena-premium`)
instead of leveraging a decoupled schema. Furthermore, the core theme preset
(`_top-premium-floral.scss`) improperly couples section-specific geometry data.

## Scope

1. **Schema & Component Expansion:** Introduce `focalPoint: z.string().optional()` to the Hero Zod
   schema (`hero.schema.ts`). Update `Hero.astro` to consume and render this via
   `--hero-bg-position-y` bounds.
2. **Data De-coupling:** Update `ximena-meza-trasvina.json` to assign a generic `premium-portrait`
   layout and dynamically pass its focal point.
3. **Hero Architecture Cleanup:** Delete `&[data-layout-variant='ximena-premium']` from
   `_hero-theme.scss`. Construct a generic `premium-portrait` layout enforcing CSS Grid bounds over
   fragile Flexbox `margin-top` overrides.
4. **Token Purity:** Eradicate section-level sizes (like
   `--jewelry-box-countdown-value-size-mobile`) from the raw theme palette
   `_top-premium-floral.scss`, replacing them with default fallbacks safely inside section files
   (`_countdown-theme.scss`, `_thank-you-theme.scss`).

## Success Criteria

- Hero component focal points can be manipulated via JSON payloads exclusively.
- Uncoupled global SCSS containing no `ximena`-specific references.
- Visual continuity for Ximena's invitation is maintained.
- `pnpm run check` returns zero schema or type errors.
