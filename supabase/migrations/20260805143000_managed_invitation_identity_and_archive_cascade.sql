-- Expand: immutable managed invitation identity + archive cascade enforcement.
-- Identity is independent of slug/title/client_name. Archive must deactivate dependents.

begin;

-- ---------------------------------------------------------------------------
-- 1) Immutable managed identity on invitations + provenance
-- ---------------------------------------------------------------------------

alter table public.invitations
  add column if not exists managed_identity_id uuid;

comment on column public.invitations.managed_identity_id is
  'Immutable managed invitation identity. Independent of slug, title, and client_name. Null for unmanaged/legacy rows.';

create unique index if not exists invitations_managed_identity_id_uidx
  on public.invitations (managed_identity_id)
  where managed_identity_id is not null;

alter table public.managed_invitation_release_provenance
  add column if not exists managed_identity_id uuid,
  add column if not exists previous_slugs text[] not null default '{}'::text[];

comment on column public.managed_invitation_release_provenance.managed_identity_id is
  'Immutable managed invitation identity recorded on successful managed apply. Never updated after first set.';

comment on column public.managed_invitation_release_provenance.previous_slugs is
  'Definition-declared historical slugs for alias diagnostics and rekey collision detection.';

create unique index if not exists managed_provenance_managed_identity_id_uidx
  on public.managed_invitation_release_provenance (managed_identity_id)
  where managed_identity_id is not null;

-- Keep invitation.managed_identity_id aligned with provenance when present.
create or replace function public.sync_invitation_managed_identity_from_provenance()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if new.managed_identity_id is null then
    return new;
  end if;

  -- Immutable once set on provenance.
  if tg_op = 'UPDATE'
     and old.managed_identity_id is not null
     and new.managed_identity_id is distinct from old.managed_identity_id then
    raise exception 'MANAGED_IDENTITY_IMMUTABLE: managed_identity_id cannot change on provenance for invitation %',
      new.invitation_id
      using errcode = 'check_violation';
  end if;

  update public.invitations i
  set managed_identity_id = new.managed_identity_id
  where i.id = new.invitation_id
    and i.managed_identity_id is distinct from new.managed_identity_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_invitation_managed_identity
  on public.managed_invitation_release_provenance;

create trigger trg_sync_invitation_managed_identity
  after insert or update of managed_identity_id
  on public.managed_invitation_release_provenance
  for each row
  execute function public.sync_invitation_managed_identity_from_provenance();

-- Reject direct mutation of invitations.managed_identity_id once set.
create or replace function public.reject_invitation_managed_identity_mutation()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if tg_op = 'UPDATE'
     and old.managed_identity_id is not null
     and new.managed_identity_id is distinct from old.managed_identity_id then
    raise exception 'MANAGED_IDENTITY_IMMUTABLE: invitations.managed_identity_id cannot change for %',
      old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_invitation_managed_identity_mutation
  on public.invitations;

create trigger trg_reject_invitation_managed_identity_mutation
  before update of managed_identity_id
  on public.invitations
  for each row
  execute function public.reject_invitation_managed_identity_mutation();

-- ---------------------------------------------------------------------------
-- 2) Archive cascade: any path that sets archived_at deactivates dependents
-- ---------------------------------------------------------------------------

