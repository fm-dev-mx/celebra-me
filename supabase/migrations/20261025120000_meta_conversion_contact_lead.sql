-- Meta conversion outbox: accept browser Contact and Lead events next to deposit Purchases.
-- Spec: docs/domains/tracking/commercial-attribution.md (Conversions API)
--
-- Tracking ingestion enqueues a Contact (WhatsApp click) or Lead (form submission) row with the
-- tracking event UUID as event_id, the same ID the Meta Pixel sends as eventID, so Meta
-- deduplicates the browser and server copies. These rows carry the visitor session instead of an
-- order and have no value. session_id has no foreign key on purpose: the 13-month analytics purge
-- must stay free to delete the session after delivery.
--
-- Registered as contract only because the CHECK swaps use DROP CONSTRAINT and DROP NOT NULL.
-- Every change widens what the table accepts; existing Purchase rows and the deployed
-- application keep working, and the shape check keeps Purchase rows exactly as strict as before.
begin;

alter table public.meta_conversion_events
  add column if not exists session_id uuid null,
  add column if not exists event_source_path text null
    check (event_source_path is null or char_length(event_source_path) <= 512);

alter table public.meta_conversion_events alter column order_id drop not null;
alter table public.meta_conversion_events alter column customer_id drop not null;
alter table public.meta_conversion_events alter column value drop not null;

alter table public.meta_conversion_events
  drop constraint if exists meta_conversion_events_event_name_check;
alter table public.meta_conversion_events
  add constraint meta_conversion_events_event_name_check
  check (event_name in ('Purchase', 'Contact', 'Lead'));

alter table public.meta_conversion_events
  drop constraint if exists meta_conversion_events_trigger_status_check;
alter table public.meta_conversion_events
  add constraint meta_conversion_events_trigger_status_check
  check (trigger_status in ('deposit_paid', 'whatsapp_contact_clicked', 'form_submitted'));

-- Purchase rows keep their order, customer and value; browser rows carry their session instead.
alter table public.meta_conversion_events
  add constraint meta_conversion_events_source_shape_check
  check (
    (event_name = 'Purchase'
      and trigger_status = 'deposit_paid'
      and order_id is not null
      and customer_id is not null
      and value is not null)
    or (event_name = 'Contact'
      and trigger_status = 'whatsapp_contact_clicked'
      and order_id is null
      and session_id is not null)
    or (event_name = 'Lead'
      and trigger_status = 'form_submitted'
      and order_id is null
      and session_id is not null)
  );

comment on column public.meta_conversion_events.session_id is
  'Visitor session of a browser Contact or Lead row. No foreign key, so the analytics purge can delete the session after delivery.';
comment on column public.meta_conversion_events.event_source_path is
  'Route path where a browser Contact or Lead happened; delivery checks it against the tracking route policy.';

commit;
