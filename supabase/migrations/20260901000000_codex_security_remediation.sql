-- Codex Security remediation for the final reviewed migration state.
--
-- This migration removes client-side privilege paths that were reintroduced by
-- later grants, canonicalizes active-record RLS, and keeps sensitive writes
-- behind the server-side BFF or trusted database triggers.

begin;

-- Client roles must not create memberships, roles, claim codes, audit rows, or
-- call privileged tenant-write/claim routines directly.
revoke all on public.event_memberships from public, anon, authenticated;
revoke all on public.app_user_roles from public, anon, authenticated;
revoke all on public.event_claim_codes from public, anon, authenticated;
revoke all on public.guest_invitation_audit from public, anon, authenticated;
revoke all on public.audit_logs from public, anon, authenticated;

grant select on public.event_memberships to authenticated;
grant select on public.app_user_roles to authenticated;

drop policy if exists app_user_roles_insert_service on public.app_user_roles;
drop policy if exists app_user_roles_update_service on public.app_user_roles;
drop policy if exists event_claim_codes_select_service on public.event_claim_codes;
drop policy if exists event_claim_codes_mutate_service on public.event_claim_codes;
drop policy if exists audit_logs_select_admin on public.audit_logs;

revoke execute on function public.upsert_guests_v1(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_guests_v1(uuid, jsonb) to service_role;

revoke execute on function public.redeem_claim_code(uuid, text)
  from public, anon, authenticated;
grant execute on function public.redeem_claim_code(uuid, text) to service_role;

revoke execute on function public.guest_invitation_emit_audit()
  from public, anon, authenticated;
grant execute on function public.guest_invitation_emit_audit() to service_role;

-- Compatibility views are server-only. The application no longer uses them
-- from browser sessions, and their definer semantics must not become a client
-- read boundary.
revoke all on public.invitation_projects from public, anon, authenticated;
revoke all on public.archived_invitations from public, anon, authenticated;
grant select on public.invitation_projects to service_role;
grant select on public.archived_invitations to service_role;

-- Remove every historical permissive policy before installing one canonical
-- active-record policy set. PostgreSQL combines permissive policies with OR.
drop policy if exists events_select_own on public.events;
drop policy if exists events_insert_own on public.events;
drop policy if exists events_update_own on public.events;
drop policy if exists events_delete_own on public.events;
drop policy if exists events_select_owned_or_member on public.events;
drop policy if exists events_superadmin_all on public.events;
drop policy if exists "Events: owner can manage" on public.events;

create policy events_select_active_owned_or_member
on public.events
for select
to authenticated
using (
  deleted_at is null
  and (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.event_memberships em
      where em.event_id = events.id
        and em.user_id = auth.uid()
        and em.deleted_at is null
    )
    or exists (
      select 1 from public.app_user_roles aur
      where aur.user_id = auth.uid()
        and aur.role = 'super_admin'
    )
  )
);

create policy events_insert_active_owned
on public.events
for insert
to authenticated
with check (deleted_at is null and owner_user_id = auth.uid());

create policy events_update_active_owned_or_admin
on public.events
for update
to authenticated
using (
  deleted_at is null
  and (
    owner_user_id = auth.uid()
    or exists (select 1 from public.app_user_roles aur where aur.user_id = auth.uid() and aur.role = 'super_admin')
  )
)
with check (
  deleted_at is null
  and (
    owner_user_id = auth.uid()
    or exists (select 1 from public.app_user_roles aur where aur.user_id = auth.uid() and aur.role = 'super_admin')
  )
);

create policy events_delete_active_owned_or_admin
on public.events
for delete
to authenticated
using (
  deleted_at is null
  and (
    owner_user_id = auth.uid()
    or exists (select 1 from public.app_user_roles aur where aur.user_id = auth.uid() and aur.role = 'super_admin')
  )
);

drop policy if exists guest_invitations_select_own on public.guest_invitations;
drop policy if exists guest_invitations_insert_own on public.guest_invitations;
drop policy if exists guest_invitations_update_own on public.guest_invitations;
drop policy if exists guest_invitations_delete_own on public.guest_invitations;
drop policy if exists guest_invitations_select_owner_or_member on public.guest_invitations;
drop policy if exists guest_invitations_insert_owner_or_member on public.guest_invitations;
drop policy if exists guest_invitations_update_owner_or_member on public.guest_invitations;
drop policy if exists guest_invitations_delete_owner_or_member on public.guest_invitations;
drop policy if exists guest_invitations_superadmin_all on public.guest_invitations;
drop policy if exists "GuestInvitations: event owners can manage" on public.guest_invitations;

create policy guest_invitations_select_active_owned_or_member
on public.guest_invitations
for select
to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.events e
    where e.id = guest_invitations.event_id
      and e.deleted_at is null
      and (
        e.owner_user_id = auth.uid()
        or exists (
          select 1 from public.event_memberships em
          where em.event_id = e.id and em.user_id = auth.uid() and em.deleted_at is null
        )
        or exists (select 1 from public.app_user_roles aur where aur.user_id = auth.uid() and aur.role = 'super_admin')
      )
  )
);

create policy guest_invitations_insert_active_owned_or_member
on public.guest_invitations
for insert
to authenticated
with check (
  deleted_at is null
  and exists (
    select 1 from public.events e
    where e.id = guest_invitations.event_id
      and e.deleted_at is null
      and (
        e.owner_user_id = auth.uid()
        or exists (
          select 1 from public.event_memberships em
          where em.event_id = e.id and em.user_id = auth.uid() and em.deleted_at is null
        )
        or exists (select 1 from public.app_user_roles aur where aur.user_id = auth.uid() and aur.role = 'super_admin')
      )
  )
);

