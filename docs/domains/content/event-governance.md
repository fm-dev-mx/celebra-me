# Event Content Governance

## Source roles

- `published_invitation_content` is the public source for real/client invitations.
- `src/content/event-demos/` contains public, fictitious showcase content.
- `src/lib/content/events.ts` owns collection lookup; `src/lib/invitation/content-resolver.ts` owns
  static eligibility; `src/data/demo-showroom.data.ts` owns showroom approval. These sets are
  intentionally distinct.
- `src/lib/intake/demo-preset-catalog.ts` is legacy, scheduled for removal. The editor no longer
  reads it; only managed provisioning still validates `baseDemoId` against it and writes
  `base_demo_id`/`snapshot` (see the
  [preset source of truth](../../../.agent/rules/invitation-preset-source-of-truth.md)).

Static content is not a temporary database fallback. A real invitation is self-sufficient: it
receives its own DB route slug, published content, `theme_id`, and client-owned asset namespace, and
it never takes structure or assets from a demo.

## Naming and capability rules

- Route slug is public identity; `_assetSlug` is the asset-registry namespace. They may differ.
- Public demo slugs are unique across `event-demos`. Production client slugs must not collide with
  static demo routes.
- Theme presets and event types come from `src/lib/theme/theme-contract.ts`, never from free-form
  strings.
- A routable demo is not automatically showroom-approved.

## Creation and validation

Use the [canonical production runbook](../intake/production-flow.md). Structure comes from the
[section contracts](section-contracts.md) and the canonical variant registry
(`src/lib/invitation/section-variants.ts`, documented in the
[variant system](../theme/variant-system.md)); no demo is a structural reference.

Do not copy client-specific media, copy, overrides, or design decisions. Validate schema, descriptor
parity, asset exports, event parity, route behavior, cache isolation, type checking, linting, tests,
and the production build. SQL patches require the manual manifest and dry-run lint; production
mutation always requires explicit authorization.
