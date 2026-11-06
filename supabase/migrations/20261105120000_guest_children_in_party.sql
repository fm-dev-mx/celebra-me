begin;

-- How many of an invitation's passes are for children, and how many of the
-- confirmed attendees are children. Adults are always derived
-- (passes - children, attendees - children) and never stored.
alter table public.guest_invitations
  add column if not exists max_allowed_children integer not null default 0,
  add column if not exists children_count integer not null default 0;

alter table public.guest_invitations
  drop constraint if exists guest_invitations_max_allowed_children_check,
  add constraint guest_invitations_max_allowed_children_check
    check (max_allowed_children >= 0 and max_allowed_children <= max_allowed_attendees),
  drop constraint if exists guest_invitations_children_count_check,
  add constraint guest_invitations_children_count_check
    check (children_count >= 0 and children_count <= attendee_count);

comment on column public.guest_invitations.max_allowed_children is
  'Passes reserved for children; never more than max_allowed_attendees. Adults = passes - children.';
comment on column public.guest_invitations.children_count is
  'Confirmed attendees who are children; never more than attendee_count.';

-- The public RSVP RPC gains p_children_count. Drop the 11-argument signature
-- so PostgREST never resolves an ambiguous overload.
drop function if exists public.submit_guest_rsvp_public(
  text, uuid, text, text, text, integer, text, integer, text, text, text
);

create function public.submit_guest_rsvp_public(
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
  p_short_id text default null,
  p_children_count integer default 0
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
  v_final_children integer;
  v_final_comment text;
begin
  if p_attendance_status is null or p_attendance_status not in ('confirmed', 'declined') then
    raise exception using errcode = 'P0001', message = 'invalid_attendance_status';
  end if;

  v_final_status := p_attendance_status;
  v_final_count := coalesce(p_attendee_count, case when v_final_status = 'confirmed' then 1 else 0 end);
  v_final_children := greatest(coalesce(p_children_count, 0), 0);
  if v_final_status = 'declined' then
    v_final_count := 0;
    v_final_children := 0;
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

  if v_final_children > v_guest.max_allowed_children or v_final_children > v_final_count then
    raise exception using errcode = 'P0001', message = 'children_count_exceeds_limit';
  end if;

  if p_guest_comment is not null and trim(p_guest_comment) <> '' then
    v_final_comment := trim(p_guest_comment);
  else
    v_final_comment := v_guest.guest_comment;
  end if;

  update public.guest_invitations
  set attendance_status = v_final_status,
      attendee_count = v_final_count,
      children_count = v_final_children,
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
    'children_count', v_guest.children_count,
    'guest_comment', v_guest.guest_comment,
    'delivery_status', v_guest.delivery_status,
    'responded_at', v_guest.responded_at,
    'entry_source', v_guest.entry_source
  );
end;
$function$;

comment on function public.submit_guest_rsvp_public is
  'Atomic SECURITY DEFINER RSVP RPC. Generic event submissions are create-only; personalized invite_id submissions may update one invitation.';

revoke all on function public.submit_guest_rsvp_public(text, uuid, text, text, text, integer, text, integer, text, text, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.submit_guest_rsvp_public(text, uuid, text, text, text, integer, text, integer, text, text, text, integer) to service_role;

-- Bulk import also carries the children reservation. Same create-only
-- behaviour as before; only max_allowed_children is new.
create or replace function public.upsert_guests_v1(
  p_event_id uuid,
  p_guests jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_guest jsonb;
  v_row_index int;
  v_count_created int := 0;
  v_count_conflicts int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_inserted_id uuid;
begin
  for v_guest, v_row_index in
    select value, ordinality::int
    from jsonb_array_elements(p_guests) with ordinality as t(value, ordinality)
  loop
    v_inserted_id := null;

    if (v_guest->>'phone') is null or (v_guest->>'phone') = '' then
      insert into public.guest_invitations (
        event_id,
        full_name,
        phone,
        country_code,
        email,
        tags,
        max_allowed_attendees,
        max_allowed_children,
        metadata
      )
      values (
        p_event_id,
        v_guest->>'full_name',
        null,
        null,
        v_guest->>'email',
        array(select jsonb_array_elements_text(coalesce(v_guest->'tags', '[]'::jsonb))),
        coalesce((v_guest->>'max_allowed_attendees')::int, 2),
        coalesce((v_guest->>'max_allowed_children')::int, 0),
        jsonb_build_object('needs_review', true, 'import_source', 'bulk')
      )
      returning id into v_inserted_id;

      v_count_created := v_count_created + 1;
    else
      insert into public.guest_invitations (
        event_id,
        full_name,
        phone,
        country_code,
        email,
        tags,
        max_allowed_attendees,
        max_allowed_children
      )
      values (
        p_event_id,
        v_guest->>'full_name',
        v_guest->>'phone',
        v_guest->>'country_code',
        v_guest->>'email',
        array(select jsonb_array_elements_text(coalesce(v_guest->'tags', '[]'::jsonb))),
        coalesce((v_guest->>'max_allowed_attendees')::int, 2),
        coalesce((v_guest->>'max_allowed_children')::int, 0)
      )
      on conflict (event_id, country_code, phone) where deleted_at is null
      do nothing
      returning id into v_inserted_id;

      if v_inserted_id is null then
        v_count_conflicts := v_count_conflicts + 1;
        v_errors := v_errors || jsonb_build_array(
          format('Fila %s: el teléfono ya existe para este evento. Usa "Actualizar existente" para modificar ese invitado.', v_row_index)
        );
      else
        v_count_created := v_count_created + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'created', v_count_created,
    'updated', 0,
    'skipped', 0,
    'conflicts', v_count_conflicts,
    'errors', v_errors,
    'status', case
      when v_count_conflicts > 0 or jsonb_array_length(v_errors) > 0 then 'partial'
      else 'success'
    end
  );
end;
$$;

comment on function public.upsert_guests_v1 is
  'Bulk creates guests for an event. Create-only: duplicates by (event_id, country_code, phone) are reported as conflicts. Rows without a phone are always inserted.';

revoke execute on function public.upsert_guests_v1(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_guests_v1(uuid, jsonb) to service_role;

commit;
