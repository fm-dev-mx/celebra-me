-- Engagement ranking v2: coverage of every published client invitation and confidence levels.
begin;
select plan(14);

create schema ranking_v2_test;

create function ranking_v2_test.as_role(p_role text, p_sql text)
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

create function ranking_v2_test.row_value(p_slug text, p_column text, p_event_type text default null)
returns text
language plpgsql
as $$
declare
  v_result text;
begin
  set local role service_role;
  execute format(
    'select %I::text from public.list_invitation_engagement_ranking_v2(%L) where slug = %L',
    p_column, p_event_type, p_slug
  ) into v_result;
  reset role;
  return v_result;
end;
$$;

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('c1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rank-v2@example.test', now(), now());

insert into public.invitations (id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, created_by, kind) values
  ('c2000000-0000-4000-8000-000000000001', 'v2-measured', 'Medida', 'xv', 'published', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'c1000000-0000-4000-8000-000000000001', 'client'),
  ('c2000000-0000-4000-8000-000000000002', 'v2-quiet', 'Sin actividad', 'boda', 'published', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'c1000000-0000-4000-8000-000000000001', 'client'),
  ('c2000000-0000-4000-8000-000000000003', 'v2-archived', 'Archivada', 'xv', 'published', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'c1000000-0000-4000-8000-000000000001', 'client'),
  ('c2000000-0000-4000-8000-000000000004', 'v2-demo', 'Demo', 'xv', 'published', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'c1000000-0000-4000-8000-000000000001', 'demo'),
  ('c2000000-0000-4000-8000-000000000005', 'v2-unpublished', 'Sin publicar', 'xv', 'in_production', 'demo-xv-jewelry-box', 'jewelry-box', '{}'::jsonb, 'c1000000-0000-4000-8000-000000000001', 'client');

insert into public.published_invitation_content (id, invitation_project_id, slug, event_type, is_demo, content, version, published_at) values
  ('c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'v2-measured', 'xv', false,
   '{"theme":{"preset":"jewelry-box"},"rsvp":{"confirmationMode":"api"}}'::jsonb, 1, now()),
  ('c3000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'v2-quiet', 'boda', false,
   '{"theme":{"preset":"jewelry-box-wedding","fontFamily":"serif"},"rsvp":{"confirmationMode":"whatsapp","accessMode":"hybrid"},"music":{"url":"https://example.test/a.mp3"}}'::jsonb, 1, now()),
  ('c3000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000003', 'v2-archived', 'xv', false, '{}'::jsonb, 1, now()),
  ('c3000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000004', 'v2-demo', 'xv', true, '{}'::jsonb, 1, now());

-- Archive after publishing (archiving cascades to the published row).
update public.invitations set archived_at = now() where id = 'c2000000-0000-4000-8000-000000000003';

