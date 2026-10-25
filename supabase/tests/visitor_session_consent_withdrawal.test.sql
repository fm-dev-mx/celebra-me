-- Visitor session consent: a marketing withdrawal is recorded per visitor, survives late
-- tracking inserts and updates, and only a strictly newer decision turns marketing back on.
begin;
select plan(9);

-- The visitor withdraws before the server has stored any of their sessions.
select public.record_visitor_marketing_withdrawal('consent-test', false, '2026-10-25T12:05:00.000Z');

select is(
  (select decided_at from public.visitor_consent_withdrawals where visitor_id = 'consent-test'),
  '2026-10-25T12:05:00.000Z',
  'the withdrawal is recorded even without a stored session'
);

-- A tracking upsert sent before the withdrawal and stored after it, as an insert.
insert into public.visitor_sessions (id, visitor_id, route_class, consent_snapshot) values
  ('c1000000-0000-4000-8000-000000000001', 'consent-test', 'commercial',
   '{"necessary": true, "analytics": true, "marketing": true, "decidedAt": "2026-10-25T12:00:00.000Z"}')
on conflict (id) do update set consent_snapshot = excluded.consent_snapshot;

select is(
  (select consent_snapshot->>'marketing' from public.visitor_sessions
    where id = 'c1000000-0000-4000-8000-000000000001'),
  'false',
  'a late insert with an older decision does not grant marketing'
);

-- The same late request again, now as an update of the stored row.
insert into public.visitor_sessions (id, visitor_id, route_class, consent_snapshot) values
  ('c1000000-0000-4000-8000-000000000001', 'consent-test', 'commercial',
   '{"necessary": true, "analytics": true, "marketing": true, "decidedAt": "2026-10-25T12:00:00.000Z"}')
on conflict (id) do update set consent_snapshot = excluded.consent_snapshot;

select is(
  (select consent_snapshot->>'marketing' from public.visitor_sessions
    where id = 'c1000000-0000-4000-8000-000000000001'),
  'false',
  'a late update with an older decision does not grant marketing'
);

update public.visitor_sessions
  set consent_snapshot = '{"necessary": true, "analytics": true, "marketing": true}'
  where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select consent_snapshot->>'marketing' from public.visitor_sessions
    where id = 'c1000000-0000-4000-8000-000000000001'),
  'false',
  'a snapshot without a decision time does not grant marketing'
);

update public.visitor_sessions
  set consent_snapshot = '{"necessary": true, "analytics": true, "marketing": true, "decidedAt": "2026-10-25T12:05:00.000Z"}'
  where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (select consent_snapshot->>'marketing' from public.visitor_sessions
    where id = 'c1000000-0000-4000-8000-000000000001'),
  'false',
  'a decision at the same instant does not grant marketing'
);

-- A new session of the same visitor with a newer decision.
insert into public.visitor_sessions (id, visitor_id, route_class, consent_snapshot) values
  ('c1000000-0000-4000-8000-000000000002', 'consent-test', 'commercial',
   '{"necessary": true, "analytics": true, "marketing": true, "decidedAt": "2026-10-25T12:10:00.000Z"}');

select is(
  (select consent_snapshot->>'marketing' from public.visitor_sessions
    where id = 'c1000000-0000-4000-8000-000000000002'),
  'true',
  'a strictly newer decision grants marketing again'
);

-- A retried older withdrawal neither moves the record back nor undoes the newer grant.
select public.record_visitor_marketing_withdrawal('consent-test', false, '2026-10-25T12:01:00.000Z');

select is(
  (select decided_at from public.visitor_consent_withdrawals where visitor_id = 'consent-test'),
  '2026-10-25T12:05:00.000Z',
  'an older withdrawal keeps the newest record'
);

select is(
  (select consent_snapshot->>'marketing' from public.visitor_sessions
    where id = 'c1000000-0000-4000-8000-000000000002'),
  'true',
  'an older withdrawal does not undo a newer grant'
);

-- A newer withdrawal switches every stored session off.
select public.record_visitor_marketing_withdrawal('consent-test', true, '2026-10-25T12:15:00.000Z');

select is(
  (select count(*)::int from public.visitor_sessions
    where visitor_id = 'consent-test' and consent_snapshot->>'marketing' = 'false'),
  2,
  'a newer withdrawal switches marketing off on every stored session'
);

select * from finish();
rollback;
