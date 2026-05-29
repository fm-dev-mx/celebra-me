-- Intake system core tables
-- This migration adds the client intake flow tables without modifying existing RSVP tables.

-- ============================================================================
-- IDEMPOTENT HELPER FUNCTION
-- ============================================================================

-- touch_updated_at() already exists from 20260215000300_rsvp_v2_core.sql
-- We recreate it idempotently to ensure it's available in all environments.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- ============================================================================
-- INVITATION PROJECTS
-- ============================================================================

create table if not exists public.invitation_projects (
  id uuid primary key default gen_random_uuid(),
  slug text null unique,
  title text not null,
  event_type text not null
    check (event_type in ('xv', 'boda', 'bautizo', 'cumple')),
  status text not null default 'draft'
    check (status in (
      'draft', 'waiting_for_client', 'client_submitted',
      'in_review', 'in_production', 'preview_sent',
      'approved', 'published', 'archived'
    )),
  base_demo_id text not null,
  theme_id text not null,
  snapshot jsonb not null default '{}',
  client_name text not null default '',
  client_email text not null default '',
  client_whatsapp text not null default '',
  photos_received boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- INTAKE REQUESTS
-- ============================================================================

create table if not exists public.intake_requests (
  id uuid primary key default gen_random_uuid(),
  invitation_project_id uuid not null
    references public.invitation_projects(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'submitted', 'closed', 'expired')),
  enabled_blocks jsonb not null default '[]',
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- INTAKE SUBMISSIONS
-- ============================================================================

create table if not exists public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  intake_request_id uuid not null
    references public.intake_requests(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'submitted', 'needs_changes', 'approved')),
  block_data jsonb not null default '{}',
  photo_notes jsonb not null default '{}',
  client_comments text not null default '',
  submitted_at timestamptz null,
  reviewed_at timestamptz null,
  review_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists idx_invitation_projects_status
  on public.invitation_projects (status);

create index if not exists idx_invitation_projects_created_by
  on public.invitation_projects (created_by);

create index if not exists idx_invitation_projects_slug
  on public.invitation_projects (slug) where slug is not null;

create index if not exists idx_intake_requests_invitation_project_id
  on public.intake_requests (invitation_project_id);

create index if not exists idx_intake_requests_token_hash
  on public.intake_requests (token_hash);

create index if not exists idx_intake_requests_status
  on public.intake_requests (status);

create index if not exists idx_intake_submissions_intake_request_id
  on public.intake_submissions (intake_request_id);

create index if not exists idx_intake_submissions_status
  on public.intake_submissions (status);

-- Ensure exactly one submission per request (MVP: no revision history).
-- The submission row transitions through statuses: in_progress → submitted → needs_changes → submitted → approved
create unique index if not exists idx_intake_submissions_one_per_request
  on public.intake_submissions (intake_request_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

drop trigger if exists trg_invitation_projects_touch_updated_at
  on public.invitation_projects;
create trigger trg_invitation_projects_touch_updated_at
  before update on public.invitation_projects
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_intake_requests_touch_updated_at
  on public.intake_requests;
create trigger trg_intake_requests_touch_updated_at
  before update on public.intake_requests
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_intake_submissions_touch_updated_at
  on public.intake_submissions;
create trigger trg_intake_submissions_touch_updated_at
  before update on public.intake_submissions
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
alter table public.invitation_projects enable row level security;
alter table public.intake_requests enable row level security;
alter table public.intake_submissions enable row level security;

-- Helper function to check if user is admin
-- (reuses pattern from existing RLS policies)
create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.app_user_roles
    where user_id = auth.uid()
    and role = 'super_admin'
  );
$$;

-- ============================================================================
-- INVITATION PROJECTS POLICIES
-- ============================================================================

-- Admins can do everything
create policy "Admins can manage invitation projects"
  on public.invitation_projects
  for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ============================================================================
-- INTAKE REQUESTS POLICIES
-- ============================================================================

-- Admins can do everything
create policy "Admins can manage intake requests"
  on public.intake_requests
  for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ============================================================================
-- INTAKE SUBMISSIONS POLICIES
-- ============================================================================

-- Admins can do everything
create policy "Admins can manage intake submissions"
  on public.intake_submissions
  for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table public.invitation_projects is
  'Client invitation projects created by admins. Tracks the workflow from creation to publication.';

comment on table public.intake_requests is
  'Configuration for client intake forms. Each request has a unique token_hash for secure access.';

comment on table public.intake_submissions is
  'Client submissions for intake forms. Exactly one submission per request (MVP: no revision history). Status transitions: in_progress → submitted → needs_changes → submitted → approved.';

comment on column public.invitation_projects.slug is
  'Optional slug for future DB-driven rendering. Unique when provided.';

comment on column public.invitation_projects.client_whatsapp is
  'Client WhatsApp contact for photo collection and communication.';

comment on column public.invitation_projects.photos_received is
  'Admin-tracked flag indicating whether WhatsApp photos have been received.';

comment on column public.intake_requests.token_hash is
  'SHA-256 hash of the intake token. Raw token is never stored.';

comment on column public.invitation_projects.snapshot is
  'DemoPreset snapshot at creation time. Decouples from future catalog changes.';
