# RSVP v2 Gap Analysis (2026-02-15)

## Executive Summary

The RSVP v2 implementation is functionally advanced but **not production-ready yet**.

- Core architecture exists (v2 tables, host/guest APIs, dashboard UI, canonical invite route).
- Critical execution gaps remain in security and data integrity.
- Legacy and v2 systems are currently coupled in transitional paths.

Final status:

- `Done`: 55%
- `Partial`: 30%
- `Missing`: 15%

---

## Traceability Matrix (Plan vs Current State)

| Area                 | Planned                                                         | Status  | Evidence                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB v2 tables         | `host_profiles/events/guest_invitations/guest_invitation_audit` | Done    | `supabase/migrations/20260215000300_rsvp_v2_core.sql`                                                                                                                                         |
| RLS ownership model  | Host-only CRUD via `auth.uid()`                                 | Partial | `supabase/migrations/20260215000400_rsvp_v2_rls.sql:140` (audit only `select`, no `insert`)                                                                                                   |
| Host dashboard APIs  | CRUD + mark-shared + CSV                                        | Done    | `src/pages/api/dashboard/guests.ts`, `src/pages/api/dashboard/guests/[guestId].ts`, `src/pages/api/dashboard/guests/[guestId]/mark-shared.ts`, `src/pages/api/dashboard/guests/export.csv.ts` |
| Public guest APIs    | context/rsvp/view by `inviteId`                                 | Done    | `src/pages/api/invitacion/[inviteId]/context.ts`, `src/pages/api/invitacion/[inviteId]/rsvp.ts`, `src/pages/api/invitacion/[inviteId]/view.ts`                                                |
| Canonical route      | `/invitacion/[inviteId]`                                        | Done    | `src/pages/invitacion/[inviteId].astro`                                                                                                                                                       |
| Legacy compatibility | `?t=` bridge to canonical URL                                   | Partial | `src/pages/[eventType]/[slug].astro:157` + `src/pages/api/invitacion/resolve.ts`                                                                                                              |
| Supabase realtime    | Push updates                                                    | Missing | Dashboard uses polling (`setInterval`) `src/components/dashboard/guests/GuestDashboardApp.tsx:60`                                                                                             |
| Auth UX              | Protected host dashboard with proper flow                       | Partial | 401 plain text only: `src/pages/dashboard/invitados.astro:7`                                                                                                                                  |
| Tests for v2         | API/service/component coverage                                  | Missing | `rg` on `tests` found no references for `rsvp-v2`, `api/invitacion`, `api/dashboard/guests`                                                                                                   |
| Documentation        | Architecture + DB updates                                       | Done    | `docs/architecture/rsvp-module.md`, `docs/ARCHITECTURE.md`, `docs/DB_RSVP.md`                                                                                                                 |

---

## Findings (Ordered by Severity)

## P0 (Critical)

1. **Host audit inserts are blocked by RLS policy model**

- Evidence:
    - Host operations append audit with host JWT: `src/lib/rsvp-v2/repository.ts:231`
    - RLS only creates `select` policy for `guest_invitation_audit`:
      `supabase/migrations/20260215000400_rsvp_v2_rls.sql:140`
- Impact:
    - `create/update/mark-shared` flows can fail after mutating `guest_invitations`.
    - API may return 500 even when the guest row already changed (partial success).

2. **Non-transactional mutation + audit causes inconsistent outcomes**

- Evidence:
    - Create then audit: `src/lib/rsvp-v2/service.ts:133` and `src/lib/rsvp-v2/service.ts:143`
    - Update then audit: `src/lib/rsvp-v2/service.ts:183` and `src/lib/rsvp-v2/service.ts:198`
    - Mark-shared then audit: `src/lib/rsvp-v2/service.ts:225` and `src/lib/rsvp-v2/service.ts:233`
- Impact:
    - Data integrity drift between core entity and audit log.
    - User retries can create operational confusion.

## P1 (High)

3. **“Realtime” requirement not implemented as Supabase Realtime**

