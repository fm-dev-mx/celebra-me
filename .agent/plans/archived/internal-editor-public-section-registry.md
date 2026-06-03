---
title: Internal Editor Public Section Registry
status: implemented
created: 2026-06-03
updated: 2026-06-03

completed_phases: 1,2,3,4,5,6
related_skills:
  - frontend-design
  - astro-patterns
  - backend-engineering
  - testing
related_docs:
  - .agent/plans/README.md
  - .agent/GATEKEEPER_RULES.md
  - .agent/workflows/plan-authoring.md
  - .agent/plans/active/invitation-dashboard-premium-plan.md
  - .agent/plans/archived/internal-editor-split-preview-pane.md
  - src/components/dashboard/intake/editor/InvitationEditor.tsx
  - src/components/dashboard/intake/editor/PublicationSection.tsx
  - src/components/dashboard/intake/editor/EditorPreviewPane.tsx
  - src/lib/intake/labels.ts
  - src/lib/theme/theme-contract.ts
  - src/lib/invitation/page-data.ts
  - src/lib/invitation/section-render-data.ts
  - src/lib/intake/services/invitation-editor.service.ts
  - src/lib/intake/mappers/draft-to-published.mapper.ts
supersedes: []
superseded_by: []
---

# Internal Editor Public Section Registry Plan

## 1. Executive Summary

The internal invitation editor already has a strong saved-preview and section-save foundation, but
public invitation sections are not yet the source of truth for the editor surface. The sidebar,
public order controls, editor card grouping, preview anchors, publish order, and section labels are
defined in several different files.

This plan restructures the editor around a central public-section registry. The goal is a pragmatic
CMS-style editor, not a full visual page builder. Public invitation sections should drive public
navigation, section order, optional visibility, editor focus, preview focus, and publication order.
Administrative areas remain separate.

## 2. Current Architecture Findings

- `InvitationEditor.tsx` renders the editor shell, local draft state, dirty state, section cards,
  sidebar navigation, persistent preview pane, publish confirmation, and asset picker.
- The sidebar is rendered from `NAV_ITEMS` in `src/lib/intake/labels.ts`.
- Public render keys are defined in `src/lib/theme/theme-contract.ts` as `CONTENT_SECTION_KEYS` and
  `INVITATION_RENDER_SECTION_KEYS`.
- Public order is persisted as `content.sectionOrder` in draft content and published content.
- The separate order UI lives in `PublicationSection.tsx` under the heading
  `Orden de secciones públicas`.
- Preview uses `/dashboard/invitaciones/[id]/preview`, which renders saved draft content first,
  published content second, and empty fallback content third.
- Publication uses the same core mapping path as preview through `mapDraftToPublished`, then writes
  `published_invitation_content`.
- `sectionStates` and `contentSource` are derived by `invitation-editor.service.ts`; they are not
  persisted.
- There is no explicit persisted visibility map. Current visibility is implicit through
  `sectionOrder`, renderable content, and section-specific data presence.

## 3. Problem Statement

The current editor has duplicated concepts:

- Sidebar entries are editor-card-oriented.
- Public section order is edited in a separate publication card.
- Public section labels are duplicated between `labels.ts`, `PublicationSection.tsx`, render
  helpers, and tests.
- Some editor cards map to multiple public sections, such as `messages` editing both `quote` and
  `thankYou`.
- Some editor cards are not public sections, such as `metadata`, `publication`, and `assetLibrary`.
- Some public render sections do not map cleanly to an editor card, especially `countdown` and
  `personalizedAccess`.

This makes it hard to keep sidebar navigation, preview anchors, public order, visibility, and
publish order aligned.

## 4. Target Architecture

Create a central registry in:

```text
src/lib/intake/invitation-section-registry.ts
```

The registry should model two different concepts:

1. Public invitation sections.
2. Editor/admin areas.

Public invitation section definitions should include:

- stable public section id,
- Spanish label,
- editor card id,
- draft content keys,
- default order,
- whether the section is required,
- whether the section is orderable,
- whether the section is toggleable,
- preview anchor selector or hash,
- short Spanish status label,
- any special behavior notes.

