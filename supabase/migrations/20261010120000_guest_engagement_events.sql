-- Guest engagement analytics (expand).
-- Spec: docs/domains/rsvp/engagement-analytics.md
--
-- Adds the append-only guest engagement ledger, per-guest projections, the
-- test-guest flag, events.event_date (derived from published content), the
-- service-role ingestion RPC, the host summary RPC, and stops the guest audit
-- trigger from writing one `viewed` row per view call.
--
-- Statement order matters for scripts/db/migration-sql-risk.ts: every created
-- object is initialized (revoke/grant) before the first non-initialization
-- statement of the transaction.
begin;

create table public.guest_engagement_events (
  id bigint generated always as identity primary key,
  client_event_id uuid not null unique,
  guest_invitation_id uuid references public.guest_invitations (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  schema_version smallint not null default 1 check (schema_version = 1),
  event_name text not null check (event_name in (
    'invitation_link_previewed', 'invitation_opened', 'invitation_progressed',
    'rsvp_form_viewed', 'rsvp_form_started', 'rsvp_submitted'
  )),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  page_view_id uuid,
  traffic_class text not null check (traffic_class in ('guest', 'host', 'test', 'bot', 'non_production')),
  device_class text not null default 'unknown' check (device_class in ('mobile', 'tablet', 'desktop', 'unknown')),
  properties jsonb not null default '{}'::jsonb,
  anonymized_at timestamptz,
  constraint guest_engagement_events_anonymization_check
    check ((guest_invitation_id is null) = (anonymized_at is not null)),
  constraint guest_engagement_events_page_view_check
    check (event_name in ('invitation_link_previewed', 'rsvp_submitted') or page_view_id is not null)
);

revoke all on table public.guest_engagement_events from public, anon, authenticated, service_role;
alter table public.guest_engagement_events enable row level security;
alter table public.guest_engagement_events force row level security;
create index guest_engagement_events_guest_idx on public.guest_engagement_events (guest_invitation_id, occurred_at desc);
create index guest_engagement_events_event_idx on public.guest_engagement_events (event_id, event_name, occurred_at);

-- Closed per-event property schema (taxonomy v1). Immutable so it can back a
-- check constraint.
create function public.guest_engagement_properties_valid(p_event_name text, p_properties jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_keys text[];
begin
  if p_properties is null or jsonb_typeof(p_properties) <> 'object' then
    return false;
  end if;
  select coalesce(array_agg(k order by k), '{}'::text[]) into v_keys
  from jsonb_object_keys(p_properties) as k;

  return case p_event_name
    when 'invitation_link_previewed' then
      v_keys = array['crawler_family']
      and p_properties ->> 'crawler_family' in ('whatsapp', 'facebook', 'telegram', 'other')
    when 'invitation_opened' then
      v_keys = array['entry', 'is_reload']
      and p_properties ->> 'entry' in ('short_link', 'direct')
      and jsonb_typeof(p_properties -> 'is_reload') = 'boolean'
    when 'invitation_progressed' then
      v_keys = array['milestone']
      and jsonb_typeof(p_properties -> 'milestone') = 'number'
      and p_properties ->> 'milestone' in ('25', '50', '75', '100')
    when 'rsvp_form_viewed' then v_keys = '{}'::text[]
    when 'rsvp_form_started' then v_keys = '{}'::text[]
    when 'rsvp_submitted' then
      v_keys = array['attendance_status']
      and p_properties ->> 'attendance_status' in ('confirmed', 'declined')
    else false
  end;
end;
$function$;

revoke all on function public.guest_engagement_properties_valid(text, jsonb) from public, anon, authenticated, service_role;

-- Event-local date of an invitation, mirroring resolveInvitationSchedule
-- (src/lib/intake/invitation-validity.ts): eventTiming.localDateTime, then
-- eventTiming.startsAtUtc in the event zone, then the legacy floating hero.date.
-- Returns null for malformed or missing data; never raises.
create function public.invitation_event_date(p_content jsonb)
returns date
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_timing jsonb := '{}'::jsonb;
  v_zone_value jsonb;
  v_zone text;
  v_zone_valid boolean := false;
  v_effective_zone text := 'America/Chihuahua';
  v_text text;
  v_date date;
begin
  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    return null;
  end if;
  if jsonb_typeof(p_content -> 'eventTiming') = 'object' then
    v_timing := p_content -> 'eventTiming';
  end if;

  v_zone_value := v_timing -> 'timeZone';
  if jsonb_typeof(v_zone_value) = 'string' then
    v_zone := v_zone_value #>> '{}';
    v_zone_valid := v_zone <> '' and v_zone = btrim(v_zone) and position('/' in v_zone) > 0
      and exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = v_zone);
  end if;
  if v_zone_valid then
    v_effective_zone := v_zone;
  end if;

  begin
    if v_timing ? 'localDateTime' and jsonb_typeof(v_timing -> 'localDateTime') <> 'null' then
      v_text := btrim(v_timing ->> 'localDateTime');
      if jsonb_typeof(v_timing -> 'localDateTime') = 'string'
        and v_text ~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$' then
        v_date := make_date(substr(v_text, 1, 4)::int, substr(v_text, 6, 2)::int, substr(v_text, 9, 2)::int);
      end if;
    elsif v_timing ? 'startsAtUtc' and jsonb_typeof(v_timing -> 'startsAtUtc') <> 'null' then
      v_text := v_timing ->> 'startsAtUtc';
      if jsonb_typeof(v_timing -> 'startsAtUtc') = 'string'
        and v_text ~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$' then
        perform make_date(substr(v_text, 1, 4)::int, substr(v_text, 6, 2)::int, substr(v_text, 9, 2)::int);
        v_date := (v_text::timestamptz at time zone v_effective_zone)::date;
      end if;
    else
      v_text := p_content #>> '{hero,date}';
      if jsonb_typeof(p_content #> '{hero,date}') = 'string'
        and v_text ~ '^\d{4}-\d{2}-\d{2}($|T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?Z?$)' then
        v_date := make_date(substr(v_text, 1, 4)::int, substr(v_text, 6, 2)::int, substr(v_text, 9, 2)::int);
      end if;
    end if;
  exception when others then
    v_date := null;
  end;

  -- An explicit but invalid zone invalidates the date, as in the application.
  if v_zone_value is not null and jsonb_typeof(v_zone_value) <> 'null'
    and not (jsonb_typeof(v_zone_value) = 'string' and v_zone = '') and not v_zone_valid then
    return null;
  end if;
  return v_date;
end;
$function$;

revoke all on function public.invitation_event_date(jsonb) from public, anon, authenticated;
grant execute on function public.invitation_event_date(jsonb) to service_role;

-- Keeps events.event_date in step with every write of non-demo published content.
create function public.sync_event_date_from_published_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.is_demo or new.deleted_at is not null or new.invitation_project_id is null then
    return new;
  end if;
  update public.events e
  set event_date = public.invitation_event_date(new.content)
  where e.invitation_project_id = new.invitation_project_id
    and e.deleted_at is null
    and e.event_date is distinct from public.invitation_event_date(new.content);
  return new;
end;
$function$;

revoke all on function public.sync_event_date_from_published_content() from public, anon, authenticated, service_role;

-- Ingestion. The application server validates the envelope, classifies the
-- request as guest, bot, or non_production, and passes the signed-in viewer (if
-- any). The function upgrades guest traffic to host (event owner, active member,
-- super admin) or test (test guest), stores events idempotently, and updates the
-- per-guest projections from guest traffic only. Link previews update
-- last_previewed_at for any class except test guests.
create function public.record_guest_engagement_events_public(
  p_invite_id text,
  p_events jsonb,
  p_viewer_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_invite uuid;
  v_guest public.guest_invitations%rowtype;
  v_is_host boolean := false;
  v_item jsonb;
  v_name text;
  v_class text;
  v_occurred timestamptz;
  v_now timestamptz := now();
  v_rows integer;
  v_milestone smallint;
  v_accepted integer := 0;
  v_duplicates integer := 0;
  v_rejected integer := 0;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) = 0 or jsonb_array_length(p_events) > 20 then
    raise exception using errcode = '22023', message = 'engagement_batch_invalid';
  end if;

  begin
    v_invite := btrim(p_invite_id)::uuid;
  exception when invalid_text_representation or null_value_not_allowed then
    return jsonb_build_object('status', 'not_found');
  end;
  if v_invite is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select gi.* into v_guest
  from public.guest_invitations gi
  join public.events e on e.id = gi.event_id
  where gi.invite_id = v_invite and gi.deleted_at is null and e.deleted_at is null
  for update of gi;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if p_viewer_user_id is not null then
    v_is_host := exists (
        select 1 from public.events e
        where e.id = v_guest.event_id and e.owner_user_id = p_viewer_user_id
      ) or exists (
        select 1 from public.event_memberships em
        where em.event_id = v_guest.event_id and em.user_id = p_viewer_user_id and em.deleted_at is null
      ) or exists (
        select 1 from public.app_user_roles aur
        where aur.user_id = p_viewer_user_id and aur.role = 'super_admin'
      );
  end if;

  for v_item in select value from jsonb_array_elements(p_events) loop
    begin
      v_name := v_item ->> 'event_name';
      v_class := v_item ->> 'traffic_class';
      if v_class not in ('guest', 'bot', 'non_production') then
        raise exception using errcode = '23514', message = 'engagement_traffic_class_invalid';
      end if;
      if v_class = 'guest' and v_is_host then
        v_class := 'host';
      end if;
      if v_class = 'guest' and v_guest.is_test then
        v_class := 'test';
      end if;
      if not public.guest_engagement_properties_valid(v_name, coalesce(v_item -> 'properties', '{}'::jsonb)) then
        raise exception using errcode = '23514', message = 'engagement_properties_invalid';
      end if;
      v_occurred := greatest(
        least(coalesce((v_item ->> 'occurred_at')::timestamptz, v_now), v_now + interval '5 minutes'),
        v_now - interval '24 hours'
      );

      insert into public.guest_engagement_events (
        client_event_id, guest_invitation_id, event_id, schema_version, event_name,
        occurred_at, received_at, page_view_id, traffic_class, device_class, properties
      ) values (
        (v_item ->> 'client_event_id')::uuid, v_guest.id, v_guest.event_id,
        coalesce((v_item ->> 'schema_version')::smallint, 1), v_name,
        v_occurred, v_now, nullif(v_item ->> 'page_view_id', '')::uuid, v_class,
        coalesce(v_item ->> 'device_class', 'unknown'), coalesce(v_item -> 'properties', '{}'::jsonb)
      )
      on conflict (client_event_id) do nothing;
      get diagnostics v_rows = row_count;
    exception
      when check_violation or not_null_violation or invalid_text_representation
        or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
        v_rejected := v_rejected + 1;
        continue;
    end;

    if v_rows = 0 then
      v_duplicates := v_duplicates + 1;
      continue;
    end if;
    v_accepted := v_accepted + 1;

    if v_name = 'invitation_link_previewed' then
      if not v_guest.is_test then
        update public.guest_invitations
        set last_previewed_at = greatest(coalesce(last_previewed_at, v_occurred), v_occurred)
        where id = v_guest.id;
      end if;
    elsif v_class = 'guest' then
      if v_name = 'invitation_opened' then
        update public.guest_invitations
        set open_count = open_count + 1,
            first_opened_at = least(coalesce(first_opened_at, v_occurred), v_occurred),
            last_opened_at = greatest(coalesce(last_opened_at, v_occurred), v_occurred),
            first_viewed_at = coalesce(first_viewed_at, v_occurred),
            last_viewed_at = greatest(coalesce(last_viewed_at, v_occurred), v_occurred),
            is_viewed = true
        where id = v_guest.id;
      elsif v_name = 'invitation_progressed' then
        v_milestone := (v_item -> 'properties' ->> 'milestone')::smallint;
        update public.guest_invitations
        set max_progress_milestone = greatest(max_progress_milestone, v_milestone),
            view_percentage = greatest(view_percentage, v_milestone)
        where id = v_guest.id;
      elsif v_name = 'rsvp_form_viewed' then
        update public.guest_invitations
        set rsvp_form_viewed_at = least(coalesce(rsvp_form_viewed_at, v_occurred), v_occurred)
        where id = v_guest.id;
      elsif v_name = 'rsvp_form_started' then
        update public.guest_invitations
        set rsvp_form_started_at = least(coalesce(rsvp_form_started_at, v_occurred), v_occurred)
        where id = v_guest.id;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'ok',
    'accepted', v_accepted,
    'duplicates', v_duplicates,
    'rejected', v_rejected
  );
end;
$function$;

revoke all on function public.record_guest_engagement_events_public(text, jsonb, uuid) from public, anon, authenticated, service_role;
grant execute on function public.record_guest_engagement_events_public(text, jsonb, uuid) to service_role;
comment on function public.record_guest_engagement_events_public(text, jsonb, uuid) is 'Service-role-only idempotent ingestion of guest engagement events (taxonomy v1) with per-guest projections.';

-- Start of engagement tracking in this database (first ledger row).
create function public.guest_engagement_tracking_started_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $function$
  select received_at from public.guest_engagement_events order by id limit 1;
$function$;

revoke all on function public.guest_engagement_tracking_started_at() from public, anon, authenticated, service_role;
grant execute on function public.guest_engagement_tracking_started_at() to authenticated, service_role;

-- Host funnel for one event. Security invoker: guest_invitations RLS decides
-- which rows the caller sees. Reads projections only; test guests excluded.
-- plpgsql defers body validation until the projection columns exist.
create function public.get_event_engagement_summary(p_event_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  return (
  with guests as (
    select
      gi.*,
      (gi.delivery_status = 'shared' or gi.open_count > 0 or gi.attendance_status <> 'pending') as reached
    from public.guest_invitations gi
    where gi.event_id = p_event_id and gi.deleted_at is null and not gi.is_test
  )
  select jsonb_build_object(
    'guests', count(*),
    'shared', count(*) filter (where reached),
    'previewed', count(*) filter (where reached and last_previewed_at is not null),
    'opened', count(*) filter (where reached and open_count > 0),
    'formViewed', count(*) filter (where reached and open_count > 0 and rsvp_form_viewed_at is not null),
    'formStarted', count(*) filter (
      where reached and open_count > 0 and rsvp_form_viewed_at is not null and rsvp_form_started_at is not null
    ),
    'responded', count(*) filter (
      where reached and open_count > 0 and rsvp_form_viewed_at is not null
        and rsvp_form_started_at is not null and attendance_status <> 'pending'
    ),
    'openedNotResponded', count(*) filter (where open_count > 0 and attendance_status = 'pending'),
    'medianSecondsToOpen', percentile_cont(0.5) within group (
      order by extract(epoch from first_opened_at - first_shared_at)
    ) filter (where first_opened_at >= first_shared_at),
    'trackingStartedAt', public.guest_engagement_tracking_started_at()
  )
  from guests
  );
end;
$function$;

revoke all on function public.get_event_engagement_summary(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_event_engagement_summary(uuid) to authenticated, service_role;

-- Ledger privileges: append-only for the service role; no client access.
grant select, insert on table public.guest_engagement_events to service_role;
create policy guest_engagement_events_service_select on public.guest_engagement_events
  for select to service_role using (true);
create policy guest_engagement_events_service_insert on public.guest_engagement_events
  for insert to service_role with check (true);

alter table public.guest_engagement_events
  add constraint guest_engagement_events_properties_check
  check (public.guest_engagement_properties_valid(event_name, properties));

-- Per-guest projections and the test-guest flag.
alter table public.guest_invitations
  add column is_test boolean not null default false,
  add column open_count integer not null default 0 check (open_count >= 0),
  add column first_opened_at timestamptz,
  add column last_opened_at timestamptz,
  add column last_previewed_at timestamptz,
  add column max_progress_milestone smallint not null default 0
    check (max_progress_milestone in (0, 25, 50, 75, 100)),
  add column rsvp_form_viewed_at timestamptz,
  add column rsvp_form_started_at timestamptz;

-- Event date.
alter table public.events add column event_date date;
create index events_event_date_idx on public.events (event_date) where deleted_at is null;

create trigger trg_published_invitation_content_sync_event_date
after insert or update of content, is_demo, deleted_at, invitation_project_id
on public.published_invitation_content
for each row
execute function public.sync_event_date_from_published_content();

-- One-time backfill from the newest live published content of each event.
update public.events e
set event_date = public.invitation_event_date(p.content)
from (
  select distinct on (pic.invitation_project_id) pic.invitation_project_id, pic.content
  from public.published_invitation_content pic
  where pic.deleted_at is null and not pic.is_demo and pic.invitation_project_id is not null
  order by pic.invitation_project_id, pic.created_at desc
) p
where e.invitation_project_id = p.invitation_project_id
  and e.deleted_at is null
  and e.event_date is distinct from public.invitation_event_date(p.content);

-- Audit: write `viewed` once per guest (first view). Repeat views and the new
-- projections are engagement detail and live in guest_engagement_events.
create or replace function public.guest_invitation_emit_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  actor text := 'system';
  event_name text;
  event_payload jsonb := '{}'::jsonb;
begin
  if auth.role() = 'authenticated' then
    actor := 'host';
  elsif auth.role() = 'service_role' then
    actor := 'system';
  end if;

  if tg_op = 'INSERT' then
    event_name := 'created';
    event_payload := jsonb_build_object(
      'max_allowed_attendees', new.max_allowed_attendees,
      'delivery_status', new.delivery_status
    );
  else
    if new.first_viewed_at is distinct from old.first_viewed_at then
      event_name := 'viewed';
      actor := 'guest';
      event_payload := jsonb_build_object(
        'first_viewed_at', new.first_viewed_at,
        'last_viewed_at', new.last_viewed_at
      );
    elsif new.attendance_status is distinct from old.attendance_status
      or new.attendee_count is distinct from old.attendee_count then
      event_name := 'status_changed';
      actor := case when new.last_response_source = 'admin' then 'host' else 'guest' end;
      event_payload := jsonb_build_object(
        'previous_status', old.attendance_status,
        'new_status', new.attendance_status,
        'previous_attendee_count', old.attendee_count,
        'new_attendee_count', new.attendee_count
      );
    elsif new.guest_comment is distinct from old.guest_comment then
      event_name := 'message_updated';
      actor := case when new.last_response_source = 'admin' then 'host' else 'guest' end;
      event_payload := jsonb_build_object(
        'previous_guest_comment', old.guest_comment,
        'new_guest_comment', new.guest_comment
      );
    elsif new.delivery_status is distinct from old.delivery_status and new.delivery_status = 'shared' then
      event_name := 'shared_whatsapp';
      actor := 'host';
      event_payload := jsonb_build_object(
        'previous_delivery_status', old.delivery_status,
        'new_delivery_status', new.delivery_status
      );
    end if;
  end if;

  if event_name is not null then
    insert into public.guest_invitation_audit (
      guest_invitation_id,
      actor_type,
      event_type,
      payload
    ) values (
      new.id,
      actor::text,
      event_name::text,
      event_payload
    );
  end if;

  return new;
end;
$fn$;

comment on table public.guest_engagement_events is 'Append-only guest engagement ledger (taxonomy v1). Rows are anonymized (guest link cleared) after events.event_date + 180 days. Spec: docs/domains/rsvp/engagement-analytics.md';
comment on column public.events.event_date is 'Event-local date derived from published content by invitation_event_date(), null for demos or missing timing.';
comment on column public.guest_invitations.is_test is 'Test guest: engagement is classified as test and excluded from metrics and snapshots.';

commit;
