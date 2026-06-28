# SDD: Dashboard Guest Metrics & RSVP Default Attendee Quantity

## Current Problems Observed

1. **Dashboard "Enviadas" inflation hypothesis**: The dashboard was reported to show "Enviadas 22"
   when the user expected fewer. Code inspection confirms `buildDashboardTotals` correctly counts
   unique invitations with `deliveryStatus === 'shared'` (mutually exclusive with `'generated'`).
   Each guest record has exactly one `deliveryStatus`. The likely root cause is **genuine guest
   record volume** (bulk imports, repeated testing, or real guest data) rather than a counting logic
   defect — the metric code itself is correct.

2. **RSVP attendee quantity defaults to 1 (or 0)**: The `useRsvpSubmission` hook calculates
   `initialAttendeeCount` as:

   ```
   initialAttendeeCount = initialData?.attendeeCount ?? effectiveGuestCap;
   ```

   When the guest has **not yet responded**, the database stores `attendee_count = 0`. Since `0` is
   not nullish, `0 ?? effectiveGuestCap` evaluates to **0** — not `maxAllowedAttendees`. The UI may
   then clamp to 1, but the expected default (`maxAllowedAttendees`) is lost. This causes confirmed
   attendee counts to be underreported because most guests do not manually adjust the quantity.

3. **No exclusion of test/demo records**: The `findGuestsByEvent` query filters only by `event_id`
   and `deleted_at=is.null`. There is no mechanism to exclude demo/test guest records from
   production metrics. No existing convention for tagging test records exists at the guest level
   (events use `is_demo` on the `invitations` table, but `guest_invitations` has no such flag).

## Files Inspected

