---
title: Internal Editor Split Preview Pane
status: implemented
created: 2026-06-02
updated: 2026-06-02
related_skills:
  - astro-patterns
  - frontend-design
  - accessibility
  - copywriting-es
  - backend-engineering
  - testing
related_docs:
  - .agent/plans/README.md
  - .agent/rules/gatekeeper.md
  - .agent/workflows/plan-authoring.md
  - docs/domains/intake/internal-invitation-editor.md
  - .agent/plans/archived/invitation-dashboard-premium-plan.md
supersedes: []
superseded_by: []
---

# Internal Editor Split Preview Pane Plan

## Goal

Change the internal invitation editor into a professional split editing surface:

- Left: section navigation.
- Center: the active editor forms and existing section cards.
- Right: a persistent browser-style preview pane.

The first implementation must preview saved content through the existing internal preview route. It
must not attempt live unsaved preview, `postMessage` synchronization, duplicated invitation
rendering logic, or cross-boundary client/server state sharing.

## Scope

This plan is for `/dashboard/invitaciones/[id]/editar` and its adjacent internal preview route.

In scope:

- Move preview responsibility out of `InvitationEditor.tsx` into a focused React component.
- Render the preview as an iframe pointed at the existing Astro route.
- Surface clear stale-preview state when local editor state is dirty.
- Reload the iframe after successful saves.
- Add desktop split layout styles and mobile fallback.
- Keep the gallery simplification as a later phase unless the split layout cannot remain usable.

Out of scope:

- Live unsaved preview.
- Serializing editor form state into the iframe.
- `postMessage` bridges.
- A global editor state store.
- Duplicating Astro invitation rendering in React.
- Changes to public invitation routing or publication semantics.
- Gallery feature rewrites beyond the minimum layout adjustment needed for the split pane.
- Commits as part of planning.

## Implementation Decisions Applied

- `embed=1` is part of Phase 1 because the route change is small and localized.
- Preview route access verification is required in Phase 1. The central middleware protects
  `/dashboard/invitaciones/[id]/preview` through the `/dashboard/invitaciones` admin-only path.
- The action bar `Vista previa` action focuses the right pane on desktop and opens the full preview
  route in a new tab below the split-layout breakpoint.
- Phase 1 uses the neutral label `Última versión guardada`; it does not implement forced
  draft/published source selection.
- Gallery simplification was included after validating the split layout density: gallery rows now
  show one selected crop preview at a time while preserving focal-point controls and public gallery
  rendering.

## Current State Analysis

### 1. Editor Layout Structure

The editor route is `src/pages/dashboard/invitaciones/[id]/editar.astro`. It loads the editor
context on the server through `getInvitationEditorContext(rawId)` and hydrates
`InvitationEditor client:load`.

`src/components/dashboard/intake/editor/InvitationEditor.tsx` owns a large React shell:

- `EditorActionBar` renders the top sticky action surface.
- A header shows content source, title, status, publication state, warnings, and publish success.
- `.invitation-editor__layout` currently has two columns: side nav and editor content.
- The side nav links to section cards by anchor.
- Section cards render metadata, main content, family, location, itinerary, RSVP, music, gifts,
  messages, gallery, and publication controls.
- A conditional preview panel exists after the main layout, controlled by `showPreview`.

The SCSS in `src/styles/dashboard/_intake.scss` currently defines `.invitation-editor__layout` as
`minmax(12rem, 15rem) minmax(0, 1fr)`, with a one-column fallback under `860px`.

### 2. Current Preview Mechanism

`InvitationEditor.tsx` already computes:

```ts
const previewUrl = `/dashboard/invitaciones/${editor.context.invitation.id}/preview`;
```

It also has `showPreview`, `refreshingPreview`, `previewRefreshKey`, and `refreshPreview`.

The current rendered preview is a conditional bottom panel:

