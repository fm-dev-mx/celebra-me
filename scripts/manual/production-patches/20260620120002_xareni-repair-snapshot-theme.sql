-- @script-id: 20260620120002_xareni-repair-snapshot-theme
-- @purpose: Repair snapshot.themeId, snapshot.id, snapshot.previewSlug
--           for Xareni Iyarit invitation.
-- @env: production
-- @ticket: CELEBRA-XARENI-THEME
-- @tables: public.invitations
-- @operation: update
-- @expected-rows-min: 1
-- @expected-rows-max: 1
-- @requires-backup: true
-- @dry-run-query: select id, theme_id, base_demo_id, snapshot->>'themeId' as snap_theme, snapshot->>'id' as snap_id from public.invitations where id = 'b3ce18b2-15f6-452a-9150-496ddd0ed133';
-- @rollback: restore the invitations row for id b3ce18b2-15f6-452a-9150-496ddd0ed133 from backup.

begin;

-- Preflight: target row must exist
do $$
begin
  if not exists (select 1 from public.invitations where id = 'b3ce18b2-15f6-452a-9150-496ddd0ed133') then
    raise exception 'INVITATION_NOT_FOUND: b3ce18b2-15f6-452a-9150-496ddd0ed133';
  end if;
end $$;

-- Verify current state
select
  id::text,
  theme_id,
  base_demo_id,
  snapshot->>'themeId' as snap_theme,
  snapshot->>'id' as snap_id,
  snapshot->>'previewSlug' as snap_preview_slug
from public.invitations
where id = 'b3ce18b2-15f6-452a-9150-496ddd0ed133';

-- Repair snapshot fields
update public.invitations
set
  snapshot = jsonb_set(
    jsonb_set(
      jsonb_set(
        snapshot,
        '{themeId}',
        '"celestial-blue"'::jsonb
      ),
      '{id}',
      '"demo-xv-celestial-blue"'::jsonb
    ),
    '{previewSlug}',
    '"demo-xv-celestial-blue"'::jsonb
  ),
  base_demo_id = 'demo-xv-celestial-blue',
  theme_id = 'celestial-blue'
where id = 'b3ce18b2-15f6-452a-9150-496ddd0ed133';

-- Verify final state
select
  id::text,
  theme_id,
  base_demo_id,
  snapshot->>'themeId' as snap_theme,
  snapshot->>'id' as snap_id,
  snapshot->>'previewSlug' as snap_preview_slug
from public.invitations
where id = 'b3ce18b2-15f6-452a-9150-496ddd0ed133';

commit;
