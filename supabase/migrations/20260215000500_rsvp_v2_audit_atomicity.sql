begin;

drop policy if exists guest_invitation_audit_insert_own_or_service on public.guest_invitation_audit;

create policy guest_invitation_audit_insert_own_or_service
on public.guest_invitation_audit
for insert
to authenticated, anon
with check (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.guest_invitations gi
    join public.events e on e.id = gi.event_id
    where gi.id = guest_invitation_audit.guest_invitation_id
      and e.owner_user_id = auth.uid()
  )
);

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
    if new.last_viewed_at is distinct from old.last_viewed_at
      or new.first_viewed_at is distinct from old.first_viewed_at then
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
    elsif new.guest_message is distinct from old.guest_message then
      event_name := 'message_updated';
      actor := case when new.last_response_source = 'admin' then 'host' else 'guest' end;
      event_payload := jsonb_build_object(
        'previous_guest_message', old.guest_message,
        'new_guest_message', new.guest_message
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

drop trigger if exists trg_guest_invitations_emit_audit on public.guest_invitations;
create trigger trg_guest_invitations_emit_audit
after insert or update on public.guest_invitations
for each row
execute function public.guest_invitation_emit_audit();

commit;
