# Invitation Production Flow

## Domain entities

| Entity                           | Table / Source                                      | Purpose                                                                                                                                          | Managed from                                                |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Static demo**                  | `src/content/event-demos/*.json` (filesystem)       | Visual reference, default images, section fallback content. Provides the base look-and-feel for each demo preset. Code-managed.                  | Static files                                                |
| **Demo preset**                  | `src/lib/intake/demo-preset-catalog.ts` (in-memory) | Defines theme, supported blocks, required assets, `previewSlug`. Snapshotted into `invitation_projects.snapshot` at project creation time.       | Code configuration                                          |
| **Invitation project**           | `invitation_projects`                               | A single client engagement from creation through publication. Tracks status, client info, and the demo preset snapshot.                          | `/dashboard/invitaciones`                                   |
| **Intake request**               | `intake_requests`                                   | Token-authenticated capture link configuration. Controls which blocks the client can fill out and link expiration.                               | `/dashboard/invitaciones/[id]`                              |
| **Intake submission**            | `intake_submissions`                                | Client-submitted block data for one intake request.                                                                                              | `/dashboard/invitaciones/[id]/review`                       |
| **Draft**                        | `invitation_content_drafts`                         | Generated from an approved submission. Editable by the admin before publishing. One draft per project (unique index on `invitation_project_id`). | `/dashboard/invitaciones/[id]/draft`                        |
| **Published invitation content** | `published_invitation_content`                      | Powers the public route `/[eventType]/[slug]`. Linked to the project via `invitation_project_id`.                                                | Created by `publishDraft`                                   |
| **RSVP event**                   | `events`                                            | Supports guest management and RSVP. May be created or updated as a side-effect of publishing. Has a globally unique `slug`.                      | `/dashboard/eventos` (manual), or side-effect of publishing |

## Full flow

```
create project → select demo base → generate capture link
    → client submits → admin reviews → generate draft
    → edit/preview → publish
```

### Step by step

1. **Admin creates project** at `/dashboard/invitaciones` — chooses a title, demo preset, and
   optionally sets client contact info. The demo preset is snapshotted into
   `invitation_projects.snapshot`.
2. **Admin generates a capture link** at `/dashboard/invitaciones/[id]` — creates an
   `intake_requests` row with a token. The link is shared with the client.
3. **Client submits data** at `/captura/[token]` — fills out blocks defined by the intake request
   configuration. Creates an `intake_submissions` row.
4. **Admin reviews the submission** at `/dashboard/invitaciones/[id]/review` — can approve, request
   changes, or edit corrections.
5. **Admin generates a draft** at `/dashboard/invitaciones/[id]/draft` — maps submission data into
   `invitation_content_drafts`.
6. **Admin edits the draft** — manually adjusts content in the draft editor.
7. **Admin previews** at `/dashboard/invitaciones/[id]/preview` — renders the invitation using draft
   content merged with demo fallbacks.
8. **Admin publishes** — `publishDraft` is called, which:
   - Validates all preconditions (draft exists, content non-empty, snapshot available, owner
     assigned).
   - Checks that the slug does not collide with another project's published content.
   - Creates or updates an `events` record (RSVP event) — requires `project.createdBy` to be set.
   - Upserts a `published_invitation_content` row.
   - Updates the project status to `published`.

## Slug behavior

- `published_invitation_content` uses `UNIQUE(event_type, slug)` as its routing key. The same slug
  can be reused across different event types (e.g., `my-event` for both `xv` and `boda`).
- `events.slug` is `UNIQUE NOT NULL` globally — no event type scoping. This is a separate, stricter
  constraint.
- The publishing service (`publishDraft`) coordinates between these two uniqueness domains:
  1. Checks `published_invitation_content` for `(event_type, slug)` collision with a different
     project.
  2. Queries `events` by slug alone, then checks `event_type`:
     - Matching slug + matching event_type → update existing event.
     - Matching slug + different event_type → block with error (cannot publish).
     - No event → create one (requires owner).

## Demo management

Demos are currently code-managed. To add a new demo:

1. Create a JSON file in `src/content/event-demos/` following existing patterns.
2. Add a new `DemoPreset` entry in `src/lib/intake/demo-preset-catalog.ts`.
3. Add a new SCSS preset if needed.

There is no dashboard-based demo editor. This is by design — demos are infrequently changed and
benefit from code review.

## Status flow for invitation projects

```
draft → waiting_for_client → client_submitted → in_review
    → in_production → preview_sent → approved → published
                                                     → archived
```

Any status can transition to `archived`. A published project can be re-published (upserts content
and increments version).

## Key constraints and known divergence

- `events.slug` is globally unique. `published_invitation_content` uses `UNIQUE(event_type, slug)`.
  This means a slug value can be used in different event types for published content but NOT for
  events.
- `publishDraft` requires `project.createdBy` to be set. Without an owner, publishing is blocked.
  This ensures every published project has an associated RSVP event.
- Manual event creation at `/dashboard/eventos` remains available for exceptional/technical cases.
