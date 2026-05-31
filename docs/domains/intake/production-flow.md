# Invitation Production Flow

## Domain model

`Invitation` is the primary production entity. The `invitations` table stores both editable demos
and client invitations:

```ts
type InvitationKind = 'demo' | 'client';
```

| Entity             | Table / source                                                           | Responsibility                                                                                  |
| ------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `Invitation`       | `invitations`                                                            | Editable production entity with `kind`, archive state, client metadata, and rendering snapshot. |
| Demo seed input    | `src/content/event-demos/**` and `src/lib/intake/demo-preset-catalog.ts` | Build-time seed content and asset metadata. Not the dashboard source of truth.                  |
| Capture request    | `intake_requests`                                                        | Optional token-backed client workflow attached to an invitation.                                |
| Capture submission | `intake_submissions`                                                     | Source data submitted by the client or stored by the admin editor.                              |
| Invitation draft   | `invitation_content_drafts`                                              | Editable production content.                                                                    |
| Published content  | `published_invitation_content`                                           | Public snapshot resolved by `(event_type, slug)`.                                               |
| RSVP event         | `events`                                                                 | Separate guest-management responsibility for client invitations only.                           |

## Admin flow

1. `/dashboard/invitaciones` synchronizes missing demo rows from the code-managed seed catalog.
2. Demos and client invitations appear in the same dashboard and use the same editor.
3. `Duplicar desde demo` creates a client invitation with `source_invitation_id`.
4. `/dashboard/invitaciones/[id]/editar` is always available to the admin without a capture token.
5. A capture link is generated only when the admin wants the client to provide source data.
6. Draft editing, preview, and publication remain admin operations.

## Publication rules

- Demo publication writes `published_invitation_content.is_demo = true` and never creates an RSVP
  event.
- Client publication writes `is_demo = false` and creates or synchronizes one linked RSVP event.
- Republishing updates the public snapshot and the linked RSVP event for client invitations.
- Static demo JSON remains a temporary public fallback until database-backed demo publication is
  verified in the deployed environment.

## Archive and deletion

- Archive writes `invitations.archived_at`, hides published content, archives capture rows and
  drafts, and archives a linked RSVP event.
- Restore clears `archived_at` and restores linked records.
- Permanent deletion is exposed only for archived invitations.
- Permanent deletion is blocked when RSVP guests, claim codes, or memberships exist.

## Rollout compatibility

Migration `20260601000001_invitations_domain.sql` keeps a temporary updatable `invitation_projects`
view for the previous Vercel build. Child columns named `invitation_project_id` remain physical
compatibility columns for one deployment cycle. Rename those columns and remove the view only after
the new deployment is verified.
