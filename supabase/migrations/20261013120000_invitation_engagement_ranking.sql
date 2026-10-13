-- Invitation engagement ranking (phase 2): one read-only routine over the
-- permanent snapshots that applies the comparison rules of
-- docs/domains/rsvp/engagement-analytics.md in the database, so every consumer
-- ranks on the same sample. Execute is granted to service_role only: the admin
-- API calls it with a strong session, hosts never reach it.
--
-- Rules applied here:
--   * same event type only (p_event_type),
--   * one snapshot per event, final preferred over rolling,
--   * sample_state = eligible when guests_shared >= 20, insufficient otherwise,
--   * group sizes per design key, counting eligible rows separately so the app
--     can withhold ranks from groups with fewer than 5 eligible invitations.
-- Ranks and medians are computed by the application from these rows.
--
-- Statement order matters for scripts/db/migration-sql-risk.ts: the function is
-- initialized (revoke/grant) inside the same transaction right after creation.
begin;

create function public.list_invitation_engagement_ranking(
  p_event_type text,
  p_group_key text default 'themePreset'
) returns table (
  event_id uuid,
  invitation_project_id uuid,
  title text,
  slug text,
  event_type text,
  event_date date,
  event_deleted boolean,
  snapshot_kind text,
  computed_at timestamptz,
  metrics_version smallint,
  guests_total integer,
  guests_shared integer,
  guests_opened integer,
  guests_responded integer,
  opens_total integer,
  open_rate numeric,
  completion_rate numeric,
  rsvp_conversion numeric,
  reopen_ratio numeric,
  median_seconds_to_open numeric,
  median_seconds_to_respond numeric,
  mobile_share numeric,
  share_lead_days integer,
  reminder_coverage numeric,
  design jsonb,
  design_schema_version smallint,
  group_value text,
  sample_state text,
  group_size integer,
  group_eligible integer
)
language plpgsql
security definer
set search_path = public
stable
as $function$
declare
  v_group_path text[];
begin
  if p_event_type is null or btrim(p_event_type) = '' then
    raise exception 'event type is required' using errcode = '22023';
  end if;

  v_group_path := case p_group_key
    when 'themePreset' then array['themePreset']
    when 'templateId' then array['templateId']
    when 'fontFamily' then array['fontFamily']
    when 'visualProfileId' then array['visualProfileId']
    when 'personalizedAccessVariant' then array['personalizedAccessVariant']
    when 'rsvpConfirmationMode' then array['rsvp', 'confirmationMode']
    when 'rsvpAccessMode' then array['rsvp', 'accessMode']
    when 'musicEnabled' then array['music', 'enabled']
    else null
  end;
  if v_group_path is null then
    raise exception 'unknown ranking group key: %', p_group_key using errcode = '22023';
  end if;

  return query
  with chosen as (
    select s.*
    from public.invitation_engagement_snapshots s
    where s.event_type = p_event_type
      and s.metrics_version = 1
  ),
  -- One row per event: the final snapshot wins; rows without an event (the
  -- event was deleted) are kept as their own group members.
  per_event as (
    select c.*
    from chosen c
    where c.event_id is null
       or c.snapshot_kind = 'final'
       or not exists (
         select 1 from chosen f
         where f.event_id = c.event_id and f.snapshot_kind = 'final'
       )
  ),
  labelled as (
    select
      p.event_id,
      e.invitation_project_id,
      e.title,
      e.slug,
      p.event_type,
      e.event_date,
      (p.event_id is null or e.id is null or e.deleted_at is not null) as event_deleted,
      p.snapshot_kind,
      p.computed_at,
      p.metrics_version,
      p.guests_total,
      p.guests_shared,
      p.guests_opened,
      p.guests_responded,
      p.opens_total,
      p.open_rate::numeric,
      p.completion_rate::numeric,
      p.rsvp_conversion::numeric,
      p.reopen_ratio::numeric,
      p.median_seconds_to_open,
      p.median_seconds_to_respond,
      p.mobile_share::numeric,
      p.share_lead_days,
      p.reminder_coverage::numeric,
      p.design,
      p.design_schema_version,
      nullif(btrim(p.design #>> v_group_path), '') as group_value,
      case when p.guests_shared >= 20 then 'eligible' else 'insufficient' end as sample_state
    from per_event p
    left join public.events e on e.id = p.event_id
  )
  select
    l.event_id,
    l.invitation_project_id,
    l.title,
    l.slug,
    l.event_type,
    l.event_date,
    l.event_deleted,
    l.snapshot_kind,
    l.computed_at,
    l.metrics_version,
    l.guests_total,
    l.guests_shared,
    l.guests_opened,
    l.guests_responded,
    l.opens_total,
    l.open_rate,
    l.completion_rate,
    l.rsvp_conversion,
    l.reopen_ratio,
    l.median_seconds_to_open,
    l.median_seconds_to_respond,
    l.mobile_share,
    l.share_lead_days,
    l.reminder_coverage,
    l.design,
    l.design_schema_version,
    l.group_value,
    l.sample_state,
    count(*) over (partition by l.group_value)::integer as group_size,
    count(*) filter (where l.sample_state = 'eligible') over (partition by l.group_value)::integer
      as group_eligible
  from labelled l
  order by l.sample_state = 'eligible' desc, l.rsvp_conversion desc nulls last, l.computed_at desc;
end;
$function$;

revoke all on function public.list_invitation_engagement_ranking(text, text) from public, anon, authenticated, service_role;
grant execute on function public.list_invitation_engagement_ranking(text, text) to service_role;

commit;
