begin;

-- Migration: Create atomic SECURITY DEFINER RPCs for public guest RSVP submission
-- and invitation view telemetry tracking.
--
-- Restores public guest RSVP and view tracking database contracts without
-- restoring direct table DML (INSERT, UPDATE, DELETE) privileges to service_role.

create or replace function public.submit_guest_rsvp_public(
  p_invite_id text default null,
  p_event_id uuid default null,
  p_full_name text default null,
  p_phone text default null,
  p_country_code text default null,
  p_max_allowed_attendees integer default null,
  p_attendance_status text default null,
  p_attendee_count integer default null,
  p_guest_comment text default null,
  p_response_source text default 'link',
  p_short_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_guest public.guest_invitations%rowtype;
  v_now timestamptz := now();
  v_final_status text;
  v_final_count integer;
  v_final_comment text;
begin
  -- Validate attendance status
  if p_attendance_status is null or p_attendance_status not in ('confirmed', 'declined') then
    raise exception using errcode = 'P0001', message = 'invalid_attendance_status';
  end if;

  v_final_status := p_attendance_status;
  v_final_count := coalesce(p_attendee_count, case when v_final_status = 'confirmed' then 1 else 0 end);
  if v_final_status = 'declined' then
    v_final_count := 0;
  elsif v_final_status = 'confirmed' and v_final_count < 1 then
    v_final_count := 1;
  end if;

  -- Resolution 1: Lookup by invite_id
  if p_invite_id is not null and trim(p_invite_id) <> '' then
    select * into v_guest
    from public.guest_invitations
    where invite_id::text = trim(p_invite_id) and deleted_at is null
    for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'guest_invitation_not_found';
    end if;

  -- Resolution 2: Generic public event link (lookup by phone or insert new guest)
  elsif p_event_id is not null then
    if p_phone is not null and trim(p_phone) <> '' and p_country_code is not null and trim(p_country_code) <> '' then
      select * into v_guest
      from public.guest_invitations
      where event_id = p_event_id
        and country_code = trim(p_country_code)
        and phone = trim(p_phone)
        and deleted_at is null
      for update;
    end if;

    if v_guest.id is null then
      if p_full_name is null or trim(p_full_name) = '' then
        raise exception using errcode = 'P0001', message = 'full_name_required';
      end if;

      insert into public.guest_invitations (
        event_id,
        full_name,
        phone,
        country_code,
        max_allowed_attendees,
        short_id,
        entry_source,
        tags
      ) values (
        p_event_id,
        trim(p_full_name),
        case when p_phone is not null and trim(p_phone) <> '' then trim(p_phone) else null end,
        case when p_country_code is not null and trim(p_country_code) <> '' then trim(p_country_code) else null end,
        coalesce(p_max_allowed_attendees, 2),
        coalesce(p_short_id, encode(gen_random_bytes(6), 'hex')),
        'generic_public',
        array['system:public']
      )
      returning * into v_guest;
    end if;

  else
    raise exception using errcode = 'P0001', message = 'missing_rsvp_target_identity';
  end if;

  -- Check max attendee limit
  if v_final_status = 'confirmed' and v_final_count > v_guest.max_allowed_attendees then
    raise exception using errcode = 'P0001', message = 'attendee_count_exceeds_limit';
  end if;

  -- Append guest comment if provided
  v_final_comment := v_guest.guest_comment;
  if p_guest_comment is not null and trim(p_guest_comment) <> '' then
    if v_final_comment is null or trim(v_final_comment) = '' then
      v_final_comment := trim(p_guest_comment);
    else
      v_final_comment := v_final_comment || E'\n---\n' || trim(p_guest_comment);
    end if;
  end if;

  -- Perform guest update
  update public.guest_invitations
  set attendance_status = v_final_status,
      attendee_count = v_final_count,
      guest_comment = v_final_comment,
      responded_at = v_now,
      last_response_source = coalesce(p_response_source, 'link'),
      updated_at = v_now
  where id = v_guest.id
  returning * into v_guest;

  -- Atomic guest audit log entry
  insert into public.guest_invitation_audit (
    guest_invitation_id,
    actor_type,
    event_type,
    payload
  ) values (
    v_guest.id,
    'guest',
    'status_changed',
    jsonb_build_object(
      'attendance_status', v_final_status,
      'attendee_count', v_final_count,
      'source', coalesce(p_response_source, 'link')
    )
  );

  return jsonb_build_object(
    'id', v_guest.id,
    'invite_id', v_guest.invite_id,
    'event_id', v_guest.event_id,
    'full_name', v_guest.full_name,
    'attendance_status', v_guest.attendance_status,
    'attendee_count', v_guest.attendee_count,
    'guest_comment', v_guest.guest_comment,
    'delivery_status', v_guest.delivery_status,
    'responded_at', v_guest.responded_at,
    'entry_source', v_guest.entry_source
  );
end;
$function$;

comment on function public.submit_guest_rsvp_public is
  'Atomic SECURITY DEFINER RPC for public guest RSVP submission and guest audit creation.';

create or replace function public.track_guest_invitation_view_public(
  p_invite_id text,
  p_view_percentage integer default null
) returns boolean
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_guest public.guest_invitations%rowtype;
  v_now timestamptz := now();
  v_next_percentage integer;
begin
  if p_invite_id is null or trim(p_invite_id) = '' then
    return false;
  end if;

  select * into v_guest
  from public.guest_invitations
  where invite_id::text = trim(p_invite_id) and deleted_at is null
  for update;

  if not found then
    return false;
  end if;

  v_next_percentage := v_guest.view_percentage;
  if p_view_percentage is not null then
    v_next_percentage := greatest(
      v_guest.view_percentage,
      least(100, greatest(0, p_view_percentage))
    );
  end if;

  update public.guest_invitations
  set first_viewed_at = coalesce(first_viewed_at, v_now),
      last_viewed_at = v_now,
      is_viewed = true,
      view_percentage = v_next_percentage,
      updated_at = v_now
  where id = v_guest.id;

  return true;
end;
$function$;

comment on function public.track_guest_invitation_view_public is
  'Atomic SECURITY DEFINER RPC for public invitation view telemetry tracking.';

-- Establish least privilege execution grants
revoke all on function public.submit_guest_rsvp_public(text, uuid, text, text, text, integer, text, integer, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_guest_rsvp_public(text, uuid, text, text, text, integer, text, integer, text, text, text) to service_role;

revoke all on function public.track_guest_invitation_view_public(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.track_guest_invitation_view_public(text, integer) to service_role;

commit;
