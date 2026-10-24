-- Commercial analytics retention (expand): keep tracking_events and visitor_sessions for 13
-- months, then purge them in small daily batches.
-- Spec: docs/domains/tracking/commercial-attribution.md (retention)
--
-- The 13-month rule lives only in commercial_analytics_retention_cutoff. The purge never
-- deletes a row that leads or sales_orders still reference, so their on delete set null
-- foreign keys never rewrite a lead or an order. customers and meta_conversion_* are never
-- read or written.
--
-- Statement order matters for scripts/db/migration-sql-risk.ts: every created object is
-- initialized (revoke/grant) before the first non-initialization statement of the transaction.
begin;

-- Rows older than the returned instant are past retention. Example: at 2027-11-24 12:00 UTC
-- the cutoff is 2026-10-24 12:00 UTC, so events of 2026-10-23 and earlier are purged.
create function public.commercial_analytics_retention_cutoff(p_now timestamptz default now())
returns timestamptz
language sql
stable
set search_path = public
as $function$
  select p_now - interval '13 months';
$function$;

revoke all on function public.commercial_analytics_retention_cutoff(timestamptz) from public, anon, authenticated, service_role;

-- Deletes at most p_batch tracking_events past retention, then at most p_batch
-- visitor_sessions past retention that no event, lead or order references anymore.
-- Returns the deleted counts as {tracking_events, visitor_sessions}.
create function public.purge_commercial_analytics(p_batch integer default 5000)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cutoff timestamptz := public.commercial_analytics_retention_cutoff(now());
  v_events integer;
  v_sessions integer;
begin
  if p_batch is null or p_batch < 1 or p_batch > 10000 then
    raise exception using errcode = '22023', message = 'commercial_purge_batch_invalid';
  end if;

  with batch as (
    select t.id
    from public.tracking_events t
    where t.occurred_at < v_cutoff
      and not exists (select 1 from public.leads l where l.source_event_id = t.id)
      and not exists (select 1 from public.sales_orders o where o.source_event_id = t.id)
    order by t.occurred_at
    limit p_batch
    for update of t skip locked
  )
  delete from public.tracking_events t
  using batch
  where t.id = batch.id;
  get diagnostics v_events = row_count;

  with batch as (
    select s.id
    from public.visitor_sessions s
    where s.last_seen_at < v_cutoff
      and not exists (select 1 from public.tracking_events t where t.session_id = s.id)
      and not exists (select 1 from public.leads l where l.session_id = s.id)
      and not exists (select 1 from public.sales_orders o where o.session_id = s.id)
    order by s.last_seen_at
    limit p_batch
    for update of s skip locked
  )
  delete from public.visitor_sessions s
  using batch
  where s.id = batch.id;
  get diagnostics v_sessions = row_count;

  return jsonb_build_object('tracking_events', v_events, 'visitor_sessions', v_sessions);
end;
$function$;

revoke all on function public.purge_commercial_analytics(integer) from public, anon, authenticated, service_role;
grant execute on function public.purge_commercial_analytics(integer) to service_role;

-- The purge walks tracking_events by age; the existing indexes lead with event_name or route_class.
create index if not exists idx_tracking_events_occurred_at
  on public.tracking_events (occurred_at);

commit;
