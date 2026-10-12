-- Permanent invitation engagement snapshots and ledger anonymization (expand).
-- Spec: docs/domains/rsvp/engagement-analytics.md (storage tiers and retention)
--
-- Snapshots hold per-invitation aggregates and design attributes only (no guest
-- data) and are kept permanently. Raw ledger rows stay linked to the guest until
-- events.event_date + 180 days, then lose the guest link. Anonymization never
-- runs for an event whose snapshot is older than its newest ledger row.
--
-- Statement order matters for scripts/db/migration-sql-risk.ts: every created
-- object is initialized (revoke/grant) before the first non-initialization
-- statement of the transaction.
begin;

create table public.invitation_engagement_snapshots (
  id bigint generated always as identity primary key,
  event_id uuid references public.events (id) on delete set null,
  event_type text not null,
  snapshot_kind text not null check (snapshot_kind in ('rolling', 'final')),
  metrics_version smallint not null default 1 check (metrics_version >= 1),
  computed_at timestamptz not null default now(),
  guests_total integer not null check (guests_total >= 0),
  guests_shared integer not null check (guests_shared >= 0),
  guests_opened integer not null check (guests_opened >= 0),
  guests_responded integer not null check (guests_responded >= 0),
  opens_total integer not null check (opens_total >= 0),
  open_rate numeric(5, 4),
  completion_rate numeric(5, 4),
  rsvp_conversion numeric(5, 4),
  reopen_ratio numeric(8, 4),
  median_seconds_to_open numeric,
  median_seconds_to_respond numeric,
  mobile_share numeric(5, 4),
  share_lead_days integer,
  reminder_coverage numeric(5, 4),
  design jsonb,
  design_schema_version smallint,
  constraint invitation_engagement_snapshots_event_kind_key unique (event_id, snapshot_kind)
);

revoke all on table public.invitation_engagement_snapshots from public, anon, authenticated, service_role;
alter table public.invitation_engagement_snapshots enable row level security;
alter table public.invitation_engagement_snapshots force row level security;
create index invitation_engagement_snapshots_type_idx on public.invitation_engagement_snapshots (event_type, snapshot_kind);

-- Events that need a snapshot now: rolling for recent ledger activity or for
-- events about to be anonymized with a stale snapshot, final once the event date
-- is at least seven days past and no final snapshot exists.
create function public.list_engagement_snapshot_candidates()
returns table (event_id uuid, invitation_project_id uuid, snapshot_kind text)
language sql
stable
security definer
set search_path = ''
as $function$
  with activity as (
    select l.event_id, max(l.received_at) as newest
    from public.guest_engagement_events l
    group by l.event_id
  ),
  latest as (
    select s.event_id, max(s.computed_at) as computed_at
    from public.invitation_engagement_snapshots s
    where s.event_id is not null
    group by s.event_id
  )
  select e.id, e.invitation_project_id, 'rolling'::text
  from public.events e
  join activity a on a.event_id = e.id
  left join latest s on s.event_id = e.id
  where e.deleted_at is null
    and (s.computed_at is null or s.computed_at < a.newest)
  union all
  select e.id, e.invitation_project_id, 'final'::text
  from public.events e
  where e.deleted_at is null
    and e.event_date is not null
    and e.event_date <= current_date - 7
    and exists (select 1 from public.guest_engagement_events l where l.event_id = e.id)
    and not exists (
      select 1 from public.invitation_engagement_snapshots s
      where s.event_id = e.id and s.snapshot_kind = 'final'
    );
$function$;

revoke all on function public.list_engagement_snapshot_candidates() from public, anon, authenticated, service_role;
grant execute on function public.list_engagement_snapshot_candidates() to service_role;

