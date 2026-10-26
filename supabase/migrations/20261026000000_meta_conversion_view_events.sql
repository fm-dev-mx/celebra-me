-- Meta conversion outbox: accept browser PageView and ViewContent rows next to Contact and Lead.
-- Spec: docs/domains/tracking/commercial-attribution.md (Conversions API)
--
-- Tracking ingestion enqueues a PageView (page_viewed) or ViewContent (demo_viewed,
-- package_viewed) row with the tracking event UUID as event_id, the same ID the Meta Pixel sends
-- as eventID, so Meta deduplicates the browser and server copies. Like Contact and Lead rows they
-- carry the visitor session instead of an order and have no value.
--
-- The 30-day retention purge and its partial index now cover every browser row; Purchase rows are
-- still never deleted.
--
-- Registered as contract only because the CHECK swaps use DROP CONSTRAINT and the index swap uses
-- DROP INDEX. Every change widens what the table accepts; existing rows and the deployed
-- application keep working, and the shape check keeps Purchase, Contact and Lead rows exactly as
-- strict as before.
begin;

alter table public.meta_conversion_events
  drop constraint if exists meta_conversion_events_event_name_check;
alter table public.meta_conversion_events
  add constraint meta_conversion_events_event_name_check
  check (event_name in ('Purchase', 'Contact', 'Lead', 'PageView', 'ViewContent'));

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
    'package_viewed'
  ));

-- Purchase rows keep their order, customer and value; browser rows carry their session instead.
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
  );

comment on column public.meta_conversion_events.session_id is
  'Visitor session of a browser PageView, ViewContent, Contact or Lead row. No foreign key, so the analytics purge can delete the session after delivery.';
comment on column public.meta_conversion_events.event_source_path is
  'Route path where a browser PageView, ViewContent, Contact or Lead happened; delivery checks it against the tracking route policy.';

-- Same rules as 20261025150000, widened from Contact and Lead to every browser row.
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
    where e.event_name in ('Contact', 'Lead', 'PageView', 'ViewContent')
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

-- The purge walks terminal browser rows by age; the partial index follows its wider filter.
drop index if exists public.idx_meta_conversion_events_retention;
create index if not exists idx_meta_conversion_events_browser_retention
  on public.meta_conversion_events (created_at)
  where event_name in ('Contact', 'Lead', 'PageView', 'ViewContent')
    and status in ('sent', 'skipped');

commit;
