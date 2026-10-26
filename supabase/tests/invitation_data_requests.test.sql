-- Invitation data requests: one hashed-token row per order, bounded answers, the submitted
-- invariant, privileges, and the CompleteRegistration outbox shape.
begin;
select plan(13);

insert into public.customers (id, display_name) values
  ('a3000000-0000-4000-8000-000000000001', 'Invitation data test');
insert into public.sales_orders (id, order_number, customer_id, event_type, total_amount, status) values
  ('b3000000-0000-4000-8000-000000000001', 'INVITATION-DATA-TEST-1',
   'a3000000-0000-4000-8000-000000000001', 'xv', 1800, 'deposit_paid');

insert into public.invitation_data_requests (id, order_id, token_hash, expires_at) values
  ('c3000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001',
   repeat('a', 64), now() + interval '60 days');

select is(
  (select status from public.invitation_data_requests where id = 'c3000000-0000-4000-8000-000000000001'),
  'sent',
  'a new request starts as sent'
);

select throws_ok(
  $$insert into public.invitation_data_requests (order_id, token_hash, expires_at) values
    ('b3000000-0000-4000-8000-000000000001', repeat('b', 64), now() + interval '1 day')$$,
  '23505',
  null,
  'an order has a single request'
);

select throws_ok(
  $$insert into public.invitation_data_requests (order_id, token_hash, expires_at) values
    ('b3000000-0000-4000-8000-000000000001', 'not-a-hash', now() + interval '1 day')$$,
  '23514',
  null,
  'the token column only accepts a SHA-256 hex digest'
);

select throws_ok(
  $$update public.invitation_data_requests set answers = '[]'::jsonb
    where id = 'c3000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'answers must be a JSON object'
);

select throws_ok(
  $$update public.invitation_data_requests
    set answers = (
      select jsonb_object_agg('field_' || n, md5(n::text) || md5((n + 1)::text))
      from generate_series(1, 600) as n
    )
    where id = 'c3000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'answers are capped at 32 KB'
);

select throws_ok(
  $$update public.invitation_data_requests set status = 'submitted'
    where id = 'c3000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'submitted needs its submission time'
);

select lives_ok(
  $$update public.invitation_data_requests
    set status = 'submitted', submitted_at = now(), last_saved_at = now(),
        answers = '{"celebrantNames":"Andrea","eventDate":"2026-12-12"}'::jsonb
    where id = 'c3000000-0000-4000-8000-000000000001'$$,
  'a submission stores the answers'
);

select lives_ok(
  $$insert into public.meta_conversion_events
    (order_id, customer_id, event_name, event_id, trigger_status, status) values
    ('b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001',
     'CompleteRegistration', 'complete_registration:b3000000-0000-4000-8000-000000000001',
     'invitation_data_submitted', 'pending')$$,
  'the outbox accepts a CompleteRegistration of an order without a value'
);

select throws_ok(
  $$insert into public.meta_conversion_events
    (order_id, customer_id, event_name, event_id, trigger_status, value, status) values
    ('b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001',
     'CompleteRegistration', 'complete_registration:with-value', 'invitation_data_submitted', 10,
     'pending')$$,
  '23514',
  null,
  'a CompleteRegistration carries no value'
);

select throws_ok(
  $$insert into public.meta_conversion_events
    (session_id, event_name, event_id, trigger_status, status) values
    ('c3000000-0000-4000-8000-000000000009', 'CompleteRegistration',
     'complete_registration:browser', 'invitation_data_submitted', 'pending')$$,
  '23514',
  null,
  'a CompleteRegistration belongs to an order'
);

select throws_ok(
  $$insert into public.meta_conversion_events
    (order_id, customer_id, event_name, event_id, trigger_status, status) values
    ('b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001',
     'Purchase', 'purchase:no-value', 'deposit_paid', 'pending')$$,
  '23514',
  null,
  'a Purchase still needs its value'
);

select ok(
  not has_table_privilege('anon', 'public.invitation_data_requests', 'select')
    and not has_table_privilege('authenticated', 'public.invitation_data_requests', 'select'),
  'browser roles cannot read invitation data requests'
);

select ok(
  has_table_privilege('service_role', 'public.invitation_data_requests', 'update')
    and not has_table_privilege('service_role', 'public.invitation_data_requests', 'delete'),
  'the service role reads and writes but never deletes requests'
);

select * from finish();
rollback;