```tsx
{showPreview && (
  <div className="invitation-editor__preview-panel">
    ...
    <iframe key={previewRefreshKey} src={previewUrl} ... />
  </div>
)}
```

This means the preview is available, but it is not a persistent right-side pane and does not create
the intended editor-plus-browser workflow.

The route `src/pages/dashboard/invitaciones/[id]/preview.astro` is server-rendered with
`prerender = false`. It loads:

- invitation record,
- draft content,
- published content,
- demo content from `event-demos`,
- the actual invitation components and `InvitationSections`.

Its fallback chain is:

1. Draft content.
2. Published content if there is no draft or the draft cannot render.
3. Empty/default preview.

This is the right foundation for an iframe preview because it uses the real Astro invitation render
path instead of duplicating the invitation view in the editor.

### 3. Current Dirty State and Save Flow

`InvitationEditor.tsx` tracks dirty sections with:

```ts
const [dirty, setDirty] = useState<Set<string>>(new Set());
```

`markDirty(section)` adds a section to the set and clears that section's success message.

`saveSection(section, expectedUpdatedAt?)` delegates to `editor.saveSection`, updates the local
baseline for the saved section, removes that section from `dirty`, and writes a Spanish success or
error message.

`saveMetadata(expectedUpdatedAt?)` follows the same pattern for administrative metadata.

`saveAllDirty()` walks the current dirty set, chains `expectedUpdatedAt` values across section
saves, and stops on the first failed save.

`beforeunload` warns when `dirty.size > 0`.

Current `refreshPreview()` saves dirty sections before bumping the iframe key. That behavior is more
destructive than the preferred first phase because the requested direction is to clearly indicate
that the preview may be stale until saving, not to implicitly save when refreshing preview.

### 4. Draft vs Published Source Handling

`getInvitationEditorContext()` hydrates editable content with draft > published > demo priority. It
also returns per-key `sectionStates`, `contentSource`, `draftUpdatedAt`, `draftStatus`, and
publication metadata.

`saveInvitationEditorSection()` validates the section payload, rebuilds the effective context,
applies one section into the draft content, and writes the draft conditionally using
`expectedUpdatedAt`. If no draft exists, it upserts a draft preserving hydrated content from
published or demo sources.

The preview route independently prefers draft content, then published content, then empty/default
content. It labels the rendered source as `Borrador`, `Versión pública`, or `Vacío`.

### 5. Gallery Editing UX and Density

`GalleryEditor.tsx` currently renders, per image:

- image key and role summary,
- mobile, tablet, and desktop crop preview frames,
- caption field,
- `FocalPointControl`,
- move up and move down controls.

It also includes a collapsed internal photo notes area.

This is dense because each gallery item now contains repeated visual preview frames plus precise
focal-point controls. The right-side iframe can become the primary visual feedback surface, so a
later phase can make gallery rows more compact without losing the precise per-device focal-point
editing behavior.

### 6. Preview Route Embedding Capability

The preview route is same-origin and internal. It already renders the actual invitation route
components and an internal preview banner. That makes it safe to embed from a rendering-boundary
perspective.

The implementation should still account for:

- The fixed preview banner consumes vertical space inside the iframe.
- The banner's "Volver al editor" link is redundant inside an embedded pane.
- Invitation components may contain links, audio controls, reveal interactions, and navigation.
- The route currently has no explicit `embed=1` mode, so the first pane can use the route as-is and
  introduce embed-specific route behavior only if the banner creates usability problems.

### 7. Security, Auth, CSRF, Cache, and Stale Data

Editor API routes use `requireEditorReadAccess` for reads and `requireEditorMutationAccess` for
mutations. Mutation access includes admin rate limiting, CSRF validation when applicable, and strong
admin session checks.

The preview route currently reads repositories directly and does not call `requireEditorReadAccess`.
Because it lives under `/dashboard`, dashboard middleware or layout/session behavior may protect it,
but the route itself does not show an explicit guard in the file inspected. This should be verified
before implementation and, if not covered centrally, fixed as part of the preview pane phase.

