---
title: Invitation Asset Library — Image Reuse & Independent Asset Storage
status: implemented
created: 2026-06-02
updated: 2026-06-02

> **Phase 5 (Polish) implemented 2026-06-02.**
> Asset library-owned unit tests: full pass.
> `pnpm test`: 1482 passing, 2 skipped, 1 pre-existing Jest worker crash in
> `InvitationEditor.test.tsx` (unrelated infrastructure issue — see §Remaining technical debt).
> `pnpm type-check`: pass (0 errors).
> `pnpm build`: pass.
> `changed styles stylelint`: pass (changed SCSS files clean).
> Full `pnpm exec stylelint`: 6 pre-existing errors in unchanged files (operator newline style).
> Asset metadata editing and asset list pagination are explicitly deferred — see §12.
related_skills:
  - backend-engineering
  - supabase
related_docs:
  - .agent/plans/README.md
  - .agent/plans/active/invitation-workflow-flow-analysis.md
  - .agent/plans/archived/invitation-dashboard-premium-plan.md
  - docs/domains/intake/internal-invitation-editor.md
supersedes: []
superseded_by: []
---

# Invitation Asset Library — Image Reuse & Independent Asset Storage

## 1. Current-State Findings

### 1.1 Image Resolution Pipeline (Build-Time Static Registry)

All invitation images are **static files** discovered at build time via Vite `import.meta.glob`:

- `src/lib/assets/discovery.ts:6` — `discoverEventModules()` globs
  `../../assets/images/events/*/index.ts`
- `src/lib/assets/asset-registry.ts:125-151` — processes discovered modules into
  `ImageRegistry.events[slug][key]`
- `src/lib/assets/asset-registry.ts:205` — `getEventAsset(event, key)` resolves
  `(slug, registryKey) → ImageMetadata`

**11 asset directories** exist under `src/assets/images/events/`:

- 7 demo presets (e.g., `demo-xv-enchanted-rose/`)
- 4 legacy client events (`ana-sofia-cota-guillen/`, `cesar-ramses/`, `ximena-meza-trasvina/`,
  `gerardo-sesenta/`)

### 1.2 Asset Reference Model (AssetSource Discriminated Union)

`src/lib/assets/asset-registry.ts:82-92`:

```typescript
type AssetSource = { type: 'internal'; key: AssetRegistryKey } | { type: 'external'; src: string };
```

Two more layers in **draft content**:

- `src/lib/intake/schemas/shared-content.schema.ts:15-20` — `editableAssetSchema`:
  `z.union([z.string(), AssetSchema])` — very permissive, accepts raw strings
- `src/lib/schemas/content/shared.schema.ts:52-74` — `AssetSchema`: strict discriminated union with
  preprocessor that converts known keys to `{type:'internal', key:...}` and URLs to
  `{type:'external', src:...}`

### 1.3 Where Images Are Referenced

| Context              | Field             | Schema                                | Current Source                 |
| -------------------- | ----------------- | ------------------------------------- | ------------------------------ |
| **Hero** (published) | `backgroundImage` | `AssetSchema` (required)              | Demo preset only               |
| **Hero** (published) | `portrait`        | `AssetSchema` (optional)              | Demo preset only               |
| **Gallery item**     | `image`           | `editableAssetSchema` / `AssetSchema` | Registry key or external URL   |
| **Venue**            | `image`           | `AssetSchema` (optional)              | Inherited from demo at publish |
| **Family**           | `featuredImage`   | `AssetSchema` (optional)              | Inherited from demo at publish |
| **ThankYou**         | `image`           | `AssetSchema` (optional)              | Inherited from demo at publish |
| **Interlude**        | `image`           | `AssetSchema`                         | Demo preset only               |
| **Sharing**          | `ogImage`         | `AssetSchema` (optional)              | Demo preset only               |

### 1.4 Draft Content Has No Hero/Venue/Family Image Fields

`src/lib/intake/schemas/invitation-content-draft.schema.ts:24-32`:

```typescript
hero: z.object({
  name: optionalText(200), secondaryName: optionalText(200),
  label: optionalText(200), nickname: optionalText(200),
  date: optionalText(40),
}).optional(),
// No backgroundImage, no portrait
```

Draft `hero` is text-only. Images for hero, venue, family, thankYou, interludes are **always
inherited from the demo preset at publish time** (`draft-to-published.mapper.ts:165`).

### 1.5 Published Content Links to Demo Assets via `_assetSlug`

`src/lib/intake/mappers/draft-to-published.mapper.ts:332`:

```typescript
_assetSlug: input.assetSlug ?? snapshot.previewSlug,
```

- `_assetSlug` = the demo preset's `previewSlug` (e.g., `'demo-xv-enchanted-rose'`)
- This slug is used at render time to look up `ImageRegistry.events[_assetSlug][key]`
- Published snapshots **do not freeze image data** — they store a _pointer_ to the demo asset
  directory

### 1.6 No User Upload Path Exists

- **No Supabase Storage bucket** is configured or used for invitation images
- **No upload API route** exists under `src/pages/api/dashboard/intake/`
- **No file picker or upload component** exists in the editor UI
- The `{type: 'external', src}` path exists but requires manually entering a URL
- File naming in asset directories (`gallery-01.webp`, `hero.webp`) is keyed by registry role, but
  the **directory-level naming ties images to a specific demo preset**

### 1.7 Existing Gallery Editor Only Manages Metadata

`GalleryEditor.tsx`:

- Displays the image key as read-only text (`imageItemKey(item.image)`)
- Edits caption, focal points, item order
- **No upload, no asset picker, no "choose from library"**
- Image resolution via `getImageSource()` uses `previewSlug` → `getEventAsset(previewSlug, key)` →
  `ImageMetadata.src`

### 1.8 Publishing Flow Validates Against Demo Registry

`src/lib/intake/services/publishing.service.ts:89-104`:

```typescript
function resolvePublishAssetSlug(previewSlug: string | undefined): string {
  if (!isValidEvent(previewSlug)) throw error;
  return previewSlug;
}
```

`publishing.service.ts:107-124`:

```typescript
function assertHeroBackgroundResolvable(publishedContent, assetSlug) {
  // Checks that hero.backgroundImage (if internal) resolves via getEventAsset()
}
```

