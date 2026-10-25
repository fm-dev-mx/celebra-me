-- Meta conversion retention (expand): purge delivered or skipped browser Contact and Lead rows
-- after 30 days, and marketing withdrawals older than every stored visitor session, in small
-- batches driven by the quarter-hour Worker sweep.
-- Spec: docs/domains/tracking/commercial-attribution.md (retention)
--
-- Purchase rows are never deleted: they belong to a sales order and its CRM timeline. Rows that
-- are pending, sending, failed or ambiguous are never deleted either, and neither is a row an
-- operator recovered (meta_conversion_recoveries is the audit of that action). Deleting a row
-- cascades to its meta_conversion_delivery_attempts.
--
-- A withdrawal only guards visitor_sessions writes that carry an older consent decision. Once it
-- is older than the oldest stored session, every stored session started after it. With no
-- stored session the cutoff is null and no withdrawal is deleted.
--
-- Statement order matters for scripts/db/migration-sql-risk.ts: every created object is
-- initialized (revoke/grant) before the first non-initialization statement of the transaction.
begin;

-- Browser rows created before the returned instant are past retention. Example: at
-- 2026-11-30 12:00 UTC the cutoff is 2026-10-31 12:00 UTC.
create function public.meta_conversion_retention_cutoff(p_now timestamptz default now())
returns timestamptz
language sql
stable
set search_path = public
as $function$
  select p_now - interval '30 days';
$function$;

revoke all on function public.meta_conversion_retention_cutoff(timestamptz) from public, anon, authenticated, service_role;

-- Deletes at most p_batch browser conversion rows past retention, then at most p_batch
-- withdrawals recorded before the oldest stored visitor session started.
-- Returns the deleted counts as {meta_conversion_events, visitor_consent_withdrawals}.
create function public.purge_meta_conversion_retention(p_batch integer default 500)
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
    where e.event_name in ('Contact', 'Lead')
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

revoke all on function public.purge_meta_conversion_retention(integer) from public, anon, authenticated, service_role;
grant execute on function public.purge_meta_conversion_retention(integer) to service_role;

-- The purge walks terminal browser rows by age; the existing index leads with status, next_attempt_at.
create index if not exists idx_meta_conversion_events_retention
  on public.meta_conversion_events (created_at)
  where event_name in ('Contact', 'Lead') and status in ('sent', 'skipped');

-- The oldest stored session bounds the withdrawal purge.
create index if not exists idx_visitor_sessions_started_at
  on public.visitor_sessions (started_at);

create index if not exists idx_visitor_consent_withdrawals_updated_at
  on public.visitor_consent_withdrawals (updated_at);

commit;
