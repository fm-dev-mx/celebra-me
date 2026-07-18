begin;
select plan(22);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'atomic-publish@example.test', now(), now());
insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, created_by, kind)
values ('20000000-0000-0000-0000-000000000001', 'atomic-publish', 'Publicación atómica', 'xv', 'in_production', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, '10000000-0000-0000-0000-000000000001', 'client');
insert into public.invitation_content_drafts (id, invitation_project_id, content, status)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{"title":"Publicación atómica"}'::jsonb, 'draft');

select has_function('public', 'publish_invitation_atomic', array['uuid','uuid','timestamp with time zone','text','text','boolean','jsonb'], 'phase-one legacy stub exists');
select has_function('public', 'publish_invitation_atomic', array['uuid','uuid','timestamp with time zone','integer','text','text','uuid','text','text','boolean','jsonb'], 'new eleven-argument publication RPC exists');
select has_function('public', 'replay_invitation_publication', array['uuid','uuid','timestamp with time zone','integer','text','text','uuid'], 'receipt replay RPC exists');
select ok(has_function_privilege('service_role', 'public.publish_invitation_atomic(uuid,uuid,timestamptz,text,text,boolean,jsonb)', 'EXECUTE'), 'service role can execute legacy stub');
select ok(not has_function_privilege('authenticated', 'public.publish_invitation_atomic(uuid,uuid,timestamptz,text,text,boolean,jsonb)', 'EXECUTE'), 'authenticated cannot execute legacy stub');
select ok(not has_function_privilege('authenticated', 'public.replay_invitation_publication(uuid,uuid,timestamptz,integer,text,text,uuid)', 'EXECUTE'), 'authenticated cannot execute receipt replay');
select ok(not has_table_privilege('authenticated', 'public.invitation_publication_idempotency', 'SELECT'), 'authenticated cannot read idempotency receipts');
select is((select public.publish_invitation_atomic('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',now(),'atomic-publish','xv',false,'{}') ->> 'code'), 'publish_upgrade_required', 'legacy call fails closed with explicit code');
select is((select count(*) from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 0::bigint, 'legacy call performs no publication');

create temporary table publication_test_result as
select public.publish_invitation_atomic(
  i.id, d.id, d.updated_at, null,
  md5(md5(jsonb_build_object('archivedAt', i.archived_at, 'baseDemoId', i.base_demo_id, 'eventType', i.event_type, 'kind', i.kind, 'slug', i.slug, 'snapshot', i.snapshot, 'status', i.status, 'themeId', i.theme_id, 'title', i.title)::text) || chr(31) || md5('{}'::jsonb::text)),
  md5('{"title":"Publicación atómica"}'::jsonb::text),
  '40000000-0000-0000-0000-000000000001', 'atomic-publish', 'xv', false, '{"title":"Publicación atómica"}'::jsonb
) as result
from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id = i.id
where i.id = '20000000-0000-0000-0000-000000000001';

select is((select result -> 'publishedContent' ->> 'version' from publication_test_result), '1', 'new contract publishes version one');
select is((select result ->> 'idempotent' from publication_test_result), 'false', 'original response is stored with its original indicator');
select is((select status from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'), 'approved', 'draft approved atomically');
select is((select count(*) from public.invitation_publication_idempotency), 1::bigint, 'one durable receipt is created');
select ok((select result is not null from public.invitation_publication_idempotency), 'receipt contains exact successful response');

select is(
  (select public.publish_invitation_atomic(
    i.id, d.id, (select draft_updated_at from public.invitation_publication_idempotency), null,
    (select public_metadata_hash from public.invitation_publication_idempotency),
    (select projection_hash from public.invitation_publication_idempotency),
    '40000000-0000-0000-0000-000000000001', 'atomic-publish', 'xv', false, '{"title":"Publicación atómica"}'::jsonb
  ) from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id=i.id where i.id='20000000-0000-0000-0000-000000000001'),
  (select result from publication_test_result), 'retry after approved draft replays the exact stored response'
);
select is((select version from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 1, 'retry does not increment the version');
update public.published_invitation_content set content = '{"title":"repair changed content"}'::jsonb where invitation_project_id = '20000000-0000-0000-0000-000000000001';
select is(
  (select public.publish_invitation_atomic(
    i.id, d.id, (select draft_updated_at from public.invitation_publication_idempotency), null,
    (select public_metadata_hash from public.invitation_publication_idempotency),
    (select projection_hash from public.invitation_publication_idempotency),
    '40000000-0000-0000-0000-000000000001', 'atomic-publish', 'xv', false, '{"title":"Publicación atómica"}'::jsonb
  ) from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id=i.id where i.id='20000000-0000-0000-0000-000000000001'),
  (select result from publication_test_result), 'later repair cannot change a prior replay result'
);
select throws_like(
  $$select public.publish_invitation_atomic('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',now(),1,'bad','bad','40000000-0000-0000-0000-000000000001','other','xv',false,'{}')$$,
  '%publish_idempotency_key_reused%', 'same key with different request fails deterministically'
);
select is((select relrowsecurity from pg_class where oid='public.invitation_publication_idempotency'::regclass), true, 'idempotency table has RLS enabled');
select is((select count(*) from information_schema.table_privileges where table_schema='public' and table_name='invitation_publication_idempotency' and grantee='service_role'), 3::bigint, 'only intended service role table privileges remain');
select is((select confdeltype from pg_constraint where conname = 'invitation_publication_idempotency_invitation_id_fkey'), 'r', 'invitation deletion is restricted by receipt retention');
select is((select confdeltype from pg_constraint where conname = 'invitation_publication_idempotency_draft_id_fkey'), 'r', 'draft deletion is restricted by receipt retention');
select * from finish();
rollback;