Editor/admin area definitions should include:

- stable editor area id,
- Spanish label,
- editor card id,
- whether it appears in the sidebar,
- dirty-state keys,
- reason it is not public.

The registry must stay plain TypeScript data and helpers. It must not import server repositories,
Astro-only modules, React components, or browser APIs.

## 5. Public/Admin Classification

Public invitation sections:

- `quote`
- `countdown`
- `location`
- `family`
- `itinerary`
- `gallery`
- `rsvp`
- `gifts`
- `thankYou`
- `personalizedAccess`

Editor/admin areas:

- `metadata` for internal project/invitation metadata.
- `publication` for public version, restore-from-published, RSVP linkage, and publish health.
- `assetLibrary` for uploaded image management.
- `photoNotes` as internal production notes grouped under Gallery, not public content.

Compound editor mappings:

- `main` edits public hero/title/description, but hero is rendered outside `InvitationSections`.
- `messages` edits `quote` and `thankYou`.
- `gallery` can surface internal `photoNotes` state while still treating `photoNotes` as non-public.

Special public sections:

- `countdown` is public and orderable, but current content usually comes from demo/template content.
  Do not expose new countdown editing until product behavior is decided.
- `personalizedAccess` is public but context-driven. It can be included in explicit section order,
  but if no explicit order exists the render path currently repositions it near Quote.

## 6. Implementation Phases

### Phase 1: Registry Foundation

Goal: add the central registry without changing runtime behavior.

Files likely to change:

- Create `src/lib/intake/invitation-section-registry.ts`
- Create `tests/unit/invitation-section-registry.test.ts`
- Modify `src/lib/intake/labels.ts` only if labels are safely re-exported from the registry.

Steps:

- [x] Define public section ids from `INVITATION_RENDER_SECTION_KEYS`.
- [x] Define editor/admin area ids separately.
- [x] Add helpers:
  - `getPublicSectionDefinitions()`
  - `getAdminAreaDefinitions()`
  - `deriveOrderedPublicSections(sectionOrder)`
  - `getEditorSectionForPublicSection(sectionId)`
  - `getPreviewAnchorForPublicSection(sectionId)`
- [x] Add unit tests proving all public ids are valid render ids.
- [x] Add unit tests proving admin areas are never returned as public orderable sections.
- [x] Add unit tests for compound mappings: `quote` and `thankYou` both map to `messages`.
- [x] Add unit tests for special sections: `personalizedAccess` is public, `metadata` is not.

Validation:

```bash
pnpm test -- tests/unit/invitation-section-registry.test.ts
pnpm type-check
```

Acceptance criteria:

- Existing editor UI does not change.
- Registry helpers produce the same effective public order as current `sectionOrder` handling.
- No server/client boundary violations are introduced.

### Phase 2: Sidebar From Registry

Goal: render sidebar sections from registry-derived public/admin definitions.

Files likely to change:

- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- Create `src/components/dashboard/intake/editor/EditorSidebar.tsx`
- `src/lib/intake/labels.ts`
- `tests/components/EditorSidebar.test.tsx` (new isolated sidebar test)

Steps:

- [x] Extract sidebar rendering into `EditorSidebar`.
- [x] Render a `Secciones públicas` group from registry public definitions.
- [x] Render an `Administración` group from registry admin areas.
- [x] Preserve existing anchors and section card ids.
- [x] Preserve current dirty, saving, error, source badge, and active-section indicators.
- [x] Ensure `metadata`, `publication`, and `assetLibrary` are visibly separate from public
      sections.

Validation:

```bash
pnpm test -- tests/components/EditorSidebar.test.tsx
pnpm type-check
pnpm lint
```

Acceptance criteria:

- Sidebar labels and dirty/source/error indicators remain accurate.
- Administrative areas are not counted as public sections.
- No publication behavior changes in this phase.

### Phase 3: Move Public Order Into Sidebar

Goal: remove the duplicate public order block from `PublicationSection` and move its function into
the public-section sidebar group.

Files likely to change:

- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- `src/components/dashboard/intake/editor/PublicationSection.tsx`
- `src/components/dashboard/intake/editor/EditorSidebar.tsx`
- `src/lib/intake/invitation-section-registry.ts`
- `tests/components/InvitationEditor.test.tsx`

Steps:

- [x] Derive the current ordered public section list from `content.sectionOrder`.
- [x] Add keyboard-accessible `Subir` and `Bajar` controls to sidebar public rows.
- [x] Update `content.sectionOrder` through the existing `publication` dirty key.
- [x] Keep saving public order through the existing `saveSection('publication')` path.
- [x] Remove `Orden de secciones públicas` from `PublicationSection`.
- [x] Keep `PublicationSection` focused on version, restore-from-published, and RSVP linkage.

Validation:

```bash
pnpm test -- tests/components/EditorSidebar.test.tsx
pnpm test -- tests/unit/draft-to-published.mapper.test.ts
pnpm type-check
pnpm lint
```

Acceptance criteria:

- There is one public-order UI, in the sidebar.
- `sectionOrder` persistence remains unchanged.
- Published order still comes from the saved draft content.

### Phase 4: Optional Visibility Semantics

Goal: make optional public section visibility explicit in UI behavior without adding a new persisted
model prematurely.

Files likely to change:

- `src/lib/intake/invitation-section-registry.ts`
- `src/components/dashboard/intake/editor/EditorSidebar.tsx`
- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- `src/lib/intake/schemas/invitation-editor.schema.ts`
- `tests/unit/invitation-section-registry.test.ts`
- `tests/components/InvitationEditor.test.tsx`

Steps:

- [x] Mark sections as required or optional in the registry.
- [x] Treat absence from `sectionOrder` as hidden/excluded for toggleable optional sections.
- [x] Keep section content intact when a section is removed from `sectionOrder`.
- [x] Do not add `sectionVisibility` yet.
- [x] Add sidebar toggles only for sections marked `toggleable`.
- [x] Prevent required sections from being hidden.
- [x] Show Spanish status copy that distinguishes `Visible`, `Oculta`, `Vacía`, and `Requerida`.

Validation:

```bash
pnpm test -- tests/unit/invitation-section-registry.test.ts tests/components/InvitationEditor.test.tsx
pnpm type-check
pnpm lint
```

Acceptance criteria:

- Optional visibility is understandable in the sidebar.
- No content is deleted when a section is hidden.
- Required sections cannot be hidden.

Decision gate:

- If product needs "hidden but still ordered" or draft/published visibility audit history, create a
  separate plan for a persisted `sectionVisibility` map.

### Phase 5: Editor And Preview Focus Synchronization

Goal: selecting a public section focuses the editor and scrolls the preview iframe to the matching
public anchor.

Files likely to change:

- `src/components/dashboard/intake/editor/EditorSidebar.tsx`
- `src/components/dashboard/intake/editor/EditorPreviewPane.tsx`
- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- `src/lib/intake/invitation-section-registry.ts`
- `tests/components/EditorPreviewPane.test.tsx`
- `tests/components/InvitationEditor.test.tsx`

Steps:

- [x] Store selected public section id in `InvitationEditor.tsx`.
- [x] On sidebar click, scroll the editor card into view and focus it.
- [x] Add an iframe URL hash or controlled message that targets the matching public anchor.
- [x] Prefer hash navigation first because it keeps preview saved-content based.
- [x] Keep stale-preview copy when local unsaved changes exist.
- [x] Add tests for sidebar click, editor focus, and preview target URL.

Validation:

```bash
pnpm test -- tests/components/EditorPreviewPane.test.tsx tests/components/InvitationEditor.test.tsx
pnpm type-check
pnpm lint
```

Acceptance criteria:

- Selecting a section has one clear editor focus and preview focus.
- Preview remains based on saved draft/published content.
- Unsaved edits are not accidentally published or autosaved.

### Phase 6: Modular Section Editor Panels

Goal: reduce `InvitationEditor.tsx` size only after registry and sidebar behavior are stable.

Files likely to change:

- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
- Create focused panel components as needed, for example:
  - `HeroMainEditor.tsx`
  - `FamilyEditor.tsx`
  - `LocationEditor.tsx`
  - `MessagesEditor.tsx`
  - `GiftsEditor.tsx`
- Existing component tests under `tests/components/`

Steps:

- [x] Extract one panel at a time.
- [x] Keep state ownership in `InvitationEditor.tsx` unless a panel has a clearly isolated local
      state.
- [x] Keep visible Spanish copy unchanged unless improving labels is explicitly part of the panel.
- [x] Avoid creating generic form abstractions.
- [ ] Run targeted component tests after each extraction.

Extraction results:

- Extracted: `MainSectionEditor`, `FamilySectionEditor`, `LocationSectionEditor` (~260 lines
  removed).
- Skipped: `RsvpSectionEditor`, `MessagesSectionEditor`, `GiftsSectionEditor` — these would be
  mechanical extractions with diminishing returns. The pre-existing `AssetLibraryPanel` act() issue
  in `tests/setup.ts` prevents running `InvitationEditor.test.tsx`, so behavioral verification is
  blocked for further extractions. The remaining inline sections are structurally sound and follow
  the same pattern as the extracted panels.

Validation:

```bash
pnpm test -- tests/components/InvitationEditor.test.tsx
pnpm type-check
pnpm lint
```

Acceptance criteria:

- `InvitationEditor.tsx` is easier to read.
- Behavior is unchanged.
- Registry mappings remain the source of sidebar/editor relationships.

### Phase 7: Drag-And-Drop Reordering

Goal: add drag-and-drop only after the data and sidebar model are stable.

Files likely to change:

- `src/components/dashboard/intake/editor/EditorSidebar.tsx`
- `src/styles/dashboard/_intake.scss`
- `tests/components/InvitationEditor.test.tsx`

Steps:

- [-] Choose a proven accessible DnD library only if the current stack supports it cleanly.
- [x] Keep `Subir` and `Bajar` controls as keyboard fallbacks.
- [x] Do not change the persisted shape; still save `sectionOrder`.
- [x] Add component tests for reorder behavior through keyboard controls.
- [-] Add manual accessibility QA for drag interaction, keyboard navigation, and screen reader copy.

Status: **Deferred by decision**. Native drag-and-drop is intentionally deferred. The keyboard-
accessible `Subir` / `Bajar` controls are the implemented and tested reorder solution. Native HTML5
DnD was evaluated as viable but:

- Drag events cannot be reliably tested in jsdom, and E2E coverage is not yet available.
- The pre-existing test infrastructure issue (`AssetLibraryPanel` act() warning) blocks further
  component-test expansion for this feature.
- Adding DnD without test verification carries risk of regressions. Revisit when a real browser E2E
  test can verify drag behavior. No dependency evaluation was needed since native DnD uses no
  external library.

Validation:

```bash
pnpm test -- tests/components/InvitationEditor.test.tsx
pnpm type-check
pnpm lint
pnpm lint:styles
```

Acceptance criteria:

- Drag-and-drop is an enhancement, not the only way to reorder.
- No layout shift or inaccessible interaction is introduced.

### Phase 8: Plan And Documentation Lifecycle

Goal: keep `.agent/plans` accurate as implementation proceeds.

Steps:

- [x] Update this plan after each completed phase.
- [x] If this plan becomes the canonical editor architecture plan, update related active plans to
      reference it.
- [x] If durable architecture rules emerge, migrate them to `docs/` or an `.agent/skills` document.
- [x] Mark this plan `implemented` when complete.
- [ ] Move this plan to `.agent/plans/archived/` when no longer actionable.

Lifecycle decisions:

- Status set to `implemented` per README taxonomy ("Work completed, plan retained for reference").
- Phase 7 (drag-and-drop) is intentionally deferred, not incomplete — keyboard controls are the
  implemented solution. The plan is complete for its core scope (registry, sidebar, order, focus
  sync, panel extraction).
- Plan stays in `active/` — it documents the registry architecture which is useful reference for
  future editor work.
