# Phase 03: Dashboard Legacy Retirement

**Completion:** `100%` | **Status:** `COMPLETED`

**Objective:** Retire the dashboard guest hook surface that no longer participates in the live
runtime and migrate the dedicated test surface to active hooks.

**Weight:** 25% of total plan

---

## Completed Work

- Removed `use-guests.ts` from the active dashboard surface.
- Removed `use-guest-mutations.ts` from the active dashboard surface.
- Rewrote `tests/components/guests.hooks.test.tsx` so it validates
  `useGuestDashboardRealtime` and `useGuestDashboardActions` instead of preserving the retired
  hook API.

---

## Acceptance Criteria

- No live dashboard route imports the retired hooks.
- No dedicated test survives only to preserve the retired hook surface.
- Dashboard CRUD, realtime, and route/API contracts remain unchanged.
