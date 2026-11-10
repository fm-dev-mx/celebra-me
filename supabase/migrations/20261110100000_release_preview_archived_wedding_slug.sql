begin;

-- Preview-only identities verified read-only: none of these IDs exists in Production.
-- The real Production wedding must remain unchanged. Never match updates by slug.
-- The Preview copy b789dbc3 of daniela-y-martin was archived by migration 20261026173000,
-- but retained the slug (invitation_projects_slug_key), managed_identity_id
-- (invitations_managed_identity_id_uidx) and provenance (managed_provenance_managed_identity_id_uidx).
-- Free all three constraints by moving the slug and detaching the managed identity,
-- preserving the archived row and historical data as evidence.

-- 1) Disable immutable identity triggers temporarily for this surgical data release.
alter table public.invitations
  disable trigger trg_reject_invitation_managed_identity_mutation;
alter table public.managed_invitation_release_provenance
  disable trigger trg_sync_invitation_managed_identity;

-- 2) Release provenance unique index and definition slug for the archived Preview row
update public.managed_invitation_release_provenance
set managed_identity_id = null,
    definition_slug = 'daniela-y-martin-archived-b789dbc3'
where invitation_id = 'b789dbc3-6a6b-4602-aa92-20d202fc8ecd'::uuid;

-- 3) Release invitation unique constraints (slug and managed_identity_id)
update public.invitations
set slug = 'daniela-y-martin-archived-b789dbc3',
    managed_identity_id = null,
    updated_at = now()
where id = 'b789dbc3-6a6b-4602-aa92-20d202fc8ecd'::uuid
  and archived_at is not null;

-- 4) Re-enable triggers.
alter table public.invitations
  enable trigger trg_reject_invitation_managed_identity_mutation;
alter table public.managed_invitation_release_provenance
  enable trigger trg_sync_invitation_managed_identity;

-- 5) Also ensure published content and events do not hold the unique route keys for this archived UUID
update public.published_invitation_content
set slug = 'daniela-y-martin-archived-b789dbc3',
    updated_at = now()
where invitation_project_id = 'b789dbc3-6a6b-4602-aa92-20d202fc8ecd'::uuid
  and slug = 'daniela-y-martin';

update public.events
set slug = 'daniela-y-martin-archived-b789dbc3',
    updated_at = now()
where invitation_project_id = 'b789dbc3-6a6b-4602-aa92-20d202fc8ecd'::uuid
  and slug = 'daniela-y-martin';

commit;
