---
title: Invitation Asset Library — Library Visibility, Metadata Editing & Demo Asset Display
status: implemented
created: 2026-06-03
updated: 2026-06-03
phase: all
implemented:
  - Phase 1: Asset metadata editing, demo asset listing, draft-content-mapper fix
  - Phase 2: Section assignment UI, demo copy-on-write
  - Phase 3: Archive/restore hardening
related_skills:
  - backend-engineering
  - supabase
related_docs:
  - .agent/plans/archived/invitation-asset-library-plan.md
  - docs/domains/intake/internal-invitation-editor.md
supersedes:
  - invitation-asset-library-plan.md
superseded_by: []
---

# Invitation Asset Library Enhancement

## 1. Problem

The current asset library (implemented per the archived plan) is an MVP that:

- Lists only `invitation_assets` rows — demo preset images are invisible.
- Provides no way to edit asset metadata (`displayName`, `defaultAltText`) after upload.
- Shows only boolean usage flags ("Usado en borrador" / "Usado en publicación") instead of exact
  section+field paths.
- Loses image references when restoring published content to draft (`draft-content-mapper.ts` drops
  `hero.backgroundImage`, `hero.portrait`, `family.featuredImage`, `venue.image`, `thankYou.image`).
- Has no archive/restore workflow.

## 2. Scope

This plan covers:

- Asset metadata editing (PATCH endpoint, inline UI).
- Demo asset visibility in the library (read-only merge from build-time registry).
- Detailed usage-path display per asset.
- Fix image field loss in `draft-content-mapper.ts`.
- Archive/restore workflow.

## Deferred Work

The following remain for future iterations:

- Image optimization / variant renditions (thumbnails, WebP pipeline).
- Crop/filter metadata on assets (asset-level focal point, etc.).
- Cross-invitation asset sharing.
- Bulk upload.
- Orphaned storage cleanup (prune storage files for soft-deleted assets >90 days old).
- Discriminated union for `AssetLibraryItem` (refactor from `isDemo` to
  `source: 'uploaded' | 'demo'`).
- Pagination for asset list (currently returns all).
- Asset-level `defaultFocalPoint` column (deferred; section-level focal points are sufficient for
  now).

## 3. Implementation

### Phase 1 — Asset Metadata Editing & Library Visibility

#### DB/Migration changes

None. Current `invitation_assets` schema is sufficient.

#### Files to create

| File                                            | Purpose                                                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/intake/services/demo-asset.service.ts` | Discover demo preset assets from `ImageRegistry` for a given `previewSlug`. Return `{ key, displayName, src, width, height }[]`. |
| `tests/unit/demo-asset-service.test.ts`         | Verify demo asset discovery.                                                                                                     |
| `tests/unit/asset-metadata-update.test.ts`      | PATCH endpoint unit tests.                                                                                                       |
| `tests/unit/draft-content-mapper.test.ts`       | Verify image fields survive published→draft round-trip.                                                                          |
| `tests/components/AssetLibraryPanel.test.tsx`   | Component tests for rename, section-refs display, demo badge.                                                                    |
| `tests/unit/asset-list-response.test.ts`        | Verify `listAssets()` returns merged uploaded + demo entries.                                                                    |

#### Files to change

| File                                                           | Change                                                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/lib/intake/repositories/asset.repository.ts`              | Add `updateAsset(id, { displayName, defaultAltText })`.                                                     |
| `src/lib/intake/services/asset.service.ts`                     | Add `updateAssetMetadata()`. In `listAssets()`, merge demo assets by calling `demo-asset.service.ts`.       |
| `src/lib/intake/services/draft-content-mapper.ts`              | Fix `mapNestedToDraftContent` and `mapVenueToDraft` to pass through image fields.                           |
| `src/pages/api/dashboard/intake/[id]/assets/[assetId].ts`      | Add PATCH handler for metadata updates.                                                                     |
| `src/pages/api/dashboard/intake/[id]/assets/index.ts`          | Enrich response with demo assets. Pass full section refs.                                                   |
| `src/lib/intake/use-asset-library.ts`                          | Update `AssetItem` to include `isDemo`, `demoKey`, full `draftSectionRefs` / `publishedSectionRefs`.        |
| `src/lib/intake/types.ts`                                      | Add `DemoAssetEntry` type.                                                                                  |
| `src/components/dashboard/intake/editor/AssetLibraryPanel.tsx` | Inline-edit for displayName/defaultAltText. Collapsible section-refs list. Demo badge on read-only entries. |
| `src/components/dashboard/intake/editor/AssetPicker.tsx`       | Demo badge. Section-refs display.                                                                           |
| `src/lib/intake/labels.ts`                                     | Spanish copy for edit, save, demo badge, section-ref headings.                                              |

#### API changes

| Route                                         | Method | Change                                                                                                          |
| --------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `/api/dashboard/intake/[id]/assets/[assetId]` | PATCH  | Accept `{ displayName?, defaultAltText? }`. Returns updated asset.                                              |
| `/api/dashboard/intake/[id]/assets`           | GET    | Response items now include `isDemo`, `demoKey` (demo entries only), `draftSectionRefs`, `publishedSectionRefs`. |

