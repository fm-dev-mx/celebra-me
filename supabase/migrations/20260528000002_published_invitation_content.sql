-- Published invitation content
-- This migration adds the published_invitation_content table for storing
-- invitation content that has been approved and published from the draft workflow.
-- Phase 3.1: one published version per slug/event-type combination.

-- ============================================================================
-- PUBLISHED INVITATION CONTENT
-- ============================================================================

create table if not exists public.published_invitation_content (
  id uuid primary key default gen_random_uuid(),
  invitation_project_id uuid
    references public.invitation_projects(id),
  slug text not null unique,
  event_type text not null,
  is_demo boolean not null default false,
  content jsonb not null,
  version integer not null default 1,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES AND CONSTRAINTS
-- ============================================================================

-- Fast lookup by slug and event type
create index if not exists idx_published_invitation_content_slug
  on public.published_invitation_content (slug);

create index if not exists idx_published_invitation_content_event_type
  on public.published_invitation_content (event_type);

-- Lookup by project
create index if not exists idx_published_invitation_content_project
  on public.published_invitation_content (invitation_project_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

drop trigger if exists trg_published_invitation_content_touch_updated_at
  on public.published_invitation_content;
create trigger trg_published_invitation_content_touch_updated_at
  before update on public.published_invitation_content
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.published_invitation_content enable row level security;

-- Admins can manage published content
create policy "Admins can manage published invitation content"
  on public.published_invitation_content
  for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- Published content is readable by anyone (public access for invitation pages)
create policy "Anyone can read published invitation content"
  on public.published_invitation_content
  for select
  using (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table public.published_invitation_content is
  'Published invitation content derived from approved/edited drafts. Serves as the DB-driven source for public invitation rendering.';
comment on column public.published_invitation_content.content is
  'Full invitation content compatible with event content schema. Stored as jsonb for flexible schema evolution.';
comment on column public.published_invitation_content.version is
  'Version number incremented on each re-publish. Enables content versioning and cache busting.';
comment on column public.published_invitation_content.published_at is
  'Timestamp of the most recent publication.';
