-- Commercial analytics retention: the 13-month cutoff, what the purge deletes and keeps,
-- batch limits, untouched leads and orders, and privileges.
begin;
select plan(17);

select is(
  public.commercial_analytics_retention_cutoff('2027-11-24 12:00:00+00'),
  '2026-10-24 12:00:00+00'::timestamptz,
  'the cutoff is exactly 13 months before the given instant'
);

-- Drain rows already past retention so the counts below describe only this fixture.
select public.purge_commercial_analytics(10000);

insert into public.visitor_sessions (id, visitor_id, last_seen_at, route_class) values
  ('c0000000-0000-4000-8000-000000000001', 'retention-test', now() - interval '14 months', 'commercial'),
  ('c0000000-0000-4000-8000-000000000002', 'retention-test', now() - interval '12 months', 'commercial'),
  ('c0000000-0000-4000-8000-000000000003', 'retention-test', now() - interval '14 months', 'commercial'),
  ('c0000000-0000-4000-8000-000000000004', 'retention-test', now() - interval '14 months', 'commercial');

insert into public.tracking_events (id, session_id, visitor_id, event_name, occurred_at, route_path, route_class) values
  -- 14 months old on an otherwise unreferenced session: both go.
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'retention-test', 'page_viewed', now() - interval '14 months', '/', 'commercial'),
  -- 12 months old: stays, and keeps its 14-month-old session alive.
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'retention-test', 'page_viewed', now() - interval '12 months', '/', 'commercial'),
  -- 14 months old but a lead points at it: stays.
  ('e0000000-0000-4000-8000-000000000003', null, 'retention-test', 'page_viewed', now() - interval '14 months', '/', 'commercial'),
  -- 14 months old but an order points at it: stays.
  ('e0000000-0000-4000-8000-000000000004', null, 'retention-test', 'page_viewed', now() - interval '14 months', '/', 'commercial');

insert into public.leads (id, lead_code, session_id, source_event_id) values
  ('d0000000-0000-4000-8000-000000000001', 'RETENTION-TEST-1',
   'c0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000003');

insert into public.customers (id, display_name) values
  ('a0000000-0000-4000-8000-000000000001', 'Retention test');
insert into public.sales_orders (id, order_number, customer_id, source_event_id, event_type, total_amount) values
  ('b0000000-0000-4000-8000-000000000001', 'RETENTION-TEST-1', 'a0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000004', 'boda', 100);

select is(
  public.purge_commercial_analytics(1),
  '{"tracking_events": 1, "visitor_sessions": 1}'::jsonb,
  'one batch of one deletes the only eligible event, then its emptied session'
);
select is(
  public.purge_commercial_analytics(5000),
  '{"tracking_events": 0, "visitor_sessions": 0}'::jsonb,
  'a second run finds nothing left past retention'
);

select ok(
  not exists (select 1 from public.tracking_events where id = 'e0000000-0000-4000-8000-000000000001'),
  'a 14-month-old event is deleted'
);
select ok(
  exists (select 1 from public.tracking_events where id = 'e0000000-0000-4000-8000-000000000002'),
  'a 12-month-old event stays'
);
select ok(
  exists (select 1 from public.tracking_events where id = 'e0000000-0000-4000-8000-000000000003'),
  'an old event referenced by a lead stays'
);
select ok(
  exists (select 1 from public.tracking_events where id = 'e0000000-0000-4000-8000-000000000004'),
  'an old event referenced by an order stays'
);
select ok(
  not exists (select 1 from public.visitor_sessions where id = 'c0000000-0000-4000-8000-000000000001'),
  'a 14-month-old session without events is deleted'
);
select ok(
  exists (select 1 from public.visitor_sessions where id = 'c0000000-0000-4000-8000-000000000002'),
  'a 12-month-old session stays'
);
select ok(
  exists (select 1 from public.visitor_sessions where id = 'c0000000-0000-4000-8000-000000000003'),
  'an old session that still has a kept event stays'
);
select ok(
  exists (select 1 from public.visitor_sessions where id = 'c0000000-0000-4000-8000-000000000004'),
  'an old session referenced by a lead stays'
);
select ok(
  exists (
    select 1 from public.leads
    where id = 'd0000000-0000-4000-8000-000000000001'
      and session_id = 'c0000000-0000-4000-8000-000000000004'
      and source_event_id = 'e0000000-0000-4000-8000-000000000003'
  ),
  'the lead keeps both of its links'
);
select ok(
  exists (
    select 1 from public.sales_orders
    where id = 'b0000000-0000-4000-8000-000000000001'
      and source_event_id = 'e0000000-0000-4000-8000-000000000004'
  ),
  'the order keeps its source event'
);

select throws_ok(
  'select public.purge_commercial_analytics(0)',
  '22023',
  'commercial_purge_batch_invalid',
  'a batch below 1 is refused'
);
select ok(
  has_function_privilege('service_role', 'public.purge_commercial_analytics(integer)', 'execute')
    and not has_function_privilege('anon', 'public.purge_commercial_analytics(integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.purge_commercial_analytics(integer)', 'execute'),
  'only the service role may run the purge'
);
select ok(
  not has_function_privilege('anon', 'public.commercial_analytics_retention_cutoff(timestamptz)', 'execute')
    and not has_function_privilege('authenticated', 'public.commercial_analytics_retention_cutoff(timestamptz)', 'execute'),
  'browser roles may not call the cutoff helper'
);
select has_index(
  'public', 'tracking_events', 'idx_tracking_events_occurred_at',
  'tracking_events has an index on occurred_at for the purge'
);

select * from finish();
rollback;