| File                                                              | Role                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/rsvp/services/dashboard-guests.service.ts`               | `buildDashboardTotals` — core metric aggregation                    |
| `src/interfaces/dashboard/guest.interface.ts`                     | `DashboardGuestItem` & `DashboardGuestListResponse['totals']` types |
| `src/hooks/use-rsvp-submission.ts`                                | `initialAttendeeCount` calculation in `useRsvpSubmission`           |
| `src/components/invitation/RSVP.tsx`                              | RSVP component rendering, `initialGuestData` prop shape             |
| `src/components/invitation/RSVPComponents.tsx`                    | `RsvpFormView` rendering the attendee count field                   |
| `src/components/invitation/RSVPFormFields.tsx`                    | `ConfirmedFields` subcomponent with guest count input               |
| `src/components/invitation/rsvp-logic.ts`                         | Validation, `normalizeGuestCount`, helper functions                 |
| `src/components/dashboard/guests/GuestSummary.tsx`                | UI rendering of totals (Enviadas, Confirmadas, Asistentes)          |
| `src/components/dashboard/guests/guest-presenter.ts`              | Per-guest status labels (not totals)                                |
| `src/components/dashboard/guests/use-guest-dashboard-realtime.ts` | Client-side totals state, polling                                   |
| `src/lib/rsvp/repositories/guest.repository.ts`                   | DB queries for guests                                               |
| `src/lib/rsvp/repositories/shared/rows.ts`                        | Column mapping, `toGuestRecord`                                     |
| `src/lib/invitation/section-render-data.ts`                       | RSVP props generation, `initialGuestData` construction              |
| `src/lib/rsvp/services/shared/guest-dto.ts`                       | Guest DTO mapping                                                   |
| `src/interfaces/rsvp/domain.interface.ts`                         | `GuestInvitationRecord`, `DeliveryStatus`, `AttendanceStatus` types |
| `src/lib/dashboard/dto/guests.ts`                                 | DTOs for dashboard API                                              |
| `src/lib/dashboard/guests-api.ts`                                 | Client-side API class                                               |
| `src/lib/guests/guest-tags.ts`                                    | `system:` tag prefix convention                                     |
| `tests/unit/rsvp-guest-count.test.tsx`                            | Existing RSVP attendee count tests                                  |
| `tests/helpers/guest-factory.ts`                                  | `makeGuest` test helper                                             |
| `supabase/migrations/20260215000300_rsvp_v2_core.sql`             | DB schema (delivery_status default 'generated')                     |

## Root-Cause Hypotheses

### H1: "Enviadas" metric is logically correct

The `sharedInvitations` counter checks `deliveryStatus === 'shared'` on each unique guest record.
Since each guest has exactly one `deliveryStatus`, repeated sends do not inflate this counter. If
the dashboard shows 22, there are 22 guest records with `deliveryStatus='shared'` for that event.

**Conclusion**: The metric code is correct. The reported "Enviadas 22" is either a misunderstanding
of the data, or there genuinely are 22 guest records (from bulk imports, demo/test data, or real
guest management). No code change needed for the aggregation logic itself.

### H2: RSVP defaults to 1 (not maxAllowedAttendees)

Confirmed bug. The `??` nullish coalescing operator fails when `attendeeCount` is 0 (which is the DB
default for unresponded guests). The fix is straightforward: treat 0 as "not yet responded" and fall
back to `effectiveGuestCap`.

## Final Metric Definitions

| Metric                  | Code Field             | Definition                                                          | Current Status                                    |
| ----------------------- | ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| Total invitations       | `totalInvitations`     | Count of unique guest invitation records                            | ✅ Correct                                        |
| Enviadas (sent)         | `sharedInvitations`    | Count of unique invitations with `deliveryStatus === 'shared'`      | ✅ Correct                                        |
| Por confirmar (pending) | `unconfirmedShared`    | Count of sent invitations without final RSVP                        | ✅ Correct                                        |
| Confirmadas             | `confirmedInvitations` | Count of invitations with `attendanceStatus === 'confirmed'`        | ✅ Correct                                        |
| Asistentes              | `confirmedPeople`      | Sum of `attendeeCount` for confirmed invitations only               | ✅ Correct                                        |
| Vistas                  | `viewed`               | Count of invitations with `firstViewedAt` set                       | ✅ Correct                                        |
| Denegadas               | `declinedInvitations`  | Count of invitations with `attendanceStatus === 'declined'`         | ✅ Correct                                        |
| Por enviar              | `generatedInvitations` | Count of invitations with `deliveryStatus === 'generated'`          | ✅ Correct                                        |
| Total invited capacity  | `totalPeople`          | Sum of `maxAllowedAttendees` for all invitations (denominator only) | ⚠️ Documented capacity sum, not a confirmed count |

### Total invited capacity note

`totalPeople` sums `maxAllowedAttendees` across ALL guest records. It is displayed in the UI as a
denominator alongside `confirmedPeople` (Asistentes). This includes pending and unsent invitations.
It is **not** a confirmed attendee count — it represents the total invited capacity. This is
intentional UI context, not a metric bug.

## RSVP Attendee Quantity Rules

1. **Default**: If the guest has NOT yet responded (`attendeeCount === 0`), the RSVP form defaults
   to `maxAllowedAttendees` (the guest's assigned capacity).
2. **Existing response preserved**: If the guest has already responded (`attendeeCount > 0`), the
   saved value is shown.
3. **Declined guests**: Default to 0 (unchanged).
4. **Clamping**: Quantity is clamped between 1 and `effectiveGuestCap` (which equals
   `maxAllowedAttendees`).
5. **No maxAllowedAttendees**: Fall back to `guestCap` (event-level default), then to 1.
6. **UI copy (Spanish)**: New helper text: "Hemos reservado {maxGuests} lugares para tu invitación.
   Puedes ajustar el número si asistirán menos personas."

## Implementation Scope

### Change 1: Fix RSVP initial attendee count

- **File**: `src/hooks/use-rsvp-submission.ts`
- **Lines**: 76-79
- **Change**: Replace `(initialData?.attendeeCount ?? effectiveGuestCap)` with
  `((initialData?.attendeeCount ?? 0) || effectiveGuestCap)`
- The `||` operator treats 0 as falsy and falls back to `effectiveGuestCap`
- **Precondition**: Only applies when `initialAttendanceStatus !== 'declined'`
- **No changes to**: DB schema, API, DTOs, or component props

### Change 2: Add UI hint text for RSVP attendee count

- **File**: `src/components/invitation/RSVPFormFields.tsx`
- **Location**: Near the `FloatingField` for `guestCount`, inside `ConfirmedFields`
- **Content**:
  `<p className="rsvp__guest-hint">Hemos reservado {effectiveGuestCap} lugares para tu invitación. Puedes ajustar el número si asistirán menos personas.</p>`
- **Only shown when**: `supportsPlusOnes && attendanceStatus === 'confirmed'`
- **Minimal SCSS**: One new class (inline or in `_rsvp.scss`)

### Change 3: Add/update tests

- **File**: `tests/unit/rsvp-guest-count.test.tsx`
- **New tests**:
  - Personalized with `maxGuests=4`, no `attendeeCount` → defaults to 4
  - Personalized with `maxGuests=2`, `attendeeCount=2` → preserves 2 (already responded)
  - Personalized with `maxGuests=1` → defaults to 1
  - Guest can reduce from 4 to 2 → 2
  - Quantity cannot exceed `effectiveGuestCap` (via validation test)
  - Quantity cannot go below 1 (via validation test)
  - Existing saved `attendeeCount` is preserved
  - Public/non-personalized RSVP fallback → 1 or `guestCap`
- **File**: `tests/lib/rsvp-v2/guest-dto.test.ts`
- **New tests**: For dashboard metrics if missing (verify totals shape)

### Change 4: Documentation updates

- **File**: `.agent/plans/active/dashboard-guest-metrics-and-rsvp-defaults.spec.md` (this doc)
- Add metric definitions to any relevant `.agent/rules/` doc if found to be outdated
- Document test/demo data limitation and proposed convention

## Non-Goals

- **No DB migration**: Adding `send_count` or `reminder_count` columns is outside scope. The current
  model only tracks `firstSharedAt` and `lastReminderSentAt`. If repeated-send tracking is needed
  later, it belongs in a separate task.
- **No changes to `buildDashboardTotals`**: The aggregation logic is correct. The `totalPeople`
  denominator is a design choice (total invited capacity), not a bug.
- **No changes to `markGuestShared`**: It correctly sets `deliveryStatus: 'shared'` and preserves
  `firstSharedAt`. This is idempotent for the metric.
- **No UI refactor**: The GuestSummary component layout stays as-is. Only add the RSVP hint text.
- **No broad renaming**: The current field names (`attendeeCount`, `maxAllowedAttendees`,
  `confirmedPeople`) are accurate. No renaming.
- **No destructive data migration**: Existing `attendeeCount = 0` values for unresponded guests are
  left as-is. The fix is at the application level.
- **No removal of `pendingPeople` or `declinedPeople`**: These are unused in the UI but may be
  useful for future features.

## Acceptance Criteria

### Dashboard Metrics

- [ ] `sharedInvitations` (Enviadas) counts unique invitations with `deliveryStatus === 'shared'`
- [ ] Re-sending the same invitation does not increment Enviadas
- [ ] Sending reminders does not increment Enviadas
- [ ] `confirmedInvitations` (Confirmadas) counts invitations with
      `attendanceStatus === 'confirmed'`
- [ ] `confirmedPeople` (Asistentes) sums `attendeeCount` for confirmed invitations only
- [ ] A pending invitation with `maxGuests=5` does not increase `confirmedPeople`
- [ ] `totalPeople` is documented as total invited capacity (not confirmed count)

### RSVP Attendee Quantity

- [ ] Personalized invitation with `maxGuests=4` opens RSVP with attendee quantity = 4
- [ ] Personalized invitation with `maxGuests=2` opens RSVP with attendee quantity = 2
- [ ] Personalized invitation with `maxGuests=1` opens RSVP with attendee quantity = 1
- [ ] Guest can reduce the quantity from `maxGuests` to a lower valid number
- [ ] Quantity cannot exceed `maxGuests` (enforced by validation and input `max` attribute)
- [ ] Quantity cannot go below 1 (enforced by validation and input `min` attribute)
- [ ] Existing saved RSVP `attendeeCount` is preserved and not overwritten
- [ ] Public/non-personalized RSVP fallback defaults to `guestCap` or 1 (unchanged)
- [ ] UI shows Spanish hint text when `supportsPlusOnes`

## Validation Plan

1. **Type check**: `pnpm type-check` — verify no type errors after changes
2. **Lint**: `pnpm lint` — verify no lint errors
3. **Unit tests**: `pnpm test -- tests/unit/rsvp-guest-count.test.tsx` — run RSVP count tests
4. **Full Jest suite**: `pnpm test` — ensure no regressions
5. **Build**: `pnpm build` — verify production build succeeds
6. **Git safety**: `pnpm agent:git-safety:check` — verify no unintended changes

## Rollback Notes

The RSVP fix is a single-line change in `use-rsvp-submission.ts`. The hint text is a small JSX
addition in `RSVPFormFields.tsx`. Both are purely application-level changes with no DB schema,
migration, or API changes. Rollback is trivial via `git checkout -- <file>` or reverting the commit.

## Documentation Updates Needed

- ✅ This SDD spec serves as the canonical reference
- ❌ No updates needed to `.agent/rules/` files (existing rules don't contradict the metrics)
- 📝 **Proposed convention for test/demo records**: The current system has no mechanism to exclude
  test guests from dashboard metrics. The smallest safe convention would be:
  - Tag test/demo guest records with `system:demo` (using the existing `system:` tag prefix from
    `guest-tags.ts`)
  - Add an optional filter in `findGuestsByEvent` or `buildDashboardTotals` to exclude `system:demo`
    tagged guests
  - This is a **future improvement** and is not part of this implementation scope

## Data Model Clarity

| Concept             | Current Field         | Type                      | Meaning                                                                      |
| ------------------- | --------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| Invited capacity    | `maxAllowedAttendees` | `number`                  | Maximum guests allowed for this invitation                                   |
| Confirmed attendees | `attendeeCount`       | `number`                  | Actual quantity confirmed by the guest (0 if not responded, >0 if confirmed) |
| Send status         | `deliveryStatus`      | `'generated' \| 'shared'` | Whether the invitation has been sent at least once                           |
| First send          | `firstSharedAt`       | `string \| null`          | Timestamp of first send (set once, preserved)                                |
| Last reminder       | `lastReminderSentAt`  | `string \| null`          | Timestamp of last reminder sent                                              |
