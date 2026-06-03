---
title: Invitation Public Safety, Data Consistency & Editor Corrections
status: active
created: 2026-06-03
updated: 2026-06-03
phase: all
implemented:
  - Phase 1: Public route safety — graceful asset resolution, error boundary, logging
  - Phase 2: Publish validation — collectPublishedAssetRefs + assertAllAssetsResolvable
  - Phase 3: VenueCard date formatting, consistent timeZone: UTC across components
  - Phase 4: ImageAssetField overflow/empty-state fix
related_skills:
  - backend-engineering
  - astro-patterns
  - testing
  - frontend-design
related_docs:
  - .agent/plans/README.md
  - .agent/plans/active/invitation-dashboard-premium-plan.md
  - .agent/plans/active/invitation-asset-library-enhancement.md
  - docs/core/architecture.md
supersedes: []
superseded_by: []
---

# Invitation Public Safety, Data Consistency & Editor Corrections

## 1. Executive Summary

The codebase builds cleanly (0 type errors, 149/150 test suites pass, production build succeeds) and
the architecture is well-separated. However, several correctness and UX issues exist at the
intersection of asset resolution, date handling, publish validation, and editor presentation.

**What is broken:**

- Public invitation routes can crash with `[AssetRegistry] Required asset is missing` when a
  published invitation references a demo preset whose image assets don't exist on disk. This occurs
  when `_assetSlug` in published content points to a non-existent event asset directory.

**What is risky:**

- The publish flow validates `hero.backgroundImage` but NOT portrait, gallery images, interludes,
  venue images, or thankYou images. A published invitation can pass validation with unresolvable
  assets in those fields.
- Venue dates are displayed as raw ISO strings (e.g. `"2026-08-01T18:00:00.000Z"`) on the public
  invitation because `VenueCard.astro` renders `venue.date` directly without formatting.
- The editor sends `datetime-local` values without timezone, but `normalizeHeroDate()` treats them
  as UTC. Hero date formatting and reveal-card date formatting use different timezone handling,
  risking off-by-one-day shifts on non-UTC servers.
- The `contentSlug` vs `assetLookupSlug` dual design in `draft-preview-helper.ts` could cause asset
  resolution gaps when invitation slug differs from previewSlug.

**What is only polish:**

- `ImageAssetField` verbose labels and card layout.
- `EditorSidebar` density and visual noise (already tracked in premium plan).
- `GalleryEditor` exposes too many secondary actions per item (already tracked in premium plan).
- Preview device selector labels without visual icons.
- These are tracked in the existing `invitation-dashboard-premium-plan.md`.

**Recommended implementation order:**

1. Public route error boundary + safe fallback rendering
2. Asset resolvability validation in publish flow (all asset fields)
3. VenueCard date formatting fix
4. Timezone consistency for date formatting
5. Preview slug dual-value consolidation
6. Image asset field overflow/empty-state fix
7. Editor visual hierarchy improvements (complementary to existing premium plan)

---

## 2. Findings

### Finding 1: Public route can crash on missing assets

**Severity:** Blocking

**Evidence:**

- `src/lib/adapters/event.ts:115-125`: `requireAsset()` throws
  `[AssetRegistry] Required asset is missing for event "${eventSlug}".`
- Called at line 173 for `hero.backgroundImage` and line 337 for gallery items.
- `src/pages/[eventType]/[slug].astro:23-27`: The route calls `resolveInvitationContent()` which
  returns null (causes 404), but if the resolution succeeds and the asset is missing at render time,
  the error propagates uncaught.
- `src/lib/invitation/content-resolver.ts:21-29`: DB-published content uses `_assetSlug` from the
  stored record. If this references a slug whose assets were removed or never existed,
  `getEventAsset()` returns undefined and `requireAsset()` throws.
- `src/pages/dashboard/invitaciones/[id]/preview.astro:68-107`: Preview uses
  `buildDraftPreviewPageContext()` which catches errors in `draft-preview-helper.ts:98-106` and
  returns an error message. So preview is safe, but public route is NOT.

**Why it matters:** A public invitation URL returns HTTP 500 instead of a user-friendly error. This
destroys the guest experience and erodes trust.

**Suggested correction:**

