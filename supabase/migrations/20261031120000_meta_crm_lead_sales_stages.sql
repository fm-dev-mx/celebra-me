-- Meta CRM sales stages: qualified lead (Lead) and confirmed order (Purchase with package value).
-- Spec: docs/domains/tracking/commercial-attribution.md (CRM lead stage events).
-- Both rows are lead-linked and carry no order, customer or event source path. The confirmed-order
-- Purchase carries the package value; the deposit Purchase shape stays unchanged.
--
-- Registered as contract only because the CHECK swaps use DROP CONSTRAINT. Every change widens
-- accepted outbox rows; existing records and the deployed application keep working. The migration
-- must be applied before the application that enqueues these rows is deployed.
begin;

alter table public.meta_conversion_events
  drop constraint if exists meta_conversion_events_trigger_status_check;
alter table public.meta_conversion_events
  add constraint meta_conversion_events_trigger_status_check
  check (trigger_status in (
    'deposit_paid',
    'whatsapp_contact_clicked',
    'form_submitted',
    'page_viewed',
    'demo_viewed',
    'package_viewed',
    'invitation_data_submitted',
    'crm_lead_quoted',
    'crm_lead_paid',
    'crm_lead_lost',
    'crm_lead_qualified',
    'crm_lead_order_confirmed'
  ));

alter table public.meta_conversion_events
  drop constraint if exists meta_conversion_events_source_shape_check;
alter table public.meta_conversion_events
  add constraint meta_conversion_events_source_shape_check
  check (
    (event_name = 'Purchase'
      and trigger_status = 'deposit_paid'
      and order_id is not null
      and customer_id is not null
      and value is not null)
    or (event_name = 'CompleteRegistration'
      and trigger_status = 'invitation_data_submitted'
      and order_id is not null
      and customer_id is not null
      and value is null)
    or (order_id is null
      and session_id is not null
      and ((event_name = 'Contact' and trigger_status = 'whatsapp_contact_clicked')
        or (event_name = 'Lead' and trigger_status = 'form_submitted')
        or (event_name = 'PageView' and trigger_status = 'page_viewed')
        or (event_name = 'ViewContent' and trigger_status in ('demo_viewed', 'package_viewed'))))
    or (event_name = 'LeadQuoted'
      and trigger_status = 'crm_lead_quoted'
      and order_id is null
      and customer_id is null
      and value is null
      and event_source_path is null)
    or (event_name = 'LeadPaid'
      and trigger_status = 'crm_lead_paid'
      and order_id is null
      and customer_id is null
      and value is null
      and event_source_path is null)
    or (event_name = 'LeadLost'
      and trigger_status = 'crm_lead_lost'
      and order_id is null
      and customer_id is null
      and value is null
      and event_source_path is null)
    or (event_name = 'Lead'
      and trigger_status = 'crm_lead_qualified'
      and order_id is null
      and customer_id is null
      and value is null
      and event_source_path is null)
    or (event_name = 'Purchase'
      and trigger_status = 'crm_lead_order_confirmed'
      and order_id is null
      and customer_id is null
      and value is not null
      and event_source_path is null)
  );

-- Delivery checks whether a lead already has a confirmed-order or deposit Purchase so Meta
-- receives a single Purchase per lead.
create index if not exists idx_meta_conversion_events_lead_purchase
  on public.meta_conversion_events (lead_id, trigger_status)
  where event_name = 'Purchase' and lead_id is not null;

commit;
