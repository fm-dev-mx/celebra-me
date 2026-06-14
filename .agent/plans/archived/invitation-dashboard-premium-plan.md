---
title: Internal Invitation Editor Premium UX Plan
status: implemented
created: 2026-05-31
updated: 2026-06-02
related_skills:
  - frontend-design
  - astro-patterns
  - testing
related_docs:
  - .agent/plans/README.md
  - docs/core/project-conventions.md
  - docs/core/architecture.md
supersedes:
  - admin-workflow-improvement.md
  - dashboard-creation-flow-plan.md
superseded_by: []
---

# Internal Invitation Editor Premium UX Plan

## 1. Purpose

Improve the internal invitation editor at `/dashboard/invitaciones/[id]/editar` so it behaves like a
compact production console: predictable scrolling, accurate gallery previews, deliberate editing
controls, compact repeated sections, clear dirty-state actions, and a safer publish workflow.

This is the canonical follow-up to the broader dashboard premium work. The list, creation route,
preview fallback chain, editor hydration, source badges, and global save action already exist in the
current codebase and are treated as baseline rather than planned work.

## 2. Constraints

- Keep visible application copy in Spanish. Keep implementation comments and technical plan text in
  English.
- Preserve Astro + TypeScript + SCSS conventions and the existing Astro-island server/client
  boundary.
- Keep explicit section saves and optimistic concurrency. Do not add autosave.
- Do not introduce database migrations unless implementation proves that persisted semantics cannot
  be expressed through the current draft and published-content records.
- Keep Vercel constraints in view: Linux-sensitive path casing, build-time content loading in Astro
  server code, client-side API calls through existing endpoints, and no environment-variable
  exposure.
- Do not add a generic template/default restore action unless a reliable default-source contract is
  defined later.

## 3. Current-State Findings

### 3.1 Existing Editor Foundation

- `InvitationEditor.tsx` owns local editable `content`, local editable `metadata`, a per-section
  `Set<string>` dirty tracker, save feedback, `beforeunload` protection, global sequential save, and
  publication feedback.
- `SectionCard.tsx` renders a consistent section shell with source badge, dirty state, save action,
  and section-level feedback.
- `useInvitationEditor.ts` delegates all mutations to dashboard API calls and refreshes React
  context after publish. This is the correct client/server boundary.
- `invitation-editor.service.ts` hydrates editable content with draft > published > demo priority,
  tracks section sources, validates section payloads with Zod, and preserves hydrated values when a
  single section is saved.
- `/dashboard/invitaciones/[id]/preview` already follows draft > published > empty fallback order
  and renders a neutral internal preview banner.

### 3.2 Must-Fix Bug: Competing Sticky Regions

`src/styles/dashboard/_intake.scss` defines both `.invitation-editor__action-bar` and
`.invitation-editor__header` as `position: sticky; top: 0`. The later action bar has `z-index: 20`
while the header has `z-index: 5`, so the action bar overlaps the header while scrolling. The
sidebar and section anchor offsets use a hard-coded `8.5rem`, which is fragile when warning copy
changes header height.

Recommended fix: keep only the compact action bar sticky. Make the informational editor header
static, keep warnings in normal flow, and reduce sticky offsets to a single action-bar-height custom
property. Apply the same property to sidebar `top` and card `scroll-margin-top`.

### 3.3 Must-Fix Bug: Persisted Gallery Focal Points Are Not Publicly Rendered

- `gallerySchema` accepts an item-level `focalPoint`.
- `GalleryEditor.tsx` edits `item.focalPoint`.
- `mapDraftToPublished()` carries gallery data through unchanged.
- `buildGallerySectionData()` preserves item data while resolving its asset.
- `PhotoGallery.astro` does not read or apply `item.focalPoint`.
- Public gallery SCSS defaults to `--gallery-item-image-position: center`, while several theme
  partials override `object-position` by item index.

