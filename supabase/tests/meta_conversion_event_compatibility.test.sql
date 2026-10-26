-- Both contract migrations must keep accepting CompleteRegistration and CRM lead-stage rows.
begin;
select plan(2);

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

select * from finish();
rollback;
