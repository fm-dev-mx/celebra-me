begin;

alter table public.host_profiles enable row level security;
alter table public.events enable row level security;
alter table public.guest_invitations enable row level security;
alter table public.guest_invitation_audit enable row level security;

alter table public.host_profiles force row level security;
alter table public.events force row level security;
alter table public.guest_invitations force row level security;
alter table public.guest_invitation_audit force row level security;

drop policy if exists host_profiles_select_own on public.host_profiles;
drop policy if exists host_profiles_insert_own on public.host_profiles;
drop policy if exists host_profiles_update_own on public.host_profiles;
drop policy if exists host_profiles_delete_own on public.host_profiles;

create policy host_profiles_select_own
on public.host_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy host_profiles_insert_own
on public.host_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy host_profiles_update_own
on public.host_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy host_profiles_delete_own
on public.host_profiles
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists events_select_own on public.events;
drop policy if exists events_insert_own on public.events;
drop policy if exists events_update_own on public.events;
drop policy if exists events_delete_own on public.events;

create policy events_select_own
on public.events
for select
to authenticated
using (auth.uid() = owner_user_id);

create policy events_insert_own
on public.events
for insert
to authenticated
with check (auth.uid() = owner_user_id);

create policy events_update_own
on public.events
for update
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy events_delete_own
on public.events
for delete
to authenticated
using (auth.uid() = owner_user_id);

drop policy if exists guest_invitations_select_own on public.guest_invitations;
drop policy if exists guest_invitations_insert_own on public.guest_invitations;
drop policy if exists guest_invitations_update_own on public.guest_invitations;
drop policy if exists guest_invitations_delete_own on public.guest_invitations;

create policy guest_invitations_select_own
on public.guest_invitations
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = guest_invitations.event_id
      and e.owner_user_id = auth.uid()
  )
);

create policy guest_invitations_insert_own
on public.guest_invitations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = guest_invitations.event_id
      and e.owner_user_id = auth.uid()
  )
);

create policy guest_invitations_update_own
on public.guest_invitations
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = guest_invitations.event_id
      and e.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = guest_invitations.event_id
      and e.owner_user_id = auth.uid()
  )
);

create policy guest_invitations_delete_own
on public.guest_invitations
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = guest_invitations.event_id
      and e.owner_user_id = auth.uid()
  )
);

drop policy if exists guest_invitation_audit_select_own on public.guest_invitation_audit;

create policy guest_invitation_audit_select_own
on public.guest_invitation_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.guest_invitations gi
    join public.events e on e.id = gi.event_id
    where gi.id = guest_invitation_audit.guest_invitation_id
      and e.owner_user_id = auth.uid()
  )
);

-- Optional helper for one-time backfill from legacy RSVP storage.
create or replace function public.backfill_guest_invitations_from_legacy()
returns integer
language plpgsql
security definer
as $fn$
declare
  inserted_count integer := 0;
begin
  insert into public.guest_invitations (
    event_id,
    full_name,
    phone_e164,
    max_allowed_attendees,
    attendance_status,
    attendee_count,
    guest_message,
    delivery_status,
    first_viewed_at,
    last_viewed_at,
    responded_at,
    legacy_guest_id,
    legacy_event_slug
  )
  select
    e.id,
    rr.guest_name_entered,
    '',
    greatest(1, rr.attendee_count),
    rr.attendance_status,
    rr.attendee_count,
    rr.notes,
    case when rr.source = 'personalized_link' then 'shared' else 'generated' end,
    null,
    null,
    rr.last_updated_at,
    rr.guest_id,
    rr.event_slug
  from public.rsvp_records rr
  join public.events e on e.slug = rr.event_slug
  where not exists (
    select 1
    from public.guest_invitations gi
    where gi.legacy_event_slug = rr.event_slug
      and coalesce(gi.legacy_guest_id, '') = coalesce(rr.guest_id, '')
      and gi.full_name = rr.guest_name_entered
  );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$fn$;

commit;