The current editor therefore promises control that the public invitation does not reliably honor.
This is a behavioral defect, not only a preview mismatch.

Recommended fix: apply an item-level CSS custom property from `PhotoGallery.astro`, and update theme
fallback rules to use that property with their current position as fallback. Explicit persisted
values must win; theme defaults remain intact for old content.

### 3.4 Gallery Preview Is Structurally Inaccurate

`GalleryEditor.tsx` renders every image in a generic `4 / 3` editor card. Public rendering uses:

- `getLayoutClass(index, variant)` for `feature`, `wide`, and `standard` layout roles.
- Theme-specific gallery grid rules and aspect ratios.
- Mobile, tablet, and desktop column changes.
- Theme fallback crop positions, plus the persisted focal point after the bug fix.

Embedding the Astro public gallery component directly inside the React editor is not a good fit. The
editor should reuse the shared TypeScript layout strategy and a small presentation contract, then
render editor-specific responsive crop frames.

### 3.5 Focal Point Editing Needs a Direct Manipulation Path

`FocalPointControl.tsx` currently provides nine presets plus a free-form CSS position string. It is
technically valid but slow for face-safe crops and only shows one generic preview frame.

Recommended strategy:

- Store the existing CSS-compatible `focalPoint` string, usually normalized as `"NN% NN%"`.
- Add click/drag selection over the image preview to update percentage coordinates immediately.
- Keep the nine presets and advanced text input as accessible fallbacks.
- Show `Móvil` and `Escritorio` crop frames using the same public layout role and focal-point value.
- Do not add responsive gallery focal-point fields in Phase 2. One explicit anchor should first be
  made reliable across current public breakpoints. Add breakpoint-specific values only if visual QA
  proves one anchor cannot satisfy real photos.

### 3.6 Photo Notes Should Not Remain a Standalone Editor Destination

`photoNotes` is intake/production metadata. It is persisted in draft content, hydrated by the editor
service, used by draft review flows, and intentionally excluded from public publishing. Removing it
from schemas would create unnecessary migration risk.

Recommended fix: remove `Notas de fotografías` from the main sidebar and standalone card, then show
the existing fields as a collapsed `Notas internas` panel inside `Galería`. Save them independently
through the existing `photoNotes` section endpoint so gallery edits and internal notes keep separate
dirty states and concurrency semantics.

### 3.7 Dirty State Has Save but No Discard

The editor tracks local unsaved state but cannot restore the last loaded/saved values. Add a global
`Descartar cambios` action in the sticky action bar. It should restore all local dirty sections from
an in-memory baseline snapshot and clear their local errors/success messages after confirmation.

Per-section discard is an optional enhancement. Global discard is the first implementation because
it is easier to understand and matches the global dirty counter.

### 3.8 Restore Semantics Must Stay Separate

Three different actions must not be labeled as one generic restore feature:

| Action                            | Meaning                                                                               | Recommendation                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `Descartar cambios`               | Revert unsaved React state to the last loaded/saved baseline                          | Implement in Phase 1                                                  |
| `Restaurar desde versión pública` | Replace the editable draft with a new draft derived from the current published record | Implement only through a server endpoint with confirmation in Phase 4 |
| Restore template/defaults         | Replace content using a base demo or another defaults source                          | Keep out of scope                                                     |

The repo has a reliable published-content source for the second action. It has demo fallback
content, but the current code does not establish that a demo is a user-safe restore target after
client edits.

### 3.9 Visible Internal Values Leak into the UI

- `ItineraryEditor.tsx` renders raw icon keys such as `church`, `reception`, `waltz`, and `party`.
- The gifts editor renders raw item types such as `cash` in a read-only input.
- `PublicationSection.tsx` already maps public section-order values to Spanish labels.
- RSVP confirmation modes already use Spanish labels.

Add display-only Spanish label maps while preserving stored keys.

### 3.10 Repeated Sections Are Too Tall

