---
title: Draft Preview Merge Fix — Publish Safety
status: completed
created: 2026-06-14
updated: 2026-06-14
completed: 2026-06-14
related_skills:
  - backend-engineering
related_docs:
  - src/lib/intake/services/invitation-editor.service.ts
  - src/lib/invitation/draft-preview-helper.ts
  - src/lib/intake/services/publishing.service.ts
  - src/lib/intake/mappers/draft-to-published.mapper.ts
  - src/pages/dashboard/invitaciones/[id]/preview.astro
  - src/lib/intake/services/merge-content.service.ts
supersedes:
  - editor-hydration-fix.md
superseded_by:
  - thank-you-overlay-preservation.md
---

# Draft Preview Merge Fix — Publish Safety

## Status

**Completed on 2026-06-14.** All 5 phases implemented and verified. The effective content flow is
now consistent across editor hydration, preview, publish, and first-draft seed.

## Problem

The editor preview and publish flow both use raw sparse draft content instead of effective merged
content (published + draft). This causes:

1. **Preview mismatch**: `data-total-sections="4"` vs `"8"` on public route. Empty quote text in
   preview while form shows it correctly.
2. **Publish data-loss**: Publishing a sparse draft overwrites the existing full published content,
   dropping sections not present in the draft.

## Root Cause

- `selectPreviewContent()` returns raw draft OR raw published — no merge.
- `publishDraft()` passes raw draft to `mapDraftToPublished()`.
- `hydrateEditableContent()` already does the right merge but is only used for the editor form — not
  reused by preview or publish.

## Implementation Plan

### Phase 1: Create `mergePublishedWithDraft()` Helper

Extract the core merge logic from `hydrateEditableContent` into a standalone testable helper in
`src/lib/intake/services/merge-content.service.ts`.

### Phase 2: Refactor `hydrateEditableContent` to Use New Helper

Replace inline merge in `hydrateEditableContent` with the new helper. Behavior must be identical.

### Phase 3: Fix Preview to Use Effective Merged Content

Replace `selectPreviewContent` with `computeEffectiveContent` in `draft-preview-helper.ts`. Update
`preview.astro` to always use effective content.

### Phase 4: Fix Publish to Use Effective Merged Content

In `publishDraft()`, merge draft with existing published content before calling
`mapDraftToPublished`.

### Phase 5: Sync Draft on First Edit

When saving a section for an invitation with no existing draft but with published content,
initialize the draft from published content.

## Files Changed

- `src/lib/intake/services/merge-content.service.ts` (new)
- `src/lib/intake/services/invitation-editor.service.ts` (refactor)
- `src/lib/invitation/draft-preview-helper.ts` (add computeEffectiveContent)
- `src/pages/dashboard/invitaciones/[id]/preview.astro` (use effective content)
- `src/lib/intake/services/publishing.service.ts` (merge before publish)

## Files Not Touched

- `src/components/invitation/Quote.astro`
- `src/lib/adapters/event.ts`
- `src/lib/intake/mappers/draft-to-published.mapper.ts`
- `src/lib/theme/theme-contract.ts`

## Remaining Work (Post-Completion)

A section-by-section audit on 2026-06-14 identified a P0 data-loss bug:

- `thankYou` overlay fields (`focalPoint`, `overlayAnchor`, `overlaySafeArea`) were missing from the
  editor messages schema and the published → draft reverse mapper. Fixed in a follow-up pass that
  also updated documentation to prevent recurrence.

## Validation

```bash
pnpm lint
pnpm test
pnpm validate:event-parity
NODE_OPTIONS=--max-old-space-size=8192 pnpm type-check
```
