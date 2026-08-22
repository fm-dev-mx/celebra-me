# RSVP Database Operations

**Last Updated:** 2026-06-05

RSVP routes, APIs, and host/guest flow are owned by [`architecture.md`](architecture.md). This file
is the RSVP table/schema inventory and database-specific operational notes.

This document describes the active Supabase schema and operational workflow for the RSVP and
invitation domains.

## Scope

The backend persists data in Supabase and is implemented through repositories and services under
`src/lib/rsvp/**` and `src/lib/intake/**`.

Current tables documented by the live code and migrations include:

### Active application tables

- `invitations` — primary domain entity (was `invitation_projects`)
- `events` — RSVP events (linked to invitations via `invitation_project_id`)
- `guest_invitations` — guest RSVP records
- `guest_invitation_audit` — audit log for guest changes
- `app_user_roles` — role assignments (`super_admin`, `host_client`)
- `event_memberships` — user-to-event associations
- `event_claim_codes` — claim codes for event access
- `audit_logs` — admin audit trail
- `host_profiles` — user display profiles
- `intake_requests` — client capture-link configuration
- `intake_submissions` — client-submitted data
- `invitation_content_drafts` — draft content for publishing
- `published_invitation_content` — published public content
- `invitation_assets` — uploaded asset metadata for the invitation Asset Library

### Legacy compatibility tables (not actively written)

- `rsvp_records`
- `rsvp_audit_log`
- `rsvp_channel_log`

## Migration Baseline

Schema history lives in `supabase/migrations/`. Do not freeze applied/pending hosted migration
counts in this document — obtain live state with `pnpm db:local:audit` / `pnpm db:preview:audit` /
`pnpm db:prod:audit`. Content promote/mirror vs RSVP isolation:
[`docs/core/content-parity-rsvp-isolation.md`](../../core/content-parity-rsvp-isolation.md).

Do not patch production with ad-hoc SQL outside a migration unless the change is part of a
controlled incident response.

## Local Workflow

See `docs/database-workflow.md` for the complete operational workflow including local development,
production backups, and migration procedures.

Invitation administration does not own guest confirmations. Its runtime service-role credential has
SELECT only on `guest_invitations` and `guest_invitation_audit`; mutations are explicitly revoked.
RSVP-specific authenticated RLS paths and RPCs remain authoritative. Invitation permanent deletion
is service-owned and its RPC blocks events with guests, claim codes, or memberships; managed
compensation also preflights guests and claim codes before removing an operation-created event. The
Phase 2 editor RPCs touch only `invitations`, `invitation_content_drafts`,
`published_invitation_content` (read/lock for restore), and append-only mutation receipts. They have
service-role-only execute grants and no guest-table grants. Mutation receipts are an immutable
idempotency ledger (`SELECT`+`INSERT` only); RPCs serialize on the invitation row and must not take
`FOR SHARE`/`FOR UPDATE` locks on receipt rows.

The complete disposable recovery drill in `docs/database-workflow.md` fingerprints guest rows and
audit history deterministically and verifies event/invitation/owner links, memberships, claim codes,
confirmation and delivery state, attendee totals, response timestamps, soft deletes, uniqueness, and
phone/country invariants after restore. Row counts alone are not accepted as RSVP recovery proof.
The pgTAP contract also proves the invitation service role cannot insert, update, or delete guest
confirmations or guest audit rows.

## Active URL Patterns Backed By The Schema

- direct invite URL: `/{eventType}/{slug}?invite={inviteId}`
- short invite URL: `/{eventType}/{slug}/i/{shortId}`
- landing RSVP URL: `/{eventType}/{slug}`
- guest APIs: `/api/invitacion/:inviteId/context`, `/rsvp`, `/view`
- public RSVP API: `/api/invitacion/public/:eventType/:slug/rsvp`
- host dashboard page: `/dashboard/invitados`
- host dashboard APIs: `/api/dashboard/**`

The live tree does not expose `/admin/rsvp` or `/api/rsvp/*` as active operational surfaces.

## Data Model Notes

### Canonical Host Dashboard Model

`events` + `guest_invitations` is the active model for dashboard guest management.

- `events.owner_user_id` maps host ownership to `auth.users(id)`.
- `guest_invitations.invite_id` is the public invitation identifier used by the guest APIs.
- `guest_invitations.short_id` supports short invitation URLs.
- `guest_invitations.entry_source` distinguishes dashboard-created rows from public generic RSVP
  rows.
- `guest_invitations.last_response_source` now records `link`, `admin`, or `generic_link`.
- `guest_invitation_audit` stores lifecycle events such as `created`, `viewed`, `shared`, and RSVP
  state changes.

For hybrid public RSVP:

- `guest_invitations` remains the canonical RSVP table.
- public submissions dedupe on the existing `(event_id, phone)` uniqueness behavior used by the
  service layer.
- when a matching phone already exists, the existing guest row is updated instead of creating a
  duplicate.
- when no matching phone exists, a new row is created with:
  - `entry_source = 'generic_public'`
  - `delivery_status = 'generated'`
  - `max_allowed_attendees` seeded from the content RSVP guest cap

### Legacy Compatibility Tables

`rsvp_records`, `rsvp_audit_log`, and `rsvp_channel_log` remain in the schema for compatibility and
transition support but the application no longer writes to them. They are locked down with RLS
policies that deny all access to anon and authenticated roles.

**Deferred cleanup**: These tables should be dropped after verifying no external scripts, analytics
pipelines, or data exports depend on them.

