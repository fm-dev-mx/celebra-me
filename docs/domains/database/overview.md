# Database Overview

**Last Updated:** 2026-05-31

This document describes the current Celebra-me Supabase/Postgres schema, entity relationships, and
major data flows.

## ERD (Entity Relationship Diagram)

```mermaid
erDiagram
    invitations ||--o{ intake_requests : "invitation_project_id"
    invitations ||--o{ invitation_content_drafts : "invitation_project_id"
    invitations ||--o{ published_invitation_content : "invitation_project_id"
    invitations ||--o| events : "invitation_project_id"
    invitations {
        uuid id PK
        text kind "demo | client"
        uuid source_invitation_id "demo lineage"
        text slug UK "nullable"
        text title
        text event_type "xv | boda | bautizo | cumple"
        text status "draft..published"
        text base_demo_id
        text theme_id
        jsonb snapshot
        text client_name
        text client_email
        text client_whatsapp
        boolean photos_received
        uuid created_by FK
        timestamptz archived_at
        timestamptz created_at
        timestamptz updated_at
    }

    events ||--o{ guest_invitations : event_id
    events ||--o{ event_claim_codes : event_id
    events ||--o{ event_memberships : event_id
    events {
        uuid id PK
        uuid owner_user_id FK
        text slug UK
        text event_type
        text title
        text status "draft | published | archived"
        uuid invitation_project_id FK "nullable"
        timestamptz published_at
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    guest_invitations {
        uuid id PK
        uuid invite_id UK
        uuid event_id FK
        text short_id UK "nullable"
        text full_name
        text phone "nullable"
        text country_code "nullable"
        text email "nullable"
        text[] tags
        jsonb metadata
        int max_allowed_attendees
        text attendance_status "pending | confirmed | declined"
        int attendee_count
        text guest_comment
        text delivery_status "generated | shared"
        timestamptz first_viewed_at
        timestamptz last_viewed_at
        timestamptz responded_at
        text last_response_source "link | admin | generic_link"
        text entry_source "dashboard | generic_public"
        boolean is_viewed
        int view_percentage
        boolean hide_celebra_me_branding
        text legacy_guest_id
        text legacy_event_slug
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    guest_invitation_audit {
        uuid id PK
        uuid guest_invitation_id FK
        text actor_type "guest | host | system"
        text event_type "created | viewed | status_changed | message_updated | shared_whatsapp"
        jsonb payload
        timestamptz created_at
    }

    event_memberships {
        uuid id PK
        uuid event_id FK
        uuid user_id FK
        text membership_role "owner | manager"
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    event_claim_codes {
        uuid id PK
        uuid event_id FK
        text code_key UK
        text code_hash
        boolean active
        timestamptz expires_at
        int max_uses
        int used_count
        uuid created_by FK
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    app_user_roles {
        uuid user_id PK FK
        text role "super_admin | host_client"
        timestamptz created_at
        timestamptz updated_at
    }

    host_profiles {
        uuid user_id PK FK
        text display_name
        timestamptz created_at
        timestamptz updated_at
    }

    intake_requests {
        uuid id PK
        uuid invitation_project_id FK
        text token_hash UK
        text token_ciphertext "nullable"
        text origin "client | internal"
        text status "draft | active | submitted | closed | expired"
        jsonb enabled_blocks
        timestamptz expires_at
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    intake_submissions {
        uuid id PK
        uuid intake_request_id FK
        text status "in_progress | submitted | needs_changes | approved"
        jsonb block_data
        jsonb photo_notes
        text client_comments
        timestamptz submitted_at
        timestamptz reviewed_at
        text review_notes
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    invitation_content_drafts {
        uuid id PK
        uuid invitation_project_id FK
        uuid submission_id FK "nullable"
        jsonb content
        text status "draft | reviewed | approved"
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    published_invitation_content {
        uuid id PK
        uuid invitation_project_id FK
        text slug
        text event_type
        boolean is_demo
        jsonb content
        int version
        timestamptz published_at
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    audit_logs {
        uuid id PK
        uuid actor_id FK "nullable"
        text action
        text target_table
        uuid target_id
        jsonb old_data
        jsonb new_data
        timestamptz created_at
    }
```

## Major Data Flows

### Invitation Creation

Admin → dashboard → `POST /api/dashboard/intake` → `createInvitation()` → writes `invitations` row
with `kind: 'demo' | 'client'`.

### Internal Admin Editing

Admin opens `/dashboard/invitaciones/[id]/editar` → reads `invitations`, creates/reads
`intake_requests(origin=internal)`, creates/reads `intake_submissions`. Data flows:
`intake_submissions.block_data` → `invitation_content_drafts.content` via draft generation.

