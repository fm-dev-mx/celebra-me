# RSVP Database Operations

RSVP routes, APIs, and host/guest flow are owned by [`architecture.md`](architecture.md). This file
is the RSVP table/schema inventory and database-specific operational notes.

This document describes the active Supabase schema and operational workflow for the RSVP and
invitation domains.

## Scope

The backend persists data in Supabase and is implemented through repositories and services under
`src/lib/rsvp/**` and `src/lib/intake/**`.

The full table inventory, ERD, indexes, and constraints are owned by
[`docs/domains/database/overview.md`](../database/overview.md). The RSVP-specific tables are
`events`, `guest_invitations`, `guest_invitation_audit`, and `event_memberships`. Claim codes and
the RSVP v1 tables are dropped by the 2026-10-09 retirement migrations.

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
is service-owned and its RPC blocks events with guests or memberships; managed compensation also
preflights guests before removing an operation-created event. The editor RPCs touch only
`invitations`, `invitation_content_drafts`, `published_invitation_content` (read/lock for restore),
and append-only mutation receipts. They have service-role-only execute grants and no guest-table
grants. Mutation receipts are an immutable idempotency ledger (`SELECT`+`INSERT` only); RPCs
serialize on the invitation row and must not take `FOR SHARE`/`FOR UPDATE` locks on receipt rows.

The complete disposable recovery drill in `docs/database-workflow.md` fingerprints guest rows and
audit history deterministically and verifies event/invitation/owner links, memberships, confirmation
and delivery state, attendee totals, response timestamps, soft deletes, uniqueness, and
phone/country invariants after restore. Row counts alone are not accepted as RSVP recovery proof.
The pgTAP contract also proves the invitation service role cannot insert, update, or delete guest
confirmations or guest audit rows.

## Active URL Patterns Backed By The Schema

- direct invite URL: `/{eventType}/{slug}?invite={inviteId}`
- short invite URL: `/{eventType}/{slug}/i/{shortId}`
- landing RSVP URL: `/{eventType}/{slug}`
- guest APIs: `/api/invitacion/:inviteId/location`, `/rsvp`, `/view`
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
- `guest_invitation_audit` stores lifecycle events such as `created`, `viewed` (first view only),
  `shared`, and RSVP state changes.
- `guest_engagement_events` is the append-only guest engagement ledger. The service role has SELECT
  and INSERT only; writes go through `record_guest_engagement_events_public`, which also maintains
  the engagement projections on `guest_invitations` (`open_count`, `first_opened_at`,
  `last_opened_at`, `last_previewed_at`, `max_progress_milestone`, `rsvp_form_viewed_at`,
  `rsvp_form_started_at`). Hosts read aggregates through `get_event_engagement_summary` (security
  invoker). `guest_invitations.is_test` excludes test guests. Taxonomy, metrics, and retention:
  [`engagement-analytics.md`](./engagement-analytics.md).
- `events.event_date` is derived from published content by `invitation_event_date()` and kept
  current by a trigger on `published_invitation_content`.

For hybrid public RSVP:

- `guest_invitations` remains the canonical RSVP table.
- public submissions dedupe on the active `(event_id, country_code, phone)` uniqueness used by the
  service layer.
- when a matching phone already exists, the existing guest row is updated instead of creating a
  duplicate.
- when no matching phone exists, a new row is created with:
  - `entry_source = 'generic_public'`
  - `delivery_status = 'generated'`
  - `max_allowed_attendees` seeded from the content RSVP guest cap

### Invitation domain tables

Invitation and intake tables (`invitations`, `intake_*`, drafts, published content,
`invitation_assets`) are described in the overview. Child FK columns keep the historical name
`invitation_project_id` (see Deferred Cleanup).

Asset binaries live in Supabase Storage locally and on Cloudinary in Preview/Production (see the
Storage Provider Boundary in
[`content-parity-rsvp-isolation.md`](../../core/content-parity-rsvp-isolation.md)). DB dumps copy
`invitation_assets` metadata but not Storage objects. Managed rows additionally record definition
slug, semantic source key, SHA-256, and operation ID. Null managed ownership means target-owned:
package absence alone can never prune that row.

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
- All SECURITY DEFINER functions have been hardened with `SET search_path = 'public'`
  (`20260601000002_corrective_security.sql`).
- Public guest flows run through server APIs. Personalized reads remain invite-scoped. View,
  personalized RSVP/decline, and hybrid event writes use service-role-only `SECURITY DEFINER` RPCs
  that validate the invite or published non-demo client event; browser roles cannot execute them.
- Elevated dashboard operations depend on authenticated session state plus repository-level auth and
  MFA safeguards.
- Service-role reads remain server-only. Direct service-role guest and guest-audit writes are
  revoked; narrow RSVP RPC execution is the only privileged public mutation boundary. Authenticated
  dashboard guest reads, creates, and edits continue through host-scoped RLS.
- Dashboard guest soft delete cannot run through RLS: the `guest_invitations` SELECT policy only
  exposes active rows, and PostgreSQL requires the updated row of a filtered UPDATE to remain
  visible, so a client `PATCH deleted_at` fails with `42501`. The BFF first checks access with the
  host session, then calls the service-role-only `soft_delete_guest_invitation_v1(guest, actor)`
  RPC, which re-checks that the actor owns, actively manages, or administers the active event.
  Soft-deleted guests stay invisible to client sessions and cannot be restored or edited from them
  (`supabase/tests/guest_invitation_rls.test.sql`,
  `tests/db/dashboard-guest-soft-delete-db.test.ts`).

## Environment Variables

Variable categories, sources, and the template/typing contract are owned by
[`docs/env-workflow.md`](../../env-workflow.md). RSVP security inputs include `TRUST_DEVICE_SECRET`,
`TRUST_DEVICE_MAX_AGE_DAYS`, and `REQUIRE_FRESH_MFA_FOR_ADMIN`.

## Deferred Cleanup

The following items require separate cleanup migrations but are not urgent. Do not mix with critical
or invitation-domain changes.

1. **Rename child FK columns**: `invitation_project_id` → `invitation_id` on `events`,
   `published_invitation_content`, `invitation_content_drafts`. No rename is in progress; it needs
   its own expand/contract migration pair.
2. **Drop `invitation_content_drafts.submission_id`**: always null since the capture form was
   retired; the publication RPCs still name it, so it leaves with their next contract migration.
3. **Drop deprecated views**: `deleted_events` — done in
   `20260726170000_drop_deleted_events_view.sql` (`deleted_invitation_projects` already dropped
   earlier).
4. **Remove compatibility view**: `invitation_projects` view (created in
   `20260601000001_invitations_domain.sql`) once no caller reads it.
5. **Add NOT NULL to `short_id`**: After verifying all rows have a value.

## Suggested Verification

Use current tests that map to the live surface, for example:

```bash
pnpm test -- tests/api/dashboard.guests.happy.test.ts tests/api/dashboard.guests.export.test.ts tests/api/invitacion.happy.test.ts tests/api/invitacion.public.test.ts
```

Verify the hosted schema contract after migrations (preflight is
`pnpm db:migrate -- --target <target>`):

```bash
pnpm db:contract:verify -- --target <production|preview>
```

The canonical schema verification script is `supabase/verification/full_schema_audit.sql`, which
runs PASS/FAIL checks for all critical tables, constraints, indexes, RLS policies, and RPC
privileges.

See also `docs/domains/database/overview.md` for the ERD diagram and data-flow documentation.