Programa, Mesa de regalos, Galería, and Orden de secciones públicas use vertically stacked cards and
repeated `Subir` / `Bajar` controls. This is clear but creates form sprawl.

Recommended direction:

- Use compact row headers with ordinal, Spanish type/icon label, and grouped actions.
- Keep expanded fields available, but collapse completed rows by default where practical.
- Keep keyboard-accessible move buttons; drag-and-drop is optional and not required.
- Use small secondary actions and reserve accent buttons for save/publish decisions.

### 3.11 Publish Workflow Needs a Deliberate Gate

The action bar disables publish while local changes are dirty but it does not clearly explain all
disabled states, summarize changed sections, or require a confirmation step. Publishing already
performs authoritative server validation in `publishing.service.ts`.

Recommended fix:

- Keep server validation authoritative.
- Add a publish-readiness summary in the editor based on existing section state and local dirty
  state.
- Disable publish for unsaved local changes, no publishable draft, or an active mutation.
- Use a confirmation modal with changed-section summary, validation warnings, and a `Vista previa`
  link before the final `Publicar cambios` action.
- Surface server validation issue paths as section-oriented messages after a failed publish.

### 3.12 Visible Date/Time Formatting Is Inconsistent

`PublicationSection.tsx` uses `toLocaleString('es-MX')`, which can produce compact numeric output.
Prefer an explicit Spanish-friendly formatter for visible publication dates, for example
`2 de junio de 2026, 14:30`. Keep native `type="date"` and `type="time"` editor inputs for editing.

## 4. Scope Classification

### Must-Fix Bugs

1. Resolve sticky action-bar/header overlap and anchor offset drift.
2. Apply persisted gallery focal points to the public gallery.
3. Make gallery editor previews represent public layout roles and focal-point behavior.

### UX Quality Improvements

1. Add global `Descartar cambios`.
2. Move photo notes under Gallery as collapsed internal notes.
3. Add Spanish labels for itinerary icons and gift types.
4. Compact repeated rows and action hierarchy.
5. Add explicit Spanish-friendly visible publication date formatting.
6. Add publish readiness, confirmation, changed-section summary, and preview-before-publish.

### Data-Model / Schema Implications

1. No database migration is required for Phase 1-3.
2. Existing gallery `focalPoint` is sufficient for reliable shared anchoring.
3. `photoNotes` remains persisted and server-validated; only its editor placement changes.
4. Restore-from-published needs a new server mutation but can use existing draft and published
   records.
5. Responsive gallery focal-point fields are deferred until visual QA demonstrates a real need.

### Optional Enhancements

1. Per-section discard after the global discard flow proves useful.
2. Drag-and-drop ordering in addition to keyboard-safe move controls.
3. Breakpoint-specific gallery focal points after real-photo validation.
4. A dedicated gallery-only full-screen preview mode.

## 5. Implementation Phases

### Phase 1 - Structural Fixes and Editor Safety

**Goal:** fix scroll behavior and add clear local-state controls without changing persistence.

**Expected files:**

- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- `src/components/dashboard/intake/editor/EditorActionBar.tsx`
- `src/components/dashboard/intake/editor/SectionCard.tsx`
- `src/components/dashboard/intake/editor/GalleryEditor.tsx`
- `src/components/dashboard/intake/editor/ItineraryEditor.tsx`
- `src/components/dashboard/intake/editor/PublicationSection.tsx`
- `src/lib/intake/labels.ts`
- `src/styles/dashboard/_intake.scss`
- `tests/components/InvitationEditor.test.tsx`

**Steps:**

- [x] Add failing editor tests for global discard, preserved baseline state after saves, hidden
      standalone photo-notes navigation, Spanish itinerary labels, Spanish gift labels, and publish
      disable reasons.
- [x] Introduce an immutable local baseline for `content` and `metadata`; refresh the relevant
      baseline after a successful section or metadata save.
