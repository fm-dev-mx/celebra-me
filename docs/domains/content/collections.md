# Content Collections

**Last Updated:** 2026-03-24

Celebra-me uses Astro content collections for routable events, showcase demos, and internal
templates.

## Source of Truth

- Collection registration: `src/content/config.ts`
- Canonical schema assembly: `src/lib/schemas/content/base-event.schema.ts`
- Related modular schemas: `src/lib/schemas/content/**`
- Routable collection resolution: `src/lib/content/events.ts`

## Active Collections

| Collection        | Path                             | Purpose                        |
| ----------------- | -------------------------------- | ------------------------------ |
| `events`          | `src/content/events/**`          | live routable events           |
| `event-demos`     | `src/content/event-demos/**`     | public showcase demos          |
| `event-templates` | `src/content/event-templates/**` | internal templates and masters |

Only `events` and `event-demos` are routable through the public invitation routes.

## Event Type Contract

The active event types come from `src/lib/theme/theme-contract.ts`:

- `xv`
- `boda`
- `bautizo`
- `cumple`

## Theme Contract

Theme presets come from `src/lib/theme/theme-contract.ts`:

- `jewelry-box`
- `jewelry-box-wedding`
- `luxury-hacienda`
- `top-premium-floral`
- `editorial`

Section variant enums come from `src/lib/theme/theme-variants.ts`.

## Routing Rules

Public invitation routes resolve as:

- `/{eventType}/{slug}`
- `/{eventType}/{slug}/invitado?invite={inviteId}`
- `/{eventType}/{slug}/i/{shortId}`

`src/lib/content/events.ts` resolves live events first and then public demos by slug and
`eventType`.

## Asset Expectations

Event-specific source assets live under `src/assets/images/events/<slug>/`.

When a route depends on local event assets, keep the asset exports in
`src/assets/images/events/<slug>/index.ts` so the discovery/registry helpers can consume them
consistently.

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
