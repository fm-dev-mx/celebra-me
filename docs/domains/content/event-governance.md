# Event Content Governance

**Last Updated:** 2026-06-19

This document defines how invitation content is organized across live events, demos, and internal
templates.

## Collection Roles

- `published_invitation_content`: public source of truth for real/client invitations
- `src/content/events/`: reserved legacy/static collection; do not add real client invitations here
- `src/content/event-demos/`: public showcase demos grouped by `eventType`
- `src/content/event-templates/`: internal templates and reusable masters; runtime use is limited
  and should be verified before treating a template as an active creation input
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

## Invitation and Demo Creation Recipe

Use this document as the practical entry point before creating or changing invitation content. Keep
the default path data/config/content-first; only change components, routes, adapters, SCSS, schemas,
or mappers when the existing contracts cannot represent the required behavior.

### Real/client invitation from an existing demo

- Create or update the client invitation through the dashboard/editor flow documented in
  [`../intake/production-flow.md`](../intake/production-flow.md) or through a reviewed
  manifest-bearing SQL patch. Do not add a real client JSON file under `src/content/events`.
- Use the selected demo as editorial and visual reference only. Replace all visible copy, event
  details, RSVP settings, family data, navigation labels, sharing copy, and section media.
- Keep slug roles separate: the route slug is stored in DB publication rows, `_assetSlug` points to
  `src/assets/images/events/<asset-slug>/`, and `previewSlug` is demo/template reference metadata.
- Put client-routed local media in `src/assets/images/events/<asset-slug>/` and export it from that
  folder's `index.ts`. Do not point a client invitation at a demo asset module.
- Validate with the narrow checks for the touched surface. When SQL is involved, use the manual SQL
  manifest and dry-run/lint commands from
  [`../../../.agent/rules/invitation-production.md`](../../../.agent/rules/invitation-production.md).

### New public demo

- Public demos are code-managed/static content under `src/content/event-demos/<event-type>/` and
  must use fictitious/demo-safe content.
- A new demo normally needs: demo JSON, `src/assets/images/events/<asset-slug>/` with an `index.ts`
  export, a decision about whether it should be included in `DEMO_PRESET_CATALOG`, and focused
  validation.
- Dashboard-selectable catalog demos must have render-safe asset resolution through their own
  approved asset namespace. Avoid pointing catalog demos at client-like asset folders unless that
  coupling is explicitly approved.
- If the demo should be selectable in the dashboard as a base, include it in the demo preset catalog
  in a separate implementation package. If it should be routable-only, document that decision near
  the demo work.
- `demo-primera-comunion-illustrated` is intentionally promoted to the dashboard catalog as a
  decoupled Primera Comunión template. Its route, `previewSlug`, and `_assetSlug` all use
  `demo-primera-comunion-illustrated`.
- Add theme, SCSS, schema, section, adapter, or renderer work only when the current contracts cannot
  express the demo. Prefer existing `theme.preset`, `sectionStyles`, `sectionOrder`, content fields,
  and asset keys first.

### New event type or theme

- Add a new event type or theme only when existing event types/presets cannot represent the product
  need.
- The source of truth for event types, theme presets, and section vocabulary is
  `src/lib/theme/theme-contract.ts`; docs and content must follow that contract.
- Treat new section behavior as a cross-layer change and use the authoritative section checklist in
  [`../../../.agent/rules/invitation-production.md#section-contract-checks`](../../../.agent/rules/invitation-production.md#section-contract-checks).

### Agent Preflight Checklist

- [ ] Decide whether the work is a real/client invitation, a public demo, or a template update.
- [ ] Confirm the event type and `theme.preset` already exist in `src/lib/theme/theme-contract.ts`.
- [ ] Confirm the route slug, `previewSlug`, and `_assetSlug` are distinct when they serve different
      roles.
- [ ] Confirm local assets live under `src/assets/images/events/<asset-slug>/` and are exported from
      that folder's `index.ts`.
- [ ] Confirm needed sections fit existing schema, mapper, adapter, renderer, and editor contracts.
- [ ] Confirm RSVP mode (`personalized-only` or `hybrid`) and any location visibility expectations.
- [ ] Confirm whether a new demo is routable-only or should be included in `DEMO_PRESET_CATALOG`.
- [ ] Run the narrow validation commands before handoff.

### Section Contract Checklist

See
[Section Contract Checks](../../../.agent/rules/invitation-production.md#section-contract-checks) in
the production rules file for the authoritative checklist. The checklist there covers all layers
(draft schema, editor schema, published schema, both mappers, editor section mapper, preview,
publish flow, adapter, renderer component, and editor key registration).

Copy the checklist from that file when working on a new section; keep the rule file as the single
source of truth.

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
- [ ] Verify section contract for each section in the invitation (see
      [Section Contract Checks](../../../.agent/rules/invitation-production.md#section-contract-checks))
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

- `bautizo`, `baby-shower`, and `primera-comunion` are part of the active event-type contract.
- `graduacion` is not part of the live event-type contract and should remain out of active content
  until the contract changes.
- Public event types should ship with demo/template coverage before they are treated as fully ready
  for ongoing content operations.
