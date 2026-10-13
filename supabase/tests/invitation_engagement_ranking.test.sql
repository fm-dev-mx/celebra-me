-- Invitation engagement ranking routine contract (phase 2).
begin;
select plan(11);

create schema ranking_test;

create function ranking_test.as_service(p_sql text)
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

create function ranking_test.as_role(p_role text, p_sql text)
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

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('b1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rank-owner@example.test', now(), now());

insert into public.events (id, owner_user_id, slug, event_type, title, status, event_date) values
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'rank-final', 'boda', 'Final y rolling', 'published', current_date - 30),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'rank-small', 'boda', 'Muestra pequeña', 'published', current_date + 30),
  ('b2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'rank-xv', 'xv', 'Otro tipo', 'published', current_date + 60);

insert into public.invitation_engagement_snapshots (
  event_id, event_type, snapshot_kind, guests_total, guests_shared, guests_opened, guests_responded,
  opens_total, open_rate, completion_rate, rsvp_conversion, reopen_ratio, mobile_share,
  share_lead_days, reminder_coverage, design, design_schema_version
) values
  -- Event 1: both kinds; the final one must win.
  ('b2000000-0000-4000-8000-000000000001', 'boda', 'rolling', 30, 25, 20, 10, 40, 0.8000, 0.5000, 0.5000, 2.0000, 0.7000, 20, 0.5000,
   '{"themePreset":"editorial","rsvp":{"confirmationMode":"direct"}}'::jsonb, 1),
  ('b2000000-0000-4000-8000-000000000001', 'boda', 'final', 30, 25, 22, 12, 44, 0.8800, 0.5500, 0.5455, 2.0000, 0.7500, 20, 0.5000,
   '{"themePreset":"editorial","rsvp":{"confirmationMode":"direct"}}'::jsonb, 1),
  -- Event 2: too few shared guests.
  ('b2000000-0000-4000-8000-000000000002', 'boda', 'rolling', 8, 5, 4, 2, 6, 0.8000, 0.2500, 0.5000, 1.5000, 1.0000, 10, 0.0000,
   '{"themePreset":"storybook","rsvp":{"confirmationMode":"review"}}'::jsonb, 1),
  -- Event 3: another event type, never listed under boda.
  ('b2000000-0000-4000-8000-000000000003', 'xv', 'rolling', 40, 30, 25, 20, 50, 0.8333, 0.6000, 0.8000, 2.0000, 0.9000, 15, 0.2000,
   '{"themePreset":"editorial"}'::jsonb, 1),
  -- Deleted event: snapshot kept without a label, still a group member.
  (null, 'boda', 'final', 35, 30, 24, 9, 48, 0.8000, 0.4000, 0.3750, 2.0000, 0.6000, 25, 0.1000,
   '{"themePreset":"editorial","rsvp":{"confirmationMode":"direct"}}'::jsonb, 1);

-- Grants.
select ok(has_function_privilege('service_role', 'public.list_invitation_engagement_ranking(text,text)', 'EXECUTE'),
  'service_role executes the ranking routine');
select ok(not has_function_privilege('anon', 'public.list_invitation_engagement_ranking(text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.list_invitation_engagement_ranking(text,text)', 'EXECUTE'),
  'anon and authenticated cannot execute the ranking routine');
select is(ranking_test.as_role('anon', $$select count(*)::text from public.list_invitation_engagement_ranking('boda')$$),
  '42501', 'anon execution is denied');

-- One row per event, same event type only.
select is(ranking_test.as_service($$select count(*)::text from public.list_invitation_engagement_ranking('boda')$$),
  '3', 'boda lists the two boda events and the deleted snapshot');
select is(ranking_test.as_service($$select snapshot_kind from public.list_invitation_engagement_ranking('boda') where slug = 'rank-final'$$),
  'final', 'the final snapshot wins over the rolling one');
select is(ranking_test.as_service($$select guests_opened::text from public.list_invitation_engagement_ranking('boda') where slug = 'rank-final'$$),
  '22', 'the final snapshot values are returned');

-- Sample state and deleted events.
select is(ranking_test.as_service($$select sample_state from public.list_invitation_engagement_ranking('boda') where slug = 'rank-small'$$),
  'insufficient', 'fewer than 20 shared guests is an insufficient sample');
select is(ranking_test.as_service($$select event_deleted::text || ':' || coalesce(title, '-') from public.list_invitation_engagement_ranking('boda') where event_id is null$$),
  'true:-', 'a snapshot without an event is flagged deleted and unlabelled');

-- Group sizes per design key.
select is(ranking_test.as_service($$select group_size::text || '/' || group_eligible::text from public.list_invitation_engagement_ranking('boda', 'themePreset') where slug = 'rank-final'$$),
  '2/2', 'theme preset groups count members and eligible members');
select is(ranking_test.as_service($$select group_value from public.list_invitation_engagement_ranking('boda', 'rsvpConfirmationMode') where slug = 'rank-small'$$),
  'review', 'nested design keys resolve');

-- Input validation.
select is(ranking_test.as_service($$select count(*)::text from public.list_invitation_engagement_ranking('boda', 'colour')$$),
  '22023', 'an unknown group key is rejected');

select * from finish();
rollback;