#### Acceptance criteria

- [x] User can rename `displayName` on any uploaded asset; change persists.
- [x] User can edit `defaultAltText` on any uploaded asset.
- [x] Library panel shows demo preset images with "Imagen de demo" badge and no edit/delete.
- [x] Each asset shows exact sections+fields where it is used.
- [x] Restoring published→draft preserves all image refs (hero, family, venue, thankYou, gallery).
- [x] Gallery items with focal points and uploaded refs survive round-trip.
- [x] Spanish copy for all new UI strings.
- [x] `pnpm test && pnpm type-check && pnpm build` pass.

#### Rollback notes

- Revert `[assetId].ts` method dispatch to DELETE-only.
- Revert `listAssets()` to no demo merge.
- Revert `draft-content-mapper.ts` field additions.
- **Scope:** 4 source files.

#### Risks

| Risk                                                                 | Severity | Mitigation                                          |
| -------------------------------------------------------------------- | -------- | --------------------------------------------------- |
| Demo asset list may include stale entries after theme change         | Low      | Keys are resolved live from registry; no cache      |
| `draft-content-mapper.ts` fix conflicts with legacy published shapes | Low      | Only affects restoration flow; test with mixed data |

### Phase 2 — Section Assignment UI Completion

#### Scope

Add AssetPicker buttons to venue, family, thankYou sections. Wire copy-on-write for demo asset
selection.

#### Files created

| File                                                             | Purpose                                                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/pages/api/dashboard/intake/[id]/assets/import-from-demo.ts` | POST endpoint — copies demo image bytes to storage, creates invitation_assets row                    |
| `tests/unit/demo-asset-import.test.ts`                           | Import service tests (invalid key, missing invitation, missing slug, unresolvable demo key, success) |

#### Files changed

| File                                                          | Change                                                                                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/dashboard/intake/editor/InvitationEditor.tsx` | Added "Imagen del lugar" buttons for ceremony/reception, "Imagen familiar" for family, "Imagen de agradecimiento" for thankYou. Extended pickerField handler for these fields. |
| `src/components/dashboard/intake/editor/AssetPicker.tsx`      | Intercepts demo asset selection — POSTs to import-from-demo, then calls onSelect with new uploaded assetId. Shows "Copiando..." during import.                                 |
| `src/lib/intake/services/asset.service.ts`                    | Added `importDemoAsset()` — validates key, looks up invitation slug, fetches image bytes from built URL, uploads to storage, creates row.                                      |

#### Acceptance criteria

- [x] Venue ceremony/reception sections have "Seleccionar imagen" button that opens AssetPicker.
- [x] Family section has "Seleccionar imagen" button for featuredImage.
- [x] ThankYou section has "Seleccionar imagen" button for image.
- [x] Selecting a demo asset from the picker creates a copy in the invitation's asset library
      (copy-on-write).
- [x] Selecting an already-uploaded image does not create a duplicate.
- [x] Removing an image from a section preserves the asset in the library (no API call).
- [x] Spanish UI copy for all new labels.

### Phase 3 — Archive & Delete Hardening

#### Scope

Add archive restore, archive filter toggle in library view, safer archive/delete UX.

#### Files changed

| File                                                           | Change                                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------ |
| `src/lib/intake/repositories/asset.repository.ts`              | Added `findArchivedAssetsByInvitationId()`, `restoreAsset()`.                    |
| `src/lib/intake/services/asset.service.ts`                     | Added `restoreAsset()`. Modified `listAssets()` with `filter: 'active'           | 'archived'` param. |
| `src/pages/api/dashboard/intake/[id]/assets/index.ts`          | Supports `?filter=archived` query param.                                         |
| `src/pages/api/dashboard/intake/[id]/assets/[assetId].ts`      | Added POST handler for restore.                                                  |
| `src/lib/intake/use-asset-library.ts`                          | Added `filter` param.                                                            |
| `src/lib/intake/labels.ts`                                     | Spanish copy: "Activas", "Archivadas", "Restaurar", archive help text.           |
| `src/components/dashboard/intake/editor/AssetLibraryPanel.tsx` | Added archive/active toggle, restore button in archived view, archive help text. |
| `tests/unit/asset-archive-restore.test.ts`                     | Archive list, restore behavior, ownership validation.                            |

#### Acceptance criteria

- [x] `GET /assets?filter=active` returns non-archived uploaded assets plus demo entries.
- [x] `GET /assets?filter=archived` returns only soft-deleted uploaded assets.
- [x] `POST /assets/[assetId]` (restore) clears `deleted_at`, validates ownership and current state.
- [x] Archive toggle in UI switches between "Activas" and "Archivadas" tabs.
- [x] Archived view shows restore button, no inline edit, no section refs.
- [x] Used assets cannot be archived — blocked with section-refs message.
- [x] Demo assets cannot be archived/restored/deleted.
- [x] Archived assets cannot be assigned to sections.
- [x] Spanish copy for all archive/restore interactions.