- [x] Add `Descartar cambios` to `EditorActionBar`, confirm only when dirty state exists, restore
      the baseline snapshot, and clear local dirty/errors/success state.
- [x] Move `photoNotes` rendering into a collapsed `Notas internas` panel under Gallery while
      retaining `dirty.has('photoNotes')` and `saveSection('photoNotes')`.
- [x] Remove `photoNotes` from `NAV_ITEMS`; continue showing its dirty state through the Gallery
      card and global dirty counter.
- [x] Add display-only label maps for itinerary icons and gift types. Render Spanish labels while
      preserving keys such as `church`, `waltz`, and `cash`.
- [x] Replace publication `toLocaleString('es-MX')` output with an explicit formatter.
- [x] Make the editor header static. Keep the action bar sticky and define one SCSS custom property
      for sidebar and anchor offsets.

**Validation:**

```bash
pnpm test -- tests/components/InvitationEditor.test.tsx
pnpm type-check
pnpm lint
pnpm lint:styles
```

**Risks and trade-offs:**

- Baseline refresh must happen only after successful saves, or discard could resurrect stale values.
- Hiding photo notes from the sidebar must not hide their unsaved state.
- Avoid CSS offsets derived from warning-card height; only the compact sticky bar should affect
  anchors.

**Depends on:** none.

**Implementation note:** Gallery internal notes are rendered through `GalleryEditor.tsx`. Gifts are
edited inline in `InvitationEditor.tsx`; there is no separate `GiftsEditor.tsx`.

### Phase 2 - Public Gallery Focal Points and Accurate Editor Preview

**Goal:** make focal-point edits truthful in both the editor and public invitation.

**Expected files:**

- `src/components/invitation/PhotoGallery.astro`
- `src/components/dashboard/intake/editor/GalleryEditor.tsx`
- `src/components/dashboard/intake/editor/FocalPointControl.tsx`
- `src/lib/components/gallery/getLayoutClass.ts`
- `src/lib/components/gallery/gallery-presentation.ts` (new, only if needed after implementation
  spike)
- `src/styles/invitation/_gallery.scss`
- `src/styles/themes/sections/gallery/_luxury-hacienda.scss`
- `src/styles/themes/sections/gallery/_celestial-blue.scss`
- `src/styles/themes/sections/gallery/_enchanted-rose.scss`
- `src/styles/dashboard/_intake.scss`
- `tests/unit/gallery-presentation.test.ts` (new)
- `tests/components/GalleryEditor.test.tsx` (new)

**Steps:**

- [x] Add failing tests proving that the public gallery emits an item-level focal-point custom
      property and the editor derives the same `feature` / `wide` / `standard` role as public
      rendering.
- [x] Apply each item’s persisted `focalPoint` in `PhotoGallery.astro` through a CSS custom
      property.
- [x] Update gallery theme overrides so index-specific positions remain fallbacks and explicit item
      focal points win.
- [x] Reuse `getLayoutClass(index, variant)` in `GalleryEditor.tsx`.
- [x] Add editor crop frames for `Móvil` and `Escritorio`; derive aspect ratio from public layout
      role and a small shared presentation helper where CSS-only values are not available to React.
- [x] Add click/drag percentage selection to `FocalPointControl`, retaining preset buttons and the
      advanced text input.
- [x] Show focal-point edits immediately in both crop frames.
- [x] Keep one stored focal point per gallery item in this phase.

**Validation:**

```bash
pnpm test -- tests/unit/gallery-presentation.test.ts tests/components/GalleryEditor.test.tsx
pnpm type-check
pnpm lint
pnpm lint:styles
pnpm build
```

**Manual visual QA:**

- Verify at least `celestial-blue`, `luxury-hacienda`, `enchanted-rose`, and one default gallery.
- Verify mobile and desktop widths.
- Verify that old content without `focalPoint` retains current theme crops.
- Verify that an explicit focal point overrides theme fallback crops.

**Risks and trade-offs:**

