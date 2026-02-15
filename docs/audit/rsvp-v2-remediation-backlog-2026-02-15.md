# RSVP v2 Remediation Backlog (2026-02-15)

## Prioritization Rules

- `P0`: blocks safe production rollout.
- `P1`: high business/operational risk.
- `P2`: quality, maintainability, and migration hardening.

---

## P0 (Must Fix Now)

### 1) Enable host-owned insert policy for guest audit

- Problem: host audit inserts use host JWT but audit table only has `select` policy.
- Evidence:
    - `supabase/migrations/20260215000400_rsvp_v2_rls.sql:140`
    - `src/lib/rsvp-v2/repository.ts:231`
- Fix:
    - Add `insert` policy on `guest_invitation_audit` for authenticated owners via join to `events`.
    - Keep service-role path for guest/public insert cases.
- Acceptance:
    - Create/update/mark-shared endpoints no longer fail due audit insert permissions.

### 2) Make write + audit atomic

- Problem: partial success path (core row updated, audit failed).
- Evidence:
    - `src/lib/rsvp-v2/service.ts:133`
    - `src/lib/rsvp-v2/service.ts:183`
    - `src/lib/rsvp-v2/service.ts:225`
- Fix:
    - Move mutation flow into SQL RPC functions with a transaction.
    - Return normalized DTO from RPC to API.
- Acceptance:
    - No scenario where mutation commits but audit missing.

### 3) Add v2 test coverage baseline

- Problem: no tests for v2 APIs/services.
- Evidence:
    - No matching tests for `rsvp-v2`, `api/invitacion`, `api/dashboard/guests`.
- Fix:
    - Add API tests:
        - `tests/api/dashboard.guests.test.ts`
        - `tests/api/invitacion.context.test.ts`
        - `tests/api/invitacion.rsvp.test.ts`
    - Add service unit tests for attendee limits and side effects.
- Acceptance:
    - CI covers success + error paths for all v2 endpoints.

---

## P1 (High Priority)

### 4) Implement true realtime channel

- Problem: current dashboard uses polling only.
- Evidence:
    - `src/components/dashboard/guests/GuestDashboardApp.tsx:62`
- Fix:
    - Add Supabase Realtime subscription per `event_id`.
    - Keep polling as fallback for reconnect/retry.
- Acceptance:
    - Host sees updates without periodic refresh in normal conditions.

### 5) Decouple view telemetry from render-time context reads

- Problem: context call mutates viewed state and logs audit during page render.
- Evidence:
    - `src/pages/invitacion/[inviteId].astro:17`
    - `src/lib/rsvp-v2/service.ts:265`
- Fix:
    - Create pure read context method.
    - Move telemetry to explicit `POST /view` beacon from client.
- Acceptance:
    - SSR render is side-effect free.

### 6) Replace manual event UUID input with host event selector

- Problem: dashboard requires manual `eventId`.
- Evidence:
    - `src/components/dashboard/guests/GuestDashboardApp.tsx:78`
- Fix:
    - Add `GET /api/dashboard/events` for host-owned events.
    - UI selector/dropdown with persisted selection.
- Acceptance:
    - No manual UUID entry needed for standard operation.

### 7) Strengthen frontend error handling for mutations

- Problem: several `fetch` calls ignore non-OK responses.
- Evidence:
    - `src/components/dashboard/guests/GuestDashboardApp.tsx:113`
    - `src/components/dashboard/guests/GuestDashboardApp.tsx:136`
    - `src/components/dashboard/guests/GuestDashboardApp.tsx:147`
- Fix:
    - Centralize API client helper with `ok` checks + typed error display.
- Acceptance:
    - User gets actionable error states and UI remains consistent.

---

## P2 (Medium Priority)

### 8) Replace in-memory rate limiter with shared store

- Problem: limiter resets per instance and is bypassable in distributed runtime.
- Evidence:
    - `src/lib/rsvp-v2/rateLimit.ts:6`
- Fix:
    - Redis/Upstash-based token bucket or Supabase-based abuse table.
- Acceptance:
    - Limits survive instance restarts and scale-out.

### 9) Reduce browser-runtime coupling in table rendering

- Problem: `window` usage inside render map.
- Evidence:
    - `src/components/dashboard/guests/GuestTable.tsx:42`
- Fix:
    - Pass `origin` from parent once or compute inside click handlers only.
- Acceptance:
    - Component is easier to test/reuse and less environment-coupled.

### 10) Standardize auth UX for dashboard route

- Problem: 401 plain text response without navigation guidance.
- Evidence:
    - `src/pages/dashboard/invitados.astro:8`
- Fix:
    - Redirect unauthenticated hosts to login route (or dedicated auth screen).
- Acceptance:
    - Consistent host auth flow and better operator UX.

### 11) Plan deprecation of legacy RSVP stack

- Problem: duplicated responsibilities between `/api/rsvp/*` and v2 APIs.
- Evidence:
    - Coexisting modules in `src/lib/rsvp/*` and `src/lib/rsvp-v2/*`
- Fix:
    - Define milestones:
        - parity complete
        - migration complete
        - deprecate and remove legacy endpoints
- Acceptance:
    - Single source of truth for RSVP runtime path.

---

## Recommended Execution Sequence

1. P0.1 + P0.2 (policy + atomicity)
2. P0.3 (tests baseline)
3. P1.5 (side-effect split) + P1.7 (frontend error handling)
4. P1.6 (event selector UX)
5. P1.4 (realtime channel)
6. P2 hardening + legacy deprecation plan
