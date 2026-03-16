# Asset Management Guide

## Strategy (Current)

Asset references in event content use a normalized source contract with legacy-string compatibility:

1. **Internal asset**: registry/discovery key resolved through `src/lib/assets/asset-registry.ts`
2. **External asset**: secure `https://` URL
3. **Public asset**: root-relative path (`/images/...`)

Legacy string values in content are normalized by the schema into the internal/external contract at
validation time.

## Resolution Pipeline

- Content schema normalizes asset references in `src/lib/schemas/content/shared.schema.ts`.
- Adapter resolution in `src/lib/adapters/event-helpers.ts` now:
    - fails on invalid internal registry keys
    - accepts only secure external URLs
    - passes through root-relative public paths
    - resolves common assets and event-discovered assets explicitly

## Governance Rules

- Preferred for stable invitation assets: internal registry/discovery keys
- Allowed for onboarding and migration: `https://` URLs and root-relative public paths
- Insecure `http://` asset URLs are rejected by schema validation
- If URL usage is temporary, track it in the invitation checklist and plan migration to internal
  assets

## New Invitation Checklist Requirement

For each new invitation scaffold:

- Fill `src/content/events/<slug>.assets.json`
- Confirm all referenced assets are available and optimized
- Decide whether each asset stays as URL or moves to registry

## Operational Commands

- `pnpm ops new-invitation <slug>`
- `pnpm ops optimize-assets`
- `pnpm assets:check-registry`

## Discovery Audit

`pnpm assets:check-registry` validates the dynamic-discovery pipeline by checking every folder under
`src/assets/images/events/` for:

- a local `index.ts` asset module
- an exported `assets` object
- local image files that are imported by that module
- imported image files that actually exist on disk

---

**Last Updated:** 2026-03-06
