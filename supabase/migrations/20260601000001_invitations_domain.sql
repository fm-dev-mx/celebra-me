-- Promote invitations to the primary production domain.
-- Child invitation_project_id columns intentionally remain in place for one
-- deployment cycle so the previous Vercel build can keep running through the
-- compatibility view. Rename them after the new application is verified.

begin;

drop view if exists public.deleted_invitation_projects;

alter table public.invitation_projects rename to invitations;
alter table public.invitations rename column deleted_at to archived_at;

alter table public.invitations
  add column if not exists kind text not null default 'client'
    check (kind in ('demo', 'client')),
  add column if not exists source_invitation_id uuid null
    references public.invitations(id) on delete set null;

alter index if exists public.idx_invitation_projects_deleted_at
  rename to idx_invitations_archived_at;

drop policy if exists "Admins can manage invitation projects"
  on public.invitations;

create policy "Admins can manage invitations"
  on public.invitations
  for all
  using (archived_at is null and public.is_admin_user())
  with check (public.is_admin_user());

-- The previous application build still uses invitation_projects and
-- deleted_at. This simple view remains updatable and is removed after rollout.
create view public.invitation_projects as
select
  id,
  slug,
  title,
  event_type,
  status,
  base_demo_id,
  theme_id,
  snapshot,
  client_name,
  client_email,
  client_whatsapp,
  photos_received,
  created_by,
  created_at,
  updated_at,
  archived_at as deleted_at
from public.invitations;

revoke all on public.invitation_projects from public, anon, authenticated;
grant select, insert, update, delete on public.invitation_projects to service_role;

create or replace function public.archive_invitation(
  p_invitation_id uuid
) returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_invitation_snapshot jsonb;
begin
  select to_jsonb(invitations.*) into v_invitation_snapshot
  from public.invitations
  where id = p_invitation_id and archived_at is null;

  if v_invitation_snapshot is null then
    return false;
  end if;

  update public.published_invitation_content
  set deleted_at = now()
  where invitation_project_id = p_invitation_id and deleted_at is null;

  update public.invitation_content_drafts
  set deleted_at = now()
  where invitation_project_id = p_invitation_id and deleted_at is null;

  update public.intake_submissions
  set deleted_at = now()
  where intake_request_id in (
    select id from public.intake_requests
    where invitation_project_id = p_invitation_id and deleted_at is null
  ) and deleted_at is null;

  update public.intake_requests
  set deleted_at = now()
  where invitation_project_id = p_invitation_id and deleted_at is null;

  update public.events
  set deleted_at = now(), status = 'archived'
  where invitation_project_id = p_invitation_id and deleted_at is null;

  update public.invitations
  set archived_at = now()
  where id = p_invitation_id;

  begin
    insert into public.audit_logs (actor_id, action, target_table, target_id, old_data)
    values (auth.uid(), 'archive_invitation', 'invitations', p_invitation_id, v_invitation_snapshot);
  exception when others then
    null;
  end;

  return true;
end;
$$;

create or replace function public.restore_invitation(
  p_invitation_id uuid
) returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_invitation_snapshot jsonb;
begin
  select to_jsonb(invitations.*) into v_invitation_snapshot
  from public.invitations
  where id = p_invitation_id and archived_at is not null;

  if v_invitation_snapshot is null then
    return false;
  end if;

  update public.invitations
  set archived_at = null
  where id = p_invitation_id;

  update public.intake_requests
  set deleted_at = null
  where invitation_project_id = p_invitation_id and deleted_at is not null;

  update public.intake_submissions
  set deleted_at = null
  where intake_request_id in (
    select id from public.intake_requests
    where invitation_project_id = p_invitation_id
  ) and deleted_at is not null;

  update public.invitation_content_drafts
  set deleted_at = null
  where invitation_project_id = p_invitation_id and deleted_at is not null;

  update public.published_invitation_content
  set deleted_at = null
  where invitation_project_id = p_invitation_id and deleted_at is not null;

  update public.events
  set deleted_at = null,
      status = case
        when exists (
          select 1 from public.published_invitation_content
          where invitation_project_id = p_invitation_id and deleted_at is null
        ) then 'published'
        else status
      end
  where invitation_project_id = p_invitation_id and deleted_at is not null;

  begin
    insert into public.audit_logs (actor_id, action, target_table, target_id, new_data)
    values (
      auth.uid(),
      'restore_invitation',
      'invitations',
      p_invitation_id,
      jsonb_build_object('restored_at', now())
    );
  exception when others then
    null;
  end;

  return true;
end;
$$;

create or replace function public.permanently_delete_invitation(
  p_invitation_id uuid
) returns text
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_invitation_snapshot jsonb;
  v_event_id uuid;
begin
  select to_jsonb(invitations.*) into v_invitation_snapshot
  from public.invitations
  where id = p_invitation_id and archived_at is not null;

  if v_invitation_snapshot is null then
    return 'not_found';
  end if;

  select id into v_event_id
  from public.events
  where invitation_project_id = p_invitation_id
  limit 1;

  if v_event_id is not null and (
    exists (select 1 from public.guest_invitations where event_id = v_event_id)
    or exists (select 1 from public.event_claim_codes where event_id = v_event_id)
    or exists (select 1 from public.event_memberships where event_id = v_event_id)
  ) then
    return 'blocked_rsvp_history';
  end if;

  begin
    insert into public.audit_logs (actor_id, action, target_table, target_id, old_data)
    values (
      auth.uid(),
      'permanently_delete_invitation',
      'invitations',
      p_invitation_id,
      v_invitation_snapshot
    );
  exception when others then
    null;
  end;

  delete from public.events where id = v_event_id;
  delete from public.published_invitation_content where invitation_project_id = p_invitation_id;
  delete from public.invitation_content_drafts where invitation_project_id = p_invitation_id;
  delete from public.intake_submissions
  where intake_request_id in (
    select id from public.intake_requests where invitation_project_id = p_invitation_id
  );
  delete from public.intake_requests where invitation_project_id = p_invitation_id;
  delete from public.invitations where id = p_invitation_id;

  return 'deleted';
end;
$$;

revoke execute on function public.archive_invitation from public, anon, authenticated;
grant execute on function public.archive_invitation to service_role;

revoke execute on function public.restore_invitation from public, anon, authenticated;
grant execute on function public.restore_invitation to service_role;

revoke execute on function public.permanently_delete_invitation from public, anon, authenticated;
grant execute on function public.permanently_delete_invitation to service_role;

create or replace view public.archived_invitations as
select
  i.*,
  (select count(*) from public.intake_requests ir where ir.invitation_project_id = i.id) as request_count,
  (select count(*) from public.intake_submissions s where s.intake_request_id in (
    select id from public.intake_requests where invitation_project_id = i.id
  )) as submission_count
from public.invitations i
where i.archived_at is not null
order by i.archived_at desc;

revoke all on public.archived_invitations from public, anon, authenticated;
grant select on public.archived_invitations to service_role;

comment on table public.invitations is
  'Editable invitations. kind distinguishes demo records from client invitations.';
comment on column public.invitations.kind is
  'Invitation behavior: demo publishes without RSVP; client publishes with RSVP synchronization.';
comment on column public.invitations.source_invitation_id is
  'Optional source demo invitation used to create this client invitation.';
comment on column public.invitations.archived_at is
  'Archive timestamp. NULL means the invitation is active.';
comment on view public.invitation_projects is
  'Temporary rollout compatibility view. Remove after the new Vercel build is verified.';

commit;
