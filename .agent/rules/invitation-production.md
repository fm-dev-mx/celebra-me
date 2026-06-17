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

## Interlude Handling

Interludes are content-backed visual sections (full-image breaks between sections), NOT demo-only
decoration. They exist in published content as first-class data and must survive the full content
flow:

| Layer                    | File                                                  | Behavior                                                                                                                                                                                   |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Effective content merge  | `src/lib/intake/services/merge-content.service.ts`    | `mergePublishedWithDraft()` copies interludes after the `ALL_EDITOR_KEYS` loop. Priority: draft > published > demo (only when `allowDemoFallback`).                                        |
| Published → draft mapper | `src/lib/intake/services/draft-content-mapper.ts`     | `mapNestedToDraftContent()` preserves interludes verbatim from published content.                                                                                                          |
| Draft → published mapper | `src/lib/intake/mappers/draft-to-published.mapper.ts` | Reads `draftContent.interludes` first (from effective content), then falls back to `demoContent.interludes` for demo invitations.                                                          |
| Preview                  | `src/lib/invitation/draft-preview-helper.ts`          | `buildDraftPreviewPageContext()` passes `isDemo: invitation.kind === 'demo'` so demo invitations get demo-backfilled interludes; client invitations get interludes from effective content. |
| Publish                  | `src/lib/intake/services/publishing.service.ts`       | `computeEffectiveContent(draft, priorPublished)` preserves interludes from prior published content.                                                                                        |
| Public renderer          | `src/lib/adapters/event.ts`                           | `buildInterludes()` reads from `data.interludes` stored in published content.                                                                                                              |

Key design decisions:

- Interludes are **not** in `ALL_EDITOR_KEYS` — they are not editable section values in the
  dashboard editor. They are set via demo content (for demo invitations) or SQL patches (for client
  invitations).
- Interludes must survive re-publish: when a client invitation with interludes in `priorPublished`
  is re-published, the effective content preserves them through `mergePublishedWithDraft` →
  `mapDraftToPublished`.
- To add interludes to a client invitation, include them in the published content JSON via SQL patch
  or demo publish. Do not assume interludes are demo-only.

## Section Contract Checks

Every editable section must be verified across ALL of these layers:

| Layer                    | File pattern                                                                  | What to check                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Draft schema             | `src/lib/intake/schemas/invitation-content-draft.schema.ts`                   | All fields the section needs                                                                    |
| Editor schema            | `src/lib/intake/schemas/invitation-editor.schema.ts`                          | All fields the editor form can save (must match draft schema)                                   |
| Published schema         | `src/lib/schemas/content/*.schema.ts`                                         | Publication validation                                                                          |
| Draft → published mapper | `src/lib/intake/mappers/draft-to-published.mapper.ts`                         | Field mapping                                                                                   |
| Published → draft mapper | `src/lib/intake/services/draft-content-mapper.ts` (`mapNestedToDraftContent`) | Reverse mapping                                                                                 |
| Editor section mapper    | `src/lib/intake/services/section-content-mapper.ts`                           | `applySectionValue` replaces the full section object                                            |
| Preview flow             | `src/pages/dashboard/invitaciones/[id]/preview.astro`                         | Uses `computeEffectiveContent`                                                                  |
| Publish flow             | `src/lib/intake/services/publishing.service.ts`                               | Uses `computeEffectiveContent` before mapping                                                   |
| Adapter                  | `src/lib/adapters/event.ts`                                                   | Resolves assets to view model                                                                   |
| Renderer                 | `src/components/invitation/*.astro` / `.tsx`                                  | Component props                                                                                 |
| Merge passthrough        | `src/lib/intake/services/merge-content.service.ts`                            | Non-editor keys (interludes) must be explicitly passed through after the `ALL_EDITOR_KEYS` loop |

When adding or editing a section:

- Editor schema must include ALL fields that can exist in the section object, since
  `applySectionValue()` replaces the entire section on save. Fields absent from the editor schema
  are silently dropped.
- Any field rendered publicly must be either editable through the dashboard, intentionally
  SQL/demo-only, or explicitly documented as derived/render-time-only.
- Use `mapNestedToDraftContent()` for the reverse (published → draft) mapping. If a field is not
  mapped there, it is lost when restoring from published or when merging published into the editor.

## Theme Vocabulary Contract

`src/lib/theme/theme-contract.ts` is the source of truth for shared invitation vocabulary: event
types, content section keys, render section keys, indication style variants, and theme preset names.

Do not duplicate these lists in schemas, adapters, UI components, or tests. Import the contract
instead.

High graph centrality for this file is expected: it is a small pure contract with no imports. Treat
it as shared vocabulary, not as a place for business logic.

## Asset Lifecycle

Three distinct slug concepts exist, and they may differ for the same invitation:

| Slug                          | Purpose                                                                       | Source                                                      |
| ----------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Route/event slug** (`slug`) | Public URL and RSVP event identity                                            | `invitations.slug`, used in route personalization           |
| **`_assetSlug`**              | Internal asset registry key matching `src/assets/images/events/<asset-slug>/` | Stored in published content JSON under `content._assetSlug` |
| **`previewSlug`**             | Demo/template reference metadata                                              | `invitations.snapshot.previewSlug` (from preset catalog)    |

Key invariants:

- Keep `_assetSlug` client-specific for real invitations. Do not point it at a demo asset directory.
- The asset registry at `src/lib/assets/asset-registry.ts` is populated via `import.meta.glob`. Each
  directory under `src/assets/images/events/{slug}/` must export a named `assets` key conforming to
  `EventAssets`. Missing or incomplete exports cause build failures or publish-time 422s.
- Asset keys are defined in `src/lib/assets/asset-keys.ts`.
- Asset resolution follows a 3-tier fallback (`resolveAssetSlug()` in
  `src/lib/assets/asset-slug.ts`): published `_assetSlug` → client slug composite → demo
  `previewSlug`.
- Published assets are frozen with a public URL; draft assets store only an `assetId`. See
  `freezeUploadedContentRefs()` for the freeze logic.
- Publish-time validation covers: asset slug resolution, event validity, uploaded asset existence,
  schema compliance, and internal asset resolvability. See `publishing.service.ts` and its test
  suite for the full guard list.

### Production SQL Diagnostics

`scripts/sql/repair-asset-slug.sql` contains 5 diagnostic SELECT queries that detect:

- Published content missing `_assetSlug`
- Draft content with empty `_assetSlug`
- Client content pointing to a demo invitation slug
- Non-missing client `_assetSlug` values needing app-side registry review
- Demo invitations with wrong `_assetSlug`

These queries are **read-only**. They must pass dry-run lint (`pnpm db:sql:lint`,
`pnpm db:prod:patch`) before any mutation is considered.

## Public Content Resolution

Public invitation routes must resolve content through the canonical content resolution path in
`src/lib/content/events.ts`, then adapt DB/content records through `src/lib/adapters/event.ts`.

Preserve the demo/client distinction when changing route resolution or content adaptation. Incorrect
resolver changes can cause public 404s, serve the wrong content source, or point client invitations
at demo assets.

## SQL Patch Safety

- Old production patches without manifest fields are historical records, not templates.
- Current production SQL patches must include the manual SQL manifest and pass:
  - `pnpm db:sql:lint -- --file <path>`
  - `pnpm db:prod:patch -- --file <path>`
- `pnpm db:prod:patch` is dry-run lint only; it must not be treated as execution approval.