No mutation should happen from preview reload. The pane should reload saved content only.

Stale-data behavior should be explicit:

- If `dirty.size > 0`, show `Hay cambios sin guardar`.
- Explain that the iframe shows the last saved draft or public fallback.
- Do not auto-save on preview reload.
- After a successful section save or save-all, bump a local preview version to refresh the iframe.

Caching should be conservative: append a simple `v=${previewVersion}` query parameter to the iframe
URL and rely on the SSR route to fetch current saved data. The preview route should not introduce
long-lived caching for this internal admin surface.

### 8. Responsive Behavior Constraints

Desktop should use a three-column grid:

```text
nav | editor | preview
```

The nav remains sticky. The preview pane should be sticky below the action bar and fill the usable
viewport height. The editor content must remain scrollable in the normal document flow.

On smaller screens, the right preview pane should hide or collapse and keep an explicit "Vista
previa" action that opens the existing preview route in a new tab or a temporary stacked panel. The
editing flow should remain the priority on mobile.

### 9. Accessibility Considerations

The pane needs:

- A semantic labelled region, such as `<aside aria-labelledby="editor-preview-title">`.
- Button labels in Spanish.
- Visible focus states through existing dashboard button styles.
- An iframe `title="Vista previa de la invitación"`.
- Non-color-only stale indicators.
- Device preset buttons with `aria-pressed`.
- Reload/open controls reachable by keyboard.

The iframe must not create a keyboard trap. Opening the full preview in a new tab should remain
available for full-page inspection.

### 10. Existing Tests to Reuse or Expand

Existing relevant coverage:

- `tests/components/InvitationEditor.test.tsx`
  - section rendering,
  - dirty discard,
  - source nav indicators,
  - publish warnings,
  - publish modal preview link,
  - section save behavior,
  - accessibility labels for section cards and nav dots.
- `tests/components/GalleryEditor.test.tsx`
  - captions and reordering,
  - asset resolution,
  - mobile/tablet/desktop crop frame rendering,
  - per-device focal-point behavior.
- `tests/unit/invitation-editor.service.test.ts`
  - draft > published > demo hydration,
  - content source states,
  - section save preserving hydrated sections,
  - draft creation,
  - restore-from-published behavior and conflicts.
- `tests/unit/draft-preview-helper.test.ts`
  - preview context building,
  - empty draft/demo resilience,
  - asset slug fallback,
  - default preview behavior.
- `tests/api/dashboard.intake.editor.restore-published.test.ts`
  - restore route mutation guard.
- `tests/unit/gallery-presentation.test.ts`
  - shared gallery layout roles and focal-point CSS contract.

New coverage should focus on `EditorPreviewPane` behavior and `InvitationEditor` integration rather
than retesting service hydration.

## Recommended Architecture

Create:

```text
src/components/dashboard/intake/editor/EditorPreviewPane.tsx
```

Responsibilities:

- Render the preview toolbar.
- Manage selected device preset locally.
- Render the iframe.
- Show stale-preview/unsaved-change state.
- Provide reload and open-preview controls.
- Avoid knowing the invitation content structure.

Suggested props:

```ts
export type EditorPreviewSource = 'draft' | 'published';

interface EditorPreviewPaneProps {
  invitationId: string;
  source: EditorPreviewSource;
  hasUnsavedChanges: boolean;
  previewVersion: number;
  onReload: () => void;
}
```

`InvitationEditor.tsx` should own `previewVersion` and increment it only after successful saves. The
pane should derive its iframe URL from `invitationId`, `source`, and `previewVersion`:

```ts
const previewUrl = `/dashboard/invitaciones/${encodeURIComponent(invitationId)}/preview?v=${previewVersion}`;
```

The `source` prop should drive Spanish labels in the pane. The route can keep its existing fallback
chain in phase 1. A later route-level `source` query can be added only if production needs to force
published preview while a draft exists.