- Evidence:
    - Polling every 8s: `src/components/dashboard/guests/GuestDashboardApp.tsx:62`
    - Documentation acknowledges polling baseline: `docs/architecture/rsvp-module.md:81`
- Impact:
    - Requirement mismatch with planned websocket push model.

4. **View tracking side-effects occur on page render path**

- Evidence:
    - Page server render calls context service: `src/pages/invitacion/[inviteId].astro:17`
    - Context service mutates view timestamps and writes audit: `src/lib/rsvp-v2/service.ts:265` and
      `src/lib/rsvp-v2/service.ts:270`
- Impact:
    - Any server render increments telemetry side effects.
    - Harder to reason about idempotency and analytics meaning.

5. **Host dashboard UX relies on manual `eventId` input**

- Evidence:
    - Event ID text input: `src/components/dashboard/guests/GuestDashboardApp.tsx:78`
- Impact:
    - Poor operational UX; high risk of empty/invalid states.
    - No event discovery API/selector for hosts.

6. **Legacy-v2 coupling introduces fragile bridge dependency**

- Evidence:
    - v2 depends on legacy token context parser: `src/lib/rsvp-v2/service.ts:22` and
      `src/lib/rsvp-v2/service.ts:350`
    - Legacy page performs client-side resolve/redirect: `src/pages/[eventType]/[slug].astro:157`
- Impact:
    - Migration path is coupled to old service semantics.
    - Harder deprecation path for `/api/rsvp/*`.

## P2 (Medium)

7. **Rate limiting is in-memory only**

- Evidence:
    - In-memory map: `src/lib/rsvp-v2/rateLimit.ts:6`
- Impact:
    - Not distributed/persistent across instances.
    - Weak against burst on multi-instance deployments.

8. **Client-side actions ignore non-OK responses in multiple flows**

- Evidence:
    - Delete/create/patch/share `fetch` calls without status handling:
      `src/components/dashboard/guests/GuestDashboardApp.tsx:113`,
      `src/components/dashboard/guests/GuestDashboardApp.tsx:136`,
      `src/components/dashboard/guests/GuestDashboardApp.tsx:147`,
      `src/components/dashboard/guests/GuestDashboardApp.tsx:122`
- Impact:
    - Silent failures and stale UI feedback.

9. **Browser globals inside render path increase portability risk**

- Evidence:
    - `window.location.origin` in render map: `src/components/dashboard/guests/GuestTable.tsx:42`
- Impact:
    - Tight coupling to browser runtime (acceptable now due `client:load`, but brittle for future
      SSR/test reuse).

10. **Auth response semantics are minimal for dashboard page**

- Evidence:
    - Plain 401 text response only: `src/pages/dashboard/invitados.astro:8`
- Impact:
    - No redirect/login handoff, poor operator UX and observability.

---

## Obsolete / Coupled / Transitional Code Classification

### Transitional (keep short-term)

- `src/lib/rsvp/*`
- `src/pages/api/rsvp/*`
- `src/pages/admin/rsvp.astro`

Rationale: still needed for legacy token and previous admin flow.

### Coupled hot spots to decouple

- `src/lib/rsvp-v2/service.ts` -> `@/lib/rsvp/service` dependency for token bridge.
- `src/pages/[eventType]/[slug].astro` containing migration redirect logic.

### Candidate obsolete (post-migration removal)

- `/admin/rsvp` Basic Auth stack and `/api/rsvp/invitations` once dashboard-v2 parity and token
  migration are complete.

---

## Mandatory Corrections Before Production

1. Add RLS policy for `guest_invitation_audit` inserts by event owner.
2. Make mutation+audit atomic (RPC/SQL function transaction or compensating strategy).
3. Add automated tests for:
    - dashboard guest APIs
    - invitacion context/rsvp/view APIs
    - v2 auth/session parsing
4. Replace or complement polling with Supabase Realtime channels.
5. Introduce host event selector/list API; remove manual event UUID as primary UX.
6. Remove side effects from render-time context reads or split read vs mutate endpoints clearly.
