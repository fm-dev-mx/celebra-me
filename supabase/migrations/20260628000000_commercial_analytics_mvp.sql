-- Commercial analytics MVP.
--
-- First-party commercial tracking is stored separately from RSVP/guest
-- operations. Browser clients never write directly to these tables; API routes
-- validate and persist through the service role.

begin;

create table if not exists public.visitor_sessions (
  id uuid primary key,
  visitor_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  last_seen_at timestamptz not null default now(),
  landing_path text not null default '/',
  referrer text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  utm_content text null,
  utm_term text null,
  device_type text null,
  route_class text not null
    check (route_class in (
      'commercial',
      'demo',
      'real_invitation',
      'personalized_invitation',
      'rsvp_guest_api',
      'dashboard_admin_auth',
      'generic_api',
      'unknown'
    )),
  is_internal boolean not null default false,
  consent_snapshot jsonb not null default '{"necessary":true,"analytics":false,"marketing":false}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid null references public.visitor_sessions(id) on delete set null,
  visitor_id text not null,
  event_name text not null
    check (event_name in (
      'page_viewed',
      'session_started',
      'session_ended',
      'section_seen',
      'scroll_depth_reached',
      'cta_clicked',
      'package_viewed',
      'demo_viewed',
      'whatsapp_contact_clicked',
      'form_started',
      'form_submitted',
      'lead_created',
      'quote_sent',
      'production_authorized',
      'production_started',
      'preview_delivered',
      'payment_pending',
      'payment_received',
      'invitation_activated',
      'converted_to_demo',
      'lost'
    )),
  occurred_at timestamptz not null default now(),
  route_path text not null,
  route_class text not null
    check (route_class in (
      'commercial',
      'demo',
      'real_invitation',
      'personalized_invitation',
      'rsvp_guest_api',
      'dashboard_admin_auth',
      'generic_api',
      'unknown'
    )),
  source text null,
  medium text null,
  campaign text null,
  event_properties jsonb not null default '{}'::jsonb,
  consent_snapshot jsonb not null default '{"necessary":true,"analytics":false,"marketing":false}'::jsonb,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_code text not null unique,
  session_id uuid null references public.visitor_sessions(id) on delete set null,
  source_event_id uuid null references public.tracking_events(id) on delete set null,
  channel text not null default 'contact_form'
    check (channel in ('contact_form', 'whatsapp', 'manual')),
  status text not null default 'new'
    check (status in (
      'new',
      'contacted',
      'quoted',
      'production_authorized',
      'paid',
      'converted_to_demo',
      'lost',
      'spam'
    )),
  name text null,
  email text null,
  phone text null,
  event_type text null,
  package_interest text null,
  message_summary text null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  consent_contact boolean not null default true,
  consent_marketing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_visitor_sessions_visitor_id
  on public.visitor_sessions (visitor_id);

create index if not exists idx_visitor_sessions_last_seen_at
  on public.visitor_sessions (last_seen_at desc);

create index if not exists idx_visitor_sessions_route_class
  on public.visitor_sessions (route_class, last_seen_at desc);

create index if not exists idx_tracking_events_session_id
  on public.tracking_events (session_id);

create index if not exists idx_tracking_events_event_name_occurred_at
  on public.tracking_events (event_name, occurred_at desc);

create index if not exists idx_tracking_events_route_class_occurred_at
  on public.tracking_events (route_class, occurred_at desc);

create index if not exists idx_tracking_events_campaign
  on public.tracking_events (source, medium, campaign);

create index if not exists idx_leads_status_created_at
  on public.leads (status, created_at desc);

create index if not exists idx_leads_session_id
  on public.leads (session_id);

drop trigger if exists trg_leads_touch_updated_at on public.leads;
create trigger trg_leads_touch_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at();

alter table public.visitor_sessions enable row level security;
alter table public.tracking_events enable row level security;
alter table public.leads enable row level security;

alter table public.visitor_sessions force row level security;
alter table public.tracking_events force row level security;
alter table public.leads force row level security;

drop policy if exists visitor_sessions_service_role_full_access on public.visitor_sessions;
create policy visitor_sessions_service_role_full_access
  on public.visitor_sessions
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists tracking_events_service_role_full_access on public.tracking_events;
create policy tracking_events_service_role_full_access
  on public.tracking_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists leads_service_role_full_access on public.leads;
create policy leads_service_role_full_access
  on public.leads
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.visitor_sessions to service_role;
grant select, insert, update, delete on public.tracking_events to service_role;
grant select, insert, update, delete on public.leads to service_role;

comment on table public.visitor_sessions is
  'Anonymous first-party commercial sessions. Does not store guest RSVP operations.';

comment on table public.tracking_events is
  'PII-safe first-party commercial analytics events written only through server APIs.';

comment on table public.leads is
  'Commercial leads created from contact forms or manual WhatsApp reconciliation. PII is only read server-side behind dashboard auth.';

comment on column public.leads.lead_code is
  'Human-friendly attribution code used to connect campaign, CTA, WhatsApp/contact intent, and lead creation.';

commit;
