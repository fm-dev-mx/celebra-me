-- Historical engagement estimates (expand). Spec: docs/domains/rsvp/engagement-analytics.md
-- (sections Confidence levels and Historical estimate).
--
-- Legacy telemetry recorded before the guest engagement ledger existed is cleaned once into
-- one row per event and method version. Rows hold per-event aggregates only (no guest data)
-- and are never ranked against measured figures. Method version 1:
--   * cutoff: 2026-10-12 16:25:00+00, just before the first ledger event; from then on the
--     ledger also writes `viewed` audit rows, so later rows are measured traffic, not legacy;
--   * a `viewed` audit row counts when it is at least 2 minutes after the guest's
--     first_shared_at (earlier rows are host review or chat link previews);
--   * a guest counts as opened when ANY row counts, not only the first one;
--   * guests without first_shared_at are counted apart and stay out of every bound;
--   * visits are counted rows sessionized per guest with the 30-minute rule;
--   * legacy view_percentage is not used: it is saturated at 100 % and does not track
--     measured depth (validation report of 2026-10-17).
--
-- Statement order matters for scripts/db/migration-sql-risk.ts: every created object is
-- initialized (revoke/grant) before the first non-initialization statement of the transaction.
begin;

create table public.invitation_engagement_historical_estimates (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  event_type text not null,
  method_version smallint not null check (method_version >= 1),
  computed_at timestamptz not null default now(),
  guests_total integer not null check (guests_total >= 0),
  guests_shared integer not null check (guests_shared >= 0),
  guests_viewed integer not null check (guests_viewed >= 0),
  guests_responded_self integer not null check (guests_responded_self >= 0),
  opened_lower integer not null check (opened_lower >= 0),
  opened_upper integer not null check (opened_upper >= opened_lower),
  visits_estimate integer not null check (visits_estimate >= 0),
  visits_per_viewer numeric(8, 2),
  conversion_lower numeric(5, 4),
  views_counted integer not null check (views_counted >= 0),
  views_before_share integer not null check (views_before_share >= 0),
  views_within_preview_window integer not null check (views_within_preview_window >= 0),
  guests_unshared integer not null check (guests_unshared >= 0),
  guests_unshared_viewed integer not null check (guests_unshared_viewed >= 0),
  guests_unshared_responded_self integer not null check (guests_unshared_responded_self >= 0),
  constraint invitation_engagement_historical_estimates_event_version_key unique (event_id, method_version)
);

revoke all on table public.invitation_engagement_historical_estimates from public, anon, authenticated, service_role;
alter table public.invitation_engagement_historical_estimates enable row level security;
alter table public.invitation_engagement_historical_estimates force row level security;

-- Computes every row of one method version once; a version that already has rows is a no-op.
create function public.compute_engagement_historical_estimates(p_method_version smallint)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cutoff constant timestamptz := timestamptz '2026-10-12 16:25:00+00';
  v_preview_window constant interval := interval '2 minutes';
  v_visit_gap constant interval := interval '30 minutes';
  v_rows integer;
