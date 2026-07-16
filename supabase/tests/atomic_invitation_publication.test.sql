begin;
select plan(31);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '10000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'atomic-publish@example.test',
  now(),
  now()
);

insert into public.invitations (
  id, slug, title, event_type, status, base_demo_id, theme_id, snapshot,
  created_by, kind
) values (
  '20000000-0000-0000-0000-000000000001',
  'atomic-publish',
  'Publicación atómica',
  'xv',
  'in_production',
  'demo-xv-jewelry-box',
  'jewelry-box',
  '{}'::jsonb,
  '10000000-0000-0000-0000-000000000001',
  'client'
);

insert into public.invitation_content_drafts (
  id, invitation_project_id, content, status
) values (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '{"title":"Publicación atómica"}'::jsonb,
  'draft'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.publish_invitation_atomic(uuid,uuid,timestamptz,text,text,boolean,jsonb)',
    'EXECUTE'
  ),
  'service_role can execute the publication RPC'
);

create or replace function pg_temp.fail_publication_boundary()
returns trigger language plpgsql as $$
begin
  if current_setting('test.fail_table', true) = TG_TABLE_NAME then
    raise exception 'test_failure_%', TG_TABLE_NAME;
  end if;
  return new;
end;
$$;

create trigger test_fail_event before insert or update on public.events
for each row execute function pg_temp.fail_publication_boundary();
create trigger test_fail_published before insert or update on public.published_invitation_content
for each row execute function pg_temp.fail_publication_boundary();
create trigger test_fail_invitation before update on public.invitations
for each row execute function pg_temp.fail_publication_boundary();
create trigger test_fail_draft before update on public.invitation_content_drafts
for each row execute function pg_temp.fail_publication_boundary();

select set_config('test.fail_table', 'events', true);
select throws_like(
  $$select public.publish_invitation_atomic(
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    (select updated_at from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'),
    'atomic-publish', 'xv', false, '{"version":"events"}'::jsonb
  )$$,
  '%test_failure_events%',
  'event write failure aborts the RPC'
);
select is((select count(*) from public.events where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 0::bigint, 'event failure leaves no event');
select is((select count(*) from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 0::bigint, 'event failure leaves no snapshot');
select is((select status from public.invitations where id = '20000000-0000-0000-0000-000000000001'), 'in_production', 'event failure leaves invitation status');
select is((select status from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'), 'draft', 'event failure leaves draft status');

select set_config('test.fail_table', 'published_invitation_content', true);
select throws_like(
  $$select public.publish_invitation_atomic(
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    (select updated_at from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'),
    'atomic-publish', 'xv', false, '{"version":"published"}'::jsonb
  )$$,
  '%test_failure_published_invitation_content%',
  'snapshot write failure aborts the RPC'
);
select is((select count(*) from public.events where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 0::bigint, 'snapshot failure rolls back event');
select is((select count(*) from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 0::bigint, 'snapshot failure leaves no snapshot');
select is((select status from public.invitations where id = '20000000-0000-0000-0000-000000000001'), 'in_production', 'snapshot failure leaves invitation status');
select is((select status from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'), 'draft', 'snapshot failure leaves draft status');

select set_config('test.fail_table', 'invitations', true);
select throws_like(
  $$select public.publish_invitation_atomic(
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    (select updated_at from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'),
    'atomic-publish', 'xv', false, '{"version":"invitation"}'::jsonb
  )$$,
  '%test_failure_invitations%',
  'invitation status failure aborts the RPC'
);
select is((select count(*) from public.events where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 0::bigint, 'invitation failure rolls back event');
select is((select count(*) from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 0::bigint, 'invitation failure rolls back snapshot');
select is((select status from public.invitations where id = '20000000-0000-0000-0000-000000000001'), 'in_production', 'invitation failure leaves invitation status');
select is((select status from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'), 'draft', 'invitation failure leaves draft status');

select set_config('test.fail_table', 'invitation_content_drafts', true);
select throws_like(
  $$select public.publish_invitation_atomic(
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    (select updated_at from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'),
    'atomic-publish', 'xv', false, '{"version":"draft"}'::jsonb
  )$$,
  '%test_failure_invitation_content_drafts%',
  'draft status failure aborts the RPC'
);
select is((select count(*) from public.events where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 0::bigint, 'draft failure rolls back event');
select is((select count(*) from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 0::bigint, 'draft failure rolls back snapshot');
select is((select status from public.invitations where id = '20000000-0000-0000-0000-000000000001'), 'in_production', 'draft failure rolls back invitation status');
select is((select status from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'), 'draft', 'draft failure leaves draft status');

drop trigger test_fail_event on public.events;
drop trigger test_fail_published on public.published_invitation_content;
drop trigger test_fail_invitation on public.invitations;
drop trigger test_fail_draft on public.invitation_content_drafts;
select set_config('test.fail_table', '', true);

select lives_ok(
  $$select public.publish_invitation_atomic(
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    (select updated_at from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'),
    'atomic-publish', 'xv', false, '{"version":1}'::jsonb
  )$$,
  'valid publication succeeds'
);
select is((select count(*) from public.events where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 1::bigint, 'success creates one RSVP event');
select is((select version from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 1, 'success creates snapshot version one');
select is((select status from public.invitations where id = '20000000-0000-0000-0000-000000000001'), 'published', 'success publishes invitation');
select is((select status from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'), 'approved', 'success approves draft');

select throws_like(
  $$select public.publish_invitation_atomic(
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    (select updated_at from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'),
    'atomic-publish', 'xv', false, '{"version":1}'::jsonb
  )$$,
  '%publish_invalid_draft_status%',
  'duplicate publication request is rejected'
);

alter table public.invitation_content_drafts disable trigger trg_invitation_content_drafts_touch_updated_at;
create temp table stale_version as
select updated_at from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001';
update public.invitation_content_drafts
set status = 'draft', updated_at = updated_at + interval '1 second'
where id = '30000000-0000-0000-0000-000000000001';
alter table public.invitation_content_drafts enable trigger trg_invitation_content_drafts_touch_updated_at;

select throws_like(
  $$select public.publish_invitation_atomic(
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    (select updated_at from stale_version),
    'atomic-publish', 'xv', false, '{"version":"stale"}'::jsonb
  )$$,
  '%publish_stale_draft%',
  'stale draft publication is rejected'
);

select lives_ok(
  $$select public.publish_invitation_atomic(
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    (select updated_at from public.invitation_content_drafts where id = '30000000-0000-0000-0000-000000000001'),
    'atomic-publish', 'xv', false, '{"version":2}'::jsonb
  )$$,
  'valid republish succeeds'
);
select is((select version from public.published_invitation_content where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 2, 'republish increments snapshot version');
select is((select count(*) from public.events where invitation_project_id = '20000000-0000-0000-0000-000000000001'), 1::bigint, 'republish reuses the RSVP event');

select * from finish();
rollback;