Device presets should be local UI state only:

```ts
type PreviewDevice = 'mobile' | 'tablet' | 'desktop';
```

Initial sizes:

- mobile: 390px wide.
- tablet: 768px wide.
- desktop: 100% of pane width.

Do not spoof user agent. The iframe width is enough for responsive CSS verification in this phase.

## Files Likely to Change

Create:

- `src/components/dashboard/intake/editor/EditorPreviewPane.tsx`

Modify:

- `src/components/dashboard/intake/editor/InvitationEditor.tsx`
  - Import and render `EditorPreviewPane` in the main layout.
  - Remove the bottom `showPreview` panel flow.
  - Keep an explicit mobile/full-preview action through `EditorActionBar`.
  - Add `previewVersion` state.
  - Increment `previewVersion` after successful `saveSection`, `saveMetadata`, `saveAllDirty`,
    `restorePublished`, and `publish` where the saved preview should refresh.
  - Do not auto-save from preview reload.
- `src/components/dashboard/intake/editor/EditorActionBar.tsx`
  - Adjust preview action from toggle semantics to "open preview" or "focus preview" semantics.
  - Keep Spanish visible copy.
- `src/styles/dashboard/_intake.scss`
  - Change editor layout to three columns on desktop.
  - Add preview pane, toolbar, device frame, iframe, and responsive fallback styles.
  - Keep SCSS in dashboard scope and avoid Tailwind.
- `src/pages/dashboard/invitaciones/[id]/preview.astro`
  - Optional in phase 1: support `?embed=1` to hide or reduce the fixed preview banner.
  - Optional in phase 1: add explicit read guard if central dashboard auth does not cover the route.
- `tests/components/InvitationEditor.test.tsx`
  - Assert split preview pane integration, stale message, iframe URL, and save-triggered reload.
- `tests/components/EditorPreviewPane.test.tsx`
  - New focused tests for pane controls, device presets, iframe title, stale messaging, reload, and
    open-preview link.

Probably unchanged:

- `src/lib/intake/services/invitation-editor.service.ts`
- `src/lib/dashboard/dto/intake.ts`
- `src/lib/intake/schemas/invitation-editor.schema.ts`
- `src/pages/api/dashboard/intake/[id]/editor/*`

These layers already support saved-draft preview, source states, and optimistic section saves.

## UX Copy

Visible UI text must remain Spanish. Suggested copy:

- Pane title: `Vista previa`
- Source label when source is draft: `Último borrador guardado`
- Source label when source is published: `Versión pública`
- Dirty warning: `Hay cambios sin guardar`
- Dirty helper: `La vista previa se actualizará después de guardar.`
- Reload button: `Recargar`
- Open button: `Abrir vista completa`
- Device buttons: `Móvil`, `Tableta`, `Escritorio`
- Empty/error helper if iframe cannot load: `No se pudo cargar la vista previa.`

## Phase Breakdown

### Phase 1: Extract and Integrate the Persistent Preview Pane

Goal: provide the split workflow without changing preview semantics.

Steps:

1. Add failing tests for `EditorPreviewPane`:
   - renders a labelled preview region,
   - renders iframe with `/dashboard/invitaciones/proj-1/preview?v=0`,
   - displays `Hay cambios sin guardar` when `hasUnsavedChanges` is true,
   - switches device presets with `aria-pressed`,
   - calls `onReload` when `Recargar` is clicked,
   - exposes `Abrir vista completa` as a new-tab link.
2. Create `EditorPreviewPane.tsx` with local device state and no invitation content knowledge.
3. Add failing integration tests in `InvitationEditor.test.tsx`:
   - preview pane is rendered by default on desktop markup,
   - dirty form edits show stale preview copy,
   - saving a section refreshes the iframe version,
   - clicking reload does not call `saveSection` when there are dirty edits.
