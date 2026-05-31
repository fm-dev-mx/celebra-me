-- Add soft-delete support for intake tables.
-- Follows the same pattern as the existing RSVP soft-delete (deleted_at + RPC).
-- Tables: invitation_projects, intake_requests, intake_submissions,
--         invitation_content_drafts, published_invitation_content

begin;

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
--    HARDENED: set search_path prevents schema injection
--    HARDENED: audit log for traceability
--    HARDENED: permission locked to service_role only
-- ============================================================================

create or replace function public.soft_delete_invitation_project(
  p_project_id uuid
) returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_project_snapshot jsonb;
begin
  select to_jsonb(invitation_projects.*) into v_project_snapshot
  from public.invitation_projects
  where id = p_project_id and deleted_at is null;

  if v_project_snapshot is null then
    return false;
  end if;

  -- Soft-delete published content
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

  -- Audit trail (best-effort: auth.uid() is null with service_role)
  begin
    insert into public.audit_logs (actor_id, action, target_table, target_id, old_data)
    values (auth.uid(), 'soft_delete_invitation_project', 'invitation_projects', p_project_id, v_project_snapshot);
  exception when others then
    null;
  end;

  return true;
end;
$$;

-- ============================================================================
-- 4. RPC: restore_invitation_project
--    HARDENED: set search_path prevents schema injection
--    HARDENED: audit log for traceability
--    HARDENED: permission locked to service_role only
-- ============================================================================

create or replace function public.restore_invitation_project(
  p_project_id uuid
) returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_project_snapshot jsonb;
begin
  select to_jsonb(invitation_projects.*) into v_project_snapshot
  from public.invitation_projects
  where id = p_project_id and deleted_at is not null;

  if v_project_snapshot is null then
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

  -- Audit trail (best-effort: auth.uid() is null with service_role)
  begin
    insert into public.audit_logs (actor_id, action, target_table, target_id, new_data)
    values (auth.uid(), 'restore_invitation_project', 'invitation_projects', p_project_id, jsonb_build_object('restored_at', now()));
  exception when others then
    null;
  end;

  return true;
end;
$$;

-- ============================================================================
-- 5. Permission management: lock down RPCs to service_role only
-- ============================================================================

revoke execute on function public.soft_delete_invitation_project from public, anon, authenticated;
grant execute on function public.soft_delete_invitation_project to service_role;

revoke execute on function public.restore_invitation_project from public, anon, authenticated;
grant execute on function public.restore_invitation_project to service_role;

-- ============================================================================
-- 6. Update RLS policies to exclude soft-deleted rows
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

-- published_invitation_content: admin policy excludes deleted
drop policy if exists "Admins can manage published invitation content"
  on public.published_invitation_content;

create policy "Admins can manage published invitation content"
  on public.published_invitation_content
  for all
  using (deleted_at is null and public.is_admin_user())
  with check (public.is_admin_user());

-- published_invitation_content: public read policy also excludes deleted
-- Soft-deleting a project intentionally makes its public invitation page return 404.
-- The app's content resolver (content-resolver.ts) will fall through to static demos,
-- which only serve isDemo: true entries — real client pages get a 404.
drop policy if exists "Anyone can read published invitation content"
  on public.published_invitation_content;

create policy "Anyone can read published invitation content"
  on public.published_invitation_content
  for select
  using (deleted_at is null);

-- ============================================================================
-- 7. View for listing deleted projects (trash/papelera)
--    HARDENED: locked to service_role only — no anon/authenticated access
-- ============================================================================

create or replace view public.deleted_invitation_projects as
select
  ip.id,
  ip.title,
  ip.slug,
  ip.event_type,
  ip.status,
  ip.client_name,
  ip.client_email,
  ip.client_whatsapp,
  ip.deleted_at,
  ip.created_at,
  (select count(*) from public.intake_requests ir where ir.invitation_project_id = ip.id) as request_count,
  (select count(*) from public.intake_submissions s where s.intake_request_id in (
    select id from public.intake_requests where invitation_project_id = ip.id
  )) as submission_count
from public.invitation_projects ip
where ip.deleted_at is not null
order by ip.deleted_at desc;

-- Lock the view: only service_role can read it
revoke all on public.deleted_invitation_projects from public, anon, authenticated;
grant select on public.deleted_invitation_projects to service_role;

comment on view public.deleted_invitation_projects is
  'Projects in the trash. Accessible only via service_role.';

-- ============================================================================
-- 8. Comments
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

comment on function public.soft_delete_invitation_project is
  'Cascading soft-delete for an invitation project and all related intake data. Only callable by service_role.';

comment on function public.restore_invitation_project is
  'Cascading restore of a soft-deleted invitation project and all related intake data. Only callable by service_role.';

commit;