1. Add a server-side try/catch around the rendering block in `[slug].astro`.
2. Change `requireAsset()` calls in `adapters/event.ts` for non-critical positions (portrait,
   gallery, interludes, venue images) to use graceful `resolveAsset()` that logs warnings instead of
   throwing.
3. Add comprehensive asset resolvability validation to the publish flow.

**Risk/trade-off:** Using fallback assets instead of throwing could hide bugs. But a broken image
placeholder is vastly better than a 500 error. Add server-side logging that reaches admin
monitoring.

---

### Finding 2: Publish validation does not check all asset fields

**Severity:** High

**Evidence:**

- `src/lib/intake/services/publishing.service.ts:152-169`: `assertHeroBackgroundResolvable()` only
  checks `hero.backgroundImage` when its type is `'internal'`.
- Does NOT check: `hero.portrait`, gallery items, interludes, venue images, `thankYou.image`,
  `family.featuredImage`, or `sharing.ogImage`.
- `src/lib/intake/mappers/draft-to-published.mapper.ts:342`: `_assetSlug` is set from
  `input.assetSlug ?? snapshot.previewSlug`.
- `publishing.service.ts:99-105`: `resolvePublishAssetSlug()` validates that `previewSlug` is a
  valid event before publishing. This gate prevents the most common cause of missing assets but only
  for `internal`-type assets; `uploaded` assets go through `freezeUploadedContentRefs()`.

**Why it matters:** A user can publish an invitation whose gallery uses `internal` keys that won't
resolve, producing a broken public page with missing images.

**Suggested correction:** Extend `assertHeroBackgroundResolvable()` (or add
`assertAllAssetsResolvable()`) to walk the full published content tree and verify every
`internal`-type asset reference resolves against the current `assetSlug`.

**Risk/trade-off:** Small CPU cost per publish. The walk is O(n) over content fields and runs on the
server, so negligible.

---

### Finding 3: Venue dates rendered as raw ISO strings on public invitation

**Severity:** High

**Evidence:**

- `src/components/invitation/components/VenueCard.astro:82`: Renders `{venue.date}` directly.
- The `venue.date` field is a raw string from the content, stored as ISO datetime.
- By contrast, `Hero.astro:55-59` and `Countdown.astro:27-33` both format dates using
  `toLocaleDateString`/`Intl.DateTimeFormat`.
- `src/lib/adapters/event.ts:287-291`: `resolveVenueData()` passes through venue values including
  `date` without transformation.

**Why it matters:** The location section displays unformatted timestamps like
`"2026-08-01T18:00:00.000Z"` instead of a human-readable date like `"1 de agosto de 2026"`.

**Suggested correction:** Format `venue.date` in `VenueCard.astro` using the same
`toLocaleDateString('es-MX')` pattern as Hero.astro, or pre-format in the adapter layer.

**Risk/trade-off:** Low risk. Only changes rendering. Must handle invalid/missing dates gracefully.

---

### Finding 4: Timezone inconsistency between date formatting locations

**Severity:** Medium

**Evidence:**

- `src/components/invitation/Hero.astro:55-59`: `new Date(date).toLocaleDateString('es-MX')` — NO
  explicit `timeZone`. Uses server runtime default (UTC on Vercel).
- `src/components/invitation/Countdown.astro:27-37`: `new Intl.DateTimeFormat('es-MX', ...)` — NO
  explicit `timeZone`.
- `src/lib/invitation/reveal-card.ts:21-28`: `new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC' })`
  — EXPLICIT `timeZone: 'UTC'`.
- `src/lib/intake/mappers/draft-to-published.mapper.ts:11-15`: `normalizeHeroDate()` appends `Z`
  (UTC) to the date string when normalizing from editor input. Editor sends `datetime-local` values
  (no timezone), which this treats as UTC.
- Editor `MainSectionEditor.tsx:96-98`: strips `Z` and slices to 16 chars for the `datetime-local`
  input.

**Why it matters:** Different components may render the same date differently if the Astro server
runs in a non-UTC timezone. This risk is low on Vercel (which uses UTC) but creates a latent bug.

**Suggested correction:** Standardize on `timeZone: 'UTC'` for all date-to-display-format
conversions. This matches the published content's `Z` suffix convention. Update Hero.astro and
Countdown.astro.

**Risk/trade-off:** Low risk if Vercel already uses UTC.