4. Update `InvitationEditor.tsx`:
   - remove `showPreview`, `refreshingPreview`, and the bottom preview panel,
   - add `previewVersion`,
   - render `EditorPreviewPane` beside the editor content,
   - change reload to only bump iframe version,
   - increment preview version after successful saves.
5. Update `EditorActionBar.tsx`:
   - keep the `Vista previa` action for small screens or full-view access,
   - remove active toggle copy such as `Cerrar vista previa`.
6. Update `_intake.scss` with three-column desktop layout and preview pane styles.
7. Run:

```bash
pnpm test -- tests/components/EditorPreviewPane.test.tsx tests/components/InvitationEditor.test.tsx
pnpm type-check
pnpm lint
```

Acceptance criteria:

- Desktop editor shows nav, editor, and preview pane at the same time.
- Preview iframe loads the existing internal preview route.
- Unsaved changes are indicated without auto-saving.
- Successful saves refresh the iframe by changing the version query.
- Keyboard users can reach reload, open, and device controls.
- No server-only modules are imported into React components.

### Phase 2: Iframe Route Polish and Safety Verification

Goal: make embedded preview feel intentional and verify access boundaries.

Steps:

1. Verify whether dashboard middleware protects
   `src/pages/dashboard/invitaciones/[id]/preview.astro`.
2. If central protection is not explicit enough, add a read guard compatible with Astro page
   rendering and the existing dashboard auth model.
3. Add `embed=1` support only if needed:
   - hide the `Volver al editor` link,
   - reduce fixed banner height,
   - keep source/warning labels visible.
4. Update `EditorPreviewPane` URL to include `embed=1` after route support exists.
5. Add route-level or integration coverage appropriate to the existing test harness.
6. Run:

```bash
pnpm test -- tests/unit/draft-preview-helper.test.ts tests/components/EditorPreviewPane.test.tsx
pnpm type-check
pnpm lint
```

Acceptance criteria:

- Embedded preview remains admin-only.
- The iframe still renders real invitation sections.
- The internal banner does not obscure too much of the iframe viewport.
- No mutation route is used for preview reload.

### Phase 3: Responsive Fallback

Goal: keep mobile editing comfortable.

Steps:

1. Add component tests or DOM assertions that the full preview link remains available.
2. Update SCSS so the right pane is hidden or collapsed under the chosen breakpoint.
3. Ensure the action bar's preview action opens the full preview route in a new tab on small
   screens.
4. Keep nav horizontal at the existing narrow layout breakpoint.
5. Run:

```bash
pnpm test -- tests/components/InvitationEditor.test.tsx tests/components/EditorPreviewPane.test.tsx
pnpm lint:styles:changed
pnpm type-check
```

Acceptance criteria:

- At small widths, editing sections remain the primary content.
- The preview is still accessible through `Vista previa` or `Abrir vista completa`.
- No horizontal overflow is introduced by fixed preview widths.

### Phase 4: Gallery Simplification

Goal: reduce gallery density after the right pane is available as the primary visual feedback.

Steps:

1. Review the split layout with real gallery content.
2. If dense gallery rows still slow editing, reduce repeated per-device thumbnails.
3. Keep focal point controls compact and preserve per-device focal point values.
4. Keep one representative thumbnail or collapsed crop summary per image.
5. Expand tests in `GalleryEditor.test.tsx` only for changed behavior.
6. Run:

```bash
pnpm test -- tests/components/GalleryEditor.test.tsx tests/unit/gallery-presentation.test.ts
pnpm lint:styles:changed
pnpm type-check
```

Acceptance criteria:

- Gallery editing requires less vertical scanning.
- Existing focal-point precision remains intact.
- Public gallery rendering remains unchanged.

## State Model

Keep local state in `InvitationEditor.tsx`:

```ts
const [previewVersion, setPreviewVersion] = useState(0);
const refreshSavedPreview = () => setPreviewVersion((version) => version + 1);
```

