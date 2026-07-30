begin;
select plan(61);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'atomic-publish@example.test', now(), now());
insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, created_by, kind)
values ('20000000-0000-0000-0000-000000000001', 'atomic-publish', 'Publicación atómica', 'xv', 'in_production', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, '10000000-0000-0000-0000-000000000001', 'client');
insert into public.invitation_content_drafts (id, invitation_project_id, content, status)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{"title":"Publicación atómica"}'::jsonb, 'draft');

select has_function('public', 'publish_invitation_atomic', array['uuid','uuid','timestamp with time zone','text','text','boolean','jsonb'], 'functional legacy compatibility overload exists');
select has_function('public', 'publish_invitation_atomic', array['uuid','uuid','timestamp with time zone','integer','text','text','uuid','text','text','boolean','jsonb'], 'new eleven-argument publication RPC exists');
select has_function('public', 'replay_invitation_publication', array['uuid','uuid','timestamp with time zone','integer','text','text','uuid'], 'receipt replay RPC exists');
select ok(has_function_privilege('service_role', 'public.publish_invitation_atomic(uuid,uuid,timestamptz,text,text,boolean,jsonb)', 'EXECUTE'), 'service role can execute legacy stub');
select ok(not has_function_privilege('authenticated', 'public.publish_invitation_atomic(uuid,uuid,timestamptz,text,text,boolean,jsonb)', 'EXECUTE'), 'authenticated cannot execute legacy stub');
select ok(not has_function_privilege('authenticated', 'public.replay_invitation_publication(uuid,uuid,timestamptz,integer,text,text,uuid)', 'EXECUTE'), 'authenticated cannot execute receipt replay');
select ok(not has_table_privilege('authenticated', 'public.invitation_publication_idempotency', 'SELECT'), 'authenticated cannot read idempotency receipts');
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
insert into public.invitations (id, slug, title, event_type, base_demo_id, theme_id, kind, status)
values ('20000000-0000-0000-0000-000000000002', 'legacy-compatibility', 'Compatibilidad heredada', 'xv', 'demo-xv-jewelry-box', 'jewelry-box', 'demo', 'draft');
insert into public.invitation_content_drafts (id, invitation_project_id, content, status)
values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '{"title":"Compatibilidad heredada"}'::jsonb, 'draft');
select is(
  (select public.publish_invitation_atomic(i.id, d.id, d.updated_at, 'legacy-compatibility', 'xv', true, '{"title":"Compatibilidad heredada"}'::jsonb) -> 'publishedContent' ->> 'version'
    from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id = i.id
    where i.id = '20000000-0000-0000-0000-000000000002'),
  '1', 'legacy compatibility overload publishes with its historical result shape'
);
select is((select status from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000002'), 'approved', 'legacy compatibility overload approves the draft');
select is((select relrowsecurity from pg_class where oid='public.invitation_publication_idempotency'::regclass), true, 'idempotency table has RLS enabled');
select is((select count(*) from information_schema.table_privileges where table_schema='public' and table_name='invitation_publication_idempotency' and grantee='service_role'), 3::bigint, 'only intended service role table privileges remain');
select is((select confdeltype from pg_constraint where conname = 'invitation_publication_idempotency_invitation_id_fkey'), 'r', 'invitation deletion is restricted by receipt retention');
select is((select confdeltype from pg_constraint where conname = 'invitation_publication_idempotency_draft_id_fkey'), 'r', 'draft deletion is restricted by receipt retention');

select has_function('public', 'save_invitation_metadata_atomic', array['uuid','uuid','timestamp with time zone','timestamp with time zone','jsonb','boolean','jsonb','text','text','uuid','text','text'], 'atomic metadata reopen RPC exists');
select has_function('public', 'restore_invitation_from_published_atomic', array['uuid','uuid','timestamp with time zone','timestamp with time zone','uuid','integer','jsonb','text','text','uuid','text','text'], 'atomic restore RPC exists');
select ok(not has_function_privilege('authenticated', 'public.save_invitation_metadata_atomic(uuid,uuid,timestamptz,timestamptz,jsonb,boolean,jsonb,text,text,uuid,text,text)', 'EXECUTE'), 'authenticated cannot execute metadata reopen');
select ok(not has_function_privilege('authenticated', 'public.restore_invitation_from_published_atomic(uuid,uuid,timestamptz,timestamptz,uuid,integer,jsonb,text,text,uuid,text,text)', 'EXECUTE'), 'authenticated cannot execute restore');
select ok(not has_table_privilege('service_role', 'public.guest_invitations', 'INSERT'), 'service role cannot insert guest confirmations directly');
select ok(not has_table_privilege('service_role', 'public.guest_invitations', 'UPDATE'), 'service role cannot update guest confirmations directly');
select ok(not has_table_privilege('service_role', 'public.guest_invitations', 'DELETE'), 'service role cannot delete guest confirmations directly');
select ok(not has_table_privilege('service_role', 'public.guest_invitation_audit', 'INSERT'), 'service role cannot insert guest audit directly');
select ok(not has_table_privilege('service_role', 'public.guest_invitation_audit', 'UPDATE'), 'service role cannot update guest audit directly');
select ok(not has_table_privilege('service_role', 'public.guest_invitation_audit', 'DELETE'), 'service role cannot delete guest audit directly');
select ok(has_table_privilege('service_role', 'public.invitation_mutation_operation_receipts', 'SELECT'), 'service role can read mutation receipts');
select ok(has_table_privilege('service_role', 'public.invitation_mutation_operation_receipts', 'INSERT'), 'service role can append mutation receipts');
select ok(not has_table_privilege('service_role', 'public.invitation_mutation_operation_receipts', 'UPDATE'), 'service role cannot update mutation receipts');
select ok(not has_table_privilege('service_role', 'public.invitation_mutation_operation_receipts', 'DELETE'), 'service role cannot delete mutation receipts');
select ok(position('guest_invitations' in pg_get_functiondef('public.save_invitation_metadata_atomic(uuid,uuid,timestamptz,timestamptz,jsonb,boolean,jsonb,text,text,uuid,text,text)'::regprocedure)) = 0, 'metadata RPC does not touch guest confirmation tables');
select ok(position('guest_invitations' in pg_get_functiondef('public.restore_invitation_from_published_atomic(uuid,uuid,timestamptz,timestamptz,uuid,integer,jsonb,text,text,uuid,text,text)'::regprocedure)) = 0, 'restore RPC does not touch guest confirmation tables');
select ok(
  not (
    select p.prosrc ~* 'from\s+public\.invitation_mutation_operation_receipts[\s\S]{0,160}\mfor\s+(share|update|no\s+key\s+update|key\s+share)\M'
    from pg_proc p
    where p.oid = 'public.save_invitation_metadata_atomic(uuid,uuid,timestamptz,timestamptz,jsonb,boolean,jsonb,text,text,uuid,text,text)'::regprocedure
  ),
  'metadata RPC does not row-lock append-only receipts'
);
select ok(
  not (
    select p.prosrc ~* 'from\s+public\.invitation_mutation_operation_receipts[\s\S]{0,160}\mfor\s+(share|update|no\s+key\s+update|key\s+share)\M'
    from pg_proc p
    where p.oid = 'public.restore_invitation_from_published_atomic(uuid,uuid,timestamptz,timestamptz,uuid,integer,jsonb,text,text,uuid,text,text)'::regprocedure
  ),
  'restore RPC does not row-lock append-only receipts'
);
select ok(
  (
    select p.prosrc ~* 'from\s+public\.invitations[\s\S]{0,160}archived_at\s+is\s+null\s+for\s+update'
    from pg_proc p
    where p.oid = 'public.save_invitation_metadata_atomic(uuid,uuid,timestamptz,timestamptz,jsonb,boolean,jsonb,text,text,uuid,text,text)'::regprocedure
  ),
  'metadata RPC serializes on the invitation row'
);
select ok(
  (
    select p.prosrc ~* 'from\s+public\.invitations[\s\S]{0,160}archived_at\s+is\s+null\s+for\s+update'
    from pg_proc p
    where p.oid = 'public.restore_invitation_from_published_atomic(uuid,uuid,timestamptz,timestamptz,uuid,integer,jsonb,text,text,uuid,text,text)'::regprocedure
  ),
  'restore RPC serializes on the invitation row'
);

insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, created_by, kind)
values ('20000000-0000-0000-0000-000000000003', 'editor-atomic', 'Título anterior', 'xv', 'published', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, '10000000-0000-0000-0000-000000000001', 'client');
insert into public.invitation_content_drafts (id, invitation_project_id, content, status)
values ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '{"title":"Borrador anterior"}'::jsonb, 'approved');
insert into public.published_invitation_content (id, invitation_project_id, slug, event_type, is_demo, content, version, published_at)
values ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'editor-atomic', 'xv', false, '{"title":"Título público","description":"Publicado"}'::jsonb, 1, now());
create temporary table editor_atomic_baseline as
select i.updated_at as invitation_updated_at, d.updated_at as draft_updated_at
from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id=i.id
where i.id='20000000-0000-0000-0000-000000000003';
create temporary table metadata_atomic_result as
select public.save_invitation_metadata_atomic(
  '60000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000003', invitation_updated_at, draft_updated_at,
  '{"title":"Título editado","slug":"editor-editado","status":"published","clientName":"Cliente","clientEmail":"","clientWhatsapp":"","photosReceived":true}'::jsonb,
  true, '{"title":"Borrador anterior"}'::jsonb, 'local', 'local-test',
  '10000000-0000-0000-0000-000000000001', 'admin', 'editor'
) as result from editor_atomic_baseline;
select is((select title from public.invitations where id='20000000-0000-0000-0000-000000000003'), 'Título editado', 'metadata title commits atomically');
select is((select status from public.invitation_content_drafts where id='30000000-0000-0000-0000-000000000003'), 'draft', 'metadata public change reopens draft atomically');
select is((select status from public.invitation_mutation_operation_receipts where operation_id='60000000-0000-0000-0000-000000000003'), 'applied', 'metadata receipt commits with state');
select is((select public.save_invitation_metadata_atomic(
  '60000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000003', invitation_updated_at, draft_updated_at,
  '{"title":"Título editado","slug":"editor-editado","status":"published","clientName":"Cliente","clientEmail":"","clientWhatsapp":"","photosReceived":true}'::jsonb,
  true, '{"title":"Borrador anterior"}'::jsonb, 'local', 'local-test',
  '10000000-0000-0000-0000-000000000001', 'admin', 'editor'
) ->> 'idempotent' from editor_atomic_baseline), 'true', 'metadata retry returns stored result');
select is((select count(*) from public.invitation_mutation_operation_receipts where operation_id='60000000-0000-0000-0000-000000000003'), 1::bigint, 'metadata replay remains one append-only receipt');
select is((select title from public.invitations where id='20000000-0000-0000-0000-000000000003'), 'Título editado', 'metadata replay does not reapply the mutation');
select throws_like(
  $$select public.save_invitation_metadata_atomic('60000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000003',(select invitation_updated_at - interval '1 second' from editor_atomic_baseline),null,'{"title":"Stale","slug":"stale","status":"published","clientName":"","clientEmail":"","clientWhatsapp":"","photosReceived":false}',false,null,'local','local-test','10000000-0000-0000-0000-000000000001','admin','editor')$$,
  '%editor_stale_invitation%', 'stale metadata invitation revision rolls back'
);
select is((select count(*) from public.invitation_mutation_operation_receipts where operation_id='60000000-0000-0000-0000-000000000004'), 0::bigint, 'failed metadata mutation leaves no successful receipt');
select throws_like(
  $$select public.save_invitation_metadata_atomic('60000000-0000-0000-0000-00000000000a','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',now(),null,'{"title":"Missing","slug":"missing","status":"published","clientName":"","clientEmail":"","clientWhatsapp":"","photosReceived":false}',false,null,'local','local-test','10000000-0000-0000-0000-000000000001','admin','editor')$$,
  '%editor_invitation_not_found%', 'missing invitation is rejected before receipt creation'
);
select is((select count(*) from public.invitation_mutation_operation_receipts where operation_id='60000000-0000-0000-0000-00000000000a'), 0::bigint, 'missing invitation leaves no receipt');
select throws_like(
  $$update public.invitation_mutation_operation_receipts set status='replayed' where operation_id='60000000-0000-0000-0000-000000000003'$$,
  '%append-only%', 'direct receipt UPDATE remains rejected'
);
select throws_like(
  $$delete from public.invitation_mutation_operation_receipts where operation_id='60000000-0000-0000-0000-000000000003'$$,
  '%append-only%', 'direct receipt DELETE remains rejected'
);
select lives_ok(
  $$
  do $role$
  begin
    perform set_config('role', 'service_role', true);
    perform public.save_invitation_metadata_atomic(
      '60000000-0000-0000-0000-000000000005',
      '20000000-0000-0000-0000-000000000003',
      (select updated_at from public.invitations where id='20000000-0000-0000-0000-000000000003'),
      null,
      '{"title":"Título secuencial","slug":"editor-editado","status":"published","clientName":"Cliente","clientEmail":"","clientWhatsapp":"","photosReceived":true}'::jsonb,
      false, null, 'local', 'local-test',
      '10000000-0000-0000-0000-000000000001', 'admin', 'editor'
    );
  end
  $role$;
  $$,
  'service_role metadata save succeeds with SELECT+INSERT receipt privileges'
);
select is((select title from public.invitations where id='20000000-0000-0000-0000-000000000003'), 'Título secuencial', 'legitimate sequential metadata mutation persists');

