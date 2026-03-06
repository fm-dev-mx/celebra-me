# Asset Management Guide

## Strategy (Current)

Asset references in event content support a mixed mode:

1. **Registry key** from `src/lib/assets/asset-registry.ts`
2. **Absolute URL** (CDN or external)
3. **Root-relative path** (`/images/...`)

This is intentionally permissive for production onboarding speed.

## Resolution Pipeline

- Content schema accepts mixed asset sources (`src/content/config.ts` `AssetSchema`).
- Adapter resolves assets through:
    - registry lookup for keys
    - direct passthrough for URL/root paths

## Governance Rules

- Preferred for stable assets: registry keys
- Allowed for rapid onboarding/migrations: URLs
- If URL usage is temporary, track it in the invitation checklist and plan migration to registry

## New Invitation Checklist Requirement

For each new invitation scaffold:

- Fill `src/content/events/<slug>.assets.json`
- Confirm all referenced assets are available and optimized
- Decide whether each asset stays as URL or moves to registry

## Operational Commands

- `pnpm ops new-invitation <slug>`
- `pnpm ops optimize-assets`

---

**Last Updated:** 2026-03-06
