-- Every contract migration on the outbox must keep accepting CompleteRegistration and CRM lead-stage rows.
begin;
select plan(5);

insert into public.customers (id, display_name) values
  ('a4000000-0000-4000-8000-000000000001', 'Meta event compatibility test');
insert into public.sales_orders (id, order_number, customer_id, event_type, total_amount, status) values
  ('b4000000-0000-4000-8000-000000000001', 'META-EVENT-COMPATIBILITY-TEST',
   'a4000000-0000-4000-8000-000000000001', 'xv', 1800, 'deposit_paid');
insert into public.leads (id, lead_code) values
  ('d4000000-0000-4000-8000-000000000001', 'META-EVENT-COMPATIBILITY-TEST');

select lives_ok(
  $$insert into public.meta_conversion_events
    (order_id, customer_id, event_name, event_id, trigger_status, status) values
    ('b4000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001',
     'CompleteRegistration', 'complete_registration:compatibility-test',
     'invitation_data_submitted', 'pending')$$,
  'the later CRM migration still accepts CompleteRegistration'
);

select lives_ok(
  $$insert into public.meta_conversion_events
    (lead_id, event_name, event_id, trigger_status, status) values
    ('d4000000-0000-4000-8000-000000000001', 'LeadQuoted',
     'crm_lead_quoted:compatibility-test', 'crm_lead_quoted', 'pending')$$,
  'the CRM migration accepts LeadQuoted alongside CompleteRegistration'
);

select lives_ok(
  $$insert into public.meta_conversion_events
    (lead_id, event_name, event_id, trigger_status, status) values
    ('d4000000-0000-4000-8000-000000000001', 'Lead',
     'crm_lead_qualified:compatibility-test', 'crm_lead_qualified', 'pending')$$,
  'the sales-stage migration accepts a qualified-lead Lead without value'
);

select lives_ok(
  $$insert into public.meta_conversion_events
    (lead_id, event_name, event_id, trigger_status, value, status) values
    ('d4000000-0000-4000-8000-000000000001', 'Purchase',
     'crm_lead_order_confirmed:compatibility-test', 'crm_lead_order_confirmed', 2500, 'pending')$$,
  'the sales-stage migration accepts a confirmed-order Purchase with value and no order'
);

select throws_ok(
  $$insert into public.meta_conversion_events
    (lead_id, event_name, event_id, trigger_status, status) values
    ('d4000000-0000-4000-8000-000000000001', 'Purchase',
     'crm_lead_order_confirmed:no-value-test', 'crm_lead_order_confirmed', 'pending')$$,
  '23514',
  null,
  'a confirmed-order Purchase needs the package value'
);

select * from finish();
rollback;
