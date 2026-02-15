begin;

create extension if not exists pgcrypto;

create table if not exists public.host_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  event_type text not null check (event_type in ('xv', 'boda', 'bautizo', 'cumple')),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_invitations (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null unique default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null,
  phone_e164 text not null,
  max_allowed_attendees integer not null check (max_allowed_attendees between 1 and 20),
  attendance_status text not null default 'pending' check (attendance_status in ('pending', 'confirmed', 'declined')),
  attendee_count integer not null default 0 check (attendee_count between 0 and 20),
  guest_message text not null default '',
  delivery_status text not null default 'generated' check (delivery_status in ('generated', 'shared')),
  first_viewed_at timestamptz null,
  last_viewed_at timestamptz null,
  responded_at timestamptz null,
  last_response_source text not null default 'link' check (last_response_source in ('link', 'admin')),
  legacy_guest_id text null,
  legacy_event_slug text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_invitations_attendance_consistency_chk check (
    (attendance_status <> 'declined' or attendee_count = 0)
    and (attendance_status <> 'confirmed' or attendee_count >= 1)
  )
);

create table if not exists public.guest_invitation_audit (
  id uuid primary key default gen_random_uuid(),
  guest_invitation_id uuid not null references public.guest_invitations(id) on delete cascade,
  actor_type text not null check (actor_type in ('guest', 'host', 'system')),
  event_type text not null check (event_type in ('created', 'viewed', 'status_changed', 'message_updated', 'shared_whatsapp')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_owner_user_id
  on public.events (owner_user_id);

create index if not exists idx_events_slug
  on public.events (slug);

create index if not exists idx_guest_invitations_event_id
  on public.guest_invitations (event_id);

create index if not exists idx_guest_invitations_event_status
  on public.guest_invitations (event_id, attendance_status);

create index if not exists idx_guest_invitations_invite_id
  on public.guest_invitations (invite_id);

create index if not exists idx_guest_invitations_phone_e164
  on public.guest_invitations (phone_e164);

create index if not exists idx_guest_invitation_audit_guest_created
  on public.guest_invitation_audit (guest_invitation_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists trg_host_profiles_touch_updated_at on public.host_profiles;
create trigger trg_host_profiles_touch_updated_at
before update on public.host_profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_events_touch_updated_at on public.events;
create trigger trg_events_touch_updated_at
before update on public.events
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_guest_invitations_touch_updated_at on public.guest_invitations;
create trigger trg_guest_invitations_touch_updated_at
before update on public.guest_invitations
for each row
execute function public.touch_updated_at();

commit;