create temporary table restore_atomic_baseline as
select i.updated_at as invitation_updated_at, d.updated_at as draft_updated_at
from public.invitations i join public.invitation_content_drafts d on d.invitation_project_id=i.id
where i.id='20000000-0000-0000-0000-000000000003';
create temporary table restore_atomic_result as
select public.restore_invitation_from_published_atomic(
  '70000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000003', invitation_updated_at, draft_updated_at,
  '50000000-0000-0000-0000-000000000003', 1,
  '{"title":"Título público","description":"Publicado"}'::jsonb, 'local', 'local-test',
  '10000000-0000-0000-0000-000000000001', 'admin', 'editor'
) as result from restore_atomic_baseline;
select is((select title from public.invitations where id='20000000-0000-0000-0000-000000000003'), 'Título público', 'restore resets invitation metadata from published source');
select is((select content->>'description' from public.invitation_content_drafts where id='30000000-0000-0000-0000-000000000003'), 'Publicado', 'restore replaces draft content atomically');
select is((select status from public.invitation_mutation_operation_receipts where operation_id='70000000-0000-0000-0000-000000000003'), 'applied', 'restore receipt commits with state');
select is((select public.restore_invitation_from_published_atomic(
  '70000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000003', invitation_updated_at, draft_updated_at,
  '50000000-0000-0000-0000-000000000003', 1,
  '{"title":"Título público","description":"Publicado"}'::jsonb, 'local', 'local-test',
  '10000000-0000-0000-0000-000000000001', 'admin', 'editor'
) ->> 'idempotent' from restore_atomic_baseline), 'true', 'restore retry returns stored result');
update public.published_invitation_content set version=2 where id='50000000-0000-0000-0000-000000000003';
select throws_like(
  $$select public.restore_invitation_from_published_atomic('70000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000003',(select updated_at from public.invitations where id='20000000-0000-0000-0000-000000000003'),(select updated_at from public.invitation_content_drafts where id='30000000-0000-0000-0000-000000000003'),'50000000-0000-0000-0000-000000000003',1,'{}','local','local-test','10000000-0000-0000-0000-000000000001','admin','editor')$$,
  '%editor_stale_published%', 'restore rejects a changed published version'
);
select * from finish();
rollback;