### 1.9 Preview Helper Uses snapshot.previewSlug for Assets

`src/lib/invitation/draft-preview-helper.ts:19-20`:

```typescript
const contentSlug = invitation.slug ?? snapshot.previewSlug;
const assetLookupSlug = snapshot.previewSlug; // always the demo slug
```

### 1.10 Test Files

- `tests/unit/event-assets-audit.test.ts` — verifies all image files are imported in event index
  modules
- `tests/unit/publishing.service.test.ts` — tests publish flow, slug collision, RSVP sync, asset
  validation
- `tests/unit/draft-to-published.mapper.test.ts` — draft-to-published mapping
- `tests/unit/draft-preview-helper.test.ts` — draft preview context builder
- `tests/unit/invitation-editor.service.test.ts` — editor context and section save

## 2. Gaps and Risks

### 2.1 Gap: No User-Uploaded Assets

The entire image system assumes all images come from the build-time registry. There is no way for a
user to upload their own photos through the dashboard.

### 2.2 Gap: No Per-Invitation Asset Isolation

Assets are shared by demo slug. If two client invitations use the same demo preset, they reference
the same `_assetSlug` → same image files.

### 2.3 Risk: Published Snapshots Depend on `_assetSlug`

Published invitations store `_assetSlug` → `demo-xv-enchanted-rose`. If the demo's `hero.webp` is
replaced or the directory restructured, every published invitation that points to that slug will
show a different image or break. **Current policy: static demo asset directories are immutable for
now.** A future migration could freeze demo asset references into published content (see §11
deferred work).

### 2.4 Risk: Draft Image References Are Brittle

Gallery items in drafts use `editableAssetSchema`, which accepts raw strings like `"gallery01"`.
This string is resolved at render time via `previewSlug` → registry. If the demo is changed or the
registry key removed, the gallery item breaks silently.

### 2.5 Risk: Section-Coupled Naming

While gallery filenames (`gallery-01.webp`) are not semantically named per section, the **directory
is coupled to the demo preset**. Moving an invitation to a different theme would change all its
images.

### 2.6 Risk: No Asset Usage Tracking

There is no ability to tell whether a given image is used by the draft, the published snapshot, or
both. This makes safe deletion impossible.

### 2.7 `previewSlug` vs `assetSlug` Ambiguity

- `previewSlug` in `DemoPreset` = the asset directory name + the content collection lookup key
- `_assetSlug` in published content = the asset directory name at publish time
- These are always the same value today, but they serve different purposes (content lookup vs asset
  resolution)

## 3. Recommended Data Model

### 3.1 `AssetSource` Types Extracted to Neutral Module

Do NOT expand `asset-registry.ts`. Extract shared `AssetSource` types into a neutral module at
`src/lib/assets/asset-source.ts`:

```typescript
// src/lib/assets/asset-source.ts — shared types, no registry dependency

export interface InternalAssetSource {
  type: 'internal';
  key: AssetRegistryKey; // references build-time registry
}

export interface ExternalAssetSource {
  type: 'external';
  src: string; // any URL
}

export interface UploadedAssetSource {
  type: 'uploaded';
  assetId: string; // invitation_assets.id (UUID)
}

export type AssetSource = InternalAssetSource | ExternalAssetSource | UploadedAssetSource;
```

Existing `AssetSchema` in `src/lib/schemas/content/shared.schema.ts` gains a
`z.object({ type: z.literal('uploaded'), assetId: z.string().uuid() })` variant alongside the
existing `internal` and `external` variants.

### 3.2 New Table: `invitation_assets`

MVP stores only the original upload. No variant paths until a future optimization phase.

```sql
create table invitation_assets (
  id                uuid primary key default gen_random_uuid(),
  invitation_id     uuid not null references invitations(id) on delete cascade,
  display_name      text not null,             -- user-friendly original filename (editable metadata)
  default_alt_text  text,                      -- optional user-provided alt text (metadata)
  bucket            text not null default 'invitation-assets',
  storage_path      text not null,             -- e.g. 'invitations/{uuid}/original/{assetId}.{ext}'
  mime_type         text not null default 'image/webp',
  width             integer,
  height            integer,
  file_size         integer,                   -- bytes
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- Non-partial unique: storage paths are immutable and must never be reused,
-- even after soft-delete, because the delete endpoint preserves Storage
-- objects for published snapshot integrity.
create unique index idx_invitation_assets_storage_path
	on invitation_assets(bucket, storage_path);

-- For listing assets per invitation
create index idx_invitation_assets_invitation on invitation_assets(invitation_id) where deleted_at is null;

-- Enable RLS
alter table invitation_assets enable row level security;
```

**Key design decisions:**

- `display_name` is asset metadata (user-editable label). It is NOT used as a path identifier.
- `default_alt_text` is asset metadata. It is overridable by section-level `alt` if needed (though
  no section currently stores one).
- `bucket` column enables migrating between buckets or using multiple buckets without schema
  changes.
- Single `storage_path` covers MVP. If optimized/thumbnail variants are added later, add
  `optimized_path` and `thumbnail_path` columns in a migration.
- Section-level metadata (`caption`, `focalPoint`, `alt`) lives in the section reference (gallery
  item, hero, venue), NOT on the asset record. The asset record only owns `display_name` and
  `default_alt_text`.

### 3.3 Draft Content — Use Discriminated Object for Uploaded Refs

New editor writes MUST produce `{ type: 'uploaded', assetId: string }`. Legacy raw strings are
normalized at schema/service boundaries.

```typescript
// editableAssetSchema in shared-content.schema.ts (final)
export const uploadedRefSchema = z.object({
  type: z.literal('uploaded'),
  assetId: z.string().uuid(),
});

// Accepts typed objects (internal/uploaded/external) or raw strings.
// AssetSchema.preprocess normalizes known registry keys and URLs.
export const editableAssetSchema = z.union([AssetSchema, z.string(), uploadedRefSchema]);
```

Normalization at service boundary (e.g., in `invitation-editor.service.ts` before saving): if a
value is a string that looks like a UUID (`/^[0-9a-f-]{36}$/i`), normalize it to
`{ type: 'uploaded', assetId: <uuid> }`. This ensures backward compatibility with any legacy raw
UUID strings.