---

### Finding 5: Preview slug dual-value design can cause asset resolution gaps

**Severity:** Medium

**Evidence:**

- `src/lib/invitation/draft-preview-helper.ts:56-57`: Defines `contentSlug` (invitation.slug or
  snapshot.previewSlug) and `assetLookupSlug` (snapshot.previewSlug).
- Line 72 passes `assetSlug: contentSlug` to `mapDraftToPublished()`.
- Line 82 passes `assetSlug: assetLookupSlug` to `adaptDbEvent()`.
- When `invitation.slug` differs from `snapshot.previewSlug`, the mapped content gets
  `_assetSlug: contentSlug` (the invitation slug), while the adapter uses `assetLookupSlug` (the
  preview slug) for asset resolution.

**Why it matters:** Subtle confusion in the code that could lead to future bugs if someone refactors
without understanding the dual-role.

**Suggested correction:** Add a code comment explaining the dual-value design. Rename `contentSlug`
to `viewModelId` and `assetLookupSlug` to `assetSlug` for clarity. No behavioral change.

**Risk/trade-off:** None.

---

### Finding 6: ImageAssetField has layout/overflow issues

**Severity:** Medium

**Evidence:**

- `src/components/dashboard/intake/editor/ImageAssetField.tsx:83-111`: The card layout uses
  `className`-based selection and hard-coded labels. The `.invitation-editor__image-preview` and
  `.invitation-editor__image-copy` are inline blocks without explicit overflow handling.
- Shows "IMG" text as placeholder when no image is selected, which may overflow on small screens.
- Renders a `<strong>` label ("Imagen seleccionada" / "Sin imagen seleccionada") alongside the image
  preview and metadata text — redundant visual noise.

**Why it matters:** The editor looks unpolished when image fields are empty or the viewport is
narrow.

**Suggested correction:**

1. Add `overflow: hidden` and `text-overflow: ellipsis` to the image field card elements.
2. Remove the redundant `<strong>` label inside the card; the field label already indicates the
   purpose.
3. Ensure a minimum card height for empty state.

**Risk/trade-off:** Low. Visual change only.

---

### Finding 7: Gallery editor exposes too many secondary actions per item

**Severity:** Medium

**Evidence:**

- `src/components/dashboard/intake/editor/GalleryEditor.tsx:110-225`: Each gallery item shows:
  index+role badge, image key text, "Seleccionar imagen" button, "Quitar de galería" button, crop
  mode selector, image preview, focal point control, caption input, per-device focal point toggle,
  and reorder buttons. This makes each item card extremely tall.
- The "Notas internas" section at lines 227-272 adds operational complexity within the same card.

**Suggested correction:**

- Already partially addressed: focal point controls are inside a `<details>` element (line 177).
- Make "Seleccionar imagen" and "Quitar de galería" icon-only buttons with aria-labels.
- Move "Notas internas" completely out of the gallery card into a separate sidebar panel.
- Reduce per-item vertical space using a horizontal layout for image key and action buttons.

**Risk/trade-off:** The existing premium plan already covers photo notes relocation. This finding
confirms that plan.

---

### Finding 8: No safe public-route error boundary

**Severity:** Blocking

**Evidence:**

- `src/pages/[eventType]/[slug].astro` has no error handling around the rendering block (lines
  96-182).
- If `requireAsset()` throws during `Hero` rendering, the entire page crashes to Astro's 500 page.
- The `resolveInvitationContent()` function at the top can return null (leads to 404). But the
  actual rendering (Hero, sections, gallery) is unprotected.

**Suggested correction:** Wrap the rendering section in a try/catch. On caught error, render a
minimal user-friendly page (e.g. "La invitación no está disponible momentáneamente") instead of
propagating the error. Log the error to server-side monitoring.

**Risk/trade-off:** Very safe. Prevents 500 errors with minimal code.

---

### Finding 9: Dashboard editor "Escritorio" preview label is ambiguous

**Severity:** Low

**Evidence:**

- `src/lib/editor/constants.ts:6-8`: Device labels are `Móvil`, `Tableta`, `Escritorio`.
- `src/components/dashboard/intake/editor/EditorPreviewPane.tsx:68-82`: The device tabs are simple
  text buttons without any icon or width annotation.
