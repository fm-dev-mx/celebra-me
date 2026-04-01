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
- Demo slugs should clearly read as showcase content, such as `demo-xv`.
- Template files should use stable editorial names such as `master.json`.
- Keep routable content free of duplicate slugs across the same `eventType`.

## Theme Governance

All content must stay within the centralized theme contract.

Current presets:

- `jewelry-box`
- `jewelry-box-wedding`
- `luxury-hacienda`
- `premiere-floral`
- `editorial`

Do not introduce ad-hoc preset names or section-variant literals directly in content files.

## Schema Discipline

- Shared schema stays authoritative in `src/content/config.ts` and `src/lib/schemas/content/**`.
- When UI or runtime supports a field, the schema and adapter layer must support it too.
- New event types require a contract update in `src/lib/theme/theme-contract.ts` before content is
  added.

## Coverage Expectations

- `bautizo` is part of the active event-type contract.
- `graduacion` is not part of the live event-type contract and should remain out of active content
  until the contract changes.
- Public event types should ship with demo/template coverage before they are treated as fully ready
  for ongoing content operations.