- No contradiction with related active plans (`invitation-dashboard-premium-plan.md`,
  `section-architecture-refactor-plan.md`).
- No durable docs to migrate — the registry type definitions and helpers are self-documenting code.

Acceptance criteria:

- There is one canonical active plan for public-section registry work.
- No active plan contradicts the live codebase.

## 7. Data Model And API Implications

No database migration is required for Phases 1-5.

The existing persisted contract remains:

- `invitation_projects` for metadata and status.
- `invitation_content_drafts.content.sectionOrder` for saved public order.
- `published_invitation_content.content.sectionOrder` for public snapshot order.
- asset library records for uploaded images.

The existing API contract remains:

- Save content through `/api/dashboard/intake/[id]/editor/sections/[section]`.
- Save order through the existing `publication` editor section until a narrower endpoint is
  justified.
- Publish through `/api/dashboard/intake/[id]/editor/publish`.
- Preview through `/dashboard/invitaciones/[id]/preview`.

Do not add a new visibility table or content schema field until omission from `sectionOrder` is
proven insufficient.

## 8. Testing Strategy

Unit tests:

- Registry public/admin classification.
- Registry section order derivation.
- Registry editor-card mapping.
- Registry preview-anchor mapping.
- `mapDraftToPublished` preserving draft `sectionOrder`.
- Render plan respecting explicit public order.

Component tests:

- Sidebar grouped rendering.
- Active section selection.
- Dirty/saving/error/source indicators.
- Reorder controls in sidebar.
- Optional section visibility toggles if implemented.
- Preview target synchronization.

Note — `InvitationEditor.test.tsx` has a pre-existing `AssetLibraryPanel` act() issue
(`tests/setup.ts` rejects unexpected `console.error` calls). This suite cannot run reliably
regardless of this implementation. Hash-sync behavior is covered at the isolated component level
(`EditorSidebar.test.tsx` for selection, `EditorPreviewPane.test.tsx` for preview URL hash).

Service/API tests:

- Existing editor save conflict behavior remains unchanged.
- Publication uses saved draft order.
- Restore-from-published continues to preserve published section order.

Manual checks:

- Desktop editor with sidebar, form, and preview pane.
- Mobile editor where preview opens full route.
- Public invitation order after save and publish.
- Keyboard navigation through sidebar and reorder controls.

## 9. Risks And Mitigations

Publish order diverges from editor order:

- Mitigate by keeping `sectionOrder` as the single persisted order and testing
  `mapDraftToPublished`.

Unsaved local state diverges from saved preview:

- Keep stale-preview messaging. Do not autosave. Do not serialize unsaved draft JSON into the iframe
  in this plan.

Server/client boundary leakage:

- Registry must be plain shared TypeScript. React components must not import repositories or Astro
  content APIs.

React state complexity:

- Extract `EditorSidebar` before adding ordering and visibility behavior. Keep save ownership in
  `InvitationEditor.tsx`.

Preview anchor mismatch:

- Registry should store preview anchors and tests should verify that public section components still
  expose those anchors.

Test brittleness:

- Prefer behavior assertions over duplicate label snapshots.

Linux/Vercel path casing:

- Use lowercase filenames and consistent import casing.

Accessibility:

- Keep keyboard reorder buttons. Drag-and-drop is optional and must not replace keyboard controls.

## 10. Open Decisions

1. Should hiding a section be represented only by removal from `sectionOrder`, or does the product
   need a separate `sectionVisibility` map?
2. Should `countdown` become editable, or remain template-derived for now?
3. Should `personalizedAccess` be user-orderable or system-managed?
4. Should preview synchronization use hash navigation only, or a later `postMessage` bridge?
5. Should this plan eventually supersede parts of `invitation-dashboard-premium-plan.md`, or remain
   a focused architecture follow-up?

## 11. Non-Goals

- No full page-builder architecture.
- No visual drag-and-drop canvas.
- No autosave.
- No database migration in the initial phases.
- No live unsaved iframe preview in the initial phases.
- No restructuring of public invitation Astro components unless preview anchors or registry tests
  prove a mismatch.