begin
  if p_method_version is distinct from 1 then
    raise exception 'unsupported historical estimate method version: %', p_method_version
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.invitation_engagement_historical_estimates h
    where h.method_version = p_method_version
  ) then
    return 0;
  end if;

  insert into public.invitation_engagement_historical_estimates (
    event_id, event_type, method_version, guests_total, guests_shared, guests_viewed,
    guests_responded_self, opened_lower, opened_upper, visits_estimate, visits_per_viewer,
    conversion_lower, views_counted, views_before_share, views_within_preview_window,
    guests_unshared, guests_unshared_viewed, guests_unshared_responded_self
  )
  with guests as (
    select
      g.id,
      g.event_id,
      g.first_shared_at,
      (g.attendance_status <> 'pending' and g.last_response_source <> 'admin'
        and coalesce(g.responded_at, v_cutoff - interval '1 second') < v_cutoff) as responded_self
    from public.guest_invitations g
    join public.events e on e.id = g.event_id and e.deleted_at is null
    where g.deleted_at is null and not g.is_test
  ),
  views as (
    select
      gs.id as guest_id,
      gs.event_id,
      a.created_at,
      case
        when gs.first_shared_at is null then 'unshared'
        when a.created_at < gs.first_shared_at then 'before_share'
        when a.created_at < gs.first_shared_at + v_preview_window then 'preview_window'
        else 'counted'
      end as view_class
    from public.guest_invitation_audit a
    join guests gs on gs.id = a.guest_invitation_id
    where a.event_type = 'viewed' and a.created_at < v_cutoff
  ),
  visits as (
    select v.guest_id, count(*)::int as visits
    from (
      select
        guest_id,
        created_at - lag(created_at) over (partition by guest_id order by created_at) as gap
      from views
      where view_class = 'counted'
    ) v
    where v.gap is null or v.gap >= v_visit_gap
    group by v.guest_id
  ),
  per_guest as (
    select
      gs.event_id,
      gs.first_shared_at is not null as shared,
      gs.responded_self,
      vi.guest_id is not null as viewed,
      coalesce(vi.visits, 0) as visits,
      exists (select 1 from views v where v.guest_id = gs.id and v.view_class = 'unshared') as unshared_viewed
    from guests gs
    left join visits vi on vi.guest_id = gs.id
  ),
  per_event as (
    select
      pg.event_id,
      count(*)::int as guests_total,
      count(*) filter (where shared)::int as guests_shared,
      count(*) filter (where shared and viewed)::int as guests_viewed,
      count(*) filter (where shared and responded_self)::int as guests_responded_self,
      count(*) filter (where shared and (viewed or responded_self))::int as opened_upper,
      coalesce(sum(visits) filter (where shared), 0)::int as visits_estimate,
      count(*) filter (where not shared)::int as guests_unshared,
      count(*) filter (where not shared and unshared_viewed)::int as guests_unshared_viewed,
      count(*) filter (where not shared and responded_self)::int as guests_unshared_responded_self
    from per_guest pg
    group by pg.event_id
  ),
  view_counts as (
    select
      v.event_id,
      count(*) filter (where view_class = 'counted')::int as views_counted,
      count(*) filter (where view_class = 'before_share')::int as views_before_share,
      count(*) filter (where view_class = 'preview_window')::int as views_within_preview_window
    from views v
    group by v.event_id
  )
  select
    pe.event_id,
    e.event_type,
    p_method_version,
    pe.guests_total,
    pe.guests_shared,
    pe.guests_viewed,
    pe.guests_responded_self,
    pe.guests_responded_self,
    pe.opened_upper,
    pe.visits_estimate,
    case when pe.guests_viewed > 0 then round(pe.visits_estimate::numeric / pe.guests_viewed, 2) end,
    case when pe.opened_upper > 0 then round(pe.guests_responded_self::numeric / pe.opened_upper, 4) end,
    coalesce(vc.views_counted, 0),
    coalesce(vc.views_before_share, 0),
    coalesce(vc.views_within_preview_window, 0),
    pe.guests_unshared,
    pe.guests_unshared_viewed,
    pe.guests_unshared_responded_self
  from per_event pe
  join public.events e on e.id = pe.event_id
  left join view_counts vc on vc.event_id = pe.event_id
  where pe.guests_shared > 0 or coalesce(vc.views_counted, 0) + coalesce(vc.views_before_share, 0) > 0
    or pe.guests_unshared_viewed > 0;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

revoke all on function public.compute_engagement_historical_estimates(smallint) from public, anon, authenticated, service_role;
grant execute on function public.compute_engagement_historical_estimates(smallint) to service_role;

-- Admin read routine: estimates of every published client invitation (same coverage as the
-- ranking v2 routine). Aggregates per invitation only.
create function public.list_engagement_historical_estimates(
  p_event_type text default null,
  p_method_version smallint default 1
) returns table (
  invitation_id uuid,
  event_id uuid,
  title text,
  slug text,
  event_type text,
  event_date date,
  method_version smallint,
  computed_at timestamptz,
  guests_total integer,
  guests_shared integer,
  guests_viewed integer,
  guests_responded_self integer,
  opened_lower integer,
  opened_upper integer,
  visits_estimate integer,
  visits_per_viewer numeric,
  conversion_lower numeric,
  views_counted integer,
  views_before_share integer,
  views_within_preview_window integer,
  guests_unshared integer,
  guests_unshared_viewed integer,
  guests_unshared_responded_self integer
)
language sql
security definer
set search_path = public
stable
as $function$
  select
    i.id,
    e.id,
    coalesce(e.title, i.slug),
    i.slug,
    i.event_type,
    e.event_date,
    h.method_version,
    h.computed_at,
    h.guests_total,
    h.guests_shared,
    h.guests_viewed,
    h.guests_responded_self,
    h.opened_lower,
    h.opened_upper,
    h.visits_estimate,
    h.visits_per_viewer,
    h.conversion_lower,
    h.views_counted,
    h.views_before_share,
    h.views_within_preview_window,
    h.guests_unshared,
    h.guests_unshared_viewed,
    h.guests_unshared_responded_self
  from public.invitations i
  join public.events e on e.invitation_project_id = i.id and e.deleted_at is null
  join public.invitation_engagement_historical_estimates h
    on h.event_id = e.id and h.method_version = p_method_version
  where i.kind = 'client'
    and i.archived_at is null
    and exists (
      select 1 from public.published_invitation_content p
      where p.invitation_project_id = i.id and p.deleted_at is null
    )
    and (p_event_type is null or i.event_type = p_event_type)
  order by i.event_type, i.slug;
$function$;

revoke all on function public.list_engagement_historical_estimates(text, smallint) from public, anon, authenticated, service_role;
grant execute on function public.list_engagement_historical_estimates(text, smallint) to service_role;

-- Estimates: read-only for the service role; writes only through the compute function.
grant select on table public.invitation_engagement_historical_estimates to service_role;
create policy invitation_engagement_historical_estimates_service_select
  on public.invitation_engagement_historical_estimates
  for select to service_role using (true);

comment on table public.invitation_engagement_historical_estimates is 'Per-event estimates from legacy telemetry before the engagement ledger, frozen per method version (no guest data). Spec: docs/domains/rsvp/engagement-analytics.md';

select public.compute_engagement_historical_estimates(1::smallint);

commit;
