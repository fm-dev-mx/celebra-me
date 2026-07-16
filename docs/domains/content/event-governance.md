# Event Content Governance

**Last Updated:** 2026-07-16

## Source roles

- `published_invitation_content` is the public source for real/client invitations.
- `src/content/event-demos/` contains public, fictitious showcase content.
- `src/content/event-templates/` contains development-only reusable masters.
- `src/lib/invitation/invitation-descriptors.ts` records routability, editor selection, showroom
  approval, canonical-reference roles, production enablement, event type, preset, and asset
  namespace. Intentional subsets remain distinct and are tested for parity.

Static content is not a temporary database fallback. A real invitation may use a demo as an
editorial reference, but it receives its own DB route slug, published content, and client-owned
asset namespace.

## Naming and capability rules

- Route slug is public identity; `_assetSlug` is the asset-registry namespace; `previewSlug` is
  demo/template reference metadata. They may differ.
- Public demo slugs are unique across `event-demos`. Production client slugs must not collide with
  static demo or development-template routes.
- Theme presets and event types come from `src/lib/theme/theme-contract.ts`; compatibility comes
  from the descriptor/preset catalog contract, never from free-form strings.
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
