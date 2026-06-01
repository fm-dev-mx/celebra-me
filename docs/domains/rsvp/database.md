# RSVP Database Operations

**Last Updated:** 2026-05-31

This document describes the active Supabase schema and operational workflow for the RSVP and
invitation domains.

## Scope

The backend persists data in Supabase and is implemented through repositories and services under
`src/lib/rsvp/**` and `src/lib/intake/**`.

Current tables documented by the live code and migrations include:

### Active production tables

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

### Legacy compatibility tables (not actively written)

- `rsvp_records`
- `rsvp_audit_log`
- `rsvp_channel_log`

## Migration Baseline

All 38 migrations under `supabase/migrations/`:

| #   | File                                                    | Purpose                                                                           |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | `20260215000100_rsvp_init.sql`                          | Initial RSVP tables                                                               |
| 2   | `20260215000200_rsvp_hardening.sql`                     | Constraints, FKs, RLS lock-down                                                   |
| 3   | `20260215000300_rsvp_v2_core.sql`                       | host_profiles, events, guest_invitations                                          |
| 4   | `20260215000400_rsvp_v2_rls.sql`                        | RLS for v2 tables                                                                 |
| 5   | `20260215000500_rsvp_v2_audit_atomicity.sql`            | Audit trigger + policy                                                            |
| 6   | `20260215000600_rsvp_v2_auth_claims_membership.sql`     | app_user_roles, event_memberships, event_claim_codes                              |
| 7   | `20260215000700_rsvp_v2_claim_code_global_unique.sql`   | code_key column, unique index                                                     |
| 8   | `20260215000800_superadmin_hardening.sql`               | audit_logs, JWT sync, superadmin RLS                                              |
| 9   | `20260215000900_claim_code_atomic_rpc.sql`              | redeem_claim_code (SELECT FOR UPDATE)                                             |
| 10  | `20260216095500_add_manual_entry_source.sql`            | Extend RSVP source constraint                                                     |
| 11  | `20260216133000_make_phone_nullable.sql`                | phone nullable in guest_invitations                                               |
| 12  | `20260220000000_add_soft_delete.sql`                    | Soft delete for events, guests, etc.                                              |
| 13  | `20260221000000_add_soft_delete_columns.sql`            | Columns-only soft delete (idempotent)                                             |
| 14  | `20260225000000_dashboard_optimization.sql`             | email, tags, metadata; upsert_guests_v1                                           |
| 15  | `20260226000000_add_short_id.sql`                       | short_id, generate_short_id function                                              |
| 16  | `20260226000001_touch_schema.sql`                       | COMMENT TOAST for PostgREST cache                                                 |
| 17  | `20260401000100_add_generic_rsvp_sources.sql`           | entry_source, last_response_source                                                |
| 18  | `20260402000100_reconcile_event_slug_parity.sql`        | One-time demo slug rename + guest merge                                           |
| 19  | `20260402010100_rsvp_engagement_standardization.sql`    | guest_message→guest_comment, is_viewed                                            |
| 20  | `20260521000001_normalize_phone_format.sql`             | +52 phone normalization                                                           |
| 21  | `20260521000002_fix_upsert_guests_phone_column.sql`     | Fix phone column reference                                                        |
| 22  | `20260522000001_make_bulk_guests_create_only.sql`       | Bulk import create-only                                                           |
| 23  | `20260523000001_add_country_code.sql`                   | country_code, phone split                                                         |
| 24  | `20260524000000_soft_delete_unique_constraint.sql`      | Partial unique index (event_id, country_code, phone)                              |
| 25  | `20260525000000_add_guest_branding_flag.sql`            | hide_celebra_me_branding                                                          |
| 26  | `20260528000000_intake_core.sql`                        | invitation_projects, intake_requests, intake_submissions                          |
| 27  | `20260528000001_intake_drafts.sql`                      | invitation_content_drafts                                                         |
| 28  | `20260528000002_published_invitation_content.sql`       | published_invitation_content                                                      |
| 29  | `20260528000003_published_content_event_type_index.sql` | Composite index (slug, event_type)                                                |
| 30  | `20260529000000_published_content_unique_route_key.sql` | UNIQUE (event_type, slug)                                                         |
| 31  | `20260530000000_cleanup_published_content_indexes.sql`  | Drop redundant indexes                                                            |
| 32  | `20260530000001_intake_token_ciphertext.sql`            | token_ciphertext for admin recovery                                               |
| 33  | `20260531000000_add_events_invitation_project_id.sql`   | invitation_project_id FK on events                                                |
| 34  | `20260531000001_add_intake_request_origin.sql`          | origin column on intake_requests                                                  |
| 35  | `20260601000000_intake_soft_delete.sql`                 | Soft delete for intake tables                                                     |
| 36  | `20260601000001_invitations_domain.sql`                 | Rename invitation_projects→invitations; archive RPCs                              |
| 37  | `20260601000002_corrective_security.sql`                | SECURITY DEFINER search_path hardening                                            |
| 38  | `20260601000003_corrective_security_followup.sql`       | Hardening follow-up: ALTER FUNCTION, upsert_guests_v1 REVOKE, explicit signatures |

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

Child FK columns still use the name `invitation_project_id` for backward compatibility during the
ongoing deployment rollout. They will be renamed to `invitation_id` after verification.

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
| `deleted_events` view                      | `archived_invitations` view |

## Security Model

- RLS is enabled for all tables except Supabase Auth tables.
- All SECURITY DEFINER functions have been hardened with `SET search_path = 'public'` (migration
  37).
- Public guest flows run through server APIs. Personalized reads remain invite-scoped, and public
  RSVP writes are event-scoped only for events that enable hybrid access.
- Elevated dashboard operations depend on authenticated session state plus repository-level auth and
  MFA safeguards.
- Service-role access is still used by the repository layer (documented tradeoff). Server-side code
  uses `useServiceRole: true` for all database operations, meaning RLS provides no defense-in-depth
  if a server endpoint is compromised. Future work should introduce per-operation auth checks in
  service code.

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
4. **Drop deprecated views**: `deleted_events` (unused; `deleted_invitation_projects` already
   dropped in migration 36).
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
# Open the Supabase SQL editor or use the CLI:
supabase db diff --linked
```

The canonical schema verification script is `supabase/verification/full_schema_audit.sql`, which
runs PASS/FAIL checks for all critical tables, constraints, indexes, RLS policies, and RPC
privileges.

See also `docs/domains/database/overview.md` for the ERD diagram and data-flow documentation.
