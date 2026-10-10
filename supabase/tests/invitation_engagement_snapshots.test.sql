-- Invitation engagement snapshots and ledger anonymization contract.
begin;
select plan(22);

create schema snapshot_test;

create function snapshot_test.as_service(p_sql text)
returns text
language plpgsql
as $$
declare
  v_result text;
begin
  set local role service_role;
  begin
    execute p_sql into v_result;
  exception when others then
    v_result := sqlstate;
  end;
  reset role;
  return v_result;
end;
$$;

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'snap-owner@example.test', now(), now());

-- Past event (eligible for final and anonymization) and a current event.
insert into public.events (id, owner_user_id, slug, event_type, title, status, event_date) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'snap-past', 'boda', 'Past', 'published', current_date - 200),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'snap-current', 'xv', 'Current', 'published', current_date + 30);

insert into public.guest_invitations (
  id, invite_id, event_id, full_name, max_allowed_attendees, delivery_status, first_shared_at,
  open_count, first_opened_at, max_progress_milestone, attendance_status, attendee_count, responded_at,
  last_reminder_sent_at, is_test
) values
  ('a3000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'Abre y confirma', 2, 'shared', now() - interval '210 days', 3, now() - interval '209 days', 100, 'confirmed', 2, now() - interval '208 days', now() - interval '205 days', false),
  ('a3000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001',
   'Abre sin responder', 2, 'shared', now() - interval '210 days', 1, now() - interval '207 days', 50, 'pending', 0, null, null, false),
  ('a3000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001',
   'Sin abrir', 2, 'shared', now() - interval '210 days', 0, null, 0, 'pending', 0, null, null, false),
  ('a3000000-0000-4000-8000-000000000004', 'a4000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001',
   'Prueba', 2, 'shared', now() - interval '210 days', 9, now() - interval '209 days', 100, 'confirmed', 2, now(), null, true),
  ('a3000000-0000-4000-8000-000000000005', 'a4000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000002',
   'Actual', 2, 'shared', now(), 1, now(), 25, 'pending', 0, null, null, false);

insert into public.guest_engagement_events (
  client_event_id, guest_invitation_id, event_id, event_name, occurred_at, received_at, page_view_id,
  traffic_class, device_class, properties
) values
  (gen_random_uuid(), 'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'invitation_opened',
   now() - interval '209 days', now() - interval '209 days', gen_random_uuid(), 'guest', 'mobile', '{"entry":"short_link","is_reload":false}'),
  (gen_random_uuid(), 'a3000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001', 'invitation_opened',
   now() - interval '207 days', now() - interval '207 days', gen_random_uuid(), 'guest', 'desktop', '{"entry":"direct","is_reload":false}'),
  (gen_random_uuid(), 'a3000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000002', 'invitation_opened',
   now(), now(), gen_random_uuid(), 'guest', 'mobile', '{"entry":"direct","is_reload":false}');

-- Privileges.
select ok(has_function_privilege('service_role', 'public.compute_invitation_engagement_snapshot(uuid,text,jsonb,smallint)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.anonymize_guest_engagement_events(integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.list_engagement_snapshot_candidates()', 'EXECUTE'),
  'service role executes the snapshot and anonymization functions');
select ok(not has_function_privilege('authenticated', 'public.compute_invitation_engagement_snapshot(uuid,text,jsonb,smallint)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.anonymize_guest_engagement_events(integer)', 'EXECUTE'),
  'clients cannot execute snapshot or anonymization functions');
select ok(has_table_privilege('service_role', 'public.invitation_engagement_snapshots', 'SELECT')
  and not has_table_privilege('service_role', 'public.invitation_engagement_snapshots', 'INSERT')
  and not has_table_privilege('service_role', 'public.invitation_engagement_snapshots', 'DELETE'),
  'service role reads snapshots but writes only through the function');
select ok(not has_table_privilege('authenticated', 'public.invitation_engagement_snapshots', 'SELECT'),
  'hosts cannot read snapshots');

-- Candidates before any snapshot.
select is((select count(*)::int from public.list_engagement_snapshot_candidates()
  where event_id = 'a2000000-0000-4000-8000-000000000001' and snapshot_kind = 'rolling'), 1,
  'a past event with ledger rows needs a rolling snapshot');
select is((select count(*)::int from public.list_engagement_snapshot_candidates()
  where event_id = 'a2000000-0000-4000-8000-000000000001' and snapshot_kind = 'final'), 1,
  'a past event needs a final snapshot');
select is((select count(*)::int from public.list_engagement_snapshot_candidates()
  where event_id = 'a2000000-0000-4000-8000-000000000002' and snapshot_kind = 'final'), 0,
  'an upcoming event does not need a final snapshot');

-- Anonymization waits for the snapshot.
select is(snapshot_test.as_service('select public.anonymize_guest_engagement_events(100)::text'), '0',
  'nothing is anonymized before the invitation has a current snapshot');

-- Rolling snapshot math (test guest excluded).
select is(snapshot_test.as_service($q$select public.compute_invitation_engagement_snapshot('a2000000-0000-4000-8000-000000000001', 'rolling', '{"themePreset":"jewelry-box"}', 1::smallint)::text$q$),
  '{"status": "ok"}', 'rolling snapshot is computed');
select is((select row(guests_total, guests_shared, guests_opened, guests_responded, opens_total)::text
  from public.invitation_engagement_snapshots where event_id = 'a2000000-0000-4000-8000-000000000001' and snapshot_kind = 'rolling'),
  '(3,3,2,1,4)', 'snapshot counts guests only and excludes test guests');
select is((select row(open_rate, completion_rate, rsvp_conversion, reopen_ratio, mobile_share, reminder_coverage)::text
  from public.invitation_engagement_snapshots where event_id = 'a2000000-0000-4000-8000-000000000001' and snapshot_kind = 'rolling'),
  '(0.6667,0.5000,0.5000,2.0000,0.5000,0.3333)', 'snapshot rates follow the metrics dictionary');
select ok((select median_seconds_to_open > 0 and median_seconds_to_respond > 0 and share_lead_days = 10
  and design ->> 'themePreset' = 'jewelry-box' and design_schema_version = 1
  from public.invitation_engagement_snapshots where event_id = 'a2000000-0000-4000-8000-000000000001' and snapshot_kind = 'rolling'),
  'snapshot keeps medians, share lead time, and design attributes');
select ok((select design is not null from public.invitation_engagement_snapshots
  where event_id = 'a2000000-0000-4000-8000-000000000001' and snapshot_kind = 'rolling')
  and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invitation_engagement_snapshots'
      and column_name in ('guest_invitation_id', 'full_name', 'phone', 'invite_id')
  ), 'snapshots have no guest columns');