-- Computes the snapshot from guest projections (guests only, test guests
-- excluded) and the ledger (device mix). Rolling rows are replaced; a final row
-- is written once and never changed.
create function public.compute_invitation_engagement_snapshot(
  p_event_id uuid,
  p_kind text,
  p_design jsonb default null,
  p_design_schema_version smallint default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event public.events%rowtype;
  v_row public.invitation_engagement_snapshots%rowtype;
  v_rows integer;
begin
  if p_kind not in ('rolling', 'final') then
    raise exception using errcode = '22023', message = 'engagement_snapshot_kind_invalid';
  end if;
  select * into v_event from public.events where id = p_event_id and deleted_at is null;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  with guests as (
    select
      gi.*,
      (gi.delivery_status = 'shared' or gi.open_count > 0 or gi.attendance_status <> 'pending') as reached
    from public.guest_invitations gi
    where gi.event_id = p_event_id and gi.deleted_at is null and not gi.is_test
  ),
  totals as (
    select
      count(*)::int as guests_total,
      count(*) filter (where reached)::int as guests_shared,
      count(*) filter (where open_count > 0)::int as guests_opened,
      count(*) filter (where attendance_status <> 'pending')::int as guests_responded,
      count(*) filter (where open_count > 0 and attendance_status <> 'pending')::int as opened_responded,
      count(*) filter (where max_progress_milestone = 100)::int as guests_completed,
      coalesce(sum(open_count), 0)::int as opens_total,
      count(*) filter (where reached and last_reminder_sent_at is not null)::int as guests_reminded,
      percentile_cont(0.5) within group (order by extract(epoch from first_opened_at - first_shared_at))
        filter (where first_opened_at >= first_shared_at) as median_open,
      percentile_cont(0.5) within group (order by extract(epoch from responded_at - first_opened_at))
        filter (where responded_at >= first_opened_at) as median_respond,
      percentile_cont(0.5) within group (order by first_shared_at::date - date '2000-01-01')
        filter (where first_shared_at is not null) as median_share_day
    from guests
  ),
  devices as (
    select
      count(*) filter (where l.device_class = 'mobile')::numeric as mobile_opens,
      count(*)::numeric as opens
    from public.guest_engagement_events l
    where l.event_id = p_event_id and l.event_name = 'invitation_opened' and l.traffic_class = 'guest'
  )
  select
    null, p_event_id, v_event.event_type, p_kind, 1, now(),
    t.guests_total, t.guests_shared, t.guests_opened, t.guests_responded, t.opens_total,
    case when t.guests_shared > 0 then round(t.guests_opened::numeric / t.guests_shared, 4) end,
    case when t.guests_opened > 0 then round(t.guests_completed::numeric / t.guests_opened, 4) end,
    case when t.guests_opened > 0 then round(t.opened_responded::numeric / t.guests_opened, 4) end,
    case when t.guests_opened > 0 then round(t.opens_total::numeric / t.guests_opened, 4) end,
    t.median_open, t.median_respond,
    case when d.opens > 0 then round(d.mobile_opens / d.opens, 4) end,
    case when v_event.event_date is not null and t.median_share_day is not null
      then v_event.event_date - (date '2000-01-01' + round(t.median_share_day)::int) end,
    case when t.guests_shared > 0 then round(t.guests_reminded::numeric / t.guests_shared, 4) end,
    p_design, case when p_design is null then null else coalesce(p_design_schema_version, 1::smallint) end
  into v_row
  from totals t cross join devices d;

  if p_kind = 'rolling' then
    insert into public.invitation_engagement_snapshots (
      event_id, event_type, snapshot_kind, metrics_version, computed_at, guests_total, guests_shared,
      guests_opened, guests_responded, opens_total, open_rate, completion_rate, rsvp_conversion,
      reopen_ratio, median_seconds_to_open, median_seconds_to_respond, mobile_share, share_lead_days,
      reminder_coverage, design, design_schema_version
    ) values (
      v_row.event_id, v_row.event_type, v_row.snapshot_kind, v_row.metrics_version, v_row.computed_at,
      v_row.guests_total, v_row.guests_shared, v_row.guests_opened, v_row.guests_responded,
      v_row.opens_total, v_row.open_rate, v_row.completion_rate, v_row.rsvp_conversion,
      v_row.reopen_ratio, v_row.median_seconds_to_open, v_row.median_seconds_to_respond,
      v_row.mobile_share, v_row.share_lead_days, v_row.reminder_coverage, v_row.design,
      v_row.design_schema_version
    )
    on conflict (event_id, snapshot_kind) do update set
      event_type = excluded.event_type, metrics_version = excluded.metrics_version,
      computed_at = excluded.computed_at, guests_total = excluded.guests_total,
      guests_shared = excluded.guests_shared, guests_opened = excluded.guests_opened,
      guests_responded = excluded.guests_responded, opens_total = excluded.opens_total,
      open_rate = excluded.open_rate, completion_rate = excluded.completion_rate,
      rsvp_conversion = excluded.rsvp_conversion, reopen_ratio = excluded.reopen_ratio,
      median_seconds_to_open = excluded.median_seconds_to_open,
      median_seconds_to_respond = excluded.median_seconds_to_respond,
      mobile_share = excluded.mobile_share, share_lead_days = excluded.share_lead_days,
      reminder_coverage = excluded.reminder_coverage,
      design = coalesce(excluded.design, invitation_engagement_snapshots.design),
      design_schema_version = coalesce(excluded.design_schema_version, invitation_engagement_snapshots.design_schema_version);
    get diagnostics v_rows = row_count;
  else
    insert into public.invitation_engagement_snapshots (
      event_id, event_type, snapshot_kind, metrics_version, computed_at, guests_total, guests_shared,
      guests_opened, guests_responded, opens_total, open_rate, completion_rate, rsvp_conversion,
      reopen_ratio, median_seconds_to_open, median_seconds_to_respond, mobile_share, share_lead_days,
      reminder_coverage, design, design_schema_version
    ) values (
      v_row.event_id, v_row.event_type, v_row.snapshot_kind, v_row.metrics_version, v_row.computed_at,
      v_row.guests_total, v_row.guests_shared, v_row.guests_opened, v_row.guests_responded,
      v_row.opens_total, v_row.open_rate, v_row.completion_rate, v_row.rsvp_conversion,
      v_row.reopen_ratio, v_row.median_seconds_to_open, v_row.median_seconds_to_respond,
      v_row.mobile_share, v_row.share_lead_days, v_row.reminder_coverage, v_row.design,
      v_row.design_schema_version
    )
    on conflict (event_id, snapshot_kind) do nothing;
    get diagnostics v_rows = row_count;
  end if;

  return jsonb_build_object('status', case when v_rows = 0 then 'unchanged' else 'ok' end);
end;
$function$;

revoke all on function public.compute_invitation_engagement_snapshot(uuid, text, jsonb, smallint) from public, anon, authenticated, service_role;
grant execute on function public.compute_invitation_engagement_snapshot(uuid, text, jsonb, smallint) to service_role;

-- Clears the guest link of ledger rows past retention: events.event_date + 180
-- days, or the newest event of the invitation + 180 days when the date is
-- unknown. Skips invitations whose latest snapshot predates their newest row.
create function public.anonymize_guest_engagement_events(p_batch integer default 1000)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_rows integer;
begin
  if p_batch is null or p_batch < 1 or p_batch > 10000 then
    raise exception using errcode = '22023', message = 'engagement_anonymize_batch_invalid';
  end if;

  with per_event as (
    select l.event_id, max(l.received_at) as newest, max(l.occurred_at) as newest_occurred
    from public.guest_engagement_events l
    where l.guest_invitation_id is not null
    group by l.event_id
  ),
  eligible as (
    select p.event_id
    from per_event p
    join public.events e on e.id = p.event_id
    where coalesce(e.event_date, p.newest_occurred::date) + 180 <= current_date
      and exists (
        select 1 from public.invitation_engagement_snapshots s
        where s.event_id = p.event_id and s.computed_at >= p.newest
      )
  ),
  batch as (
    select l.id
    from public.guest_engagement_events l
    join eligible el on el.event_id = l.event_id
    where l.guest_invitation_id is not null
    order by l.id
    limit p_batch
    for update of l skip locked
  )
  update public.guest_engagement_events l
  set guest_invitation_id = null, anonymized_at = now()
  from batch
  where l.id = batch.id;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

revoke all on function public.anonymize_guest_engagement_events(integer) from public, anon, authenticated, service_role;
grant execute on function public.anonymize_guest_engagement_events(integer) to service_role;

-- Snapshots: read-only for the service role; writes only through the function.
grant select on table public.invitation_engagement_snapshots to service_role;
create policy invitation_engagement_snapshots_service_select on public.invitation_engagement_snapshots
  for select to service_role using (true);

comment on table public.invitation_engagement_snapshots is 'Permanent per-invitation engagement aggregates and design attributes (no guest data). Spec: docs/domains/rsvp/engagement-analytics.md';

commit;
