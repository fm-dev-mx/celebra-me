-- Add order_created and deposit_paid to tracking_events check constraint
-- for the commercial CRM timeline.
--
-- Uses a DO block to safely replace the constraint regardless of its
-- auto-generated name, making it continuation-safe across environments
-- where the constraint may or may not already exist under the expected name.

begin;

do $$
begin
  -- Drop the automatically-named constraint if it exists.
  -- PostgreSQL auto-names unnamed check constraints as
  -- tablename_columnname_check, so we expect tracking_events_event_name_check.
  if exists (
    select 1 from pg_constraint
    where conname = 'tracking_events_event_name_check'
      and conrelid = 'public.tracking_events'::regclass
  ) then
    alter table public.tracking_events
      drop constraint tracking_events_event_name_check;
  end if;
end $$;

alter table public.tracking_events
  add constraint tracking_events_event_name_check
    check (event_name in (
      'page_viewed',
      'session_started',
      'session_ended',
      'section_seen',
      'scroll_depth_reached',
      'cta_clicked',
      'package_viewed',
      'demo_viewed',
      'whatsapp_contact_clicked',
      'form_started',
      'form_submitted',
      'lead_created',
      'order_created',
      'deposit_paid',
      'quote_sent',
      'production_authorized',
      'production_started',
      'preview_delivered',
      'payment_pending',
      'payment_received',
      'invitation_activated',
      'converted_to_demo',
      'lost'
    ));

commit;
