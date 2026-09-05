-- Forward-only closure corrections for the Codex Security remediation.
-- Historical migrations remain immutable; this migration fixes the final
-- deployed schema state and preserves the hosted pgcrypto qualification.

begin;

-- These resources are owned by the authenticated BFF. Their application
-- repositories use service_role, so client roles must not bypass the BFF's
-- session, CSRF, authorization, environment, or rate-limit gates through
-- direct PostgREST DML.
revoke all on table public.invitations from public, anon, authenticated;
revoke all on table public.intake_requests from public, anon, authenticated;
revoke all on table public.intake_submissions from public, anon, authenticated;
revoke all on table public.invitation_content_drafts from public, anon, authenticated;
revoke all on table public.invitation_assets from public, anon, authenticated;

-- Published invitation content is read by the server with service_role only.
-- Revoke both table privileges and the historical permissive RLS policy.
revoke all on table public.published_invitation_content from public, anon, authenticated;
grant select on table public.published_invitation_content to service_role;
drop policy if exists "Anyone can read published invitation content"
  on public.published_invitation_content;

-- Keep the create-only generic RSVP contract while retaining personalized-link
-- updates. The qualified extension call is required by search_path=public.
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

  if p_invite_id is not null and trim(p_invite_id) <> '' then
    select * into v_guest
    from public.guest_invitations
    where invite_id::text = trim(p_invite_id) and deleted_at is null
    for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'guest_invitation_not_found';
    end if;
  elsif p_event_id is not null then
    if p_full_name is null or trim(p_full_name) = '' then
      raise exception using errcode = 'P0001', message = 'full_name_required';
    end if;

    insert into public.guest_invitations (
      event_id, full_name, phone, country_code, max_allowed_attendees,
      short_id, entry_source, tags
    ) values (
      p_event_id,
      trim(p_full_name),
      case when p_phone is not null and trim(p_phone) <> '' then trim(p_phone) else null end,
      case when p_country_code is not null and trim(p_country_code) <> '' then trim(p_country_code) else null end,
      coalesce(p_max_allowed_attendees, 2),
      coalesce(p_short_id, encode(extensions.gen_random_bytes(6), 'hex')),
      'generic_public',
      array['system:public']
    ) returning * into v_guest;
  else
    raise exception using errcode = 'P0001', message = 'missing_rsvp_target_identity';
  end if;

  if v_final_status = 'confirmed' and v_final_count > v_guest.max_allowed_attendees then
    raise exception using errcode = 'P0001', message = 'attendee_count_exceeds_limit';
  end if;

  if p_guest_comment is not null and trim(p_guest_comment) <> '' then
    v_final_comment := trim(p_guest_comment);
  else
    v_final_comment := v_guest.guest_comment;
  end if;

  update public.guest_invitations
  set attendance_status = v_final_status,
      attendee_count = v_final_count,
      guest_comment = v_final_comment,
      responded_at = v_now,
      last_response_source = coalesce(p_response_source, 'link'),
      updated_at = v_now
  where id = v_guest.id
  returning * into v_guest;

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
  'Atomic SECURITY DEFINER RSVP RPC. Generic event submissions are create-only; personalized invite_id submissions may update one invitation.';

commit;
