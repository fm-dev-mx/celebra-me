-- Retire host self-registration (claim codes) and the client capture form (intake requests and
-- submissions). The application no longer reads or writes these objects.
--
-- Data: export event_claim_codes, intake_requests and intake_submissions before applying to a
-- hosted target. invitation_content_drafts.submission_id stays as an always-null legacy column
-- because the publication RPCs still name it; only its foreign key goes away.

-- 1. Dependents that would break once the tables are gone ----------------------------------------

drop view if exists public.archived_invitations;

-- No caller remains; the two project variants already pointed at the renamed invitation_projects.
drop function if exists public.soft_delete_event(uuid, uuid);
drop function if exists public.restore_event(uuid, uuid);
drop function if exists public.soft_delete_invitation_project(uuid);
drop function if exists public.restore_invitation_project(uuid);

drop function if exists public.redeem_claim_code(uuid, text);
drop function if exists public.submit_intake_request_once(uuid, uuid, uuid, text);

create or replace function public.permanently_delete_invitation(p_invitation_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  delete from public.invitations where id = p_invitation_id;

  return 'deleted';
end;
$function$;

create or replace function public.deactivate_invitation_dependents(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.published_invitation_content
  set deleted_at = coalesce(deleted_at, now())
  where invitation_project_id = p_invitation_id
    and deleted_at is null;

  update public.invitation_content_drafts
  set deleted_at = coalesce(deleted_at, now())
  where invitation_project_id = p_invitation_id
    and deleted_at is null;

  update public.events
  set deleted_at = coalesce(deleted_at, now()),
      status = 'archived'
  where invitation_project_id = p_invitation_id
    and deleted_at is null;
end;
$function$;

create or replace function public.enforce_invitation_archive_cascade()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_active_events int;
  v_active_published int;
  v_active_drafts int;
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

  if v_active_events <> 0 or v_active_published <> 0 or v_active_drafts <> 0 then
    raise exception
      'ARCHIVE_CASCADE_INCOMPLETE: invitation % still has active dependents (events=%, published=%, drafts=%)',
      new.id, v_active_events, v_active_published, v_active_drafts
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

create or replace function public.restore_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
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
$function$;

create or replace function public.reject_active_child_of_archived_invitation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_archived_at timestamptz;
  v_invitation_id uuid;
begin
  v_invitation_id := new.invitation_project_id;
  if v_invitation_id is null then
    return new;
  end if;

  -- Only enforce for rows that are (becoming) active.
  if tg_table_name in (
    'events',
    'published_invitation_content',
    'invitation_content_drafts'
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
$function$;

-- 2. Tables ------------------------------------------------------------------------------------

alter table public.invitation_content_drafts
  drop constraint if exists invitation_content_drafts_submission_id_fkey;

drop table if exists public.intake_submissions;
drop table if exists public.intake_requests;
drop table if exists public.event_claim_codes;

drop function if exists public.reject_active_intake_submission_of_archived_invitation();
drop function if exists public.sync_event_claim_code_key();

-- 3. Capture statuses are no longer reachable ---------------------------------------------------

do $$
begin
  if exists (
    select 1 from public.invitations
    where status in ('waiting_for_client', 'client_submitted', 'in_review')
  ) then
    raise exception 'CAPTURE_STATUS_IN_USE: an invitation still uses a capture status'
      using errcode = 'check_violation';
  end if;
end $$;

do $$
declare
  v_constraint text;
begin
  select c.conname into v_constraint
  from pg_constraint c
  where c.conrelid = 'public.invitations'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%waiting_for_client%';
  if v_constraint is not null then
    execute format('alter table public.invitations drop constraint %I', v_constraint);
  end if;
end $$;

alter table public.invitations
  add constraint invitations_status_check
  check (status in ('draft', 'in_production', 'preview_sent', 'approved', 'published', 'archived'));