### Invitation Domain Tables

The invitation/intake module (see `docs/domains/intake/production-flow.md`) adds:

- `invitations` — primary production entity (was `invitation_projects`). Uses `kind`
  (`demo`|`client`), `archived_at` for archive state, and `source_invitation_id` for demo lineage.
- `intake_requests` — token-backed client capture link configuration
- `intake_submissions` — client-submitted form data
- `invitation_content_drafts` — editable draft content
- `published_invitation_content` — public snapshot resolved by `(event_type, slug)`
- `invitation_assets` — metadata for uploaded Asset Library files. Actual image files live in the
  Supabase Storage `invitation-assets` bucket. The table may be empty locally when all content uses
  internal bundled assets instead of uploaded Storage objects.

Child FK columns still use the name `invitation_project_id` for backward compatibility during the
ongoing deployment rollout. They will be renamed to `invitation_id` after verification.

### Asset Library

The Asset Library is scoped to `invitations`. Upload APIs write metadata to `invitation_assets` and
store binary files in Supabase Storage. The database row records the Storage bucket/path, display
name, optional alt text, MIME type, dimensions, file size, and soft-delete state. Local refreshes
can copy this metadata from production, but DB dumps do not copy Storage objects. Managed rows
additionally record definition slug, semantic source key, SHA-256, and operation ID. Null managed
ownership means target-owned: package absence alone can never prune that row.

### Deprecated RPCs

The following functions exist in the schema but are superseded by newer equivalents. They are kept
for backward compatibility and marked with `[DEPRECATED]` in their comments:

| Deprecated function                        | Replacement                 |
| ------------------------------------------ | --------------------------- |
| `soft_delete_event(uuid, uuid)`            | `archive_invitation(uuid)`  |
| `restore_event(uuid, uuid)`                | `restore_invitation(uuid)`  |
| `soft_delete_invitation_project(uuid)`     | `archive_invitation(uuid)`  |
| `restore_invitation_project(uuid)`         | `restore_invitation(uuid)`  |
| `backfill_guest_invitations_from_legacy()` | Intake pipeline             |
| `deleted_events` view (dropped)            | `archived_invitations` view |

## Security Model

- RLS is enabled for all tables except Supabase Auth tables.
- All SECURITY DEFINER functions have been hardened with `SET search_path = 'public'` (migration
  37).
- Public guest flows run through server APIs. Personalized reads remain invite-scoped. View,
  personalized RSVP/decline, and hybrid event writes use service-role-only `SECURITY DEFINER` RPCs
  that validate the invite or published non-demo client event; browser roles cannot execute them.
- Elevated dashboard operations depend on authenticated session state plus repository-level auth and
  MFA safeguards.
- Service-role reads remain server-only. Direct service-role guest and guest-audit writes are
  revoked; narrow RSVP RPC execution is the only privileged public mutation boundary. Authenticated
  dashboard guest operations continue through host-scoped RLS.

## Environment Variables

The repo currently types and documents these RSVP/Supabase-related variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `RSVP_CLAIM_CODE_PEPPER`
- `TRUST_DEVICE_SECRET`
- `TRUST_DEVICE_MAX_AGE_DAYS`
- `REQUIRE_FRESH_MFA_FOR_ADMIN`

The active runtime also uses these operational variables outside the narrow RSVP/Supabase contract:

- `BASE_URL`
- `NODE_ENV`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RSVP_V2_DISTRIBUTED_RATELIMIT`
- `SUPER_ADMIN_EMAILS`
- `GMAIL_USER`
- `GMAIL_PASS`
- `CONTACT_FORM_RECIPIENT_EMAIL`
- `PUBLIC_GOOGLE_ANALYTICS_ID`

Keep `.env.example` and `src/env.d.ts` aligned when one of these active operational variables is
added, renamed, or retired.

## Deferred Cleanup

The following items require separate cleanup migrations but are not urgent. Do not mix with critical
or invitation-domain changes.

1. **Drop legacy RSVP tables**: `rsvp_records`, `rsvp_audit_log`, `rsvp_channel_log` after
   confirming no external dependency.
2. **Rename child FK columns**: `invitation_project_id` → `invitation_id` on `events`,
   `published_invitation_content`, `intake_requests`, `invitation_content_drafts` after the current
   build deployment is verified.
3. **Drop deprecated RPCs**: `soft_delete_event`, `restore_event`, `soft_delete_invitation_project`,
   `restore_invitation_project`, `backfill_guest_invitations_from_legacy` after verifying no callers
   remain.
4. **Drop deprecated views**: `deleted_events` — done in
   `20260726170000_drop_deleted_events_view.sql` (`deleted_invitation_projects` already dropped
   earlier).
5. **Remove compatibility view**: `invitation_projects` view (created in migration 36) after the new
   build is deployed and verified.
6. **Add NOT NULL to `short_id`**: After verifying all rows have a value.

## Suggested Verification

Use current tests that map to the live surface, for example:

```bash
pnpm test -- tests/api/dashboard.guests.happy.test.ts tests/api/dashboard.guests.export.test.ts tests/api/invitacion.happy.test.ts tests/api/invitacion.public.test.ts
```

Run the schema verification queries before and after deploying migrations:

```bash
pnpm db:migrate -- --target production
```

The canonical schema verification script is `supabase/verification/full_schema_audit.sql`, which
runs PASS/FAIL checks for all critical tables, constraints, indexes, RLS policies, and RPC
privileges.

See also `docs/domains/database/overview.md` for the ERD diagram and data-flow documentation.