- Theme gallery SCSS has index-specific exceptions. Convert only crop-position precedence needed for
  persisted values; do not refactor theme visuals broadly.
- React cannot directly reuse an Astro component. Share data/presentation decisions, not rendered
  markup.

**Depends on:** Phase 1 sticky/layout cleanup.

### Phase 3 - Compact Premium Console Pass

**Goal:** reduce form sprawl while keeping editing explicit and understandable.

**Expected files:**

- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- `src/components/dashboard/intake/editor/SectionCard.tsx`
- `src/components/dashboard/intake/editor/ItineraryEditor.tsx`
- `src/components/dashboard/intake/editor/GalleryEditor.tsx`
- `src/components/dashboard/intake/editor/PublicationSection.tsx`
- `src/styles/dashboard/_intake.scss`
- `tests/components/InvitationEditor.test.tsx`
- `tests/components/GalleryEditor.test.tsx`

**Steps:**

- [x] Add failing component tests for compact repeated-row headers, expanded/collapsed behavior,
      accessible move buttons, and visible dirty/error state.
- [x] Reduce card padding, repeated helper text, and accent-button repetition.
- [x] Render Programa items as compact rows with ordinal, Spanish icon label, time, and grouped
      actions; expose fields in an expanded editor body.
- [x] Render Mesa de regalos items as compact rows with Spanish type label and grouped actions.
- [x] Render Gallery items with a compact image header, crop mode selector, caption field, focal
      editor, and grouped move actions.
- [x] Render Orden de secciones públicas as dense rows with ordinal and grouped move actions.
- [x] Keep keyboard-accessible `Subir` / `Bajar`; do not require drag-and-drop.
- [x] Improve warning presentation so publish-readiness issues link to affected sections.

**Validation:**

```bash
pnpm test -- tests/components/InvitationEditor.test.tsx tests/components/GalleryEditor.test.tsx
pnpm type-check
pnpm lint
pnpm lint:styles
pnpm build
```

**Risks and trade-offs:**

- Collapsing rows must not obscure validation failures or dirty state.
- Do not introduce a generic component abstraction unless at least two sections genuinely share the
  same interaction model.

**Depends on:** Phase 2 gallery preview contract.

### Phase 4 - Controlled Restore and Publish Workflow

**Goal:** add deliberate server-backed restore and publish decisions after the editor surface is
stable.

**Expected files:**

- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- `src/components/dashboard/intake/editor/EditorActionBar.tsx`
- `src/components/dashboard/intake/ConfirmModal.tsx`
- `src/hooks/use-invitation-editor.ts`
- `src/lib/dashboard/admin-api.ts`
- `src/lib/dashboard/dto/intake.ts`
- `src/lib/intake/services/invitation-editor.service.ts`
- `src/pages/api/dashboard/intake/[id]/editor/restore-published.ts` (new)
- `tests/components/InvitationEditor.test.tsx`
- `tests/unit/invitation-editor.service.test.ts`
- `tests/api/dashboard.intake.editor.restore-published.test.ts` (new)

**Steps:**

- [x] Add failing service and API tests for restore-from-published: require a published record,
      derive editable draft shape with `mapNestedToDraftContent`, write a new draft state, and
      preserve optimistic concurrency behavior.
- [x] Add `POST /api/dashboard/intake/[id]/editor/restore-published` with existing admin session,
      CSRF, and rate-limit guards.
- [x] Add `Restaurar desde versión pública` behind an explicit confirmation modal. Keep it visually
      separate from local `Descartar cambios`.
- [x] Add failing component tests for publish modal summary, preview link, warning display, and
      disabled publish states.
- [x] Add publish-readiness presentation using existing section-state and dirty-state data.
- [x] Open a publish confirmation modal that summarizes changed sections and validation warnings,
      includes `Vista previa`, and requires a final `Publicar cambios`.
- [x] Translate server validation issue paths into section-oriented UI messages after publish
      failure.
