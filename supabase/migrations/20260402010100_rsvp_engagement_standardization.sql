begin;

-- 0. Temporary drop trigger to avoid dependency errors during rename/update
drop trigger if exists trg_guest_invitations_emit_audit on public.guest_invitations;

-- 1. Rename guest_message to guest_comment
alter table public.guest_invitations
  rename column guest_message to guest_comment;

-- 2. Add Engagement Tracking Columns
alter table public.guest_invitations
  add column if not exists view_percentage integer not null default 0
  check (view_percentage between 0 and 100);

alter table public.guest_invitations
  add column if not exists is_viewed boolean not null default false;

-- 3. Update is_viewed for existing records
-- (Now safe to run because the trg_guest_invitations_emit_audit is dropped)
update public.guest_invitations
set is_viewed = true
where first_viewed_at is not null;

-- 4. Create trigger to automatically set is_viewed
create or replace function public.on_first_view()
returns trigger
language plpgsql
as $fn$
begin
  if new.first_viewed_at is not null then
    new.is_viewed = true;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_guest_invitations_first_view on public.guest_invitations;
create trigger trg_guest_invitations_first_view
before update on public.guest_invitations
for each row
execute function public.on_first_view();

-- 5. Update guest_invitation_emit_audit function to use guest_comment
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

-- 6. Re-create the audit trigger
drop trigger if exists trg_guest_invitations_emit_audit on public.guest_invitations;
create trigger trg_guest_invitations_emit_audit
after insert or update on public.guest_invitations
for each row
execute function public.guest_invitation_emit_audit();

commit;
