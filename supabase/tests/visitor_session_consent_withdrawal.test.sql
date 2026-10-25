-- Visitor session consent: a marketing withdrawal survives late tracking upserts and only a
-- strictly newer decision turns marketing back on.
begin;
select plan(5);

insert into public.visitor_sessions (id, visitor_id, route_class, consent_snapshot) values
  ('c1000000-0000-4000-8000-000000000001', 'consent-test', 'commercial',
   '{"necessary": true, "analytics": true, "marketing": true, "decidedAt": "2026-10-25T12:00:00.000Z"}');

-- The withdrawal route.
update public.visitor_sessions
  set consent_snapshot = '{"necessary": true, "analytics": false, "marketing": false, "decidedAt": "2026-10-25T12:05:00.000Z"}'
  where visitor_id = 'consent-test';

-- A tracking upsert sent before the withdrawal and stored after it.
insert into public.visitor_sessions (id, visitor_id, route_class, consent_snapshot) values
  ('c1000000-0000-4000-8000-000000000001', 'consent-test', 'commercial',
   '{"necessary": true, "analytics": true, "marketing": true, "decidedAt": "2026-10-25T12:00:00.000Z"}')
on conflict (id) do update set consent_snapshot = excluded.consent_snapshot;

select is(
  (select consent_snapshot->>'marketing' from public.visitor_sessions
    where id = 'c1000000-0000-4000-8000-000000000001'),
  'false',
  'an older decision does not undo the withdrawal'
);

update public.visitor_sessions
  set consent_snapshot = '{"necessary": true, "analytics": true, "marketing": true}'
  where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select consent_snapshot->>'marketing' from public.visitor_sessions
    where id = 'c1000000-0000-4000-8000-000000000001'),
  'false',
  'a snapshot without a decision time does not undo the withdrawal'
);

update public.visitor_sessions
  set consent_snapshot = '{"necessary": true, "analytics": true, "marketing": true, "decidedAt": "2026-10-25T12:05:00.000Z"}'
  where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select consent_snapshot->>'marketing' from public.visitor_sessions
    where id = 'c1000000-0000-4000-8000-000000000001'),
  'false',
  'a decision at the same instant does not undo the withdrawal'
);

update public.visitor_sessions
  set consent_snapshot = '{"necessary": true, "analytics": true, "marketing": true, "decidedAt": "2026-10-25T12:10:00.000Z"}'
  where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select consent_snapshot->>'decidedAt' from public.visitor_sessions
    where id = 'c1000000-0000-4000-8000-000000000001'),
  '2026-10-25T12:10:00.000Z',
  'a newer decision grants marketing again'
);

update public.visitor_sessions
  set consent_snapshot = '{"necessary": true, "analytics": false, "marketing": false, "decidedAt": "2026-10-25T12:09:00.000Z"}'
  where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select consent_snapshot->>'marketing' from public.visitor_sessions
    where id = 'c1000000-0000-4000-8000-000000000001'),
  'false',
  'a withdrawal always applies'
);

select * from finish();
rollback;
