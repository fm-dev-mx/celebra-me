# RSVP Status — Current Operational Snapshot

**Last Updated:** 2026-03-17

## 1) Executive Status

**Current Verdict:** The RSVP module is operational and documented as a live, multi-surface system
with:

- host-side dashboard management under `/dashboard/**`,
- guest-facing invitation flows under `/{eventType}/{slug}/...`,
- Supabase-backed persistence and authorization services,
- MFA/session hardening for protected routes.

This document is a current-state snapshot. Historical launch notes remain preserved in audit logs
and should not be treated as the primary source of truth.

---

## 2) Active Runtime Surfaces

### 2.1 Host Dashboard

Primary host-facing routes:

- `/dashboard/invitados`
- `/dashboard/eventos`
- `/dashboard/claimcodes`
- `/dashboard/usuarios`
- `/dashboard/admin`
- `/dashboard/mfa-setup`

Primary host-facing APIs:

- `/api/dashboard/guests`
- `/api/dashboard/guests/[guestId]`
- `/api/dashboard/guests/[guestId]/mark-shared`
- `/api/dashboard/guests/export.csv`
- `/api/dashboard/guests/stream`
- `/api/dashboard/events`
- `/api/dashboard/claimcodes`
- `/api/dashboard/admin/events`
- `/api/dashboard/admin/users`

### 2.2 Guest Invitation Experience

Primary guest-facing route patterns:

- `/{eventType}/{slug}/invitado?invite={inviteId}`
- `/{eventType}/{slug}/i/{shortId}`

Primary guest-facing APIs:

- `GET /api/invitacion/:inviteId/context`
- `POST /api/invitacion/:inviteId/rsvp`
- `POST /api/invitacion/:inviteId/view`
- `GET /api/invitacion/resolve`

### 2.3 Legacy / Operational Surfaces

The following surfaces still exist for compatibility or operations, but they are not the canonical
host dashboard:

- `/admin/rsvp`
- `/api/rsvp/invitations`

Historical note:

- References to `/api/invitation/rsvp` or `/invitation/{inviteId}` are no longer current-state
  contracts.

---

## 3) Active Implementation Hubs

### 3.1 Domain Services

- `src/lib/rsvp/services/**`
- `src/lib/rsvp/repositories/**`
- `src/lib/rsvp/services/shared/**`
- `src/lib/rsvp/repositories/shared/**`

Compatibility aggregators still exist:

- `src/lib/rsvp/service.ts`
- `src/lib/rsvp/repository.ts`

### 3.2 UI Components

Host-side UI:

- `src/components/dashboard/guests/**`
- `src/components/dashboard/events/**`
- `src/components/dashboard/users/**`
- `src/components/dashboard/claimcodes/**`
- `src/components/dashboard/shell/**`

Guest-side UI:

- `src/components/invitation/GuestInvitationHero.astro`
- `src/components/invitation/GuestRSVPForm.tsx`
- `src/components/invitation/GuestPostConfirmActions.tsx`
- `src/components/invitation/RSVP.tsx`

### 3.3 Styling

- `src/styles/dashboard/**`
- `src/styles/invitation/_rsvp.scss`
- `src/styles/themes/sections/_rsvp-theme.scss`

---

## 4) Security And Session Posture

- Protected dashboard operations require authenticated session context.
- Superadmin and sensitive flows require MFA / AAL2 enforcement.
- Session synchronization is handled through `/api/auth/sync-session`.
- Public invitation APIs remain server-mediated and do not expose unrestricted cross-event reads.

Known architecture gap that remains open:

- Some repository operations still rely on service-role-backed access patterns where ideal
  JWT-scoped/RLS-only execution is not yet fully realized.

---

## 5) Data And Persistence Posture

- The active guest-management model is built around `events`, `guest_invitations`, and
  `guest_invitation_audit`.
- Legacy RSVP tables remain in place for coexistence and transition.
- Supabase migrations under `supabase/migrations/` remain the authoritative change mechanism for
  schema evolution.

See also:

- `docs/domains/rsvp/database.md`
- `docs/domains/rsvp/architecture.md`

---

## 6) Verification Expectations

The RSVP module should be considered aligned only when:

- dashboard routes and APIs documented here match the current `src/pages/**` tree,
- guest invitation flows documented here match the current `src/utils/invitation-link.ts` and
  `/api/invitacion/**` handlers,
- auth/session docs remain consistent with middleware and `/api/auth/**` flows.

Deterministic validation for repo health still uses:

- `pnpm astro check`
- `pnpm lint`

---

## 7) Change Notes

- **2026-03-17:** Reframed the status document as a current operational snapshot and aligned routes,
  APIs, and implementation hubs with the live repository tree.
