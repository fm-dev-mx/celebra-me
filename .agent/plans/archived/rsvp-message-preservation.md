---
title: RSVP Message Preservation
status: implemented
created: 2026-06-12
updated: 2026-06-12
related_skills:
  - backend-engineering
related_docs:
  - docs/domains/database/overview.md
---

## Goal

Prevent RSVP guest messages from being overwritten when a guest submits a blank or whitespace-only
RSVP. Append new non-empty messages to the existing message history.

## Implementation

### Phase 1 — Server-side append/preserve

#### New files

- `src/lib/rsvp/core/guest-message.ts` — helpers: `isBlank`, `formatMessageTimestamp`,
  `getLatestMessage`, `appendGuestMessage`.
- `tests/lib/rsvp-v2/append-guest-message.test.ts` — unit tests.

### Edited files

- `src/lib/rsvp/core/utils.ts` — add `MAX_GUEST_COMMENT_LEN`.
- `src/lib/rsvp/core/rsvp-request.ts` — use `MAX_GUEST_COMMENT_LEN`.
- `src/lib/rsvp/services/rsvp-submission.service.ts` — server-side append/preserve logic in
  `persistRsvpResponse`.
- `tests/unit/guest-presenter.test.ts` — cumulative-format test case.
- `tests/unit/rsvp-v2.service.test.ts` — regression coverage.

### Not changed

- No database migration.
- No Supabase RLS changes.
- No repository changes.
- No client-side hooks, components, or section-render-data changes.
- No CSS changes (already has `white-space: pre-wrap`).
- No interface/type changes.

### Phase 2 — Dashboard presentation

#### Changed files

- `src/components/dashboard/guests/guest-presenter.ts` — added `parseGuestCommentHistory` and
  `GuestMessageEntry` type.
- `src/components/dashboard/guests/GuestTableRow.tsx` — render parsed message entries instead of raw
  `guestComment`.
- `src/styles/dashboard/_dashboard-guests-table.scss` — added `.guest-message-entries` and
  `.guest-message-entry` styles.
- `tests/unit/guest-presenter.test.ts` — 7 test cases for `parseGuestCommentHistory`.
- `tests/components/GuestTableRow.test.tsx` — updated selector to `.guest-message-entry__text`.

### Not changed

- No database migration.
- No Supabase RLS changes.
- No repository changes.
- No client-side hooks, components, or section-render-data changes.
- No interface/type changes.
- No server-side append format changes.

## Validation

### Phase 1

- `pnpm test append-guest-message` — 20/20 passed
- `pnpm test guest-presenter` — 60/60 passed
- `pnpm test rsvp-v2.service` — 31/31 passed
- `pnpm type-check` — 0 errors, 0 warnings
- `pnpm lint` — 0 errors, 64 warnings (pre-existing)
- `pnpm test` — 2201/2203 passed (2 skipped, pre-existing)

### Phase 2

- `pnpm test guest-presenter` — 67/67 passed
- `pnpm test GuestTableRow` — 20/20 passed
- `pnpm type-check` — 0 errors, 0 warnings
- `pnpm lint` — 0 errors, 64 warnings (pre-existing)
- `pnpm lint:styles` — 6 pre-existing errors (unrelated SCSS files)
- `pnpm test` — 2208/2210 passed (2 skipped, pre-existing)
