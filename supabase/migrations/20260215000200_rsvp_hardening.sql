begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rsvp_records_attendance_consistency_chk'
  ) then
    alter table public.rsvp_records
      add constraint rsvp_records_attendance_consistency_chk
      check (
        (attendance_status <> 'declined' or attendee_count = 0)
        and (attendance_status <> 'confirmed' or attendee_count >= 1)
      );
  end if;
end
$$;

alter table public.rsvp_audit_log
  drop constraint if exists rsvp_audit_log_rsvp_id_fkey;

alter table public.rsvp_audit_log
  add constraint rsvp_audit_log_rsvp_id_fkey
  foreign key (rsvp_id)
  references public.rsvp_records (rsvp_id)
  on delete cascade;

alter table public.rsvp_channel_log
  drop constraint if exists rsvp_channel_log_rsvp_id_fkey;

alter table public.rsvp_channel_log
  add constraint rsvp_channel_log_rsvp_id_fkey
  foreign key (rsvp_id)
  references public.rsvp_records (rsvp_id)
  on delete cascade;

create or replace function public.set_last_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.last_updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists trg_rsvp_records_set_last_updated_at on public.rsvp_records;

create trigger trg_rsvp_records_set_last_updated_at
before update on public.rsvp_records
for each row
execute function public.set_last_updated_at();

alter table public.rsvp_records enable row level security;
alter table public.rsvp_audit_log enable row level security;
alter table public.rsvp_channel_log enable row level security;

alter table public.rsvp_records force row level security;
alter table public.rsvp_audit_log force row level security;
alter table public.rsvp_channel_log force row level security;

revoke all on table public.rsvp_records from anon, authenticated;
revoke all on table public.rsvp_audit_log from anon, authenticated;
revoke all on table public.rsvp_channel_log from anon, authenticated;

drop policy if exists rsvp_records_no_access_anon on public.rsvp_records;
drop policy if exists rsvp_records_no_access_authenticated on public.rsvp_records;
drop policy if exists rsvp_audit_log_no_access_anon on public.rsvp_audit_log;
drop policy if exists rsvp_audit_log_no_access_authenticated on public.rsvp_audit_log;
drop policy if exists rsvp_channel_log_no_access_anon on public.rsvp_channel_log;
drop policy if exists rsvp_channel_log_no_access_authenticated on public.rsvp_channel_log;

create policy rsvp_records_no_access_anon
on public.rsvp_records
for all
to anon
using (false)
with check (false);

create policy rsvp_records_no_access_authenticated
on public.rsvp_records
for all
to authenticated
using (false)
with check (false);

create policy rsvp_audit_log_no_access_anon
on public.rsvp_audit_log
for all
to anon
using (false)
with check (false);

create policy rsvp_audit_log_no_access_authenticated
on public.rsvp_audit_log
for all
to authenticated
using (false)
with check (false);

create policy rsvp_channel_log_no_access_anon
on public.rsvp_channel_log
for all
to anon
using (false)
with check (false);

create policy rsvp_channel_log_no_access_authenticated
on public.rsvp_channel_log
for all
to authenticated
using (false)
with check (false);

commit;
