-- Meta CRM lead stages: quote sent, deposit paid and opportunity lost.
-- Spec: docs/domains/tracking/commercial-attribution.md (CRM lead stage events).
-- These rows are lead-linked, carry no order/customer/value, and may retain an optional session
-- for latest-consent checks. Terminal CRM stage rows share the 30-day outbox retention window.
--
-- Registered as contract only because the CHECK swaps use DROP CONSTRAINT. Every change widens
-- accepted outbox rows; existing records and the deployed application keep working. The migration
-- must be applied before the application that enqueues CRM lead-stage rows is deployed.
begin;

alter table public.meta_conversion_events
  drop constraint if exists meta_conversion_events_event_name_check;
alter table public.meta_conversion_events
  add constraint meta_conversion_events_event_name_check
  check (event_name in (
    'Purchase', 'Contact', 'Lead', 'PageView', 'ViewContent',
    'LeadQuoted', 'LeadPaid', 'LeadLost'
  ));

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
    'crm_lead_quoted',
    'crm_lead_paid',
    'crm_lead_lost'
  ));

-- Preserve every existing Purchase/browser shape and allow only strict CRM stage rows.
-- The existing lead_id foreign key uses ON DELETE SET NULL; keep that behavior so lead deletion
-- is not blocked by an unsent outbox row. The enqueue path always supplies lead_id.
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
  );

comment on column public.meta_conversion_events.session_id is
  'Visitor session for browser events or the optional session copied from a CRM lead-stage row, used to recheck marketing consent. No foreign key.';
comment on column public.meta_conversion_events.event_source_path is
  'Route path for browser PageView, ViewContent, Contact or Lead events; CRM lead-stage rows have no event source path.';

create or replace function public.purge_meta_conversion_retention(p_batch integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_events_cutoff timestamptz := public.meta_conversion_retention_cutoff(now());
  v_withdrawals_cutoff timestamptz;
  v_events integer;
  v_withdrawals integer;
begin
  if p_batch is null or p_batch < 1 or p_batch > 5000 then
    raise exception using errcode = '22023', message = 'meta_retention_batch_invalid';
  end if;

  with batch as (
    select e.id
    from public.meta_conversion_events e
    where e.event_name in (
        'Contact', 'Lead', 'PageView', 'ViewContent', 'LeadQuoted', 'LeadPaid', 'LeadLost'
      )
      and e.status in ('sent', 'skipped')
      and e.created_at < v_events_cutoff
      and not exists (
        select 1 from public.meta_conversion_recoveries r where r.conversion_event_id = e.id
      )
    order by e.created_at
    limit p_batch
    for update of e skip locked
  )
  delete from public.meta_conversion_events e
  using batch
  where e.id = batch.id;
  get diagnostics v_events = row_count;

  select min(s.started_at) into v_withdrawals_cutoff from public.visitor_sessions s;

  with batch as (
    select w.visitor_id
    from public.visitor_consent_withdrawals w
    where w.updated_at < v_withdrawals_cutoff
    order by w.updated_at
    limit p_batch
    for update of w skip locked
  )
  delete from public.visitor_consent_withdrawals w
  using batch
  where w.visitor_id = batch.visitor_id;
  get diagnostics v_withdrawals = row_count;

  return jsonb_build_object(
    'meta_conversion_events', v_events,
    'visitor_consent_withdrawals', v_withdrawals
  );
end;
$function$;

create index if not exists idx_meta_conversion_events_crm_retention
  on public.meta_conversion_events (created_at)
  where event_name in ('LeadQuoted', 'LeadPaid', 'LeadLost')
    and status in ('sent', 'skipped');

commit;
