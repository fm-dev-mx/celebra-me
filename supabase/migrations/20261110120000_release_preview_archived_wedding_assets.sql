begin;

-- Preview-only identity verified read-only: this ID does not exist in Production.
-- The real Production wedding must remain unchanged. Never match updates by slug.
-- The Preview copy b789dbc3 of daniela-y-martin was archived by migration 20261026173000
-- and rekeyed by migration 20261110100000, but its historical invitation_assets rows
-- still retain storage_path paths prefixed with invitations/boda/daniela-y-martin/.
-- Because idx_invitation_assets_storage_path is a non-partial unique index on
-- (bucket, storage_path), provisioning the canonical wedding on Preview fails with a
-- duplicate key conflict even against soft-deleted rows.
-- Relocate these storage_path values to match the archived slug:
-- invitations/boda/daniela-y-martin-archived-b789dbc3/..., preserving rows and evidence.

update public.invitation_assets
set storage_path = replace(
      storage_path,
      'invitations/boda/daniela-y-martin/',
      'invitations/boda/daniela-y-martin-archived-b789dbc3/'
    ),
    updated_at = now()
where invitation_id = 'b789dbc3-6a6b-4602-aa92-20d202fc8ecd'::uuid
  and storage_path like 'invitations/boda/daniela-y-martin/%';

commit;
