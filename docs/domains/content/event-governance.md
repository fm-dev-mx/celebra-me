# Event Content Governance

**Last Updated:** 2026-06-13

This document defines how invitation content is organized across live events, demos, and internal
templates.

## Collection Roles

- `published_invitation_content`: public source of truth for real/client invitations
- `src/content/events/`: reserved legacy/static collection; do not add real client invitations here
- `src/content/event-demos/`: public showcase demos grouped by `eventType`
- `src/content/event-templates/`: internal templates and reusable masters
- `docs/archive/`: historical documentation only, not content input

## Naming Rules

- Client invitation route slugs should be semantic and client-specific, and are stored in the DB
  publication rows.
- Demo slugs should clearly read as showcase content and include the theme preset, such as
  `demo-xv-jewelry-box` or `demo-boda-jewelry-box-wedding`.
- Template files should use stable editorial names such as `master.json`.
- Keep routable demo/template slugs distinct from DB-published client route slugs.

## Creating Real Invitations From Demos

Use demos as production references, not as runtime dependencies for a real event. Real/client
invitations are DB-published content and must not be created as static JSON under
`src/content/events`.

1. Pick a globally unique, client-specific route slug for the DB publication row.
2. Use the dashboard flow or a reviewed manifest-bearing SQL patch to create/update client
   invitation, event, and published-content rows.
3. Copy a demo's content shape only as editorial reference, then replace visible copy, event
   details, RSVP settings, family data, navigation labels, sharing copy, and section media
   references.
4. Keep the selected `theme.preset` inside the centralized theme contract. Adjust only supported
   content fields or existing theme tokens; do not add ad-hoc preset names.
5. Put local routed media in `src/assets/images/events/<asset-slug>/` and export it from that
   folder's `index.ts`. Do not point the real invitation at a demo asset module.
6. Set `_assetSlug` to the event asset directory key. Keep `previewSlug` only as demo/template
   reference metadata for editor previews and optional demo asset import.
7. Do not copy reusable components, route logic, schemas, or large blocks of section logic from a
   demo. If a real invitation requires that, the demo is not reusable enough for production use.
8. Validate the publication with schema/content tests, route isolation, asset export checks, type
   checking, linting, event parity, and the SQL manifest/lint/dry-run checks when SQL is involved.

### Checklist: Create a Real Invitation from a Demo

- [ ] Create or update DB-published content with `isDemo: false`, `eventType`, and `theme.preset`
- [ ] Replace all visible copy (hero name, label, venue, parents, godparents, captions, etc.)
- [ ] Set `rsvp.accessMode: "hybrid"` for production RSVP behavior
- [ ] Set `envelope.disabled: false` with proper seal and palette
- [ ] Add `sharing.whatsappTemplate` with real slug and name
- [ ] Create `src/assets/images/events/<asset-slug>/` folder
- [ ] Copy or create event-specific images (hero, ceremony, reception, family, gallery, interludes)
- [ ] Export all images from `src/assets/images/events/<asset-slug>/index.ts` — no demo imports
- [ ] Set `_assetSlug` to `<asset-slug>` and keep it distinct from demo `previewSlug`
- [ ] Add content test asserting schema validity, slug isolation, and local asset exports
- [ ] Run: `pnpm test`, `pnpm type-check`, `pnpm lint`, `pnpm validate:event-parity`, and SQL patch
      lint/dry-run when SQL is involved

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
