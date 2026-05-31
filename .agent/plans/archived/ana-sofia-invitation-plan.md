---
title: Ana Sofía Cota Guillen Invitation Plan
status: implemented
created: unknown
updated: 2026-05-31
---

# Ana Sofía Cota Guillen Invitation Plan

## Summary

Build an independent XV invitation for Ana Sofía Cota Guillen at `/xv/ana-sofia-cota-guillen`. The
implementation uses the shared invitation route, content schema, asset registry, and the independent
reusable `celestial-blue` theme preset with a sky-blue/ice-blue/royal-blue/pearl/silver color
architecture.

## Technical Scope

- Created one live event content file under `src/content/events/`.
- Created one independent event asset folder under `src/assets/images/events/`.
- Created one scoped style override under `src/styles/events/`.
- Created one reusable theme preset: `src/styles/themes/presets/_celestial-blue.scss`.
- Registered `celestial-blue` in `PREMIUM_THEMES` (single source of truth for schema validation).
- Added `[data-variant='celestial-blue']` to all section theme SCSS files.

## Architecture Constraints

- Event data must remain logic-free and schema-valid.
- Because this is a live event under `src/content/events/`, a matching Supabase `events` row must
  exist for `xv/ana-sofia-cota-guillen` so `pnpm build` passes event parity.
- Theme identity is `celestial-blue`; Ana Sofía's sky blue, ice blue, royal blue, pearl, and silver
  treatment belongs to `.event--ana-sofia-cota-guillen.theme-preset--celestial-blue`.
- The asset module must export every local image file so dynamic discovery can populate the
  universal asset registry.
- Styling must avoid raw hex colors and use scoped semantic custom properties with `rgb()` values.
- The new event must not reference Ximena's slug, copy, assets, route tests, or theme identity.

## Theme Independence

The `celestial-blue` theme is a fully independent reusable demo theme:

- Registered in `PREMIUM_THEMES` → valid across all schema fields.
- Has its own preset file with complete color architecture.
- Section variant selectors are shared with `jewelry-box` for structural layout but differ in
  color/token values via the preset file and event-scoped overrides.
- No dependency on `jewelry-box`, `premiere-floral`, `luxury-hacienda`, or `editorial`.

## Fabricated Data

- Spanish descriptive copy, gallery captions, countdown footer, RSVP confirmation, and thank-you
  message were created from the event brief.
- RSVP guest cap defaults to `4`.
- `family.featuredImage` uses an Ana Sofía portrait because no family group photo was provided.
- Apple Maps and Waze URLs were omitted because only Google Maps links were supplied.
- Background music was omitted because no licensed hosted URL was provided.

## Verification Expectations

- `pnpm test -- tests/content/ana-sofia-invitation.test.ts`
- `pnpm test -- tests/content/schema.test.ts`
- `pnpm type-check`
- `pnpm lint:styles:changed`
- `pnpm validate:ui-governance`
- `pnpm validate:event-parity`
- `pnpm build`
- Independence check via `rg` — no Ana-specific implementation dependency on existing themes.
- Playwright audit for `/xv/ana-sofia-cota-guillen` at mobile, tablet, and desktop viewports.
