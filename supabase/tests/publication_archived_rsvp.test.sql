begin;
select plan(8);

-- Publishing content must not reopen an RSVP that an administrator disabled (event archived),
-- while a draft or published linked event keeps becoming published.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('10000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'archived-rsvp@example.test', now(), now());

insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, created_by, kind)
values
  ('20000000-0000-0000-0000-0000000000a1', 'archived-rsvp', 'RSVP desactivado', 'xv', 'in_production', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, '10000000-0000-0000-0000-0000000000a1', 'client'),
  ('20000000-0000-0000-0000-0000000000a2', 'draft-rsvp', 'RSVP en borrador', 'xv', 'in_production', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, '10000000-0000-0000-0000-0000000000a1', 'client');

insert into public.invitation_content_drafts (id, invitation_project_id, content, status)
values
  ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', '{"title":"RSVP desactivado"}'::jsonb, 'draft'),
  ('30000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-0000000000a2', '{"title":"RSVP en borrador"}'::jsonb, 'draft');

insert into public.events (id, owner_user_id, slug, event_type, title, status, published_at, invitation_project_id)
values
  ('80000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', 'archived-rsvp', 'xv', 'RSVP desactivado', 'archived', '2026-09-01T12:00:00Z', '20000000-0000-0000-0000-0000000000a1'),
  ('80000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000a1', 'draft-rsvp', 'xv', 'RSVP en borrador', 'draft', null, '20000000-0000-0000-0000-0000000000a2');

-- First publication of each invitation through the real RPC (no prior published version).
create function pg_temp.publish_test_invitation(p_invitation_id uuid, p_idempotency_key uuid)
returns jsonb
language sql
as $$
  select public.publish_invitation_atomic(
    i.id, d.id, d.updated_at, null,
    md5(md5(jsonb_build_object('archivedAt', i.archived_at, 'baseDemoId', i.base_demo_id, 'eventType', i.event_type, 'kind', i.kind, 'slug', i.slug, 'snapshot', i.snapshot, 'status', i.status, 'themeId', i.theme_id, 'title', i.title)::text) || chr(31) || md5('{}'::jsonb::text)),
    md5(d.content::text),
    p_idempotency_key, i.slug, i.event_type, false, d.content
  )
  from public.invitations i
  join public.invitation_content_drafts d on d.invitation_project_id = i.id
  where i.id = p_invitation_id;
$$;

select lives_ok(
  $$select pg_temp.publish_test_invitation('20000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a1')$$,
  'publishing an invitation whose RSVP is disabled succeeds'
);
select is((select status from public.events where id = '80000000-0000-0000-0000-0000000000a1'), 'archived', 'publication keeps a disabled RSVP archived');
select is((select published_at from public.events where id = '80000000-0000-0000-0000-0000000000a1'), '2026-09-01T12:00:00Z'::timestamptz, 'publication keeps published_at of an archived event');
select ok(exists (select 1 from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-0000000000a1' and deleted_at is null), 'content of the archived-RSVP invitation is still published');

select lives_ok(
  $$select pg_temp.publish_test_invitation('20000000-0000-0000-0000-0000000000a2', '40000000-0000-0000-0000-0000000000a2')$$,
  'publishing an invitation with a draft event succeeds'
);
select is((select status from public.events where id = '80000000-0000-0000-0000-0000000000a2'), 'published', 'publication still opens a draft event');
select isnt((select published_at from public.events where id = '80000000-0000-0000-0000-0000000000a2'), null, 'publication stamps published_at on a draft event');
select is((select count(*) from public.events where invitation_project_id in ('20000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a2')), 2::bigint, 'publication reuses the linked events');

select * from finish();
rollback;
