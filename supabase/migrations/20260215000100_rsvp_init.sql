begin;

create table if not exists public.rsvp_records (
  store_key text primary key,
  rsvp_id text not null unique,
  event_slug text not null,
  guest_id text null,
  guest_name_entered text not null,
  attendance_status text not null check (attendance_status in ('pending', 'confirmed', 'declined')),
  attendee_count integer not null check (attendee_count >= 0),
  notes text not null default '',
  dietary text not null default '',
  source text not null check (source in ('personalized_link', 'generic_link', 'admin')),
  created_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  normalized_guest_name text not null,
  is_potential_duplicate boolean not null default false
);

create table if not exists public.rsvp_audit_log (
  audit_id text primary key,
  rsvp_id text not null,
  previous_status text null check (previous_status in ('pending', 'confirmed', 'declined')),
  new_status text not null check (new_status in ('pending', 'confirmed', 'declined')),
  previous_attendee_count integer null check (previous_attendee_count >= 0),
  new_attendee_count integer not null check (new_attendee_count >= 0),
  changed_by text not null check (changed_by in ('guest', 'admin', 'system')),
  changed_at timestamptz not null default now()
);

create table if not exists public.rsvp_channel_log (
  channel_event_id text primary key,
  rsvp_id text not null,
  channel text not null check (channel in ('whatsapp')),
  action text not null check (action in ('cta_rendered', 'clicked')),
  occurred_at timestamptz not null default now()
);

create index if not exists idx_rsvp_records_event_guest
  on public.rsvp_records (event_slug, guest_id);

create index if not exists idx_rsvp_records_event_normalized_name
  on public.rsvp_records (event_slug, normalized_guest_name);

create index if not exists idx_rsvp_records_event_status
  on public.rsvp_records (event_slug, attendance_status);

create index if not exists idx_rsvp_records_updated_at
  on public.rsvp_records (last_updated_at desc);

create index if not exists idx_rsvp_records_event_updated_at
  on public.rsvp_records (event_slug, last_updated_at desc);

create index if not exists idx_rsvp_audit_rsvp_changed
  on public.rsvp_audit_log (rsvp_id, changed_at desc);

create index if not exists idx_rsvp_channel_rsvp_occurred
  on public.rsvp_channel_log (rsvp_id, occurred_at desc);

commit;
