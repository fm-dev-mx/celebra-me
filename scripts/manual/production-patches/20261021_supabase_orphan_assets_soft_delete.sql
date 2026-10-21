-- @script-id: 20261021_supabase_orphan_assets_soft_delete
-- @purpose: Soft-delete the 13 live invitation_assets rows on the supabase provider that no published content or draft references, so Production keeps only r2 rows
-- @env: production
-- @ticket: owner decision d113 (row 18 of the invitation code reduction plan); read-only audit in .agent/tmp/reports/2026-10-21-fila-18-r2-revision.md
-- @tables: public.invitation_assets
-- @operation: update
-- @expected-rows-min: 13
-- @expected-rows-max: 13
-- @requires-backup: true
-- @dry-run-query: select id, invitation_id, storage_path from public.invitation_assets where provider = 'supabase' and deleted_at is null and id in ('fad93470-1c8d-45ef-90c4-fab7d19b7912', 'ba417856-16e7-4808-9e03-2c84d17c069d', 'b6d30e2a-cbed-4eed-8335-710105cdaa52', 'd1049f89-961c-4d07-ad12-19cc50efd0cc', '0b760f93-6e5d-4f5b-b6c5-e2d999551a24', 'ff5f596c-422b-4bfc-8954-85733fb9f68f', '1e4100b9-49bf-430b-8ce0-59a1f9df4a17', 'a1b640d8-7c3a-4a99-b947-cc3da7bed101', '869fb59d-96d3-4e42-9589-141e0bbc315e', '0c146376-d90a-42fb-89c1-154808527ba2', 'c9e50184-6936-4177-9094-b789aeb9048b', '707de417-7959-44af-a673-e4eff994d652', '5a9dda61-b675-4b35-b5ed-552c09998461')
-- @rollback: update public.invitation_assets set deleted_at = null where id in (the 13 ids above); the Supabase Storage objects are not touched, so the rows serve again unchanged

begin;

update public.invitation_assets
set deleted_at = now()
where provider = 'supabase'
  and deleted_at is null
  and id in (
    'fad93470-1c8d-45ef-90c4-fab7d19b7912', 'ba417856-16e7-4808-9e03-2c84d17c069d',
    'b6d30e2a-cbed-4eed-8335-710105cdaa52', 'd1049f89-961c-4d07-ad12-19cc50efd0cc',
    '0b760f93-6e5d-4f5b-b6c5-e2d999551a24', 'ff5f596c-422b-4bfc-8954-85733fb9f68f',
    '1e4100b9-49bf-430b-8ce0-59a1f9df4a17', 'a1b640d8-7c3a-4a99-b947-cc3da7bed101',
    '869fb59d-96d3-4e42-9589-141e0bbc315e', '0c146376-d90a-42fb-89c1-154808527ba2',
    'c9e50184-6936-4177-9094-b789aeb9048b', '707de417-7959-44af-a673-e4eff994d652',
    '5a9dda61-b675-4b35-b5ed-552c09998461'
  );

commit;
