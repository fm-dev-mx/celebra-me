# Invitation Production Rules

## Source of Truth

- Real/client invitations are DB-published content resolved from `published_invitation_content`.
- Static content is reserved for demos, templates, and explicitly supported fallback windows.
- Do not create client invitations by adding JSON files under `src/content/events`.

## Slug Meanings

- Route/event slug: public URL and RSVP event identity, for example `leah-lexa`.
- `_assetSlug`: internal asset registry key matching `src/assets/images/events/<asset-slug>/`.
- `previewSlug`: demo/template reference metadata for editor previews and optional demo asset
  import.

Keep `_assetSlug` client-specific for real invitations. Do not point it at a demo asset directory.

## SQL Patch Safety

- Old production patches without manifest fields are historical records, not templates.
- Current production SQL patches must include the manual SQL manifest and pass:
  - `pnpm db:sql:lint -- --file <path>`
  - `pnpm db:prod:patch -- --file <path>`
- `pnpm db:prod:patch` is dry-run lint only; it must not be treated as execution approval.