Use `dirty.size > 0` as `hasUnsavedChanges`.

Increment `previewVersion` only after a save or restore operation returns success. A manual reload
can also increment it, but must not save dirty sections.

Do not add new API state or DTO fields in phase 1.

## SCSS Layout Strategy

Use dashboard component classes under `_intake.scss`:

- `.invitation-editor__workspace` or expand `.invitation-editor__layout` to three columns.
- `.invitation-editor__preview-pane`
- `.invitation-editor__preview-toolbar`
- `.invitation-editor__preview-device-tabs`
- `.invitation-editor__preview-frame`
- `.invitation-editor__preview-iframe`

Desktop grid example:

```scss
.invitation-editor__layout {
  display: grid;
  grid-template-columns: minmax(11rem, 14rem) minmax(28rem, 1fr) minmax(20rem, 34rem);
  gap: 1rem;
  align-items: start;
}
```

Preview pane:

```scss
.invitation-editor__preview-pane {
  position: sticky;
  top: var(--invitation-editor-sticky-offset);
  min-height: calc(100vh - var(--invitation-editor-sticky-offset) - 1rem);
}
```

Use fixed max widths inside the frame for mobile/tablet presets and `width: 100%` for desktop. Avoid
one-note palette changes and keep existing dashboard tokens.

## Preview Iframe URL Strategy

Phase 1 URL:

```text
/dashboard/invitaciones/[id]/preview?v=[previewVersion]
```

Optional phase 2 URL:

```text
/dashboard/invitaciones/[id]/preview?embed=1&v=[previewVersion]
```

Do not pass unsaved content in the URL. Do not pass serialized draft JSON. Do not add a preview
mutation endpoint.

## Save and Reload Behavior

- Editing fields marks sections dirty.
- Dirty state shows `Hay cambios sin guardar` in the action bar, nav/card state, and preview pane.
- `Guardar sección` saves one section and refreshes preview on success.
- `Guardar cambios` saves all dirty sections and refreshes preview once after all succeed.
- `Recargar` in the preview pane reloads saved data only.
- `Publicar cambios` continues to require no dirty local edits and uses the existing confirmation.
- Restore-from-published refreshes the preview after the restored draft is loaded.

## Rollback Strategy

Rollback is simple because phase 1 is mostly client layout and component extraction:

1. Stop rendering `EditorPreviewPane` from `InvitationEditor.tsx`.
2. Restore the previous bottom conditional preview panel if needed.
3. Revert the three-column `_intake.scss` layout to two columns.
4. Keep any route auth hardening from phase 2 if it is correct and independently valuable.

No database migration or content transformation is required.

## Risks and Mitigations

Risk: preview route is not explicitly guarded.

Mitigation: verify dashboard middleware protection before implementation. Add route-local read
access if needed.

Risk: iframe consumes too much width on mid-size screens.

Mitigation: use a conservative desktop breakpoint and hide/collapse preview below it.

Risk: auto-refresh after every section save causes excessive route work.

Mitigation: refresh only after successful saves. If needed, debounce only manual rapid reloads, not
save correctness.

Risk: embedded preview banner wastes viewport height.

Mitigation: add `embed=1` route behavior in phase 2.

Risk: device preset widths cause horizontal overflow.

Mitigation: constrain the frame with `max-width: 100%` and test mobile/tablet/desktop presets.

Risk: existing uncommitted editor/gallery work conflicts with implementation.

Mitigation: implement in a clean branch or after current WIP is committed/stashed; do not overwrite
local changes.

## Decisions Needed

1. Should phase 1 keep the internal preview banner inside the iframe, or should `embed=1` be part of
   the first implementation?
2. Should the action bar's `Vista previa` button focus the right pane on desktop, open a new tab on
   mobile, or always open a new tab once the pane exists?
3. Should `source='published'` be supported as a real route query in this iteration, or only as pane
   label/state for now?

## Verification Checklist