- "Escritorio" fills the available iframe container width, which may not visually communicate
  "desktop width" if the editor pane is narrow.

**Suggested correction:** Add small width indicators next to the labels (e.g. `Móvil — 375px`,
`Tableta — 768px`, `Escritorio — 100%`). Keep Spanish labels.

**Risk/trade-off:** Low. Visual-only.

---

### Finding 10: Editor sidebar is dense with overlapping indicators

**Severity:** Low

**Evidence:**

- `src/components/dashboard/intake/editor/EditorSidebar.tsx:117-202`: Each section row can
  simultaneously show: source dot, label, dirty asterisk, saving spinner, status text, reorder
  buttons, and visibility toggle.
- `src/components/dashboard/intake/editor/SectionCard.tsx:40-49`: Each card shows source badge +
  dirty label in header.
- This is the same issue tracked in the premium plan. Confirming it here.

**Suggested correction:** Defer to existing `invitation-dashboard-premium-plan.md`. No new action
needed.

**Risk/trade-off:** N/A — already planned.

---

## 3. Implementation Plan

### Phase 1: Public Route Safety (Blocking)

| #   | File(s)                                                                                     | Description                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | `src/pages/[eventType]/[slug].astro`                                                        | Wrap rendering in try/catch. On error, render minimal fallback page with user-friendly message in Spanish. Log error to console/server monitoring.                                                                                                                                      |
| 1.2 | `src/lib/adapters/event.ts`                                                                 | Change `requireAsset()` usages for non-critical assets (portrait, gallery, interludes, venue images, thankYou image) to use `resolveAsset()` with graceful skip. Keep `requireAsset()` for `hero.backgroundImage`. When an asset can't be resolved, log a warning and return undefined. |
| 1.3 | `src/components/invitation/*.astro` (Hero, Gallery, VenueCard, Interlude, ThankYou, Family) | Ensure all components that receive optional `ImageAsset \| undefined` handle `undefined` gracefully (skip rendering, no broken image tags).                                                                                                                                             |

### Phase 2: Publish Validation (High)

| #   | File(s)                                         | Description                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | `src/lib/intake/services/publishing.service.ts` | Replace `assertHeroBackgroundResolvable()` with `assertAllAssetsResolvable()` that walks the full published content tree and validates every `internal`-type asset reference resolves against `assetSlug`. Report all unresolvable assets in the error message. |
| 2.2 | `src/lib/intake/services/publishing.service.ts` | Add check that venue dates are parseable and non-empty when location section is present.                                                                                                                                                                        |
| 2.3 | `tests/unit/publishing.service.test.ts`         | Add test case for publish with missing internal assets in gallery, portrait, and venue images.                                                                                                                                                                  |

### Phase 3: Date/Location Display Fixes (High)

| #   | File(s)                                                | Description                                                                                                                                                                         |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | `src/components/invitation/components/VenueCard.astro` | Format `venue.date` using `new Date(date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })`. Handle empty/invalid dates gracefully. |
| 3.2 | `src/components/invitation/Hero.astro`                 | Add `timeZone: 'UTC'` to `toLocaleDateString` call for consistency.                                                                                                                 |
| 3.3 | `src/components/invitation/Countdown.astro`            | Add `timeZone: 'UTC'` to `Intl.DateTimeFormat` call.                                                                                                                                |
| 3.4 | `src/lib/invitation/draft-preview-helper.ts`           | Rename `contentSlug` → `viewModelId`, `assetLookupSlug` → `assetSlug`. Add comment explaining the dual-value design intent.                                                         |

### Phase 4: Editor UX Corrections (Medium)

| #   | File(s)                                                        | Description                                                                                                                                                               |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | `src/components/dashboard/intake/editor/ImageAssetField.tsx`   | Fix overflow: add `overflow: hidden; text-overflow: ellipsis` to card elements. Remove redundant `<strong>` label. Ensure minimum empty-state height.                     |
| 4.2 | `src/components/dashboard/intake/editor/GalleryEditor.tsx`     | Collapse per-item focal point (already done via `<details>` — verify). Make action buttons icon-only with aria-labels. Move "Notas internas" to a separate sidebar panel. |
| 4.3 | `src/components/dashboard/intake/editor/EditorPreviewPane.tsx` | Add width indicators to device selector buttons.                                                                                                                          |

