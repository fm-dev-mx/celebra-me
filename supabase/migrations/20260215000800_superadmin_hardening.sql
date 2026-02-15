begin;

-- 1. Audit Logs Table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id uuid not null,
  old_data jsonb null,
  new_data jsonb null,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

create policy audit_logs_select_admin
on public.audit_logs
for select
to authenticated
using (
  (select role from public.app_user_roles where user_id = auth.uid()) = 'super_admin'
);

-- 2. JWT Claim Injection Function & Trigger
create or replace function public.sync_user_role_to_metadata()
returns trigger as $$
begin
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', new.role)
  where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_app_user_role_to_metadata on public.app_user_roles;
create trigger trg_sync_app_user_role_to_metadata
after insert or update on public.app_user_roles
for each row
execute function public.sync_user_role_to_metadata();

-- 3. Superadmin RLS Hardening for existing tables

-- Policies for events
drop policy if exists events_superadmin_all on public.events;
create policy events_superadmin_all
on public.events
for all
to authenticated
using (
  (select role from public.app_user_roles where user_id = auth.uid()) = 'super_admin'
)
with check (
  (select role from public.app_user_roles where user_id = auth.uid()) = 'super_admin'
);

-- Policies for guest_invitations
drop policy if exists guest_invitations_superadmin_all on public.guest_invitations;
create policy guest_invitations_superadmin_all
on public.guest_invitations
for all
to authenticated
using (
  (select role from public.app_user_roles where user_id = auth.uid()) = 'super_admin'
)
with check (
  (select role from public.app_user_roles where user_id = auth.uid()) = 'super_admin'
);

-- Policies for event_memberships (Superadmin can manage memberships)
drop policy if exists event_memberships_superadmin_all on public.event_memberships;
create policy event_memberships_superadmin_all
on public.event_memberships
for all
to authenticated
using (
  (select role from public.app_user_roles where user_id = auth.uid()) = 'super_admin'
)
with check (
  (select role from public.app_user_roles where user_id = auth.uid()) = 'super_admin'
);

commit;
