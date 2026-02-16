begin;

create table if not exists public.app_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'host_client')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_memberships (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null default 'owner' check (membership_role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.event_claim_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  code_hash text not null,
  active boolean not null default true,
  expires_at timestamptz null,
  max_uses int not null default 1 check (max_uses > 0),
  used_count int not null default 0 check (used_count >= 0),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_memberships_user_id on public.event_memberships(user_id);
create index if not exists idx_event_memberships_event_id on public.event_memberships(event_id);
create index if not exists idx_event_claim_codes_event_hash on public.event_claim_codes(event_id, code_hash);

drop trigger if exists trg_app_user_roles_touch_updated_at on public.app_user_roles;
create trigger trg_app_user_roles_touch_updated_at
before update on public.app_user_roles
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_event_memberships_touch_updated_at on public.event_memberships;
create trigger trg_event_memberships_touch_updated_at
before update on public.event_memberships
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_event_claim_codes_touch_updated_at on public.event_claim_codes;
create trigger trg_event_claim_codes_touch_updated_at
before update on public.event_claim_codes
for each row
execute function public.touch_updated_at();

alter table public.app_user_roles enable row level security;
alter table public.event_memberships enable row level security;
alter table public.event_claim_codes enable row level security;
alter table public.app_user_roles force row level security;
alter table public.event_memberships force row level security;
alter table public.event_claim_codes force row level security;

drop policy if exists app_user_roles_select_own on public.app_user_roles;
create policy app_user_roles_select_own
on public.app_user_roles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists app_user_roles_insert_service on public.app_user_roles;
create policy app_user_roles_insert_service
on public.app_user_roles
for insert
to authenticated, anon
with check (auth.role() = 'service_role');

drop policy if exists app_user_roles_update_service on public.app_user_roles;
create policy app_user_roles_update_service
on public.app_user_roles
for update
to authenticated, anon
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists event_memberships_select_own on public.event_memberships;
create policy event_memberships_select_own
on public.event_memberships
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists event_memberships_insert_own_or_service on public.event_memberships;
create policy event_memberships_insert_own_or_service
on public.event_memberships
for insert
to authenticated, anon
with check (
  auth.role() = 'service_role'
  or auth.uid() = user_id
);

drop policy if exists event_memberships_update_service on public.event_memberships;
create policy event_memberships_update_service
on public.event_memberships
for update
to authenticated, anon
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists event_claim_codes_select_service on public.event_claim_codes;
create policy event_claim_codes_select_service
on public.event_claim_codes
for select
to authenticated, anon
using (auth.role() = 'service_role');

drop policy if exists event_claim_codes_mutate_service on public.event_claim_codes;
create policy event_claim_codes_mutate_service
on public.event_claim_codes
for all
to authenticated, anon
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists events_select_own on public.events;
drop policy if exists events_select_owned_or_member on public.events;
create policy events_select_owned_or_member
on public.events
for select
to authenticated
using (
  auth.uid() = owner_user_id
  or exists (
    select 1
    from public.event_memberships em
    where em.event_id = events.id
      and em.user_id = auth.uid()
  )
);

drop policy if exists guest_invitations_select_own on public.guest_invitations;
drop policy if exists guest_invitations_select_owner_or_member on public.guest_invitations;
create policy guest_invitations_select_owner_or_member
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
  or exists (
    select 1
    from public.event_memberships em
    where em.event_id = guest_invitations.event_id
      and em.user_id = auth.uid()
  )
);

drop policy if exists guest_invitations_insert_own on public.guest_invitations;
drop policy if exists guest_invitations_insert_owner_or_member on public.guest_invitations;
create policy guest_invitations_insert_owner_or_member
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
  or exists (
    select 1
    from public.event_memberships em
    where em.event_id = guest_invitations.event_id
      and em.user_id = auth.uid()
  )
);

drop policy if exists guest_invitations_update_own on public.guest_invitations;
drop policy if exists guest_invitations_update_owner_or_member on public.guest_invitations;
create policy guest_invitations_update_owner_or_member
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
  or exists (
    select 1
    from public.event_memberships em
    where em.event_id = guest_invitations.event_id
      and em.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = guest_invitations.event_id
      and e.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.event_memberships em
    where em.event_id = guest_invitations.event_id
      and em.user_id = auth.uid()
  )
);

drop policy if exists guest_invitations_delete_own on public.guest_invitations;
drop policy if exists guest_invitations_delete_owner_or_member on public.guest_invitations;
create policy guest_invitations_delete_owner_or_member
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
  or exists (
    select 1
    from public.event_memberships em
    where em.event_id = guest_invitations.event_id
      and em.user_id = auth.uid()
  )
);

commit;

