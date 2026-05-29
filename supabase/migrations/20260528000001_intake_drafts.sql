-- Invitation content drafts
-- This migration adds the invitation_content_drafts table for storing generated
-- invitation draft content derived from approved intake submissions.
-- Phase 2.1: one active draft per invitation project.

-- ============================================================================
-- INVITATION CONTENT DRAFTS
-- ============================================================================

create table if not exists public.invitation_content_drafts (
  id uuid primary key default gen_random_uuid(),
  invitation_project_id uuid not null
    references public.invitation_projects(id) on delete cascade,
  submission_id uuid
    references public.intake_submissions(id),
  content jsonb not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'reviewed', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES AND CONSTRAINTS
-- ============================================================================

-- Fast lookup by project
create index if not exists idx_invitation_content_drafts_project
  on public.invitation_content_drafts (invitation_project_id);

-- Exactly one draft per invitation project (Phase 2.1 constraint)
create unique index if not exists idx_invitation_content_drafts_one_per_project
  on public.invitation_content_drafts (invitation_project_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

drop trigger if exists trg_invitation_content_drafts_touch_updated_at
  on public.invitation_content_drafts;
create trigger trg_invitation_content_drafts_touch_updated_at
  before update on public.invitation_content_drafts
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.invitation_content_drafts enable row level security;

create policy "Admins can manage invitation content drafts"
  on public.invitation_content_drafts
  for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table public.invitation_content_drafts is
  'Generated invitation draft content derived from approved intake submissions. One draft per invitation project.';
comment on column public.invitation_content_drafts.content is
  'Normalized invitation content compatible with event content schema. Mapped deterministically from intake block data.';
comment on column public.invitation_content_drafts.status is
  'draft = generated from submission, reviewed = admin has reviewed, approved = ready for publishing.';
