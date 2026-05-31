-- Add soft-delete support for intake tables.
-- Follows the same pattern as the existing RSVP soft-delete (deleted_at + RPC).
-- Tables: invitation_projects, intake_requests, intake_submissions,
--         invitation_content_drafts, published_invitation_content

-- ============================================================================
-- 1. Add deleted_at columns
-- ============================================================================

alter table public.invitation_projects
  add column if not exists deleted_at timestamptz default null;

alter table public.intake_requests
  add column if not exists deleted_at timestamptz default null;

alter table public.intake_submissions
  add column if not exists deleted_at timestamptz default null;

alter table public.invitation_content_drafts
  add column if not exists deleted_at timestamptz default null;

alter table public.published_invitation_content
  add column if not exists deleted_at timestamptz default null;

-- ============================================================================
-- 2. Partial indexes for filtering active rows
-- ============================================================================

create index if not exists idx_invitation_projects_deleted_at
  on public.invitation_projects(deleted_at)
  where deleted_at is null;

create index if not exists idx_intake_requests_deleted_at
  on public.intake_requests(deleted_at)
  where deleted_at is null;

create index if not exists idx_intake_submissions_deleted_at
  on public.intake_submissions(deleted_at)
  where deleted_at is null;

create index if not exists idx_invitation_content_drafts_deleted_at
  on public.invitation_content_drafts(deleted_at)
  where deleted_at is null;

create index if not exists idx_published_invitation_content_deleted_at
  on public.published_invitation_content(deleted_at)
  where deleted_at is null;

-- ============================================================================
-- 3. RPC: soft_delete_invitation_project
-- Cascading soft-delete: project -> requests -> submissions -> drafts -> published
-- ============================================================================

create or replace function public.soft_delete_invitation_project(
  p_project_id uuid
) returns boolean
language plpgsql
security definer
as $$
declare
  v_project_exists boolean;
begin
  select exists(
    select 1 from public.invitation_projects
    where id = p_project_id and deleted_at is null
  ) into v_project_exists;

  if not v_project_exists then
    return false;
  end if;

  -- Soft-delete published content (no FK cascade, done explicitly)
  update public.published_invitation_content
  set deleted_at = now()
  where invitation_project_id = p_project_id and deleted_at is null;

  -- Soft-delete content drafts
  update public.invitation_content_drafts
  set deleted_at = now()
  where invitation_project_id = p_project_id and deleted_at is null;

  -- Soft-delete submissions via their requests
  update public.intake_submissions
  set deleted_at = now()
  where intake_request_id in (
    select id from public.intake_requests
    where invitation_project_id = p_project_id and deleted_at is null
  ) and deleted_at is null;

  -- Soft-delete intake requests
  update public.intake_requests
  set deleted_at = now()
  where invitation_project_id = p_project_id and deleted_at is null;

  -- Soft-delete the project itself
  update public.invitation_projects
  set deleted_at = now()
  where id = p_project_id;

  return true;
end;
$$;

-- ============================================================================
-- 4. RPC: restore_invitation_project
-- Restores cascading from project -> requests -> submissions -> drafts -> published
-- ============================================================================

create or replace function public.restore_invitation_project(
  p_project_id uuid
) returns boolean
language plpgsql
security definer
as $$
declare
  v_project_exists boolean;
begin
  select exists(
    select 1 from public.invitation_projects
    where id = p_project_id and deleted_at is not null
  ) into v_project_exists;

  if not v_project_exists then
    return false;
  end if;

  -- Restore project
  update public.invitation_projects
  set deleted_at = null
  where id = p_project_id;

  -- Restore requests
  update public.intake_requests
  set deleted_at = null
  where invitation_project_id = p_project_id and deleted_at is not null;

  -- Restore submissions
  update public.intake_submissions
  set deleted_at = null
  where intake_request_id in (
    select id from public.intake_requests
    where invitation_project_id = p_project_id
  ) and deleted_at is not null;

  -- Restore drafts
  update public.invitation_content_drafts
  set deleted_at = null
  where invitation_project_id = p_project_id and deleted_at is not null;

  -- Restore published content
  update public.published_invitation_content
  set deleted_at = null
  where invitation_project_id = p_project_id and deleted_at is not null;

  return true;
end;
$$;

-- ============================================================================
-- 5. Update RLS policies to exclude soft-deleted rows
-- ============================================================================

-- invitation_projects: exclude deleted
drop policy if exists "Admins can manage invitation projects"
  on public.invitation_projects;

create policy "Admins can manage invitation projects"
  on public.invitation_projects
  for all
  using (deleted_at is null and public.is_admin_user())
  with check (public.is_admin_user());

-- intake_requests: exclude deleted
drop policy if exists "Admins can manage intake requests"
  on public.intake_requests;

create policy "Admins can manage intake requests"
  on public.intake_requests
  for all
  using (deleted_at is null and public.is_admin_user())
  with check (public.is_admin_user());

-- intake_submissions: exclude deleted
drop policy if exists "Admins can manage intake submissions"
  on public.intake_submissions;

create policy "Admins can manage intake submissions"
  on public.intake_submissions
  for all
  using (deleted_at is null and public.is_admin_user())
  with check (public.is_admin_user());

-- invitation_content_drafts: exclude deleted
drop policy if exists "Admins can manage invitation content drafts"
  on public.invitation_content_drafts;

create policy "Admins can manage invitation content drafts"
  on public.invitation_content_drafts
  for all
  using (deleted_at is null and public.is_admin_user())
  with check (public.is_admin_user());

-- published_invitation_content: exclude deleted
drop policy if exists "Admins can manage published invitation content"
  on public.published_invitation_content;

create policy "Admins can manage published invitation content"
  on public.published_invitation_content
  for all
  using (deleted_at is null and public.is_admin_user())
  with check (public.is_admin_user());

-- ============================================================================
-- 6. Comments
-- ============================================================================

comment on column public.invitation_projects.deleted_at is
  'Timestamp de soft delete. NULL = activo';

comment on column public.intake_requests.deleted_at is
  'Timestamp de soft delete. NULL = activo';

comment on column public.intake_submissions.deleted_at is
  'Timestamp de soft delete. NULL = activo';

comment on column public.invitation_content_drafts.deleted_at is
  'Timestamp de soft delete. NULL = activo';

comment on column public.published_invitation_content.deleted_at is
  'Timestamp de soft delete. NULL = activo';