- [x] Keep template/default restoration out of scope.

**Validation:**

```bash
pnpm test -- tests/unit/invitation-editor.service.test.ts tests/api/dashboard.intake.editor.restore-published.test.ts tests/components/InvitationEditor.test.tsx
pnpm type-check
pnpm lint
pnpm lint:styles
pnpm build
```

**Risks and trade-offs:**

- Restore-from-published is destructive to the editable draft and must require confirmation.
- Published content is nested while editor content is flat. Reuse `mapNestedToDraftContent`; do not
  add an ad hoc converter.
- Publishing remains server-authoritative even when client readiness appears green.

**Depends on:** Phase 1 local discard semantics and Phase 3 warning presentation.

## 6. Recommended Implementation Order

1. Phase 1: fix sticky structure, local discard, label mapping, photo-notes placement, and date
   formatting.
2. Phase 2: make gallery focal points truthful and preview crops representative.
3. Phase 3: tighten repeated sections once gallery interactions are stable.
4. Phase 4: add destructive restore-from-published and publish confirmation after the editor state
   model is clear.

## 7. Unresolved Questions

1. Should `Notas internas` expose all current `photoNotes` fields inside Gallery, or should the
   first pass expose only WhatsApp status, general notes, crop notes, and priority notes while
   preserving the remaining fields in stored data?
2. After Phase 2 visual QA, do real galleries require separate mobile and desktop focal points, or
   is one persisted anchor sufficient?
3. Should the publish confirmation list only sections changed since the last published version, or
   initially list sections saved during the current editor session? The former is more accurate but
   requires server-provided diff metadata.
4. Should restore-from-published replace the current draft immediately or create a recoverable draft
   revision? Current repositories support replacement, not revision history.

## 8. Files Inspected

### Planning and Existing Plan Context

- `.agent/plans/README.md`
- `.agent/plans/archived/invitation-dashboard-premium-plan.md`
- `.agent/plans/active/editor-hydration-fix.md`
- `.agent/plans/active/section-architecture-refactor-plan.md`

### Editor UI and Styles

- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- `src/components/dashboard/intake/editor/EditorActionBar.tsx`
- `src/components/dashboard/intake/editor/SectionCard.tsx`
- `src/components/dashboard/intake/editor/FocalPointControl.tsx`
- `src/components/dashboard/intake/editor/GalleryEditor.tsx`
- `src/components/dashboard/intake/editor/ItineraryEditor.tsx`
- `src/components/dashboard/intake/editor/MetadataSection.tsx`
- `src/components/dashboard/intake/editor/PublicationSection.tsx`
- `src/components/dashboard/intake/editor/Field.tsx`
- `src/components/dashboard/intake/ConfirmModal.tsx`
- `src/styles/dashboard/_intake.scss`

### Public Invitation Rendering

- `src/components/invitation/Gallery.astro`
- `src/components/invitation/PhotoGallery.astro`
- `src/components/invitation/GalleryLightbox.astro`
- `src/components/invitation/InvitationSections.astro`
- `src/lib/components/gallery/getLayoutClass.ts`
- `src/lib/invitation/section-render-data.ts`
- `src/lib/invitation/draft-preview-helper.ts`
- `src/lib/invitation/page-data.ts`
- `src/styles/invitation/_gallery.scss`
- `src/styles/themes/sections/gallery/_luxury-hacienda.scss`
- `src/styles/themes/sections/gallery/_celestial-blue.scss`
- `src/styles/themes/sections/gallery/_enchanted-rose.scss`

### DTOs, Schemas, Mappers, Hooks, and Services