-- Final snapshot is immutable.
select is(snapshot_test.as_service($q$select public.compute_invitation_engagement_snapshot('a2000000-0000-4000-8000-000000000001', 'final')::text$q$),
  '{"status": "ok"}', 'final snapshot is written once');
update public.guest_invitations set open_count = 7 where id = 'a3000000-0000-4000-8000-000000000003';
select is(snapshot_test.as_service($q$select public.compute_invitation_engagement_snapshot('a2000000-0000-4000-8000-000000000001', 'final')::text$q$),
  '{"status": "unchanged"}', 'a second final computation changes nothing');
select is((select guests_opened from public.invitation_engagement_snapshots
  where event_id = 'a2000000-0000-4000-8000-000000000001' and snapshot_kind = 'final'), 2,
  'final snapshot keeps its original values');
select is(snapshot_test.as_service($q$select public.compute_invitation_engagement_snapshot('a2000000-0000-4000-8000-000000000001', 'weekly')::text$q$),
  '22023', 'unknown snapshot kinds are rejected');

-- Anonymization after the snapshot: past event only.
select is(snapshot_test.as_service('select public.anonymize_guest_engagement_events(100)::text'), '2',
  'past-event rows lose the guest link after the snapshot');
select is((select count(*)::int from public.guest_engagement_events
  where event_id = 'a2000000-0000-4000-8000-000000000001' and guest_invitation_id is null and anonymized_at is not null), 2,
  'anonymized rows keep the event and an anonymization timestamp');
select is((select count(*)::int from public.guest_engagement_events
  where event_id = 'a2000000-0000-4000-8000-000000000002' and guest_invitation_id is not null), 1,
  'current-event rows stay linked');
select is((select open_count from public.guest_invitations where id = 'a3000000-0000-4000-8000-000000000001'), 3,
  'guest projections survive anonymization');

-- Snapshots survive event deletion.
delete from public.guest_engagement_events where event_id = 'a2000000-0000-4000-8000-000000000001';
delete from public.guest_invitations where event_id = 'a2000000-0000-4000-8000-000000000001';
delete from public.events where id = 'a2000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.invitation_engagement_snapshots where event_id is null and event_type = 'boda'), 2,
  'snapshots are kept when the event is deleted');

select * from finish();
rollback;