create policy guest_invitations_update_active_owned_or_member
on public.guest_invitations
for update
to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.events e
    where e.id = guest_invitations.event_id
      and e.deleted_at is null
      and (
        e.owner_user_id = auth.uid()
        or exists (
          select 1 from public.event_memberships em
          where em.event_id = e.id and em.user_id = auth.uid() and em.deleted_at is null
        )
        or exists (select 1 from public.app_user_roles aur where aur.user_id = auth.uid() and aur.role = 'super_admin')
      )
  )
)
with check (
  deleted_at is null
  and exists (
    select 1 from public.events e
    where e.id = guest_invitations.event_id
      and e.deleted_at is null
      and (
        e.owner_user_id = auth.uid()
        or exists (
          select 1 from public.event_memberships em
          where em.event_id = e.id and em.user_id = auth.uid() and em.deleted_at is null
        )
        or exists (select 1 from public.app_user_roles aur where aur.user_id = auth.uid() and aur.role = 'super_admin')
      )
  )
);

create policy guest_invitations_delete_active_owned_or_member
on public.guest_invitations
for delete
to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.events e
    where e.id = guest_invitations.event_id
      and e.deleted_at is null
      and (
        e.owner_user_id = auth.uid()
        or exists (
          select 1 from public.event_memberships em
          where em.event_id = e.id and em.user_id = auth.uid() and em.deleted_at is null
        )
        or exists (select 1 from public.app_user_roles aur where aur.user_id = auth.uid() and aur.role = 'super_admin')
      )
  )
);

drop policy if exists event_memberships_select_own on public.event_memberships;
drop policy if exists event_memberships_insert_own_or_service on public.event_memberships;
drop policy if exists event_memberships_update_service on public.event_memberships;
drop policy if exists event_memberships_superadmin_all on public.event_memberships;
drop policy if exists "EventMemberships: view own" on public.event_memberships;

create policy event_memberships_select_active_own
on public.event_memberships
for select
to authenticated
using (deleted_at is null and user_id = auth.uid());

drop policy if exists guest_invitation_audit_select_own on public.guest_invitation_audit;
drop policy if exists guest_invitation_audit_insert_own_or_service on public.guest_invitation_audit;

create policy guest_invitation_audit_select_active_owned_or_member
on public.guest_invitation_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.guest_invitations gi
    join public.events e on e.id = gi.event_id
    where gi.id = guest_invitation_audit.guest_invitation_id
      and gi.deleted_at is null
      and e.deleted_at is null
      and (
        e.owner_user_id = auth.uid()
        or exists (
          select 1 from public.event_memberships em
          where em.event_id = e.id and em.user_id = auth.uid() and em.deleted_at is null
        )
        or exists (select 1 from public.app_user_roles aur where aur.user_id = auth.uid() and aur.role = 'super_admin')
      )
  )
);

alter function public.redeem_claim_code(uuid, text) set search_path = 'public';
alter function public.upsert_guests_v1(uuid, jsonb) set search_path = 'public';

-- Generic RSVP is create-only. Personalized links use p_invite_id and may
-- update that specific invitation; a public event request never resolves an
-- existing guest by phone.
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
      coalesce(p_short_id, encode(gen_random_bytes(6), 'hex')),
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

-- Intake submission is a one-shot state transition. The request row is the
-- lock that serializes concurrent submissions and prevents duplicate notices.
create or replace function public.submit_intake_request_once(
  p_request_id uuid,
  p_submission_id uuid,
  p_invitation_id uuid,
  p_client_comments text
) returns table(applied boolean)
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_request public.intake_requests%rowtype;
  v_submission public.intake_submissions%rowtype;
  v_invitation public.invitations%rowtype;
begin
  select * into v_request
  from public.intake_requests
  where id = p_request_id and deleted_at is null
  for update;

  if not found then
    return query select false;
    return;
  end if;

  select * into v_submission
  from public.intake_submissions
  where id = p_submission_id
    and intake_request_id = p_request_id
    and deleted_at is null
  for update;

  if not found then
    return query select false;
    return;
  end if;

  select * into v_invitation
  from public.invitations
  where id = p_invitation_id
    and archived_at is null
  for update;

  if not found or v_request.invitation_project_id <> p_invitation_id then
    return query select false;
    return;
  end if;

  if v_submission.status <> 'in_progress'
     or v_request.status <> 'active'
     or v_invitation.status in ('in_review', 'in_production', 'preview_sent', 'approved', 'published', 'archived') then
    return query select false;
    return;
  end if;

  update public.intake_submissions
  set status = 'submitted',
      client_comments = coalesce(p_client_comments, ''),
      submitted_at = now()
  where id = p_submission_id;

  update public.intake_requests
  set status = 'submitted'
  where id = p_request_id;

  update public.invitations
  set status = 'client_submitted'
  where id = p_invitation_id;

  return query select true;
end;
$function$;

revoke all on function public.submit_intake_request_once(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_intake_request_once(uuid, uuid, uuid, text) to service_role;

-- A reservation created without a capability must not consume quota. The row
-- is removed only while it is still an unuploaded reservation for this session.
create or replace function public.release_valentina_memory_reservation(
  p_item_id uuid,
  p_session_id uuid
) returns boolean
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_deleted boolean := false;
begin
  delete from public.valentina_memory_items
  where id = p_item_id
    and session_id = p_session_id
    and status = 'uploading'
    and object_deleted_at is null
  returning true into v_deleted;
  return coalesce(v_deleted, false);
end;
$function$;

revoke all on function public.release_valentina_memory_reservation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_valentina_memory_reservation(uuid, uuid) to service_role;

commit;
