# RSVP Module Architecture (Multi-tenant)

## Context

This module adds a full guest management workflow for hosts and a personalized RSVP journey for
guests.

The stack is:

- Astro routes and API endpoints
- React islands for dashboard and RSVP interactions
- Supabase Postgres + RLS for data isolation

## Goals

- Hosts can CRUD guests under their own events.
- Every guest has a canonical invitation URL: `/invitacion/{inviteId}`.
- Guests can confirm/decline with strict attendee limits.
- Dashboard status updates are near-real-time.
- Legacy RSVP (`rsvp_records`) remains operational during migration.

## Boundaries

- Client never uses service role credentials.
- Host operations use authenticated user JWT and RLS.
- Public guest operations run via server APIs and only accept `inviteId`.
- Legacy admin (`/admin/rsvp`) remains temporary and isolated.

## Data Model

Primary v2 tables:

- `host_profiles`
- `events`
- `guest_invitations`
- `guest_invitation_audit`
- `app_user_roles`
- `event_memberships`
- `event_claim_codes`

Legacy tables retained during transition:

- `rsvp_records`
- `rsvp_audit_log`
- `rsvp_channel_log`

## Data Flow

### Host Flow

1. Host signs in with Supabase Auth.
2. Unauthenticated access to `/dashboard/invitados` redirects to `/login?next=/dashboard/invitados`.
3. Dashboard requests `/api/dashboard/guests` with JWT.
4. API queries PostgREST with user JWT (RLS scoped by `auth.uid()`).
5. CRUD actions update `guest_invitations` and append `guest_invitation_audit`.
6. Dashboard refreshes list periodically and after mutations.

### Guest Flow

1. Guest opens `/invitacion/{inviteId}`.
2. API context endpoint resolves invitation by `inviteId`.
3. Client posts view telemetry to `/api/invitacion/{inviteId}/view`.
4. API marks `first_viewed_at` (once) and updates `last_viewed_at`.
5. Guest submits RSVP; API validates limits and updates status/message.

## API Contracts

### Host API

- `GET /api/dashboard/guests?eventId=...&status=...&search=...`
- `POST /api/dashboard/guests`
- `PATCH /api/dashboard/guests/:guestId`
- `DELETE /api/dashboard/guests/:guestId`
- `POST /api/dashboard/guests/:guestId/mark-shared`
- `GET /api/dashboard/guests/export.csv?eventId=...`

### Auth API

- `POST /api/auth/login-host`
- `POST /api/auth/register-host`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/auth/sync-session`

Registration policy:

- host signup requires `claimCode` (global unique) + email
- successful claim creates event membership for the new host account
- backend compatibility: `eventSlug` is accepted as deprecated input but ignored for claim
  resolution
- lookup key is `event_claim_codes.code_key` (current implementation stores normalized hashed key)

### Guest API

- `GET /api/invitacion/:inviteId/context`
- `POST /api/invitacion/:inviteId/rsvp`
- `POST /api/invitacion/:inviteId/view`

## Realtime Strategy

Current implementation uses short-interval refresh in the dashboard as a transport-safe baseline.
The repository and API contracts are ready for a future websocket-based channel without breaking UI
contracts.

## Security

- RLS policies enforce host ownership for event and invitation CRUD.
- Multi-factor Authentication (MFA) is required for Superadmin and sensitive dashboard operations.
- Session persistence uses server-side cookie synchronization to maintain Level 2 (AAL2) security
  across page navigations.
- Public guest endpoints never expose cross-event listings.
- Input sanitization + attendee bound checks are enforced server-side.
- Audit trail tracks view/response/share events.

## Migration Notes

- `src/content/events/*.json -> rsvp.guests` is legacy for invitation rendering.
- Dashboard source of truth is now Supabase (`guest_invitations`).
- Optional SQL backfill function: `backfill_guest_invitations_from_legacy()`.
- `/admin/rsvp` remains legacy temporary (Basic Auth) during migration.
- `/admin/rsvp` is intentionally hidden from the public login UI to reduce user friction.
- Host registration uses `claimCode` global único and creates event membership.
