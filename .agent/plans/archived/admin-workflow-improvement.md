---
title: Admin Workflow Improvement Plan
status: superseded
created: unknown
updated: 2026-05-31
superseded_by: invitation-dashboard-premium-plan.md
---

# Admin Workflow Improvement Plan

## Intent

Improve the internal invitation workflow at Celebra-me.com for operational clarity, correctness, and
maintainability. The system already has a well-structured intake pipeline; this plan normalizes
navigation, state transitions, review UX, and publishing safety without broad refactors.

## Constraints

- Do not introduce photo upload, file storage, or asset management.
- Visible UI copy in Spanish; code/types/internal naming in English.
- No broad refactors. Small, reversible, buildable-at-every-phase changes.
- No new Supabase migrations unless explicitly required (none are needed for the phases below).
- Keep Eventos and Invitaciones as separate technical models (they serve different purposes).

## Verification

Every phase must pass:

```bash
pnpm type-check && pnpm lint && pnpm test && pnpm build
```

---

## Phase 1 — Normalize creation flow, states, and navigation

**Files to change**:

- `src/layouts/DashboardLayout.astro` — remove `Eventos` nav item, keep Invitaciones as primary
  admin home
- `src/lib/intake/services/publishing.service.ts` — add
  `updateInvitationProject(id, { status: 'published' })` after successful publish
- `src/lib/intake/types.ts` — consider removing unused `preview_sent` from project statuses
- Deduplicate STATUS_LABELS maps in: `InvitationList.tsx`, `InvitationDetail.tsx`,
  `SubmissionReview.tsx`, `IntakeLinkPanel.tsx`

**Acceptance**:

- Sidebar shows: Invitados, Admin, Códigos de acceso, Invitaciones, Usuarios (no Eventos)
- Publishing sets project status to `published`
- No duplicate STATUS_LABELS

---

## Phase 2 — Improve human-readable intake review

**Files to change**:

- `src/components/dashboard/intake/SubmissionReview.tsx` — replace raw `Object.entries(key)` with
  Spanish labels from block definitions; render date-locations ceremony/reception as sub-sections
  instead of JSON blobs

**Acceptance**:

- Review shows "Nombre del festejado(a)" not "celebrantName"
- Date-locations renders structured ceremony/reception sections
- No `JSON.stringify` in review display

---

## Phase 3 — Add photo captions and usage notes (no upload)

**Files to change**:

- `src/lib/intake/blocks/photos.block.ts` — add `photoOrder`, `cropNotes`, `priorityNotes` fields
- `src/lib/intake/schemas/intake-block.schema.ts` — add corresponding Zod fields
- `src/components/intake/blocks/PhotosBlock.tsx` — add form fields
- `src/lib/intake/schemas/invitation-content-draft.schema.ts` — add to `photoNotes`
- `src/lib/intake/services/draft-content-mapper.ts` — map new fields
- `src/components/dashboard/intake/DraftEditor.tsx` — add editor fields
- `src/components/dashboard/intake/DraftReview.tsx` — add review display

**Acceptance**:

- Client intake has ordering notes, crop notes, priority notes
- Admin screens show these fields
- No file upload introduced

---

## Phase 4 — Improve internal content editor

**Files to change**:

- `src/components/dashboard/intake/DraftEditor.tsx` — improve field organization, add inline
  validation, add save feedback

**Acceptance**:

- All sections editable (Hero, Family, Location, RSVP, Music, Gifts, Messages, Photo Notes)
- Changes persisted via PATCH
- Validation prevents saving incomplete data

---

## Phase 5 — Harden publishing flow and tests

**Files to change**:

- `src/lib/intake/services/publishing.service.ts` — ensure project status → `published` (already in
  Phase 1, verify completeness)
- `tests/unit/publishing.service.test.ts` — add test for project status update
- New test functions for review display, photo notes schema, draft editor sections

**Acceptance**:

- Publish sets both draft status → `approved` and project status → `published`
- Published content in `published_invitation_content` + `events` row created/updated
- Draft not editable after publish
- All existing and new tests pass
