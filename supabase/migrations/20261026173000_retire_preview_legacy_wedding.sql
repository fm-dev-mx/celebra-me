begin;

-- Preview-only identities verified read-only on 2026-10-26: none of these IDs exists in
-- Production. The real Production wedding must remain unchanged. Never match updates by slug.
-- The older Preview invitation/publication are already retired; preserve their timestamps.
update public.published_invitation_content
set deleted_at = now(), updated_at = now()
where id in (
  '5c658a84-c195-4467-8d20-5242ef5d7371'::uuid,
  '7a7d3456-5403-4cae-9282-213a35110193'::uuid
)
and invitation_project_id in (
  '4b616edc-142f-4427-85df-dc75e94aa381'::uuid,
  'b789dbc3-6a6b-4602-aa92-20d202fc8ecd'::uuid
)
and deleted_at is null;

update public.invitations
set archived_at = now(), updated_at = now()
where id in (
  '4b616edc-142f-4427-85df-dc75e94aa381'::uuid,
  'b789dbc3-6a6b-4602-aa92-20d202fc8ecd'::uuid
)
and archived_at is null;

-- These five live Supabase metadata rows belong to the already archived Preview copy.
-- Retired snapshots and Storage bytes remain available; no physical deletion is performed.
-- If an active document starts referencing a row, preserve it for a fresh owner decision.
update public.invitation_assets as a
set deleted_at = now(), updated_at = now()
where a.id in (
  '05438c36-fdba-4f2b-839e-7ad2834216a8'::uuid,
  '0fd31856-413f-4926-a440-839c52b49397'::uuid,
  '9d491c21-a841-4455-bbc7-3a203cab778e'::uuid,
  'cb90fa52-f827-4721-bf67-2a7853fa9221'::uuid,
  'e79bc7db-e69f-49b6-a329-61cd0a5a6a0a'::uuid
)
and a.invitation_id = '4b616edc-142f-4427-85df-dc75e94aa381'::uuid
and a.provider = 'supabase'
and a.deleted_at is null
and not exists (
  select 1 from public.published_invitation_content p
  where p.deleted_at is null and strpos(p.content::text, a.id::text) > 0
)
and not exists (
  select 1 from public.invitation_content_drafts d
  where d.deleted_at is null and strpos(d.content::text, a.id::text) > 0
);

commit;
