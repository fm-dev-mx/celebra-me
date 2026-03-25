# RSVP Module Architecture

**Last Updated:** 2026-03-24

This document describes the current RSVP and host-dashboard architecture in the live repository.

## Scope

The RSVP domain covers:

- host authentication and elevated session handling
- dashboard CRUD flows for guests, events, users, and claim codes
- guest invitation context, RSVP submission, and invitation view telemetry
- Supabase-backed repositories, services, and security helpers under `src/lib/rsvp/**`

## Active Route Surface

### Host-Facing Pages

- `/dashboard/invitados`
- `/dashboard/admin`
- `/dashboard/eventos`
- `/dashboard/usuarios`
- `/dashboard/claimcodes`
- `/dashboard/mfa-setup`

### Guest-Facing Pages

- `/{eventType}/{slug}`
- `/{eventType}/{slug}/invitado?invite={inviteId}`
- `/{eventType}/{slug}/i/{shortId}`

`generateInvitationLink()` in `src/utils/invitation-link.ts` emits the direct guest URL when no
short code is available and emits the short URL when `shortId` exists.

## API Surface

### Auth APIs

- `POST /api/auth/login-host`
- `POST /api/auth/register-host`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/auth/sync-session`
- `POST /api/auth/refresh-session`

### Dashboard APIs

- `GET|POST /api/dashboard/guests`
- `PATCH|DELETE /api/dashboard/guests/:guestId`
- `POST /api/dashboard/guests/:guestId/mark-shared`
- `POST /api/dashboard/guests/bulk`
- `GET /api/dashboard/guests/export.csv`
- `GET /api/dashboard/guests/stream`
- `GET /api/dashboard/events`
- `GET|POST /api/dashboard/claimcodes`
- `PATCH|DELETE /api/dashboard/claimcodes/:claimCodeId`
- `POST /api/dashboard/claimcodes/validate`
- `GET /api/dashboard/admin/events`
- `PATCH|DELETE /api/dashboard/admin/events/:eventId`
- `GET /api/dashboard/admin/users`
- `PATCH /api/dashboard/admin/users/:userId/role`

### Guest Invitation APIs

- `GET /api/invitacion/:inviteId/context`
- `POST /api/invitacion/:inviteId/rsvp`
- `POST /api/invitacion/:inviteId/view`

There is no active `/api/invitacion/resolve` or `/api/invitation/:inviteId/*` public contract in the
live tree.

## Layer Boundaries

- API handlers live under `src/pages/api/**`.
- Business logic lives under `src/lib/rsvp/services/**`.
- Persistence logic lives under `src/lib/rsvp/repositories/**`.
- Security and request-boundary helpers live under `src/lib/rsvp/auth/**`,
  `src/lib/rsvp/security/**`, and `src/middleware.ts`.
- Interactive dashboard and RSVP UI lives in React islands under `src/components/dashboard/**` and
  `src/components/invitation/**`.

## Current Behavior

### Host Flow

1. A host signs in through the auth APIs.
2. Protected dashboard routes require a valid synced session.
3. Dashboard islands call the dashboard APIs under `/api/dashboard/**`.
4. Services and repositories resolve event ownership, claim-code access, guest CRUD, and audit
   writes.
5. Guests dashboard updates stream over SSE via `/api/dashboard/guests/stream`.

### Guest Flow

1. A guest enters through the direct invite URL or a short URL.
2. The route resolves invitation context server-side.
3. The client fetches `/api/invitacion/:inviteId/context`.
4. View telemetry posts to `/api/invitacion/:inviteId/view`.
5. RSVP submissions post to `/api/invitacion/:inviteId/rsvp`.

## Security Notes

- Client code never receives service-role credentials directly.
- MFA is part of the elevated dashboard/session surface.
- Public invitation APIs are invite-scoped and do not expose cross-event listings.
- Some repository operations still use `useServiceRole: true` inside the service layer; that remains
  a documented implementation tradeoff, not the desired long-term target.

## Historical Note

Older docs may mention `/admin/rsvp` or `/api/invitation/*`. Those are historical references and
must not be treated as active system entrypoints.

## Source-of-Truth Files

- `src/pages/dashboard/**`
- `src/pages/api/auth/**`
- `src/pages/api/dashboard/**`
- `src/pages/api/invitacion/[inviteId]/**`
- `src/lib/rsvp/**`
- `src/utils/invitation-link.ts`