insert into public.events (id, owner_user_id, slug, event_type, title, status, invitation_project_id, event_date) values
  ('c4000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'v2-measured', 'xv', 'Medida', 'published', 'c2000000-0000-4000-8000-000000000001', current_date + 30),
  ('c4000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'v2-quiet', 'boda', 'Sin actividad', 'published', 'c2000000-0000-4000-8000-000000000002', current_date - 30);

-- Published content triggers may derive event_date; pin the fixture dates.
update public.events set event_date = current_date + 30 where id = 'c4000000-0000-4000-8000-000000000001';
update public.events set event_date = current_date - 30 where id = 'c4000000-0000-4000-8000-000000000002';

update public.invitation_access_controls set public_access = 'disabled'
where invitation_id = 'c2000000-0000-4000-8000-000000000001';

-- Measured event: A opened+responded, B responded only, C host-entered response,
-- D opened only, 21 shared and pending, plus a test guest that never counts.
insert into public.guest_invitations (
  id, invite_id, event_id, full_name, max_allowed_attendees, delivery_status, first_shared_at,
  open_count, attendance_status, attendee_count, responded_at, last_response_source, is_test
) values
  ('c5000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 'A', 2, 'shared', now() - interval '20 days', 2, 'confirmed', 2, now() - interval '5 days', 'link', false),
  ('c5000000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000001', 'B', 2, 'shared', now() - interval '20 days', 0, 'confirmed', 1, now() - interval '30 days', 'link', false),
  ('c5000000-0000-4000-8000-000000000003', 'c6000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000001', 'C', 2, 'shared', now() - interval '20 days', 0, 'declined', 0, now() - interval '4 days', 'admin', false),
  ('c5000000-0000-4000-8000-000000000004', 'c6000000-0000-4000-8000-000000000004', 'c4000000-0000-4000-8000-000000000001', 'D', 2, 'shared', now() - interval '20 days', 1, 'pending', 0, null, 'link', false),
  ('c5000000-0000-4000-8000-000000000099', 'c6000000-0000-4000-8000-000000000099', 'c4000000-0000-4000-8000-000000000001', 'Prueba', 2, 'shared', now() - interval '20 days', 3, 'confirmed', 1, now() - interval '2 days', 'link', true);

insert into public.guest_invitations (id, invite_id, event_id, full_name, max_allowed_attendees, delivery_status, first_shared_at)
select gen_random_uuid(), gen_random_uuid(), 'c4000000-0000-4000-8000-000000000001', 'Relleno ' || n, 1, 'shared', now() - interval '20 days'
from generate_series(1, 21) n;

-- Quiet event: three guest responses before any ledger activity, no snapshot.
insert into public.guest_invitations (
  id, invite_id, event_id, full_name, max_allowed_attendees, delivery_status, first_shared_at,
  attendance_status, attendee_count, responded_at, last_response_source
)
select gen_random_uuid(), gen_random_uuid(), 'c4000000-0000-4000-8000-000000000002', 'Boda ' || n, 1, 'shared',
  now() - interval '60 days', 'confirmed', 1, now() - interval '50 days', 'link'
from generate_series(1, 3) n;

insert into public.invitation_engagement_snapshots (
  event_id, event_type, snapshot_kind, guests_total, guests_shared, guests_opened, guests_responded,
  opens_total, open_rate, completion_rate, rsvp_conversion, design, design_schema_version
) values
  ('c4000000-0000-4000-8000-000000000001', 'xv', 'rolling', 25, 25, 2, 3, 3, 0.0800, 0.5000, 0.5000,
   '{"themePreset":"jewelry-box"}'::jsonb, 1),
  ('c4000000-0000-4000-8000-000000000001', 'xv', 'final', 25, 25, 2, 3, 3, 0.0800, 0.7500, 0.5000,
   '{"themePreset":"jewelry-box"}'::jsonb, 1);

-- Grants.
select ok(has_function_privilege('service_role', 'public.list_invitation_engagement_ranking_v2(text)', 'EXECUTE'),
  'service_role executes ranking v2');
select is(ranking_v2_test.as_role('authenticated', $$select count(*)::text from public.list_invitation_engagement_ranking_v2()$$),
  '42501', 'hosts cannot execute ranking v2');

-- Coverage.
select is(ranking_v2_test.as_role('service_role', $$select string_agg(slug, ',' order by slug) from public.list_invitation_engagement_ranking_v2() where slug like 'v2-%'$$),
  'v2-measured,v2-quiet', 'every published client invitation is listed; archived, demo and unpublished are not');
select is(ranking_v2_test.as_role('service_role', $$select string_agg(slug, ',') from public.list_invitation_engagement_ranking_v2('boda') where slug like 'v2-%'$$),
  'v2-quiet', 'an event type narrows the list');

-- Activity and snapshot choice.
select is(ranking_v2_test.row_value('v2-measured', 'activity_state') || ':' || ranking_v2_test.row_value('v2-measured', 'snapshot_kind'),
  'measured:final', 'a measured invitation uses its final snapshot');
select is(ranking_v2_test.row_value('v2-measured', 'completion_rate'), '0.7500',
  'ledger metrics come from the final snapshot');
select is(ranking_v2_test.row_value('v2-quiet', 'activity_state') || ':' || ranking_v2_test.row_value('v2-quiet', 'event_status'),
  'none:past', 'an invitation without ledger activity is listed as none and past');

-- Inferred figures from live guest projections.
select is(ranking_v2_test.row_value('v2-measured', 'guests_responded') || '/' || ranking_v2_test.row_value('v2-measured', 'guests_responded_self'),
  '3/2', 'host-entered responses are excluded from guest responses; test guests never count');
select is(ranking_v2_test.row_value('v2-measured', 'guests_opened') || '/' || ranking_v2_test.row_value('v2-measured', 'guests_opened_inferred'),
  '2/3', 'a guest response infers an open');
select is(ranking_v2_test.row_value('v2-measured', 'response_rate') || '|' || ranking_v2_test.row_value('v2-measured', 'conversion_upper'),
  '0.0800|0.6667', 'response rate over shared guests and conversion upper bound over inferred opens');
select is(ranking_v2_test.row_value('v2-measured', 'sample_state') || ':' || ranking_v2_test.row_value('v2-quiet', 'sample_state'),
  'eligible:insufficient', 'twenty shared guests make a sample');

-- Access, confirmation mode and design from published content.
select is(ranking_v2_test.row_value('v2-measured', 'public_access'), 'disabled', 'public access is reported');
select is(ranking_v2_test.row_value('v2-quiet', 'confirmation_mode'), 'whatsapp', 'confirmation mode comes from published content');
select is(ranking_v2_test.as_role('service_role', $$select design->>'themePreset' || '|' || (design#>>'{music,enabled}') || '|' || (design#>>'{rsvp,accessMode}') from public.list_invitation_engagement_ranking_v2() where slug = 'v2-quiet'$$),
  'jewelry-box-wedding|true|hybrid', 'design is derived from published content when there is no snapshot');

select * from finish();
rollback;
