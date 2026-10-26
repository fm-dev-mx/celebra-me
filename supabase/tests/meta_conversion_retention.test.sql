-- Meta conversion retention: the 30-day cutoff, which browser conversion rows and consent
-- withdrawals the purge deletes and keeps, batch limits, and privileges.
begin;
select plan(19);

select is(
  public.meta_conversion_retention_cutoff('2026-11-30 12:00:00+00'),
  '2026-10-31 12:00:00+00'::timestamptz,
  'the cutoff is exactly 30 days before the given instant'
);

-- Drain rows already past retention so the counts below describe only this fixture.
select public.purge_meta_conversion_retention(5000);

-- The oldest stored session bounds the withdrawal purge.
insert into public.visitor_sessions (id, visitor_id, started_at, last_seen_at, route_class) values
  ('c2000000-0000-4000-8000-000000000001', 'meta-retention-test', '2000-01-01 00:00:00+00',
   '2000-01-01 00:00:00+00', 'commercial');

insert into public.visitor_consent_withdrawals (visitor_id, decided_at, updated_at) values
  ('meta-retention-old', '1999-06-01T00:00:00.000Z', '1999-06-01 00:00:00+00'),
  ('meta-retention-new', '2000-06-01T00:00:00.000Z', '2000-06-01 00:00:00+00');

insert into public.meta_conversion_events
  (id, event_name, event_id, trigger_status, session_id, status, created_at) values
  -- Sent 32 days ago: deleted first.
  ('f2000000-0000-4000-8000-000000000001', 'Contact', 'meta-retention-1', 'whatsapp_contact_clicked',
   'c2000000-0000-4000-8000-000000000001', 'sent', now() - interval '32 days'),
  -- Skipped 31 days ago: deleted.
  ('f2000000-0000-4000-8000-000000000002', 'Lead', 'meta-retention-2', 'form_submitted',
   'c2000000-0000-4000-8000-000000000001', 'skipped', now() - interval '31 days'),
  -- Sent 29 days ago: stays.
  ('f2000000-0000-4000-8000-000000000003', 'Contact', 'meta-retention-3', 'whatsapp_contact_clicked',
   'c2000000-0000-4000-8000-000000000001', 'sent', now() - interval '29 days'),
  -- Failed 40 days ago: still retried, stays.
  ('f2000000-0000-4000-8000-000000000004', 'Contact', 'meta-retention-4', 'whatsapp_contact_clicked',
   'c2000000-0000-4000-8000-000000000001', 'failed', now() - interval '40 days'),
  -- Ambiguous 40 days ago: waits for an operator, stays.
  ('f2000000-0000-4000-8000-000000000005', 'Contact', 'meta-retention-5', 'whatsapp_contact_clicked',
   'c2000000-0000-4000-8000-000000000001', 'ambiguous', now() - interval '40 days'),
  -- Sent 40 days ago but an operator recovered it: stays.
  ('f2000000-0000-4000-8000-000000000006', 'Contact', 'meta-retention-6', 'whatsapp_contact_clicked',
   'c2000000-0000-4000-8000-000000000001', 'sent', now() - interval '40 days');

insert into public.meta_conversion_delivery_attempts (conversion_event_id, attempt_number, claim_id, outcome) values
  ('f2000000-0000-4000-8000-000000000001', 1, 'f2100000-0000-4000-8000-000000000001', 'sent');

insert into public.meta_conversion_recoveries (conversion_event_id, actor_id, reason, source_status, destination_status) values
  ('f2000000-0000-4000-8000-000000000006', 'f2200000-0000-4000-8000-000000000001',
   'Meta retention test', 'ambiguous', 'sent');

-- Sent Purchase 40 days ago: belongs to an order, stays.
insert into public.customers (id, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'Meta retention test');
insert into public.sales_orders (id, order_number, customer_id, event_type, total_amount) values
  ('b2000000-0000-4000-8000-000000000001', 'META-RETENTION-TEST-1',
   'a2000000-0000-4000-8000-000000000001', 'boda', 100);