Use the closest relevant commands for the files changed:

```bash
pnpm test -- tests/components/EditorPreviewPane.test.tsx tests/components/InvitationEditor.test.tsx
pnpm test -- tests/components/GalleryEditor.test.tsx tests/unit/gallery-presentation.test.ts
pnpm test -- tests/unit/draft-preview-helper.test.ts tests/unit/invitation-editor.service.test.ts
pnpm lint:styles:changed
pnpm type-check
pnpm lint
```

Manual verification:

- Open `/dashboard/invitaciones/[id]/editar` while authenticated.
- Confirm desktop shows nav, editor, and right preview pane.
- Edit a field and confirm stale-preview copy appears.
- Save one section and confirm the iframe reloads saved content.
- Use `Recargar`, `Abrir vista completa`, `Móvil`, `Tableta`, and `Escritorio` with keyboard.
- Check small viewport behavior and confirm no horizontal overflow.

## Completion Notes

Completed on 2026-06-02.

### Phase Status

- Phase 1: Implemented. The editor now renders a persistent right-side `EditorPreviewPane`, uses the
  existing internal preview route in an iframe with `embed=1`, shows stale saved-preview copy, and
  refreshes only after successful saves or explicit reload.
- Phase 2: Implemented. Preview route access was verified through central dashboard middleware:
  `/dashboard/invitaciones` is an admin-only path, and both normal and embedded preview URLs are
  covered by tests for unauthenticated and `host_client` access. No route-local read guard was added
  because central middleware explicitly protects the route family.
- Phase 3: Implemented. The action bar keeps stable `Vista previa` copy, focuses the pane on
  desktop, and opens the versioned full preview route in a new tab below the split-layout
  breakpoint. The preview pane hides below the desktop split breakpoint.
- Phase 4: Implemented narrowly. Gallery rows were simplified from three simultaneous crop previews
  per image to one selected crop preview controlled by the existing `Vista previa` selector.
  Caption, ordering, shared and per-device focal point precision, and public gallery presentation
  behavior remain intact.

### Final Decisions

- Full preview links use `/dashboard/invitaciones/[id]/preview?v=[previewVersion]`.
- Embedded iframe links use `/dashboard/invitaciones/[id]/preview?embed=1&v=[previewVersion]`.
- The pane uses neutral saved-state copy: `Última versión guardada`.
- No forced `source=draft|published` prop or route behavior was introduced.
- Gallery simplification stayed local to the editor density issue and did not change public gallery
  rendering.

### Verification Results

- `pnpm test -- tests/components/EditorPreviewPane.test.tsx tests/components/InvitationEditor.test.tsx tests/integration/auth.middleware.test.ts`
  passed: 41 passed, 1 skipped.
- `pnpm test -- tests/components/GalleryEditor.test.tsx tests/unit/gallery-presentation.test.ts`
  passed: 11 passed.
- `pnpm test -- tests/unit/draft-preview-helper.test.ts tests/unit/invitation-editor.service.test.ts`
  passed: 34 passed.
- `pnpm lint:styles:changed` passed for `src/styles/dashboard/_intake.scss`.
- `pnpm type-check` passed with 0 errors, 0 warnings, and 1 existing hint for
  `CreateInvitationFlow.tsx` `FormEventHandler` deprecation.
- `pnpm lint` passed with the existing boundaries plugin legacy-selector migration warning.
- `git diff --check` passed with line-ending normalization warnings only.
- Browser smoke check passed for local `/login` rendering and unauthenticated
  `/dashboard/invitaciones/proj-1/preview?embed=1&v=0` redirecting to `/login` with no console
  errors.

### Remaining Risks

- Authenticated dashboard verification was not completed in this pass because no admin session or
  seeded invitation credentials were available. Iframe rendering with real invitation content,
  responsive visual framing, keyboard interaction, save/reload behavior, and gallery density with
  real images should still be checked in-browser before release.