### Optional Client Capture (Capture Link)

Admin generates capture link → creates `intake_requests(origin=client)` with `token_hash` +
encrypted `token_ciphertext` → client visits `/captura/[token]` → reads/writes `intake_submissions`
→ admin reviews.

### Publishing

Admin clicks "Publicar" → `publishDraft()` service:

1. Reads draft from `invitation_content_drafts`
2. Maps draft content via `mapDraftToPublished()`
3. If `kind=client`: creates/updates `events` row (RSVP sync)
4. Upserts `published_invitation_content` (one row per `(event_type, slug)`)
5. Updates `invitations.status = 'published'`
6. Updates `invitation_content_drafts.status = 'approved'`

### Public Route Resolution (Content Serving)

Visitor → `/{eventType}/{slug}` → `resolveInvitationContent()`:

1. Tries `published_invitation_content` lookup via `(event_type, slug)`
2. Falls back to static Astro content collection for demo entries
3. Non-demo static entries are explicitly blocked (must come from DB)

### RSVP Linkage

When a client invitation is published, `synchronizeClientRsvp()` checks for an existing `events` row
by `invitation_project_id` or `slug`. Creates or updates the event. The partial unique index
`idx_events_unique_invitation_project` enforces at most one event per project.

### Archive / Restore

Admin clicks "Archivar" → `archive_invitation()` RPC:

- Sets `invitations.archived_at = now()`
- Soft-deletes `published_invitation_content`, `invitation_content_drafts`, `intake_submissions`,
  `intake_requests`, `events`
- Records `audit_logs` entry

Admin clicks "Restaurar" → `restore_invitation()` RPC:

- Clears `archived_at`
- Restores all soft-deleted children
- Restores event status to 'published' if published content exists

### Demo Duplication

Admin clicks "Duplicar desde demo" → `duplicateInvitationFromDemo()`:

1. Creates new `invitations` row with `kind='client'` and `source_invitation_id` pointing to source
2. Copies demo content into a new `invitation_content_drafts` row

## Index Strategy

| Table                          | Index                                                 | Purpose                                    |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------ |
| `invitations`                  | `idx_invitations_archived_at`                         | Active row filtering                       |
| `events`                       | `idx_events_deleted_at`                               | Active row filtering                       |
| `events`                       | `idx_events_unique_invitation_project`                | 1:1 enforcement                            |
| `events`                       | `idx_events_invitation_project_id`                    | FK lookup                                  |
| `guest_invitations`            | `guest_invitations_event_country_phone_active_unique` | Unique (event, country, phone) active only |
| `published_invitation_content` | `published_invitation_content_event_type_slug_key`    | UNIQUE constraint for route key            |
| `intake_requests`              | `idx_intake_requests_token_hash`                      | Token lookup                               |
| `intake_requests`              | `idx_intake_requests_project_origin_created`          | Dashboard listing                          |

## Key Constraints

- `published_invitation_content`: UNIQUE `(event_type, slug)` — route identity
- `guest_invitations`: Partial UNIQUE INDEX
  `(event_id, country_code, phone) WHERE deleted_at IS NULL`
- `events`: Partial UNIQUE INDEX `(invitation_project_id) WHERE invitation_project_id IS NOT NULL`
- `invitations.slug`: UNIQUE (nullable — only set for published invitations)
- `intake_submissions`: Partial UNIQUE INDEX `(intake_request_id)` — exactly one submission per
  request

## Security Model

- **RLS enabled** on all application tables
- **SECURITY DEFINER functions** hardened with `set search_path = 'public'` (migration 37)
- **Server-side service_role**: All repository methods use `useServiceRole: true` to bypass RLS.
  This is a documented tradeoff: defense-in-depth relies on server-side auth checks, not RLS.
- **Public read access**: Only `published_invitation_content` has a public RLS select policy.
- **Admin-only access**: `invitations`, `intake_*`, drafts are locked to `is_admin_user()`.
- **Service-role only**: `audit_logs`, `deleted_*` views, archive/restore RPCs.

## Migration Strategy

Current state: 38 incremental migrations. Production uses `supabase db push` to apply new ones.

**For local/staging**: use `pnpm db:reset:local` (applies all migrations from scratch).

**For production**: never rewrite, delete, or squash already-applied migrations. Always add
corrective migrations. Migration history is append-only.

**Fresh bootstrap**: A `supabase/baseline.sql` schema dump can be generated via
`supabase db dump --schema public > supabase/baseline.sql` for environments that should not replay
all 38 migrations.
