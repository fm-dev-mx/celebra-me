-- Guest engagement ledger contract: privileges, ingestion idempotency, traffic
-- classification, projections, audit narrowing, host summary, and event date.
begin;
select plan(51);

create schema engagement_test;

-- Calls the ingestion RPC as service_role; returns the jsonb result or the SQLSTATE.
create function engagement_test.record(p_invite text, p_events jsonb, p_viewer uuid default null)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
begin
  set local role service_role;
  begin
    v_result := public.record_guest_engagement_events_public(p_invite, p_events, p_viewer);
  exception when others then
    v_result := jsonb_build_object('sqlstate', sqlstate);
  end;
  reset role;
  return v_result;
end;
$$;

-- Builds one event envelope.
create function engagement_test.ev(
  p_name text,
  p_class text default 'guest',
  p_properties jsonb default '{}'::jsonb,
  p_page_view uuid default 'f0000000-0000-4000-8000-0000000000aa',
  p_id uuid default gen_random_uuid(),
  p_occurred timestamptz default now()
) returns jsonb
language sql
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'client_event_id', p_id, 'schema_version', 1, 'event_name', p_name,
    'occurred_at', p_occurred, 'page_view_id', p_page_view, 'traffic_class', p_class,
    'device_class', 'mobile', 'properties', p_properties
  ));
$$;

