# Event Content Governance

**Last Updated:** 2026-07-16

## Source roles

- `published_invitation_content` is the public source for real/client invitations.
- `src/content/event-demos/` contains public, fictitious showcase content.
- `src/content/event-templates/` contains development-only reusable masters.
- `src/lib/content/events.ts` owns collection lookup; `src/lib/invitation/content-resolver.ts` owns
  static eligibility. `src/lib/intake/demo-preset-catalog.ts` owns editor selection and
  `src/data/demo-showroom.data.ts` owns showroom approval. These sets are intentionally distinct;
  reference recommendations live in the production runbook, not a shared descriptor registry.

Static content is not a temporary database fallback. A real invitation may use a demo as an
editorial reference, but it receives its own DB route slug, published content, and client-owned
asset namespace.

## Naming and capability rules

- Route slug is public identity; `_assetSlug` is the asset-registry namespace; `previewSlug` is
  demo/template reference metadata. They may differ.
- Public demo slugs are unique across `event-demos`. Production client slugs must not collide with
  static demo or development-template routes.
- Theme presets and event types come from `src/lib/theme/theme-contract.ts`; editor compatibility
  comes from the preset catalog contract, never from free-form strings.
- A routable demo is not automatically editor-selectable or showroom-approved.
- The `xv/master.json` template is a tested development-only starter, not production content.

## Creation and validation

Use the [canonical production runbook](../intake/production-flow.md). The current reference set is:

- `demo-xv-jewelry-box` for asset organization;
- `demo-baby-shower-celestial` for optional-section coverage;
- `demo-boda-jewelry-box-wedding` for non-XV structure.

Do not copy client-specific media, copy, overrides, or design decisions. Validate schema, descriptor
parity, asset exports, event parity, route behavior, cache isolation, type checking, linting, tests,
and the production build. SQL patches require the manual manifest and dry-run lint; production
mutation always requires explicit authorization.
