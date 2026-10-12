# Content Collections

**Last Updated:** 2026-10-09

Celebra-me uses one Astro content collection, for showcase demos. Real/client invitations are
DB-published content; see [`event-governance.md`](event-governance.md) for the real invitation
source-of-truth contract.

## Source of Truth

- Collection registration: `src/content.config.ts` (`defineCollection` + `glob` loader format)
- Canonical schema assembly: `src/lib/schemas/content/base-event.schema.ts`
- Related modular schemas: `src/lib/schemas/content/**`
- Routable collection resolution: `src/lib/content/events.ts`

## Active Collections

| Collection    | Path                         | Purpose               |
| ------------- | ---------------------------- | --------------------- |
| `event-demos` | `src/content/event-demos/**` | public showcase demos |

`src/lib/content/events.ts` looks up the collection. The static eligibility gate belongs to
`src/lib/invitation/content-resolver.ts`: only demo content (`isDemo: true`) is eligible.
DB-published client content from `published_invitation_content` is the only source for real/client
invitations. Public showroom approval belongs to `src/data/demo-showroom.data.ts`; a routable demo
is not automatically showroom-approved.

## Event Type Contract

The active event types come from `src/lib/theme/theme-contract.ts`:

- `xv`
- `boda`
- `bautizo`
- `cumple`
- `baby-shower`
- `primera-comunion`

## Theme Contract

Theme presets come from `src/lib/theme/theme-contract.ts`:

- `jewelry-box`
- `jewelry-box-wedding`
- `luxury-hacienda`
- `celestial-blue`
- `enchanted-rose`
- `sacred-keepsake`
- `premiere-floral`
- `editorial`
- `editorial-magazine`
- `angelic-presence`
- `storybook-lilac`

Section variants come from `src/lib/invitation/section-variants.ts`. Do not duplicate preset or
variant literals in content-specific code.

## Routing Rules

Public invitation routes resolve as:

- `/{eventType}/{slug}`
- `/{eventType}/{slug}?invite={inviteId}`
- `/{eventType}/{slug}/i/{shortId}`

`src/lib/content/events.ts` resolves static fallback entries and public demos by slug and
`eventType`. Public client invitation resolution is governed by `published_invitation_content`.

## Asset Expectations

Event-specific source assets live under `src/assets/images/events/<asset-slug>/`.

Static routable slugs must remain globally unique across `event-demos`. Real/client route slugs live
in DB publication rows and must stay distinct from demo slugs.

When a route depends on local event assets, keep the asset exports in
`src/assets/images/events/<asset-slug>/index.ts` so the discovery/registry helpers can consume them
consistently.

A demo namespace must never hold client-provided media. The legacy
`src/lib/intake/demo-preset-catalog.ts` is read only by managed provisioning (`baseDemoId`); see
[event governance](event-governance.md#source-roles). It may hold catalog-only ids with no routable
demo JSON.

## Validation

Use `pnpm ops validate-schema` for content schema checks and the proportional tiers in
[validation procedures](../../core/validation-procedures.md). `pnpm build` already includes
`pnpm type-check`; do not repeat that check at an unchanged build checkpoint.

## Related Docs

- `docs/core/content-schema.md`
- `docs/domains/content/event-governance.md`
- `docs/domains/theme/architecture.md`