create or replace function public.deactivate_invitation_dependents(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  update public.published_invitation_content
  set deleted_at = coalesce(deleted_at, now())
  where invitation_project_id = p_invitation_id
    and deleted_at is null;

  update public.invitation_content_drafts
  set deleted_at = coalesce(deleted_at, now())
  where invitation_project_id = p_invitation_id
    and deleted_at is null;

  update public.intake_submissions
  set deleted_at = coalesce(deleted_at, now())
  where intake_request_id in (
    select id from public.intake_requests
    where invitation_project_id = p_invitation_id
  )
    and deleted_at is null;

  update public.intake_requests
  set deleted_at = coalesce(deleted_at, now())
  where invitation_project_id = p_invitation_id
    and deleted_at is null;

  update public.events
  set deleted_at = coalesce(deleted_at, now()),
      status = 'archived'
  where invitation_project_id = p_invitation_id
    and deleted_at is null;
end;
$$;

create or replace function public.enforce_invitation_archive_cascade()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_active_events int;
  v_active_published int;
  v_active_drafts int;
  v_active_requests int;
  v_active_submissions int;
begin
  if new.archived_at is null or (old.archived_at is not null) then
    return new;
  end if;

  perform public.deactivate_invitation_dependents(new.id);

  select count(*) into v_active_events
  from public.events
  where invitation_project_id = new.id and deleted_at is null;

  select count(*) into v_active_published
  from public.published_invitation_content
  where invitation_project_id = new.id and deleted_at is null;

  select count(*) into v_active_drafts
  from public.invitation_content_drafts
  where invitation_project_id = new.id and deleted_at is null;

  select count(*) into v_active_requests
  from public.intake_requests
  where invitation_project_id = new.id and deleted_at is null;

  select count(*) into v_active_submissions
  from public.intake_submissions s
  where s.deleted_at is null
    and s.intake_request_id in (
      select r.id from public.intake_requests r
      where r.invitation_project_id = new.id
    );

  if v_active_events <> 0
     or v_active_published <> 0
     or v_active_drafts <> 0
     or v_active_requests <> 0
     or v_active_submissions <> 0 then
    raise exception
      'ARCHIVE_CASCADE_INCOMPLETE: invitation % still has active dependents (events=%, published=%, drafts=%, intake_requests=%, intake_submissions=%)',
      new.id, v_active_events, v_active_published, v_active_drafts, v_active_requests, v_active_submissions
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_invitation_archive_cascade on public.invitations;

create trigger trg_enforce_invitation_archive_cascade
  after update of archived_at
  on public.invitations
  for each row
  when (new.archived_at is not null and old.archived_at is null)
  execute function public.enforce_invitation_archive_cascade();

-- Block reactivation of dependents while parent remains archived.
create or replace function public.reject_active_child_of_archived_invitation()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_archived_at timestamptz;
  v_invitation_id uuid;
begin
  v_invitation_id := new.invitation_project_id;
  if v_invitation_id is null then
    return new;
  end if;

  -- Only enforce for rows that are (becoming) active.
  if tg_table_name = 'events' then
    if new.deleted_at is not null then
      return new;
    end if;
  elsif tg_table_name in (
    'published_invitation_content',
    'invitation_content_drafts',
    'intake_requests'
  ) then
    if new.deleted_at is not null then
      return new;
    end if;
  end if;

  select archived_at into v_archived_at
  from public.invitations
  where id = v_invitation_id;

  if v_archived_at is not null then
    raise exception
      'ARCHIVED_PARENT_ACTIVE_CHILD: cannot activate % for archived invitation %',
      tg_table_name, v_invitation_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reject_active_event_of_archived_invitation on public.events;
create trigger trg_reject_active_event_of_archived_invitation
  before insert or update of deleted_at, invitation_project_id
  on public.events
  for each row
  execute function public.reject_active_child_of_archived_invitation();

drop trigger if exists trg_reject_active_published_of_archived_invitation
  on public.published_invitation_content;
create trigger trg_reject_active_published_of_archived_invitation
  before insert or update of deleted_at, invitation_project_id
  on public.published_invitation_content
  for each row
  execute function public.reject_active_child_of_archived_invitation();

drop trigger if exists trg_reject_active_draft_of_archived_invitation
  on public.invitation_content_drafts;
create trigger trg_reject_active_draft_of_archived_invitation
  before insert or update of deleted_at, invitation_project_id
  on public.invitation_content_drafts
  for each row
  execute function public.reject_active_child_of_archived_invitation();

drop trigger if exists trg_reject_active_intake_of_archived_invitation
  on public.intake_requests;
create trigger trg_reject_active_intake_of_archived_invitation
  before insert or update of deleted_at, invitation_project_id
  on public.intake_requests
  for each row
  execute function public.reject_active_child_of_archived_invitation();

-- intake_submissions link through intake_request_id, not invitation_project_id.
create or replace function public.reject_active_intake_submission_of_archived_invitation()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_archived_at timestamptz;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  select i.archived_at into v_archived_at
  from public.intake_requests r
  join public.invitations i on i.id = r.invitation_project_id
  where r.id = new.intake_request_id;

  if v_archived_at is not null then
    raise exception
      'ARCHIVED_PARENT_ACTIVE_CHILD: cannot activate intake_submissions for archived invitation (request %)',
      new.intake_request_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reject_active_intake_submission_of_archived_invitation
  on public.intake_submissions;
create trigger trg_reject_active_intake_submission_of_archived_invitation
  before insert or update of deleted_at, intake_request_id
  on public.intake_submissions
  for each row
  execute function public.reject_active_intake_submission_of_archived_invitation();

-- Keep archive_invitation RPC, but share the cascade helper for one code path.
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

  -- Setting archived_at fires trg_enforce_invitation_archive_cascade.
  update public.invitations
  set archived_at = now()
  where id = p_invitation_id
    and archived_at is null;

  begin
    insert into public.audit_logs (actor_id, action, target_table, target_id, old_data)
    values (auth.uid(), 'archive_invitation', 'invitations', p_invitation_id, v_invitation_snapshot);
  exception when others then
    null;
  end;

  return true;
end;
$$;

revoke execute on function public.deactivate_invitation_dependents(uuid) from public, anon, authenticated;
grant execute on function public.deactivate_invitation_dependents(uuid) to service_role;

revoke execute on function public.archive_invitation(uuid) from public, anon, authenticated;
grant execute on function public.archive_invitation(uuid) to service_role;

-- One-time repair for rows archived before cascade enforcement existed.
do $$
declare
  r record;
begin
  for r in
    select id from public.invitations where archived_at is not null
  loop
    perform public.deactivate_invitation_dependents(r.id);
  end loop;
end $$;

commit;