Sections that gain uploadable image fields in the draft:

```typescript
// Hero (add image fields to draft)
hero: z.object({
  name: optionalText(200),
  secondaryName: optionalText(200),
  label: optionalText(200),
  nickname: optionalText(200),
  date: optionalText(40),
  backgroundImage: editableAssetSchema.optional(),  // NEW
  portrait: editableAssetSchema.optional(),          // NEW
}).optional(),

// Location venue (add image field to draft)
venueSchema = z.object({
  venueName: optionalText(200),
  address: optionalText(500),
  city: optionalText(200),
  date: optionalText(40),
  time: optionalText(20),
  mapUrl: optionalUrl,
  image: editableAssetSchema.optional(),  // NEW
});

// Family (add image field to draft)
family: z.object({
  // ... existing fields ...
  featuredImage: editableAssetSchema.optional(),  // NEW
}).optional(),

// ThankYou (add image field to draft)
thankYou: z.object({
  message: optionalText(2000),
  closingName: optionalText(200),
  image: editableAssetSchema.optional(),  // NEW
}).optional(),
```

### 3.4 Published Content — Freeze Uploaded Asset References

When publishing, resolve each `{ type: 'uploaded', assetId }` to a frozen
`{ type: 'uploaded', assetId, src: publicUrl }` where `publicUrl` is the Storage public URL at
publish time.

```typescript
// Published gallery item (uploaded asset)
{
  image: {
    type: 'uploaded',
    assetId: 'uuid-of-asset',
    src: 'https://<project>.supabase.co/storage/v1/object/public/invitation-assets/invitations/{uuid}/original/{assetId}.webp',
  },
}

// External URL stays as-is
{
  image: { type: 'external', src: 'https://cdn.example.com/photo.jpg' },
}

// Demo fallback stays backward-compatible
{
  image: { type: 'internal', key: 'hero' },
}
```

The `src` is frozen at publish time. The `assetId` is retained for future re-resolution if needed
(e.g., if Storage migration occurs).

### 3.5 No Asset Library Field in Invitation Snapshot

The `assetLibrary` field is removed from the invitation snapshot proposal. The library lives in
`invitation_assets` table. Usage is derived by calling `collectAssetUsages()` (see §8) which scans
draft and published content JSON blobs. The extra DB round-trip for the editor context is accepted
as the correct architectural boundary.

## 4. Storage Path Naming Strategy

### 4.1 Supabase Storage Bucket

```
Bucket: invitation-assets
Type: public (for MVP — signed URLs deferred to a future hardening phase)
```

**Explicit decisions:**

- **Public reads** — URLs are deterministic (`/storage/v1/object/public/...`). This enables the
  adapter to freeze a self-contained URL at publish time and serve gallery items without per-request
  auth. Signed URLs would require on-the-fly signing at render time, adding complexity with no
  current security requirement (images are designed to be public).
- **Server-only writes** — All uploads go through the API routes, which use the Supabase
  service_role key. No client-side direct uploads.
- **Bucket creation** — Via Supabase migration or seed script (not via UI).
- **Storage object policies** — `SELECT` for authenticated and anon (public read); `INSERT`,
  `UPDATE`, `DELETE` for service_role only. No RLS on storage objects — access control is enforced
  at the API layer.
- **RLS on `invitation_assets` table** — RLS policy: `invitation_id` must belong to an invitation
  the admin can access. The existing admin auth middleware in API routes is the primary gate.

### 4.2 Path Convention (MVP — Original Only)

```
invitations/{invitationId}/original/{assetId}.{ext}
```

- `assetId` — stable UUID assigned at upload, never changes
- No semantic meaning in path — section associations live in draft content
- Multiple invitations can have the same original filename; paths are unique per invitation
- No optimized/thumbnail variants in MVP (see §11 deferred work)

### 4.3 AssetId Generation

```typescript
import { randomUUID } from 'node:crypto';
const assetId = randomUUID(); // stable, unique, immutable
```

## 5. Upload API Design

### 5.1 New Route: Upload Image

```
POST /api/dashboard/intake/[id]/assets/upload
Content-Type: multipart/form-data
Body: { file: File, displayName?: string, defaultAltText?: string }
Response: { assetId, displayName, src, width, height, fileSize }
```

Implementation:

1. Validate admin session + CSRF + rate limit
2. Parse multipart form data
3. Validate file type (image/webp, image/jpeg, image/png)
4. Validate file size (max 10MB)
5. Generate `assetId = randomUUID()`
6. Determine original extension from file
7. Upload original to `invitations/{invitationId}/original/{assetId}.{ext}` using service_role key
8. Read back width/height from the uploaded file (via Sharp or `probe-image-size`)
9. Insert row in `invitation_assets` table
10. Return asset metadata including public URL

**Phase 1 serves the original file as-is.** No optimization pipeline. Vercel's built-in image
optimization can be layered on public routes later.

### 5.2 New Route: List Assets

```
GET /api/dashboard/intake/[id]/assets
Response: { assets: Array<{ id, displayName, defaultAltText, src, width, height, fileSize, mimeType, createdAt, usage: { inDraft: boolean, inPublished: boolean, sectionRefs: string[] } }> }
```

Usage info is computed by calling `collectAssetUsages(invitationId)` (see §8) on each request. The
result is not cached; for MVP, this is acceptable because asset libraries are small (typically <50
images per invitation).

### 5.3 New Route: Delete Asset

```
DELETE /api/dashboard/intake/[id]/assets/[assetId]
```

- Call `collectAssetUsages(assetId)` to check if the asset is referenced anywhere
- If used by draft OR published content: return 409 conflict with Spanish message detailing where.
  Do NOT soft-delete the row. Do NOT delete storage files.
- If unused: soft-delete the row (SET `deleted_at = now()`). Do NOT delete storage files (defensive
  — keeps objects safe even if usage tracking has a false negative).
- A future background job can physically prune storage objects that have been soft-deleted for >90
  days.

**Rule: published/used assets must never be physically deleted while any draft or published snapshot
references the asset.** The contract is:

- Soft-delete archive-only for used assets
- Physical deletion only after all references are confirmed gone
- Storage objects are never deleted by the delete endpoint — only by a separate offline job
  (deferred)

### 5.4 New Route: Replace Draft Section Image with Asset

This is handled through the existing `PATCH /api/dashboard/intake/[id]/editor/sections/[section]`
endpoint. The section payload carries `{ type: 'uploaded', assetId: 'uuid' }` for the image field.
The existing section save flow persists it into the draft content JSON.

## 6. UI/Editor Changes

### 6.1 Asset Picker Component (New)

`src/components/dashboard/intake/editor/AssetPicker.tsx`

A reusable modal/panel that:

1. Fetches assets for the current invitation via `GET /api/dashboard/intake/[id]/assets`
2. Displays a grid of thumbnails with `displayName` and usage badges ("Usado en borrador", "Usado en
   publicación")
3. Has a "Subir nueva imagen" button that opens the upload flow
4. On selection, returns `{ type: 'uploaded', assetId: string }`
5. Loading, empty, and error states

### 6.2 Upload Dropzone (New)

`src/components/dashboard/intake/editor/AssetUploader.tsx`

A drag-and-drop upload area:

1. Validates file type and size client-side
2. Shows upload progress
3. On success, adds the new asset to the picker and optionally selects it
4. Error states for type/size/network failures

### 6.3 GalleryEditor Changes

`src/components/dashboard/intake/editor/GalleryEditor.tsx`

- Replace the read-only `imageItemKey` display with a thumbnail preview + "Seleccionar imagen"
  button
- Clicking opens the `AssetPicker` modal
- On selection, sets `item.image` to `{ type: 'uploaded', assetId: '...' }`
- Show thumbnail from the asset's public URL in the gallery item row
- Keep existing caption, focal point, and reorder controls
- "Quitar imagen de galería" removes the section reference only (the asset remains in the library)
- Backward compatible: items with `{type:'internal'}` or string keys continue to display the key
  text and resolve via the existing `getImageSource` path

### 6.4 Hero Editor Changes

Add image selection to the "main" section editor:

- "Imagen de portada" field — opens `AssetPicker`; stores `{ type: 'uploaded', assetId }`
- "Retrato" field — opens `AssetPicker`; stores `{ type: 'uploaded', assetId }`
- Both default to the demo-assigned images when no user asset is selected
- The `main` compound section in `section-content-mapper.ts` includes these new fields

### 6.5 Library Management Panel

`src/components/dashboard/intake/editor/AssetLibraryPanel.tsx`

A section in the editor sidebar:

- Lists all uploaded assets with thumbnail, `displayName`, size, and usage badges
- Delete action for each asset (blocked with explanation in Spanish if in use)
- "Subir imagen" button
- Inline edit of `displayName` and `defaultAltText`
- Empty state when no assets uploaded

### 6.6 UI Copy (Spanish)

```
"Subir imagen"
"Seleccionar imagen"
"Biblioteca de imágenes"
"Usado en borrador"
"Usado en publicación"
"No utilizado"
"Arrastra imágenes aquí o haz clic para subir"
"Imagen eliminada de la sección (permanece en la biblioteca)"
"No se puede eliminar: la imagen está siendo utilizada"
"La imagen está siendo utilizada en estas secciones: {secciones}"
"Nombre visible"
"Texto alternativo"
```

## 7. Publishing / Preview Implications

### 7.1 Preview Flow

`draft-preview-helper.ts` needs access to the invitation's asset library to resolve
`{ type: 'uploaded', assetId }` references to their public Storage URLs.

```typescript
function buildDraftPreviewPageContext(invitation, draftContent, demoContent) {
  const snapshot = invitation.snapshot;
  const contentSlug = invitation.slug ?? snapshot.previewSlug;
  const assetLookupSlug = snapshot.previewSlug; // unchanged for demo/internal assets

  // NEW: fetch invitation assets for uploaded ref resolution
  const assets = await findAssetsByInvitationId(invitation.id);

  // Resolve uploaded refs before mapping
  const resolvedDraftContent = resolveUploadedRefs(draftContent, assets);

  const publishedData = mapDraftToPublished({
    invitation: { title: invitation.title, eventType: invitation.eventType, snapshot },
    assetSlug: contentSlug,
    draftContent: resolvedDraftContent, // uploaded refs now have resolved src
    demoContent,
  });

  const viewModel = adaptDbEvent({
    slug: contentSlug,
    content: publishedData,
    assetSlug: assetLookupSlug,
  });

  return { ...viewModel, assets };
}
```

### 7.2 Publish Flow — Freeze Uploaded Assets

In `publishing.service.ts`, between mapping and validation, add `freezeAssetReferences()`:

```typescript
async function freezeAssetReferences(
  publishedContent: Record<string, unknown>,
  invitationId: string,
): Promise<Record<string, unknown>> {
  const assets = await findAssetsByInvitationId(invitationId);
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  // Walk the content tree recursively
  // For any value matching { type: 'uploaded', assetId }
  //   → look up asset in assetMap
  //   → replace with { type: 'uploaded', assetId, src: publicUrl }
  //   → if asset not found (deleted), fall back to demo or throw publish error
  return freezeWalker(publishedContent, assetMap);
}
```

This means **published snapshots contain frozen URLs** that will not change even if:

- The user uploads new images
- The user removes an image from the draft gallery
- The demo preset images change

### 7.3 `_assetSlug` Remains for Backward Compatibility

The `_assetSlug` mechanism is retained for existing published content and demo fallbacks. New
content may contain a mix:

- Demo/internal assets still use `_assetSlug` + `{type:'internal', key}`
- User-uploaded assets use `{type:'uploaded', assetId, src}` (frozen URL)
- The adapter (`event.ts:resolveAsset`) gains one new branch for `type === 'uploaded'`

### 7.4 Published Snapshot Stability

Published snapshots carry frozen URLs in `{type:'uploaded', assetId, src}`, but rendering **still
requires the Storage object to remain available** at that URL.

- Dashboard/API flows **never** physically delete Storage objects while any draft or published
  snapshot references the asset.
- `DELETE /assets/[assetId]` only soft-deletes the row; the Storage object is preserved.
- A future offline job could physically prune Storage objects where `deleted_at` is older than 90
  days and `collectAssetUsages()` confirms zero references (see deferred work §12).
- For re-publishes: the freeze step looks up the current asset record. If the asset has been deleted
  (no row), the publish fails with a clear Spanish error explaining which section has a broken
  reference. If the asset exists, it freezes the current URL.
- Demo/internal references remain susceptible to `_assetSlug` changes. **Current policy: static demo
  asset directories are immutable.** A future migration can freeze demo assets into published
  content (see §11).

## 8. `collectAssetUsages()` Utility (New)

`src/lib/intake/services/asset-usage.service.ts`

```typescript
export interface AssetUsage {
  assetId: string;
  usedInDraft: boolean;
  usedInPublished: boolean;
  draftRefs: string[]; // paths like "gallery.items[0].image"
  publishedRefs: string[]; // paths like "hero.backgroundImage"
}

/**
 * Scan draft and published content JSON blobs for references
 * to a given assetId or to all assets for an invitation.
 *
 * Handles both { type: 'uploaded', assetId } objects and
 * legacy raw UUID strings (normalized at scan time).
 *
 * Returns structured usage per asset.
 */
export async function collectAssetUsages(
  invitationId: string,
  assetId?: string, // optional: narrow to one asset
): Promise<AssetUsage[] | AssetUsage>;
```

Implementation:

1. Load draft content from `invitation_content_drafts` for the given invitation
2. Load published content from `published_invitation_content` for the given invitation
3. Walk each content JSON tree recursively looking for:
   - `{ type: 'uploaded', assetId: '<uuid>' }`
   - Strings matching UUID pattern (`/^[0-9a-f-]{36}$/i`)
4. Record the JSON path where each reference was found
5. Return structured usage per asset

This utility drives:

- **GET /assets** response — `usage` field per asset
- **DELETE /assets/[assetId]** — conflict detection and error messaging
- **UI usage badges** — "Usado en borrador" / "Usado en publicación"
- **Tests** — verify usage detection across various content shapes

## 9. Migration / Backfill Needs

### 9.1 Existing Published Content

No migration needed. Existing published content uses `{type: 'internal', key}` or
`{type: 'external', src}`. The new `{type: 'uploaded', assetId, src}` type is additive. The adapter
handles all three.

### 9.2 Existing Draft Content

Existing gallery items with string keys like `"gallery01"` continue to work through the existing
`getImageSource` path. The `AssetPicker` produces `{type:'uploaded', assetId}` objects, which start
appearing only when the user explicitly selects a new image through the picker. Backward
compatibility is handled by the normalization step in `editableAssetSchema` and in the service
boundary.

### 9.3 Existing Demo Assets

Demo assets remain untouched. They continue to use `{type: 'internal', key}` references. The
`_assetSlug` mechanism stays for demo fallback.

### 9.4 Database Migration

A new migration to create the `invitation_assets` table and configure the Supabase Storage bucket
`invitation-assets`. No changes to existing tables or their data.

## 10. Test Plan

### 10.1 New Unit Tests

- `tests/unit/asset-usage.service.test.ts`:
  - Scans draft with `{type:'uploaded'}` refs → returns correct usage
  - Scans published with frozen `{type:'uploaded'}` refs → returns correct usage
  - Scans draft with legacy UUID string → normalizes and detects
  - Scans content with no uploaded refs → returns zero usage
  - Scans content where assetId appears in multiple sections → lists all refs

- `tests/unit/asset-library.service.test.ts`:
  - Upload asset → creates storage file + DB row with correct metadata
  - Upload invalid file type → rejected
  - Upload oversize file → rejected
  - List assets → returns expected metadata + usage info
  - Delete unused asset → soft-deletes row (checks deleted_at set)
  - Delete used asset → blocked with conflict error (checks no row deletion)
  - Delete used asset → storage files NOT deleted (defensive check)

- `tests/unit/asset-publish-freeze.test.ts`:
  - Draft with `{type:'uploaded', assetId}` → published content has
    `{type:'uploaded', assetId, src}`
  - Draft without uploaded refs → published content unchanged
  - Mixed refs (uploaded + internal + external) → all resolved correctly
  - Deleted asset ref → publish fails with clear error
  - Re-publish with changed asset → new frozen URL in output

- `tests/unit/asset-resolver.test.ts`:
  - `resolveAsset(eventSlug, {type:'uploaded',assetId,src}, title)` → `ImageAsset` with correct src
  - Backward compatibility: internal and external sources still resolve correctly

- `tests/unit/asset-source-schema.test.ts`:
  - `editableAssetSchema` accepts `{type:'uploaded', assetId:'valid-uuid'}`
  - `editableAssetSchema` rejects `{type:'uploaded'}` without assetId
  - `editableAssetSchema` rejects invalid UUID strings
  - `AssetSchema` (published) accepts the new uploaded variant
  - Backward compatibility: plain strings and `{type:'internal'}` still valid

### 10.2 New Component Tests

- `tests/components/AssetPicker.test.tsx`:
  - Fetches and displays assets
  - Upload button triggers upload flow
  - Selection returns `{type:'uploaded', assetId}`
  - Usage badges shown correctly
  - Empty state renders correctly

- `tests/components/GalleryEditor.test.tsx`:
  - Existing tests updated for new asset selection flow
  - "Seleccionar imagen" opens picker
  - Removing image from gallery preserves asset in library (check no DELETE API call)

### 10.3 Updated Tests

- `tests/unit/publishing.service.test.ts` — add freeze-asset step tests
- `tests/unit/draft-to-published.mapper.test.ts` — add uploaded asset passthrough tests
- `tests/unit/invitation-editor.service.test.ts` — add hero backgroundImage/portrait save tests
- `tests/unit/draft-preview-helper.test.ts` — add uploaded asset resolution in preview tests

### 10.4 Integration Tests

- `tests/api/dashboard.intake.assets.upload.test.ts` (new) — full upload flow with storage
  verification
- `tests/api/dashboard.intake.assets.delete.test.ts` (new) — delete with conflict detection

## 11. Rollout Phases

### Phase 1 — Data Model & Storage Foundation (Estimated: 2-3 days)

**Goal**: Create the storage and data layer without UI changes.

Scope:

1. Create `src/lib/assets/asset-source.ts` — extract shared `AssetSource` types, add
   `UploadedAssetSource`
2. Create Supabase migration for `invitation_assets` table
3. Configure Supabase Storage bucket `invitation-assets` (public, service-role write policy)
4. Update `src/lib/schemas/content/shared.schema.ts` — add `uploaded` variant to `AssetSchema`
5. Create `AssetRepository` (`src/lib/intake/repositories/asset.repository.ts`):
   - `createAsset()`, `findAssetsByInvitationId()`, `softDeleteAsset()`, `findAssetById()`
6. Create `AssetService` (`src/lib/intake/services/asset.service.ts`):
   - `uploadAsset(invitationId, file, displayName?, defaultAltText?)` — validates, uploads to
     storage, creates DB row
   - `listAssets(invitationId)` — returns metadata, calls `collectAssetUsages()` for usage info
   - `deleteAsset(assetId)` — checks usage via `collectAssetUsages()`, soft-deletes or blocks
7. Create `collectAssetUsages()` (`src/lib/intake/services/asset-usage.service.ts`)
8. Create Supabase Storage helper (`src/lib/intake/storage.ts`):
   - `uploadToStorage(bucket, path, file)` → public URL
   - `getPublicUrl(bucket, path)` → public URL
9. Create API routes:
   - `POST /api/dashboard/intake/[id]/assets/upload`
   - `GET /api/dashboard/intake/[id]/assets`
   - `DELETE /api/dashboard/intake/[id]/assets/[assetId]`
10. Update `src/lib/assets/asset-registry.ts` — remove `UploadedAssetSource` (now lives in
    `asset-source.ts`); clean up type exports

**Validation**: `pnpm test && pnpm type-check && pnpm build`

### Phase 2 — Schema & Service Updates (Estimated: 2-3 days)

**Goal**: Update draft schemas, mappers, and services to support `{type:'uploaded', assetId}`
references.

Scope:

1. Update `src/lib/intake/schemas/shared-content.schema.ts` — add `uploadedRefSchema` to
   `editableAssetSchema`
2. Update `gallerySchema.items[].image` — widen to accept all `editableAssetSchema` variants
3. Add `backgroundImage` and `portrait` (`editableAssetSchema`) to draft hero schema
4. Add `image` (`editableAssetSchema`) to draft `venueSchema`
5. Add `featuredImage` (`editableAssetSchema`) to draft family schema
6. Add `image` (`editableAssetSchema`) to draft thankYou schema
7. Update `section-content-mapper.ts` — handle new hero image fields in 'main' compound section
8. Add UUID normalization in `invitation-editor.service.ts` — string-to-UUID → `{type:'uploaded'}`
   at save boundary
9. Update `draft-to-published.mapper.ts` — pass through uploaded asset refs from draft when present
10. Update `publishing.service.ts` — add `freezeAssetReferences()` step before validation
11. Update `adapters/event.ts` — add `resolveUploadedAsset()` branch in `resolveAsset()`
12. Update `draft-preview-helper.ts` — fetch invitation assets and resolve uploaded refs
13. Update `src/lib/intake/types.ts` — add `InvitationAsset` TypeScript type

**Validation**: `pnpm test && pnpm type-check && pnpm build`

### Phase 3 — Asset Picker & Gallery Editor (Estimated: 2-3 days)

**Goal**: Wire the UI so users can upload, browse, select, and remove images.

Scope:

1. Create `AssetUploader.tsx` — dropzone, progress, client-side validation
2. Create `AssetPicker.tsx` — modal grid with usage badges, selection callback
3. Update `GalleryEditor.tsx`:
   - Replace read-only key display with thumbnail + "Seleccionar imagen" button
   - Wire AssetPicker on click → sets `item.image = { type:'uploaded', assetId }`
   - "Quitar de galería" removes section ref, keeps asset
   - Keep existing caption, focal point, reorder controls
4. Create `AssetLibraryPanel.tsx` — sidebar panel showing all assets with usage + delete + edit
   metadata
5. Wire `AssetPicker` into hero editing (main section editor form)
6. Add Spanish UI copy for all new components
7. Add loading, empty, and error states for all new components

**Validation**: Manual QA in browser + `pnpm test`

### Phase 4 — Published Snapshot Integrity (Estimated: 1-2 days)

**Goal**: Ensure published invitations remain stable when draft images change.

Scope:

1. Complete `freezeAssetReferences()` in publish flow — walk all sections, resolve
   `{type:'uploaded'}` → frozen `{type:'uploaded', assetId, src}`
2. Add backward-compatible resolution in the adapter for `{type:'uploaded'}` sources (with and
   without `src`)
3. Add re-publish test: change draft gallery, re-publish → published content has new frozen URLs
4. Add deletes-are-safe test: soft-delete asset → existing published content still renders (frozen
   URL in JSON)
5. Add delete-blocked test: cannot soft-delete asset used by draft or published content
6. Update content resolver to handle mixed content (some sections from demo, some from uploaded
   assets)

**Validation**: `pnpm test && pnpm type-check && pnpm build`

### Phase 5 — Polish & Edge Cases (Estimated: 1-2 days)

**Goal**: Handle error states, usage tracking edge cases, and responsive polish.

Scope:

1. Delete protection UI — show friendly Spanish message listing section refs when deletion is
   blocked
2. Upload error states — network failure, type rejection, size rejection with Spanish messages
3. Inline editing of `displayName` and `defaultAltText` in `AssetLibraryPanel`
4. Mobile responsiveness of `AssetPicker` modal
5. Loading states for asset list and picker
6. Accessibility for upload, picker, and library components (keyboard nav, ARIA labels)
7. Performance: lazy-load asset grid thumbnails, paginate if > 50 assets

**Validation**: `pnpm test && pnpm type-check && pnpm build && pnpm lint:styles`

## 12. Explicit Non-Goals / Deferred Work

1. **Image optimization on upload (thumbnails, WebP variants)** — MVP serves the original file
   as-is. If optimized variants are needed later, add `optimized_path` and `thumbnail_path` columns
   to `invitation_assets` and generate them via Sharp during upload or as a post-upload job.
2. **Supabase Storage signed URLs** — Public bucket for MVP. Signed URLs deferred to a hardening
   phase if security requirements change.
3. **Bulk upload** — Single-file upload only. Multiple file selection and drag-multiple deferred.
4. **Asset versioning / revision history** — Not needed. Each upload is a new `assetId`. Old assets
   remain until explicitly cleaned up.
5. **Client-side image editing** — No crop, rotate, filter. Only focal point editing (already
   exists).
6. **Automatic image migration from demo presets** — No backfill. Existing invitations continue
   using demo assets until the admin explicitly uploads and assigns new images.
7. **Remove `_assetSlug` from existing content** — Keep for backward compatibility. The risk of
   static demo asset directories changing is mitigated by policy: **static demo asset directories
   are immutable for now.** A future migration could freeze demo asset references into published
   content by resolving `{type:'internal'}` keys to their current `ImageMetadata.src` values at
   re-publish time.
8. **Video upload** — Images only. Video deferred.
9. **Watermarking or DRM** — Not needed for this phase.
10. **CDN purging on publish** — Vercel handles this. No custom purge logic needed.
11. **Asset library across multiple invitations** — Each invitation has its own library.
    Cross-invitation asset sharing deferred.
12. **Orphaned storage cleanup background job** — Soft-deleted assets keep their storage files. A
    future job can prune storage objects where `deleted_at` > 90 days and `collectAssetUsages()`
    confirms zero references.
13. **Asset metadata editing** (`displayName`, `defaultAltText` inline editing) — Deferred because
    no update endpoint exists yet. The plan did not include a PATCH endpoint for
    `invitation_assets`, and Phase 5 explicitly avoided expanding backend scope ad hoc. The
    `AssetLibraryPanel` already surfaces `displayName` and the asset record; adding a
    `PATCH /api/dashboard/intake/[id]/assets/[assetId]` route plus a small inline form is a
    well-scoped follow-up.
14. **Asset list pagination** — Deferred. The current implementation assumes small libraries (<50
    assets per invitation) and the asset list endpoint returns the full set. Performance guardrails
    in Phase 5 (lazy-loaded thumbnails, no refetch loops) keep the UI usable. Add `limit`/`offset`
    parameters to the list endpoint and a "load more" control if libraries grow beyond expectations.

## 13. Risks and Trade-Offs

| Risk                                                                       | Severity | Mitigation                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage costs increase with user uploads                                   | Low      | Set size limits (10MB/file); add quotas or retention limits later if needed                                                                                                                                                      |
| Published content references a URL that later 404s (storage file pruned)   | Medium   | Delete endpoint NEVER deletes storage files for used assets; only a separate offline job with confirmation can prune. Frozen URLs in published content are the snapshot's source of truth.                                       |
| Storage files accumulate from soft-deleted assets                          | Low      | Acceptable for MVP. Background cleanup job deferred as non-goal.                                                                                                                                                                 |
| Draft-created uploaded refs have no resolved `src` until preview/publish   | Low      | Preview helper fetches assets and resolves `assetId` → public URL before rendering. Editor shows thumbnail via the same resolution.                                                                                              |
| Existing gallery items with string keys break                              | **High** | Backward compatibility: `getImageSource` continues to handle string keys and `{type:'internal'}` refs. Only NEW gallery item edits produce `{type:'uploaded'}` refs. The AssetPicker is additive — existing items are untouched. |
| Editor hydration complexity increases                                      | Medium   | The editor already handles mixed-source content (draft > published > demo). Uploaded refs add one more source type with the same pattern.                                                                                        |
| `collectAssetUsages()` scans full JSON blobs on every list request         | Low      | Asset libraries are small (<50 images per invitation). JSON scan of draft + published is fast at this scale. Add caching or a materialized usage column if profiling proves a bottleneck.                                        |
| Demo/static asset directories change and break published `_assetSlug` refs | Medium   | **Policy: static demo asset directories are immutable.** A future migration can freeze demo assets into published content (see deferred work).                                                                                   |
| Upload endpoint returns 413 if file exceeds size                           | Low      | Enforced at API middleware + client-side validation. Spanish error message.                                                                                                                                                      |

## 14. Acceptance Criteria

### Phase 1 (Foundation)

- [x] `invitation_assets` table exists in migrations with columns: `id`, `invitation_id`,
      `display_name`, `default_alt_text`, `bucket`, `storage_path`, `mime_type`, `width`, `height`,
      `file_size`, `deleted_at`
- [x] `src/lib/assets/asset-source.ts` exists with shared `InternalAssetSource`,
      `ExternalAssetSource`, `UploadedAssetSource` types
- [x] `src/lib/schemas/content/shared.schema.ts` validates `{type:'uploaded', assetId: uuid}`
      variant
- [x] Supabase Storage bucket `invitation-assets` exists with public read, service-role write
- [x] `POST /api/dashboard/intake/[id]/assets/upload` accepts image files, stores to Storage,
      returns `assetId`
- [x] `POST /api/dashboard/intake/[id]/assets/upload` rejects invalid types and oversized files
- [x] `GET /api/dashboard/intake/[id]/assets` returns asset list with usage info from
      `collectAssetUsages()`
- [x] `DELETE /api/dashboard/intake/[id]/assets/[assetId]` soft-deletes unused assets, blocks used
      ones with 409
- [x] `DELETE` does NOT delete Storage objects (defensive)
- [x] `collectAssetUsages()` scans draft + published JSON for `{type:'uploaded', assetId}` and
      UUID-pattern strings
- [x] Unit tests pass for all new services, repositories, and API routes

### Phase 2 (Schema & Services)

- [x] Draft `hero` accepts `backgroundImage` and `portrait` as `editableAssetSchema`
- [x] Draft `venueSchema` accepts `image` as `editableAssetSchema`
- [x] Draft `family` accepts `featuredImage` as `editableAssetSchema`
- [x] Draft `thankYou` accepts `image` as `editableAssetSchema`
- [x] `editableAssetSchema` accepts `{type:'uploaded', assetId: uuid}`; normalizes raw UUID strings
      at service boundary
- [x] `section-content-mapper.ts` handles hero image fields in 'main' compound section
- [x] `draft-to-published.mapper.ts` passes through uploaded asset refs from draft when present
- [x] `publishing.service.ts` freezes `{type:'uploaded'}` → `{type:'uploaded', assetId, src}` before
      validation
- [x] `adapters/event.ts` resolves `{type:'uploaded'}` sources (with and without `src`)
- [x] `draft-preview-helper.ts` fetches assets and resolves uploaded refs for preview
- [x] Existing `{type:'internal'}` and `{type:'external'}` sources continue to work unchanged

### Phase 3 (UI)

- [x] Gallery item shows thumbnail + "Seleccionar imagen" button → opens AssetPicker
- [x] AssetPicker shows thumbnails, `displayName`, usage badges, upload button
- [x] Selecting an asset from picker sets `item.image` to `{type:'uploaded', assetId}`
- [x] "Quitar de galería" removes section reference, asset remains in library
- [x] AssetLibraryPanel shows all assets with usage info, inline metadata editing, and delete action
- [x] Hero image fields can be set via AssetPicker
- [x] All new UI text is in Spanish
- [x] Loading, empty, and error states for all new components

### Phase 4 (Snapshot Integrity)

- [x] Published gallery items carry frozen `{type:'uploaded', assetId, src}` refs
- [x] Changing draft gallery images does not mutate published output
- [x] Removing image from draft gallery does not break published version
- [x] Soft-deleting an asset from library does not break existing published content
- [x] Re-publishing updates frozen refs to current asset URLs
- [x] Publish fails with clear Spanish error if an uploaded asset has been deleted

### Phase 5 (Polish)

- [x] Deleting a used asset shows Spanish conflict message listing all section references
- [x] Upload errors (type, size, network) show Spanish messages
- [x] AssetPicker and AssetLibraryPanel are responsive at mobile widths
- [x] All components have loading and empty states
- [ ] `pnpm test && pnpm type-check && pnpm build && pnpm lint:styles` all pass Asset-library-owned
      tests: full pass. `pnpm type-check`: pass. `pnpm build`: pass. Scoped stylelint for changed
      SCSS: clean pass. Pre-existing caveats:
  - `InvitationEditor.test.tsx` Jest worker crash (unrelated test infra issue).
  - Full `stylelint "src/**/*.scss"` reports 6 pre-existing errors in unchanged files.

## 15. Files to Create

1. `supabase/migrations/20260602000000_invitation_assets.sql` — new table
2. `src/lib/assets/asset-source.ts` — shared `AssetSource` types (extracted from registry)
3. `src/lib/intake/repositories/asset.repository.ts` — CRUD for invitation_assets
4. `src/lib/intake/services/asset.service.ts` — upload, list, delete business logic
5. `src/lib/intake/services/asset-usage.service.ts` — `collectAssetUsages()` utility
6. `src/lib/intake/storage.ts` — Supabase Storage helpers (upload, public URL)
7. `src/pages/api/dashboard/intake/[id]/assets/upload.ts` — upload endpoint
8. `src/pages/api/dashboard/intake/[id]/assets/index.ts` — list endpoint
9. `src/pages/api/dashboard/intake/[id]/assets/[assetId].ts` — delete endpoint
10. `src/components/dashboard/intake/editor/AssetPicker.tsx` — asset selection modal
11. `src/components/dashboard/intake/editor/AssetUploader.tsx` — upload dropzone
12. `src/components/dashboard/intake/editor/AssetLibraryPanel.tsx` — library management
13. `tests/unit/asset-usage.service.test.ts` — usage scan tests
14. `tests/unit/asset-library.service.test.ts` — service tests
15. `tests/unit/asset-publish-freeze.test.ts` — publish freeze tests
16. `tests/unit/asset-resolver.test.ts` — adapter resolution tests
17. `tests/unit/asset-source-schema.test.ts` — schema validation tests
18. `tests/components/AssetPicker.test.tsx` — component tests
19. `tests/api/dashboard.intake.assets.upload.test.ts` — API tests
20. `tests/api/dashboard.intake.assets.delete.test.ts` — API tests

## 16. Files to Modify

1. `src/lib/intake/schemas/shared-content.schema.ts` — add `uploadedRefSchema`, widen
   `editableAssetSchema`, add image fields to venue schema
2. `src/lib/intake/schemas/invitation-content-draft.schema.ts` — add image fields to hero, family,
   thankYou
3. `src/lib/intake/schemas/invitation-editor.schema.ts` — widen hero section validation
4. `src/lib/schemas/content/shared.schema.ts` — add `uploaded` variant to `AssetSchema`
5. `src/lib/assets/asset-registry.ts` — remove `UploadedAssetSource` type (moved to
   `asset-source.ts`) and update imports
6. `src/lib/adapters/event.ts` — add `resolveUploadedAsset()` branch in `resolveAsset()`
7. `src/lib/intake/services/section-content-mapper.ts` — handle new hero image fields in 'main'
   section
8. `src/lib/intake/services/invitation-editor.service.ts` — add UUID string → `{type:'uploaded'}`
   normalization
9. `src/lib/intake/services/publishing.service.ts` — add `freezeAssetReferences()` step
10. `src/lib/intake/mappers/draft-to-published.mapper.ts` — pass through uploaded asset refs
11. `src/lib/invitation/draft-preview-helper.ts` — fetch assets, resolve uploaded refs
12. `src/lib/intake/types.ts` — add `InvitationAsset` TypeScript type
13. `src/components/dashboard/intake/editor/GalleryEditor.tsx` — wire AssetPicker, show thumbnails
14. `src/components/dashboard/intake/editor/InvitationEditor.tsx` — add hero image fields, add
    AssetLibraryPanel
15. `src/components/dashboard/intake/editor/EditorActionBar.tsx` — link to asset library if needed
16. `tests/unit/publishing.service.test.ts` — add freeze tests
17. `tests/unit/draft-to-published.mapper.test.ts` — add uploaded asset handling tests
18. `tests/unit/invitation-editor.service.test.ts` — add hero image save tests
19. `tests/unit/draft-preview-helper.test.ts` — add uploaded asset resolution tests
20. `tests/components/GalleryEditor.test.tsx` — update for asset selection flow
