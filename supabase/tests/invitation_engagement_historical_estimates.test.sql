-- Historical engagement estimates: cleaning rules of method version 1, privileges and coverage.
begin;
select plan(21);

create schema historical_test;

create function historical_test.as_role(p_role text, p_sql text)
returns text
language plpgsql
as $$
declare
  v_result text;
begin
  execute format('set local role %I', p_role);
  begin
    execute p_sql into v_result;
  exception when others then
    v_result := sqlstate;
  end;
  reset role;
  return v_result;
end;
$$;

create function historical_test.row_value(p_slug text, p_column text)
returns text
language plpgsql
as $$
declare
  v_result text;
begin
  set local role service_role;
  execute format(
    'select %I::text from public.list_engagement_historical_estimates() where slug = %L',
    p_column, p_slug
  ) into v_result;
  reset role;
  return v_result;
end;
$$;

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('d1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'historical@example.test', now(), now());

insert into public.invitations (id, slug, title, event_type, status, theme_id, created_by, kind) values
  ('d2000000-0000-4000-8000-000000000001', 'hist-xv', 'Histórica', 'xv', 'published', 'jewelry-box', 'd1000000-0000-4000-8000-000000000001', 'client'),
  ('d2000000-0000-4000-8000-000000000002', 'hist-archived', 'Archivada', 'boda', 'published', 'jewelry-box', 'd1000000-0000-4000-8000-000000000001', 'client');

insert into public.published_invitation_content (id, invitation_project_id, slug, event_type, is_demo, content, version, published_at) values
  ('d3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'hist-xv', 'xv', false, '{}'::jsonb, 1, now()),
  ('d3000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'hist-archived', 'boda', false, '{}'::jsonb, 1, now());

insert into public.events (id, owner_user_id, slug, event_type, title, status, invitation_project_id) values
  ('d4000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'hist-xv', 'xv', 'Histórica', 'published', 'd2000000-0000-4000-8000-000000000001'),
  ('d4000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'hist-archived', 'boda', 'Archivada', 'published', 'd2000000-0000-4000-8000-000000000002');

-- G1 viewed in two visits and responded; G2 only before sharing and inside the preview window;
-- G3 first view inside the preview window, a real view the next day; G4 host-entered response;
-- G5 never shared, viewed and responded; G6 viewed only after the cutoff; G7 test guest;
-- G8 responded after the cutoff. The archived event has one shared, viewed guest.
insert into public.guest_invitations (
  id, invite_id, event_id, full_name, max_allowed_attendees, delivery_status, first_shared_at,
  attendance_status, attendee_count, responded_at, last_response_source, is_test
) values
  ('d5000000-0000-4000-8000-000000000001', 'd6000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001', 'G1', 2, 'shared', '2026-09-01 12:00+00', 'confirmed', 1, '2026-09-02 12:00+00', 'link', false),
  ('d5000000-0000-4000-8000-000000000002', 'd6000000-0000-4000-8000-000000000002', 'd4000000-0000-4000-8000-000000000001', 'G2', 2, 'shared', '2026-09-01 12:00+00', 'pending', 0, null, 'link', false),
  ('d5000000-0000-4000-8000-000000000003', 'd6000000-0000-4000-8000-000000000003', 'd4000000-0000-4000-8000-000000000001', 'G3', 2, 'shared', '2026-09-01 12:00+00', 'pending', 0, null, 'link', false),
  ('d5000000-0000-4000-8000-000000000004', 'd6000000-0000-4000-8000-000000000004', 'd4000000-0000-4000-8000-000000000001', 'G4', 2, 'shared', '2026-09-01 12:00+00', 'declined', 0, '2026-09-03 12:00+00', 'admin', false),
  ('d5000000-0000-4000-8000-000000000005', 'd6000000-0000-4000-8000-000000000005', 'd4000000-0000-4000-8000-000000000001', 'G5', 2, 'generated', null, 'confirmed', 1, '2026-09-06 12:00+00', 'link', false),
  ('d5000000-0000-4000-8000-000000000006', 'd6000000-0000-4000-8000-000000000006', 'd4000000-0000-4000-8000-000000000001', 'G6', 2, 'shared', '2026-09-01 12:00+00', 'pending', 0, null, 'link', false),
  ('d5000000-0000-4000-8000-000000000007', 'd6000000-0000-4000-8000-000000000007', 'd4000000-0000-4000-8000-000000000001', 'G7', 2, 'shared', '2026-09-01 12:00+00', 'confirmed', 1, '2026-09-02 12:00+00', 'link', true),
  ('d5000000-0000-4000-8000-000000000008', 'd6000000-0000-4000-8000-000000000008', 'd4000000-0000-4000-8000-000000000001', 'G8', 2, 'shared', '2026-09-01 12:00+00', 'confirmed', 1, '2026-10-14 12:00+00', 'link', false),
  ('d5000000-0000-4000-8000-000000000009', 'd6000000-0000-4000-8000-000000000009', 'd4000000-0000-4000-8000-000000000002', 'A1', 2, 'shared', '2026-09-01 12:00+00', 'pending', 0, null, 'link', false);

insert into public.guest_invitation_audit (guest_invitation_id, actor_type, event_type, payload, created_at) values
  ('d5000000-0000-4000-8000-000000000001', 'guest', 'viewed', '{}'::jsonb, '2026-09-01 12:00:30+00'),
  ('d5000000-0000-4000-8000-000000000001', 'guest', 'viewed', '{}'::jsonb, '2026-09-01 13:00+00'),
  ('d5000000-0000-4000-8000-000000000001', 'guest', 'viewed', '{}'::jsonb, '2026-09-01 13:10+00'),
  ('d5000000-0000-4000-8000-000000000001', 'guest', 'viewed', '{}'::jsonb, '2026-09-01 15:00+00'),
  ('d5000000-0000-4000-8000-000000000002', 'guest', 'viewed', '{}'::jsonb, '2026-09-01 11:00+00'),
  ('d5000000-0000-4000-8000-000000000002', 'guest', 'viewed', '{}'::jsonb, '2026-09-01 12:01+00'),
  ('d5000000-0000-4000-8000-000000000003', 'guest', 'viewed', '{}'::jsonb, '2026-09-01 12:01+00'),
  ('d5000000-0000-4000-8000-000000000003', 'guest', 'viewed', '{}'::jsonb, '2026-09-02 09:00+00'),
  ('d5000000-0000-4000-8000-000000000005', 'guest', 'viewed', '{}'::jsonb, '2026-09-05 12:00+00'),
  ('d5000000-0000-4000-8000-000000000006', 'guest', 'viewed', '{}'::jsonb, '2026-10-12 16:30+00'),
  ('d5000000-0000-4000-8000-000000000007', 'guest', 'viewed', '{}'::jsonb, '2026-09-01 14:00+00'),
  ('d5000000-0000-4000-8000-000000000009', 'guest', 'viewed', '{}'::jsonb, '2026-09-01 14:00+00');

-- Archive after the fixture exists (archiving cascades to the event).
update public.invitations set archived_at = now() where id = 'd2000000-0000-4000-8000-000000000002';

-- The migration computed version 1 over the base data; recompute over the fixture.
delete from public.invitation_engagement_historical_estimates;

-- Privileges and shape.
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.invitation_engagement_historical_estimates'::regclass),
  'row level security is enabled and forced');
select is(historical_test.as_role('authenticated', $$select count(*)::text from public.invitation_engagement_historical_estimates$$),
  '42501', 'hosts cannot read the estimates table');
select is(historical_test.as_role('authenticated', $$select public.compute_engagement_historical_estimates(1::smallint)::text$$),
  '42501', 'hosts cannot compute estimates');
select is(historical_test.as_role('authenticated', $$select count(*)::text from public.list_engagement_historical_estimates()$$),
  '42501', 'hosts cannot list estimates');
select hasnt_column('public', 'invitation_engagement_historical_estimates', 'depth_estimate',
  'legacy depth is not estimated');

-- Computation once per method version.
select is(historical_test.as_role('service_role', $$select (public.compute_engagement_historical_estimates(1::smallint) >= 1)::text$$),
  'true', 'version 1 computes the estimates');
select is((select count(*)::int from public.invitation_engagement_historical_estimates
    where event_id = 'd4000000-0000-4000-8000-000000000001'),
  1, 'one row per event and method version');
select is(historical_test.as_role('service_role', $$select public.compute_engagement_historical_estimates(1::smallint)::text$$),
  '0', 're-running a computed version is a no-op');
select is(historical_test.as_role('service_role', $$select public.compute_engagement_historical_estimates(2::smallint)::text$$),
  '22023', 'unknown method versions are rejected');

-- Coverage.
select is(historical_test.as_role('service_role', $$select string_agg(slug, ',') from public.list_engagement_historical_estimates() where slug like 'hist-%'$$),
  'hist-xv', 'archived invitations are not listed');
select is(historical_test.as_role('service_role', $$select count(*)::text from public.list_engagement_historical_estimates('boda') where slug like 'hist-%'$$),
  '0', 'an event type narrows the list');

-- Cleaning rules.
select is(historical_test.row_value('hist-xv', 'guests_total') || '/' || historical_test.row_value('hist-xv', 'guests_shared'),
  '7/6', 'test guests never count; shared means a first_shared_at');
select is(historical_test.row_value('hist-xv', 'guests_viewed'), '2',
  'any view at least 2 minutes after sharing opens the guest, even when the first view is a preview');
select is(historical_test.row_value('hist-xv', 'views_counted'), '4',
  'views after the cutoff and views of test guests are ignored');
select is(historical_test.row_value('hist-xv', 'views_before_share') || '/' || historical_test.row_value('hist-xv', 'views_within_preview_window'),
  '1/3', 'views before sharing and inside the preview window are counted apart');
select is(historical_test.row_value('hist-xv', 'visits_estimate') || '|' || historical_test.row_value('hist-xv', 'visits_per_viewer'),
  '3|1.50', 'counted views are sessionized with the 30-minute rule');
select is(historical_test.row_value('hist-xv', 'guests_responded_self'), '1',
  'host-entered responses and responses after the cutoff are excluded');
select is(historical_test.row_value('hist-xv', 'opened_lower') || '-' || historical_test.row_value('hist-xv', 'opened_upper'),
  '1-2', 'opens range from guest responses to views or responses');
select is(historical_test.row_value('hist-xv', 'conversion_lower'), '0.5000',
  'conversion lower bound is responses over the upper open bound');
select is(historical_test.row_value('hist-xv', 'guests_unshared') || '/' || historical_test.row_value('hist-xv', 'guests_unshared_viewed')
  || '/' || historical_test.row_value('hist-xv', 'guests_unshared_responded_self'),
  '1/1/1', 'guests without first_shared_at are counted apart');
select is(historical_test.row_value('hist-xv', 'method_version'), '1', 'rows carry their method version');

select * from finish();
rollback;
