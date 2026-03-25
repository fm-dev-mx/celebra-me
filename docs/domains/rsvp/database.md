# RSVP Database Operations

**Last Updated:** 2026-03-24

This document describes the active Supabase schema and operational workflow for the RSVP domain.

## Scope

The RSVP backend persists data in Supabase and is implemented through the repositories and services
under `src/lib/rsvp/**`.

Current tables documented by the live code and migrations include:

- `host_profiles`
- `events`
- `guest_invitations`
- `guest_invitation_audit`
- `app_user_roles`
- `event_memberships`
- `event_claim_codes`
- legacy compatibility tables: `rsvp_records`, `rsvp_audit_log`, `rsvp_channel_log`

## Migration Baseline

Current migrations under `supabase/migrations/`:

- `20260215000100_rsvp_init.sql`
- `20260215000200_rsvp_hardening.sql`
- `20260215000300_rsvp_v2_core.sql`
- `20260215000400_rsvp_v2_rls.sql`
- `20260215000500_rsvp_v2_audit_atomicity.sql`
- `20260215000600_rsvp_v2_auth_claims_membership.sql`
- `20260215000700_rsvp_v2_claim_code_global_unique.sql`
- `20260215000800_superadmin_hardening.sql`
- `20260215000900_claim_code_atomic_rpc.sql`
- `20260216095500_add_manual_entry_source.sql`
- `20260216133000_make_phone_nullable.sql`
- `20260220000000_add_soft_delete.sql`
- `20260221000000_add_soft_delete_columns.sql`
- `20260225000000_dashboard_optimization.sql`
- `20260226000000_add_short_id.sql`
- `20260226000001_touch_schema.sql`

Do not patch production with ad-hoc SQL outside a migration unless the change is part of a
controlled incident response.

## Local Workflow

Prerequisites:

- Docker
- Supabase CLI available on `PATH`

Commands:

```bash
pnpm db:start
pnpm db:push
pnpm db:reset:local
pnpm db:migrate:new <migration_name>
```

## Active URL Patterns Backed By The Schema

- direct invite URL: `/{eventType}/{slug}/invitado?invite={inviteId}`
- short invite URL: `/{eventType}/{slug}/i/{shortId}`
- guest APIs: `/api/invitacion/:inviteId/context`, `/rsvp`, `/view`
- host dashboard page: `/dashboard/invitados`
- host dashboard APIs: `/api/dashboard/**`

The live tree does not expose `/admin/rsvp` or `/api/rsvp/*` as active operational surfaces.

## Data Model Notes

### Canonical Host Dashboard Model

`events` + `guest_invitations` is the active model for dashboard guest management.

- `events.owner_user_id` maps host ownership to `auth.users(id)`.
- `guest_invitations.invite_id` is the public invitation identifier used by the guest APIs.
- `guest_invitations.short_id` supports short invitation URLs.
- `guest_invitation_audit` stores lifecycle events such as `created`, `viewed`, `shared`, and RSVP
  state changes.

### Legacy Compatibility Tables

`rsvp_records`, `rsvp_audit_log`, and `rsvp_channel_log` remain in the schema for compatibility and
transition support. They are not the primary dashboard source of truth.

## Security Model

- RLS is enabled for the v2 tables.
- Public guest flows are invite-scoped and run through server APIs.
- Elevated dashboard operations depend on authenticated session state plus repository-level auth and
  MFA safeguards.
- Service-role access is still present in parts of the implementation and remains a documented
  tradeoff in the current codebase.

## Environment Variables

The repo currently types and documents these RSVP/Supabase-related variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `RSVP_TOKEN_SECRET`
- `RSVP_CLAIM_CODE_PEPPER`
- `TRUST_DEVICE_SECRET`
- `TRUST_DEVICE_MAX_AGE_DAYS`

Legacy compatibility variables such as `RSVP_ADMIN_USER` and `RSVP_ADMIN_PASSWORD` still exist in
`src/env.d.ts` and `.env.example`, but they do not correspond to an active `/admin/rsvp` route in
the live tree.

## Suggested Verification

Use current tests that map to the live surface, for example:

```bash
pnpm test -- tests/api/dashboard.guests.happy.test.ts tests/api/dashboard.guests.export.test.ts tests/api/invitacion.context.happy.test.ts tests/api/invitacion.rsvp.happy.test.ts
```
