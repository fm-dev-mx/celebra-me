-- Engagement ranking v2 (phase 2.1): every published client invitation, with
-- confidence levels. Spec: docs/domains/rsvp/engagement-analytics.md
-- (sections Confidence levels and Ranking query v2).
--
-- Inferred figures are computed live from guest projections, so invitations
-- without ledger activity are still listed with exact response counts. Ledger
-- metrics (completion, opens, devices, medians) come from the chosen snapshot,
-- final over rolling. Snapshots are not modified. Only aggregates per
-- invitation leave the function, and execute is granted to service_role only.
--
-- Statement order matters for scripts/db/migration-sql-risk.ts: the function
-- is initialized (revoke/grant) inside the same transaction right after creation.
begin;

create function public.list_invitation_engagement_ranking_v2(
  p_event_type text default null
) returns table (
  invitation_id uuid,
  event_id uuid,
  title text,
  slug text,
  event_type text,
  event_date date,
  event_status text,
  activity_state text,
  public_access text,
  confirmation_mode text,
  design jsonb,
  snapshot_kind text,
  computed_at timestamptz,
  guests_total integer,
  guests_shared integer,
  guests_responded integer,
  guests_responded_self integer,
  guests_opened integer,
  guests_opened_inferred integer,
  response_rate numeric,
  conversion_upper numeric,
  open_rate numeric,
  completion_rate numeric,
  reopen_ratio numeric,
  median_seconds_to_open numeric,
  median_seconds_to_respond numeric,
  mobile_share numeric,
  share_lead_days integer,
  reminder_coverage numeric,
  sample_state text
)
language plpgsql
security definer
set search_path = public
stable
as $function$
begin
  return query
  with published as (
    select
      i.id as invitation_id,
      i.slug,
      i.event_type,
      pub.content
    from public.invitations i
    join lateral (
      select p.content
      from public.published_invitation_content p
      where p.invitation_project_id = i.id and p.deleted_at is null
      order by p.version desc
      limit 1
    ) pub on true
    where i.kind = 'client'
      and i.archived_at is null
      and (p_event_type is null or i.event_type = p_event_type)
  ),
  guests as (
    select
      e.id as event_id,
      count(*) filter (where not g.is_test)::int as guests_total,
      count(*) filter (where not g.is_test and (
        g.delivery_status = 'shared' or g.open_count > 0 or g.attendance_status <> 'pending'
      ))::int as guests_shared,
      count(*) filter (where not g.is_test and g.attendance_status <> 'pending')::int as guests_responded,
      count(*) filter (where not g.is_test and g.attendance_status <> 'pending'
        and g.last_response_source <> 'admin')::int as guests_responded_self,
      count(*) filter (where not g.is_test and g.open_count > 0)::int as guests_opened,
      count(*) filter (where not g.is_test and (
        g.open_count > 0 or (g.attendance_status <> 'pending' and g.last_response_source <> 'admin')
      ))::int as guests_opened_inferred,
      count(*) filter (where not g.is_test and g.last_reminder_sent_at is not null and (
        g.delivery_status = 'shared' or g.open_count > 0 or g.attendance_status <> 'pending'
      ))::int as guests_reminded,
      percentile_cont(0.5) within group (order by g.first_shared_at::date - date '2000-01-01')
        filter (where not g.is_test and g.first_shared_at is not null) as median_share_day
    from public.events e
    join public.guest_invitations g on g.event_id = e.id and g.deleted_at is null
    where e.deleted_at is null
    group by e.id
  ),
  snapshots as (
    select distinct on (s.event_id) s.*
    from public.invitation_engagement_snapshots s
    where s.event_id is not null and s.metrics_version = 1
    order by s.event_id, (s.snapshot_kind = 'final') desc, s.computed_at desc
  )
  select
    pb.invitation_id,
    e.id,
    coalesce(e.title, pb.slug),
    pb.slug,
    pb.event_type,
    e.event_date,
    case
      when e.event_date is null then 'unknown'
      when e.event_date >= (now() at time zone 'America/Chihuahua')::date then 'upcoming'
      else 'past'
    end,
    case when s.event_id is null then 'none' else 'measured' end,
    coalesce(ac.public_access, 'enabled'),
    coalesce(nullif(pb.content #>> '{rsvp,confirmationMode}', ''), 'api'),
    coalesce(
      s.design,
      jsonb_build_object(
        'themePreset', pb.content #>> '{theme,preset}',
        'fontFamily', pb.content #>> '{theme,fontFamily}',
        'templateId', pb.content ->> 'templateId',
        'visualProfileId', pb.content ->> 'visualProfileId',
        'personalizedAccessVariant', pb.content #>> '{rsvp,personalizedAccess,variant}',
        'music', jsonb_build_object(
          'enabled', nullif(pb.content #>> '{music,url}', '') is not null,
          'autoPlay', coalesce(pb.content #>> '{music,autoPlay}', '') = 'true'
        ),
        'rsvp', jsonb_build_object(
          'accessMode', pb.content #>> '{rsvp,accessMode}',
          'confirmationMode', pb.content #>> '{rsvp,confirmationMode}'
        )
      )
    ),
    s.snapshot_kind,
    s.computed_at,
    coalesce(gs.guests_total, 0),
    coalesce(gs.guests_shared, 0),
    coalesce(gs.guests_responded, 0),
    coalesce(gs.guests_responded_self, 0),
    coalesce(gs.guests_opened, 0),
    coalesce(gs.guests_opened_inferred, 0),
    case when coalesce(gs.guests_shared, 0) > 0
      then round(gs.guests_responded_self::numeric / gs.guests_shared, 4) end,
    case when coalesce(gs.guests_opened_inferred, 0) > 0
      then round(gs.guests_responded_self::numeric / gs.guests_opened_inferred, 4) end,
    s.open_rate::numeric,
    s.completion_rate::numeric,
    s.reopen_ratio::numeric,
    s.median_seconds_to_open,
    s.median_seconds_to_respond,
    s.mobile_share::numeric,
    case when e.event_date is not null and gs.median_share_day is not null
      then e.event_date - (date '2000-01-01' + round(gs.median_share_day)::int) end,
    case when coalesce(gs.guests_shared, 0) > 0
      then round(gs.guests_reminded::numeric / gs.guests_shared, 4) end,
    case when coalesce(gs.guests_shared, 0) >= 20 then 'eligible' else 'insufficient' end
  from published pb
  left join public.events e on e.invitation_project_id = pb.invitation_id and e.deleted_at is null
  left join guests gs on gs.event_id = e.id
  left join snapshots s on s.event_id = e.id
  left join public.invitation_access_controls ac on ac.invitation_id = pb.invitation_id
  order by pb.event_type, pb.slug;
end;
$function$;

revoke all on function public.list_invitation_engagement_ranking_v2(text) from public, anon, authenticated, service_role;
grant execute on function public.list_invitation_engagement_ranking_v2(text) to service_role;

commit;
