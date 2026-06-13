# Event Content Governance

**Last Updated:** 2026-03-24

This document defines how invitation content is organized across live events, demos, and internal
templates.

## Collection Roles

- `src/content/events/`: live routable events used by production routes
- `src/content/event-demos/`: public showcase demos grouped by `eventType`
- `src/content/event-templates/`: internal templates and reusable masters
- `docs/archive/`: historical documentation only, not content input

## Naming Rules

- Live event slugs should be semantic and client-specific.
- Demo slugs should clearly read as showcase content and include the theme preset, such as
  `demo-xv-jewelry-box` or `demo-boda-jewelry-box-wedding`.
- Template files should use stable editorial names such as `master.json`.
- Keep routable content free of duplicate slugs across all public collections, regardless of
  `eventType`.

## Creating Real Invitations From Demos

Use demos as production references, not as runtime dependencies for a real event.

1. Pick a globally unique, client-specific slug and create the real content file in
   `src/content/events/<slug>.json`.
2. Copy the demo's content shape only as a starting point, then replace visible copy, event details,
   RSVP settings, family data, navigation labels, sharing copy, and section media references.
3. Keep the selected `theme.preset` inside the centralized theme contract. Adjust only supported
   content fields or existing theme tokens; do not add ad-hoc preset names.
4. Put local routed media in `src/assets/images/events/<slug>/` and export it from that folder's
   `index.ts`. Do not point the real invitation at a demo asset module.
5. Do not copy reusable components, route logic, schemas, or large blocks of section logic from a
   demo. If a real invitation requires that, the demo is not reusable enough for production use.
6. Validate the new invitation with schema/content tests, slug isolation, asset export checks, type
   checking, linting, and build before shipping.

### Checklist: Create a Real Invitation from a Demo

- [ ] Create `src/content/events/<slug>.json` — set `isDemo: false`, `eventType`, `theme.preset`
- [ ] Replace all visible copy (hero name, label, venue, parents, godparents, captions, etc.)
- [ ] Set `rsvp.accessMode: "hybrid"` for production RSVP behavior
- [ ] Set `envelope.disabled: false` with proper seal and palette
- [ ] Add `sharing.whatsappTemplate` with real slug and name
- [ ] Create `src/assets/images/events/<slug>/` folder
- [ ] Copy or create event-specific images (hero, ceremony, reception, family, gallery, interludes)
- [ ] Export all images from `src/assets/images/events/<slug>/index.ts` — no demo imports
- [ ] Add content test asserting schema validity, slug isolation, and local asset exports
- [ ] Run: `pnpm test`, `pnpm type-check`, `pnpm lint`, `pnpm ops validate-schema`, `pnpm build`

## Theme Governance

All content must stay within the centralized theme contract.

Current presets:

- `jewelry-box`
- `jewelry-box-wedding`
- `celestial-blue`
- `enchanted-rose`
- `sacred-keepsake`
- `luxury-hacienda`
- `premiere-floral`
- `editorial`
- `angelic-presence`

Do not introduce ad-hoc preset names or section-variant literals directly in content files.

## Schema Discipline

- Shared schema stays authoritative in `src/content.config.ts` and `src/lib/schemas/content/**`.
- When UI or runtime supports a field, the schema and adapter layer must support it too.
- New event types require a contract update in `src/lib/theme/theme-contract.ts` before content is
  added.

## Coverage Expectations

- `bautizo` and `baby-shower` are part of the active event-type contract.
- `graduacion` is not part of the live event-type contract and should remain out of active content
  until the contract changes.
- Public event types should ship with demo/template coverage before they are treated as fully ready
  for ongoing content operations.