- `src/hooks/use-invitation-editor.ts`
- `src/lib/dashboard/dto/intake.ts`
- `src/lib/intake/editor-api.ts`
- `src/lib/intake/labels.ts`
- `src/lib/intake/schemas/shared-content.schema.ts`
- `src/lib/intake/schemas/invitation-editor.schema.ts`
- `src/lib/intake/schemas/invitation-content-draft.schema.ts`
- `src/lib/schemas/content/shared.schema.ts`
- `src/lib/schemas/content/gallery.schema.ts`
- `src/lib/intake/services/invitation-editor.service.ts`
- `src/lib/intake/services/publishing.service.ts`
- `src/lib/intake/services/draft-content-mapper.ts`
- `src/lib/intake/mappers/draft-to-published.mapper.ts`
- `src/lib/adapters/event.ts`
- `src/lib/theme/theme-contract.ts`

### Routes and Tests

- `src/pages/dashboard/invitaciones/[id].astro`
- `src/pages/dashboard/invitaciones/[id]/editar.astro`
- `src/pages/dashboard/invitaciones/[id]/preview.astro`
- `src/pages/dashboard/invitaciones/nueva.astro`
- `src/pages/api/dashboard/intake/[id]/editor.ts`
- `src/pages/api/dashboard/intake/[id]/editor/metadata.ts`
- `src/pages/api/dashboard/intake/[id]/editor/publish.ts`
- `src/pages/api/dashboard/intake/[id]/editor/reconcile-rsvp.ts`
- `src/pages/api/dashboard/intake/[id]/editor/sections/[section].ts`
- `tests/components/InvitationEditor.test.tsx`
- `tests/unit/invitation-editor.service.test.ts`
- `tests/unit/image-layout.schema.test.ts`

## 9. Plan Self-Review

- [x] Sticky overlap root cause is tied to current SCSS, not an assumption.
- [x] Gallery focal-point defect is traced from schema through public rendering.
- [x] Existing preview fallback and editor hydration work are treated as landed baseline.
- [x] Photo notes remain persisted and validated; only their editor placement changes.
- [x] Local discard, restore-from-published, and template restore are separate concepts.
- [x] No database migration is proposed.
- [x] No generic restore-defaults feature is proposed.
- [x] Vercel server/client, environment, and Linux-casing constraints are retained.
- [x] Each phase is buildable, reviewable, and has validation commands.

## 10. Implementation Status

All implementation steps are complete. Keep this plan active until authenticated manual visual QA is
available for the invitation editor and public gallery.

**Automated validation completed on 2026-06-02:**

- `pnpm test`
- `pnpm type-check`
- `pnpm lint`
- `pnpm exec stylelint 'src/styles/invitation/_gallery.scss' 'src/styles/dashboard/_intake.scss'`
- `pnpm build`
- `git diff --check`

**Known repository-level validation limitation:**

- `pnpm lint:styles` still reports six pre-existing operator-newline errors in untouched files:
  `src/styles/invitation/_family.scss`, `src/styles/invitation/_rsvp.scss`, and
  `src/styles/themes/sections/location/_enchanted-rose.scss`.

**Hardening pass completed on 2026-06-02:**

- Fixed `focalPoint` type gap: added `focalPoint?: string` to
  `InvitationViewModel.sections.gallery.items` in `src/lib/adapters/types.ts` and `GalleryItem` in
  `src/components/invitation/Gallery.astro`.
- Audited `getLayoutClass` coverage: confirmed `angelic-presence`, `sacred-keepsake`, `editorial`,
  and unlisted variants use uniform grids without role-based spans. Added clarifying comment and
  tests confirming the `standard` fallback is intentional.
- Fixed six pre-existing `scss/operator-no-newline-after` stylelint errors across `_family.scss`,
  `_rsvp.scss`, and `_enchanted-rose.scss`. `pnpm lint:styles` is now fully green.
- No commits or migrations created.

**Manual QA remaining:**

- Authenticate in the local dashboard and verify the editor at desktop and mobile widths.
- Verify `celestial-blue`, `luxury-hacienda`, `enchanted-rose`, and one default public gallery.
- Verify legacy content without `focalPoint` retains theme crops and explicit focal points override
  those fallbacks.
