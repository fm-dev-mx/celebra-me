# Invitation Production Rules

## Source of Truth

- Real/client invitations are DB-published content resolved from `published_invitation_content`.
- Static content is reserved for demos, templates, and explicitly supported fallback windows.
- Do not create client invitations by adding JSON files under `src/content/events`.

## Effective Content Flow

The merge flow ensures data is never lost between draft ↔ published transitions:

1. **Editor hydration**:
   `mergePublishedWithDraft(published, draft, { allowDemoFallback, demoContent })` in
   `getInvitationEditorContext()`. Draft wins, then published, then demo (for demo invitations
   only).
2. **Editor preview**: `computeEffectiveContent(draft, published)` → `mapDraftToPublished()` →
   `adaptDbEvent()`. Preview always uses merged content, never raw sparse draft.
3. **Publish**: `computeEffectiveContent(draft, priorPublished)` → `mapDraftToPublished()` →
   validated against `eventContentSchema` → stored in `published_invitation_content`. Non-edited
   sections are preserved from prior published content.
4. **First draft save**: When no draft exists but published content exists,
   `saveInvitationEditorSection()` seeds the new draft from published content using
   `draft?.content ?? published?.content ?? {}`.

Key functions: `mergePublishedWithDraft()` and `computeEffectiveContent()` in
`src/lib/intake/services/merge-content.service.ts`.

## Section Contract Checks

Every editable section must be verified across ALL of these layers:

| Layer                    | File pattern                                                                  | What to check                                                 |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Draft schema             | `src/lib/intake/schemas/invitation-content-draft.schema.ts`                   | All fields the section needs                                  |
| Editor schema            | `src/lib/intake/schemas/invitation-editor.schema.ts`                          | All fields the editor form can save (must match draft schema) |
| Published schema         | `src/lib/schemas/content/*.schema.ts`                                         | Publication validation                                        |
| Draft → published mapper | `src/lib/intake/mappers/draft-to-published.mapper.ts`                         | Field mapping                                                 |
| Published → draft mapper | `src/lib/intake/services/draft-content-mapper.ts` (`mapNestedToDraftContent`) | Reverse mapping                                               |
| Editor section mapper    | `src/lib/intake/services/section-content-mapper.ts`                           | `applySectionValue` replaces the full section object          |
| Preview flow             | `src/pages/dashboard/invitaciones/[id]/preview.astro`                         | Uses `computeEffectiveContent`                                |
| Publish flow             | `src/lib/intake/services/publishing.service.ts`                               | Uses `computeEffectiveContent` before mapping                 |
| Adapter                  | `src/lib/adapters/event.ts`                                                   | Resolves assets to view model                                 |
| Renderer                 | `src/components/invitation/*.astro` / `.tsx`                                  | Component props                                               |

When adding or editing a section:

- Editor schema must include ALL fields that can exist in the section object, since
  `applySectionValue()` replaces the entire section on save. Fields absent from the editor schema
  are silently dropped.
- Any field rendered publicly must be either editable through the dashboard, intentionally
  SQL/demo-only, or explicitly documented as derived/render-time-only.
- Use `mapNestedToDraftContent()` for the reverse (published → draft) mapping. If a field is not
  mapped there, it is lost when restoring from published or when merging published into the editor.

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
