# Content Collections

**Last Updated:** 2026-06-19

Celebra-me uses Astro content collections for legacy/static fallback content, showcase demos, and
internal templates. Real/client invitations are DB-published content; see
[`event-governance.md`](event-governance.md) for the real invitation source-of-truth contract.

## Source of Truth

- Collection registration: `src/content.config.ts` (Astro 6 `defineCollection` + `glob` loader
  format)
- Canonical schema assembly: `src/lib/schemas/content/base-event.schema.ts`
- Related modular schemas: `src/lib/schemas/content/**`
- Routable collection resolution: `src/lib/content/events.ts`

## Active Collections

| Collection        | Path                             | Purpose                                       |
| ----------------- | -------------------------------- | --------------------------------------------- |
| `events`          | `src/content/events/**`          | legacy/static fallback; no new client content |
| `event-demos`     | `src/content/event-demos/**`     | public showcase demos                         |
| `event-templates` | `src/content/event-templates/**` | internal templates; verify runtime use        |

Only `events` and `event-demos` are routable through the public invitation routes. DB-published
client content from `published_invitation_content` is resolved before static fallback content.
`src/content/events` should not receive new client invitation content by default. `event-templates`
exists for internal masters, but its runtime use is limited and should be verified before relying on
it for a creation workflow.

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
- `angelic-presence`

Section variant enums are consumed through `src/lib/theme/theme-contract.ts`. Do not duplicate
preset or variant literals in content-specific code.

## Routing Rules

Public invitation routes resolve as:

- `/{eventType}/{slug}`
- `/{eventType}/{slug}?invite={inviteId}`
- `/{eventType}/{slug}/i/{shortId}`

`src/lib/content/events.ts` resolves static fallback entries and public demos by slug and
`eventType`. Public client invitation resolution is governed by `published_invitation_content`.

## Asset Expectations

Event-specific source assets live under `src/assets/images/events/<asset-slug>/`.

Static routable slugs must remain globally unique across `events` and `event-demos`. Real/client
route slugs live in DB publication rows and must stay distinct from demo/template slugs.

When a route depends on local event assets, keep the asset exports in
`src/assets/images/events/<asset-slug>/index.ts` so the discovery/registry helpers can consume them
consistently.

Dashboard-selectable demos are not inferred from routable static JSON alone. A demo becomes a
dashboard preset only when it is added to `DEMO_PRESET_CATALOG` and has explicit render-safe asset
resolution through an approved demo-owned namespace. `demo-primera-comunion-illustrated` is promoted
this way with `_assetSlug` set to `demo-primera-comunion-illustrated`, separate from any client
invitation asset folder.

## Validation

```bash
pnpm type-check
pnpm ops validate-schema
pnpm build
```

## Related Docs

- `docs/core/content-schema.md`
- `docs/domains/content/event-governance.md`
- `docs/domains/theme/architecture.md`