### Phase 5: Premium UI Polish (Low — defer to existing premium plan)

Items already tracked in `invitation-dashboard-premium-plan.md`. Do not duplicate work.

---

## 4. Files Likely to Change

**Phase 1:**

- `src/pages/[eventType]/[slug].astro`
- `src/lib/adapters/event.ts`
- `src/components/invitation/Hero.astro`
- `src/components/invitation/Gallery.astro` (or `PhotoGallery.astro`)
- `src/components/invitation/components/VenueCard.astro`
- `src/components/invitation/ThankYou.astro`
- `src/components/invitation/Interlude.astro`

**Phase 2:**

- `src/lib/intake/services/publishing.service.ts`
- `tests/unit/publishing.service.test.ts`

**Phase 3:**

- `src/components/invitation/components/VenueCard.astro`
- `src/components/invitation/Hero.astro`
- `src/components/invitation/Countdown.astro`
- `src/lib/invitation/draft-preview-helper.ts`

**Phase 4:**

- `src/components/dashboard/intake/editor/ImageAssetField.tsx`
- `src/components/dashboard/intake/editor/GalleryEditor.tsx`
- `src/components/dashboard/intake/editor/EditorPreviewPane.tsx`
- `src/lib/editor/constants.ts`
- `src/styles/dashboard/_intake.scss` (overflow fixes)

---

## 5. Testing Strategy

### Unit tests

- `tests/unit/publishing.service.test.ts`: Add test cases for publish with unresolvable internal
  assets in gallery, portrait, venue images.
- `tests/unit/adapters.test.ts` (create if needed): Test that `resolveAsset()` returns undefined
  gracefully (no throw) for non-critical asset types.
- `tests/components/ImageAssetField.test.tsx`: Add test for empty state rendering and overflow
  behavior.

### Component tests

- `tests/components/InvitationEditor.test.tsx`: Test that editor loads correctly with missing
  previewSlug.
- `tests/components/GalleryEditor.test.tsx`: Verify action buttons and empty state.

### Integration/build checks

- Build must pass: `pnpm build`
- Type check must pass: `pnpm type-check`
- Lint must pass: `pnpm lint`

### Manual QA checklist

1. Create invitation, publish with a theme that has all required assets. Verify public route renders
   correctly.
2. Create invitation, remove demo asset images from `src/assets/images/events/<slug>/`, verify
   publish is blocked.
3. On existing published invitation that references missing assets, verify public route shows
   fallback page instead of crash.
4. Verify venue dates display as formatted dates (not ISO strings) on public invitation.
5. Verify hero date matches across Hero, Countdown, and Envelope reveal card.
6. Verify image field in editor does not overflow on narrow viewports.
7. Verify device selector shows distinct width indicators.

### Regression cases

- Published invitation with missing hero background → should show error page, not crash.
- Published invitation with empty gallery → should render gallery section gracefully.
- Venue with empty date → should render venue card without date line.
- Demo invitation with missing portrait → should not crash, portrait section should be skipped.

---

## 6. Acceptance Criteria

1. Public invitation route **never** returns HTTP 500 due to missing assets. Missing assets produce
   either graceful fallback or a user-friendly error page.
2. Publish flow validates ALL internal asset references (not just hero background) and blocks
   publication with a clear error message listing all unresolvable assets.
3. Venue dates display as formatted, human-readable Spanish dates on the public invitation.
4. Date formatting consistently uses `timeZone: 'UTC'` across Hero, Countdown, and VenueCard.
5. ImageAssetField does not overflow on narrow viewports and presents a clean empty state.
6. All existing tests continue to pass.
7. Production build succeeds with zero errors.

---

## 7. Non-Goals

- Do NOT add a new date abstraction library or custom date utility. Use existing
  `Intl.DateTimeFormat` patterns consistently.
- Do NOT redesign the editor layout or component architecture — those are covered by
  `invitation-dashboard-premium-plan.md`.
- Do NOT introduce new database migrations.
- Do NOT change the asset discovery mechanism (e.g. don't replace `import.meta.glob`).
- Do NOT add generic template/default restore actions.
- Do NOT change the draft/published content schema.
- Do NOT add autosave or real-time collaboration.
- Do NOT translate UI text to English.