insert into public.meta_conversion_events
  (id, order_id, customer_id, event_name, event_id, trigger_status, value, status, created_at) values
  ('f2000000-0000-4000-8000-000000000007', 'b2000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001', 'Purchase', 'meta-retention-7', 'deposit_paid', 100,
   'sent', now() - interval '40 days');

select is(
  public.purge_meta_conversion_retention(1),
  '{"meta_conversion_events": 1, "visitor_consent_withdrawals": 1}'::jsonb,
  'one batch of one deletes the oldest eligible row and the oldest eligible withdrawal'
);
select ok(
  not exists (select 1 from public.meta_conversion_events where id = 'f2000000-0000-4000-8000-000000000001'),
  'the oldest sent Contact goes in the first batch'
);
select ok(
  not exists (
    select 1 from public.meta_conversion_delivery_attempts
    where conversion_event_id = 'f2000000-0000-4000-8000-000000000001'
  ),
  'its delivery attempts go with it'
);
select is(
  public.purge_meta_conversion_retention(500),
  '{"meta_conversion_events": 1, "visitor_consent_withdrawals": 0}'::jsonb,
  'the next batch deletes the remaining eligible row'
);
select is(
  public.purge_meta_conversion_retention(500),
  '{"meta_conversion_events": 0, "visitor_consent_withdrawals": 0}'::jsonb,
  'a third run finds nothing left past retention'
);

select ok(
  not exists (select 1 from public.meta_conversion_events where id = 'f2000000-0000-4000-8000-000000000002'),
  'a skipped Lead older than 30 days is deleted'
);
select ok(
  exists (select 1 from public.meta_conversion_events where id = 'f2000000-0000-4000-8000-000000000003'),
  'a sent Contact younger than 30 days stays'
);
select ok(
  exists (select 1 from public.meta_conversion_events where id = 'f2000000-0000-4000-8000-000000000004'),
  'an old failed row stays'
);
select ok(
  exists (select 1 from public.meta_conversion_events where id = 'f2000000-0000-4000-8000-000000000005'),
  'an old ambiguous row stays'
);
select ok(
  exists (select 1 from public.meta_conversion_events where id = 'f2000000-0000-4000-8000-000000000006'),
  'an old row with an operator recovery stays'
);
select ok(
  exists (select 1 from public.meta_conversion_events where id = 'f2000000-0000-4000-8000-000000000007'),
  'an old sent Purchase stays'
);
select ok(
  not exists (select 1 from public.visitor_consent_withdrawals where visitor_id = 'meta-retention-old'),
  'a withdrawal older than the oldest stored session is deleted'
);
select ok(
  exists (select 1 from public.visitor_consent_withdrawals where visitor_id = 'meta-retention-new'),
  'a withdrawal newer than the oldest stored session stays'
);

select throws_ok(
  'select public.purge_meta_conversion_retention(0)',
  '22023',
  'meta_retention_batch_invalid',
  'a batch below 1 is refused'
);
select ok(
  has_function_privilege('service_role', 'public.purge_meta_conversion_retention(integer)', 'execute')
    and not has_function_privilege('anon', 'public.purge_meta_conversion_retention(integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.purge_meta_conversion_retention(integer)', 'execute'),
  'only the service role may run the purge'
);
select ok(
  not has_function_privilege('anon', 'public.meta_conversion_retention_cutoff(timestamptz)', 'execute')
    and not has_function_privilege('authenticated', 'public.meta_conversion_retention_cutoff(timestamptz)', 'execute'),
  'browser roles may not call the cutoff helper'
);
select has_index(
  'public', 'meta_conversion_events', 'idx_meta_conversion_events_browser_retention',
  'meta_conversion_events has a partial index for the purge'
);
select has_index(
  'public', 'visitor_sessions', 'idx_visitor_sessions_started_at',
  'visitor_sessions has an index on started_at for the withdrawal cutoff'
);

select * from finish();
rollback;