create function engagement_test.summary_as(p_user uuid, p_event uuid)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  set local role authenticated;
  v_result := public.get_event_engagement_summary(p_event);
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return v_result;
end;
$$;

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('f1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'eng-owner@example.test', now(), now()),
  ('f1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'eng-outsider@example.test', now(), now());

insert into public.events (id, owner_user_id, slug, event_type, title, status) values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'eng-event', 'xv', 'Engagement event', 'published');

insert into public.guest_invitations (id, invite_id, event_id, full_name, max_allowed_attendees, delivery_status, first_shared_at, is_test) values
  ('f3000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'Invitada', 2, 'shared', now() - interval '2 hours', false),
  ('f3000000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'Invitado de prueba', 2, 'shared', now(), true),
  ('f3000000-0000-4000-8000-000000000003', 'f4000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000001', 'Sin abrir', 2, 'shared', now(), false);

-- Privileges.
select ok(has_function_privilege('service_role', 'public.record_guest_engagement_events_public(text,jsonb,uuid)', 'EXECUTE'),
  'service role executes the ingestion RPC');
select ok(not has_function_privilege('anon', 'public.record_guest_engagement_events_public(text,jsonb,uuid)', 'EXECUTE'),
  'anon cannot execute the ingestion RPC');
select ok(not has_function_privilege('authenticated', 'public.record_guest_engagement_events_public(text,jsonb,uuid)', 'EXECUTE'),
  'authenticated cannot execute the ingestion RPC');
select ok(has_function_privilege('authenticated', 'public.get_event_engagement_summary(uuid)', 'EXECUTE'),
  'authenticated executes the host summary');
select ok(not has_function_privilege('anon', 'public.get_event_engagement_summary(uuid)', 'EXECUTE'),
  'anon cannot execute the host summary');
select ok(has_table_privilege('service_role', 'public.guest_engagement_events', 'INSERT')
  and has_table_privilege('service_role', 'public.guest_engagement_events', 'SELECT'),
  'service role can select and insert ledger rows');
select ok(not has_table_privilege('service_role', 'public.guest_engagement_events', 'UPDATE')
  and not has_table_privilege('service_role', 'public.guest_engagement_events', 'DELETE'),
  'service role cannot update or delete ledger rows');
select ok(not has_table_privilege('authenticated', 'public.guest_engagement_events', 'SELECT')
  and not has_table_privilege('anon', 'public.guest_engagement_events', 'SELECT'),
  'clients cannot read the ledger');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.guest_engagement_events'::regclass),
  'ledger RLS is enabled and forced');
select ok(not has_table_privilege('service_role', 'public.guest_invitations', 'UPDATE'),
  'service role still has no direct guest UPDATE');

-- Property schema.
select ok(public.guest_engagement_properties_valid('invitation_opened', '{"entry":"short_link","is_reload":false}'),
  'opened accepts entry and is_reload');
select ok(not public.guest_engagement_properties_valid('invitation_opened', '{"entry":"short_link"}'),
  'opened requires is_reload');
select ok(not public.guest_engagement_properties_valid('invitation_progressed', '{"milestone":30}'),
  'progressed rejects non-milestone values');
select ok(not public.guest_engagement_properties_valid('rsvp_form_viewed', '{"x":1}'),
  'form viewed rejects extra keys');
select ok(not public.guest_engagement_properties_valid('cta_clicked', '{}'),
  'reserved events are rejected');

-- First open.
select is(
  engagement_test.record('f4000000-0000-4000-8000-000000000001', jsonb_build_array(
    engagement_test.ev('invitation_opened', p_properties => '{"entry":"short_link","is_reload":false}',
      p_id => 'f5000000-0000-4000-8000-000000000001'))),
  '{"status":"ok","accepted":1,"duplicates":0,"rejected":0}'::jsonb,
  'first open is accepted');
select is((select open_count from public.guest_invitations where id = 'f3000000-0000-4000-8000-000000000001'), 1,
  'first open increments open_count');
select ok((select first_opened_at is not null and first_viewed_at is not null and is_viewed
  from public.guest_invitations where id = 'f3000000-0000-4000-8000-000000000001'),
  'first open sets first_opened_at and legacy view columns');
select is((select count(*)::int from public.guest_invitation_audit
  where guest_invitation_id = 'f3000000-0000-4000-8000-000000000001' and event_type = 'viewed'), 1,
  'first open writes one viewed audit row');

-- Idempotency and repeat opens.
select is(
  engagement_test.record('f4000000-0000-4000-8000-000000000001', jsonb_build_array(
    engagement_test.ev('invitation_opened', p_properties => '{"entry":"short_link","is_reload":false}',
      p_id => 'f5000000-0000-4000-8000-000000000001'))),
  '{"status":"ok","accepted":0,"duplicates":1,"rejected":0}'::jsonb,
  'a retried event is a duplicate');
select is((select open_count from public.guest_invitations where id = 'f3000000-0000-4000-8000-000000000001'), 1,
  'a duplicate does not change projections');
select is(
  (engagement_test.record('f4000000-0000-4000-8000-000000000001', jsonb_build_array(
    engagement_test.ev('invitation_opened', p_properties => '{"entry":"direct","is_reload":true}',
      p_page_view => 'f0000000-0000-4000-8000-0000000000bb'))) ->> 'accepted')::int,
  1, 'a second page view is accepted');
select is((select open_count from public.guest_invitations where id = 'f3000000-0000-4000-8000-000000000001'), 2,
  'a second open increments open_count');
select is((select count(*)::int from public.guest_invitation_audit
  where guest_invitation_id = 'f3000000-0000-4000-8000-000000000001' and event_type = 'viewed'), 1,
  'repeat opens do not add viewed audit rows');

-- Progress, form steps, and rejection of invalid items.
select is(
  engagement_test.record('f4000000-0000-4000-8000-000000000001', jsonb_build_array(
    engagement_test.ev('invitation_progressed', p_properties => '{"milestone":50}'),
    engagement_test.ev('invitation_progressed', p_properties => '{"milestone":30}'),
    engagement_test.ev('rsvp_form_viewed'),
    engagement_test.ev('rsvp_form_started'),
    engagement_test.ev('invitation_opened', p_properties => '{"entry":"direct","is_reload":false}', p_page_view => null))),
  '{"status":"ok","accepted":3,"duplicates":0,"rejected":2}'::jsonb,
  'invalid milestone and missing page view are rejected per item');
select ok((select max_progress_milestone = 50 and view_percentage = 50 and rsvp_form_viewed_at is not null
  and rsvp_form_started_at is not null
  from public.guest_invitations where id = 'f3000000-0000-4000-8000-000000000001'),
  'progress and form projections are updated');

-- Client-supplied classes are limited to guest, bot, non_production.
select is(
  (engagement_test.record('f4000000-0000-4000-8000-000000000001', jsonb_build_array(
    engagement_test.ev('rsvp_form_viewed', 'host'))) ->> 'rejected')::int,
  1, 'callers cannot claim the host class');

-- Host and test classification.
select is(
  (engagement_test.record('f4000000-0000-4000-8000-000000000001', jsonb_build_array(
    engagement_test.ev('invitation_opened', p_properties => '{"entry":"direct","is_reload":false}',
      p_page_view => 'f0000000-0000-4000-8000-0000000000cc', p_id => 'f5000000-0000-4000-8000-000000000002')),
    'f1000000-0000-4000-8000-000000000001') ->> 'accepted')::int,
  1, 'an owner open is stored');
select is((select traffic_class from public.guest_engagement_events where client_event_id = 'f5000000-0000-4000-8000-000000000002'),
  'host', 'the event owner is classified as host');
select is((select open_count from public.guest_invitations where id = 'f3000000-0000-4000-8000-000000000001'), 2,
  'host opens do not move projections');
select is(
  (engagement_test.record('f4000000-0000-4000-8000-000000000001', jsonb_build_array(
    engagement_test.ev('invitation_opened', p_properties => '{"entry":"direct","is_reload":false}',
      p_page_view => 'f0000000-0000-4000-8000-0000000000dd', p_id => 'f5000000-0000-4000-8000-000000000003')),
    'f1000000-0000-4000-8000-000000000002') ->> 'accepted')::int,
  1, 'an outsider open is stored');
select is((select traffic_class from public.guest_engagement_events where client_event_id = 'f5000000-0000-4000-8000-000000000003'),
  'guest', 'a signed-in outsider stays a guest');

select is(
  (engagement_test.record('f4000000-0000-4000-8000-000000000002', jsonb_build_array(
    engagement_test.ev('invitation_opened', p_properties => '{"entry":"direct","is_reload":false}',
      p_id => 'f5000000-0000-4000-8000-000000000004'))) ->> 'accepted')::int,
  1, 'a test guest open is stored');
select is((select traffic_class from public.guest_engagement_events where client_event_id = 'f5000000-0000-4000-8000-000000000004'),
  'test', 'test guests are classified as test');
select is((select open_count from public.guest_invitations where id = 'f3000000-0000-4000-8000-000000000002'), 0,
  'test guest opens do not move projections');

-- Link previews.
select is(
  (engagement_test.record('f4000000-0000-4000-8000-000000000003', jsonb_build_array(
    engagement_test.ev('invitation_link_previewed', 'bot', '{"crawler_family":"whatsapp"}', null))) ->> 'accepted')::int,
  1, 'a link preview is accepted without a page view');
select ok((select last_previewed_at is not null and open_count = 0
  from public.guest_invitations where id = 'f3000000-0000-4000-8000-000000000003'),
  'a preview sets last_previewed_at but is not an open');

-- Clock clamping, unknown invites, and batch limits.
select is(
  (engagement_test.record('f4000000-0000-4000-8000-000000000003', jsonb_build_array(
    engagement_test.ev('rsvp_form_viewed', p_id => 'f5000000-0000-4000-8000-000000000005',
      p_occurred => now() - interval '10 days'))) ->> 'accepted')::int,
  1, 'an old client timestamp is accepted');
select ok((select occurred_at >= now() - interval '24 hours' from public.guest_engagement_events
  where client_event_id = 'f5000000-0000-4000-8000-000000000005'),
  'occurred_at is clamped to the last 24 hours');
select is(engagement_test.record('f4000000-0000-4000-8000-0000000000ff', jsonb_build_array(engagement_test.ev('rsvp_form_viewed'))),
  '{"status":"not_found"}'::jsonb, 'unknown invite is not_found');
select is(engagement_test.record('not-a-uuid', jsonb_build_array(engagement_test.ev('rsvp_form_viewed'))),
  '{"status":"not_found"}'::jsonb, 'malformed invite is not_found');
select is(engagement_test.record('f4000000-0000-4000-8000-000000000001',
  (select jsonb_agg(engagement_test.ev('rsvp_form_viewed')) from generate_series(1, 21))),
  '{"sqlstate":"22023"}'::jsonb, 'batches over 20 events are rejected');

-- Host summary.
select is(
  engagement_test.summary_as('f1000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001')
    - 'medianSecondsToOpen' - 'trackingStartedAt',
  '{"guests":2,"shared":2,"previewed":1,"opened":1,"formViewed":1,"formStarted":1,"responded":0,"openedNotResponded":1}'::jsonb,
  'owner summary counts guests only, excluding the test guest');
select ok((engagement_test.summary_as('f1000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001')
  ->> 'medianSecondsToOpen')::numeric > 0, 'summary reports median time to open');
select is((engagement_test.summary_as('f1000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001') ->> 'guests')::int,
  0, 'an outsider sees no guests in the summary');

-- Event date derivation.
select is(public.invitation_event_date('{"eventTiming":{"localDateTime":"2026-12-05T19:30","timeZone":"America/Mexico_City"}}'),
  '2026-12-05'::date, 'localDateTime wins');
select is(public.invitation_event_date('{"eventTiming":{"startsAtUtc":"2026-12-06T03:00:00.000Z","timeZone":"America/Chihuahua"}}'),
  '2026-12-05'::date, 'startsAtUtc converts to the event zone');
select is(public.invitation_event_date('{"eventTiming":{"localDateTime":"2026-02-30T10:00"},"hero":{"date":"2026-03-01T00:00:00Z"}}'),
  null::date, 'malformed localDateTime is not masked by hero.date');
select is(public.invitation_event_date('{"hero":{"date":"2026-11-14T00:00:00Z"}}'),
  '2026-11-14'::date, 'legacy hero.date is a floating local date');
select is(public.invitation_event_date('{"eventTiming":{"timeZone":"Mars/Base"},"hero":{"date":"2026-11-14"}}'),
  null::date, 'an invalid explicit zone yields no date');

-- Publish trigger keeps events.event_date current.
insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, created_by, kind)
values ('f6000000-0000-4000-8000-000000000001', 'eng-event', 'Engagement event', 'xv', 'published',
  'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'f1000000-0000-4000-8000-000000000001', 'client');
update public.events set invitation_project_id = 'f6000000-0000-4000-8000-000000000001'
where id = 'f2000000-0000-4000-8000-000000000001';
insert into public.published_invitation_content (invitation_project_id, slug, event_type, is_demo, content, version, published_at)
values ('f6000000-0000-4000-8000-000000000001', 'eng-event', 'xv', false,
  '{"eventTiming":{"localDateTime":"2027-01-09T18:00","timeZone":"America/Chihuahua"}}', 1, now());
select is((select event_date from public.events where id = 'f2000000-0000-4000-8000-000000000001'),
  '2027-01-09'::date, 'publishing content sets events.event_date');

select * from finish();
rollback;
