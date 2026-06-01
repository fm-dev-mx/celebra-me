---
title: Editor Data Hydration Fix
status: active
created: 2026-05-31
updated: 2026-05-31
related_skills: []
related_docs:
  - src/lib/intake/services/invitation-editor.service.ts
  - src/lib/intake/services/draft-content-mapper.ts
  - src/lib/intake/schemas/invitation-content-draft.schema.ts
  - src/lib/intake/types.ts
  - src/lib/dashboard/dto/intake.ts
  - src/components/dashboard/intake/editor/InvitationEditor.tsx
  - tests/unit/invitation-editor.service.test.ts
supersedes: []
superseded_by: []
---

# Editor Data Hydration Fix

## Status

Active — Phase 1 (hydration) implemented. Phase 2-4 pending.

## Problem

`hydrateEditableContent` only inherits `['gallery', 'itinerary', 'sectionOrder']` from
published/demo content when no draft exists. All other fields (hero, family, location, rsvp, music,
gifts, quote, thankYou, photoNotes) show as empty in the editor for demos and published invitations
without a draft.

## Root Cause

File: `src/lib/intake/services/invitation-editor.service.ts:27` — `HYDRATED_DRAFT_KEYS` is too
narrow.

## Implementation Plan

### Phase 1: Full Hydration (current)

- Extend hydrated keys to ALL editor-managed keys
- Add `mapNestedToDraftContent` helper to flatten published/demo content to DraftContent shape
- Track content source per section (`draft`, `published`, `demo`, `empty`, `mixed`)
- Update DTO to include section state metadata

### Phase 2: UI Source Indicators

- Display per-section source badges in editor
- Show which sections have draft/published/demo/empty content

### Phase 3: Save/Publish Safety

- Hydration status check before first save
- Pre-publish section summary
- Confirmation for destructive saves

### Phase 4: Dashboard/Editor UX

- Content summary in list table
- Sticky editor nav
- Save status feedback improvements

## Verification

```bash
pnpm test -- tests/unit/invitation-editor.service.test.ts
pnpm type-check
pnpm build
```
